import sys
import json
import hashlib
from datetime import datetime
import os
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

LEDGER_FILE = "ledger.json"

def load_json(filepath):
    if not os.path.exists(filepath):
        return {}
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def update_supabase(address, amount_atom=None, nonce=None, **kwargs):
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[SKIP] Supabase env missing. Skipping DB sync.")
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    query_url = f"{url}/rest/v1/profiles?wallet_address=eq.{address.lower()}"
    resp = requests.get(query_url, headers=headers)
    profiles = resp.json()
    
    if profiles:
        pid = profiles[0]['id']
        update_url = f"{url}/rest/v1/profiles?id=eq.{pid}"
        payload = {}
        if amount_atom is not None:
            payload["total_accumulated"] = str(amount_atom)
        if nonce is not None:
            payload["last_nonce"] = int(nonce)
        if "staked_amount" in kwargs:
            payload["staked_amount"] = str(kwargs["staked_amount"])

            
        if payload:
            requests.patch(update_url, headers=headers, json=payload)
            print(f"[CLOUD] Supabase synchronized for {address} (Data: {payload})")

def process_transaction(payload_str):
    try:
        data = json.loads(payload_str)
    except Exception as e:
        print(f"[ERROR] Invalid payload JSON: {e}")
        return

    op = data.get("op", "transfer")
    tx = data.get("tx")
    signature = data.get("signature")
    
    if not tx or not signature:
        print("[ERROR] Missing tx or signature")
        return
        
    try:
        from_address = tx.get("from_address") or tx.get("address")
        if not from_address:
            print("[ERROR] Missing address in tx")
            return
            
        ledger = load_json(LEDGER_FILE)
        nonces = ledger.setdefault("nonces", {})
        
        # 🌟 Replay Protection & Signature Logic
        if op == "sync_legacy":
            # Sync doesn't use nonce to allow mass onboarding from old ledger
            amount_atom = int(tx.get("amount", 0))
            message_str = f"SYNC_LEGACY:{amount_atom}"
        else:
            expected_nonce = int(nonces.get(from_address, "0")) + 1
            signed_nonce = int(tx.get("nonce", 0))
            amount_atom = int(tx.get("amount_atom", 0))
            
            if op == "transfer":
                to_address = tx.get("to_address")
                message_str = f"AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}"
            else:
                message_str = f"AUR_{op.upper()}:{signed_nonce}:{from_address}:{amount_atom}"

            if signed_nonce != expected_nonce:
                print(f"[ERROR] Invalid nonce. Expected {expected_nonce}, got {signed_nonce}")
                return
            
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address.lower():
            print("[ERROR] Invalid digital signature")
            return
            
    except Exception as e:
        print(f"[ERROR] Signature verification failed: {e}")
        return
        
    if amount_atom <= 0:
        print("[ERROR] Invalid amount")
        return
        
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    
    if op == "sync_legacy":
        # Force set balance to the verified legacy amount
        balances[from_address] = str(amount_atom)
        update_supabase(from_address, amount_atom)
        new_event = {
            "id": f"sync-{datetime.utcnow().timestamp()}",
            "event_type": "LEGACY_SYNC",
            "address": from_address,
            "amount_atom": str(amount_atom),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "cloud_validated": True
        }
    else:
        # Update nonce for standard ops
        nonces[from_address] = str(signed_nonce)
        update_supabase(from_address, nonce=signed_nonce)
        liq_bal = int(balances.get(from_address, "0"))
        
        if op == "transfer":
            to_address = tx.get("to_address")
            if liq_bal < amount_atom:
                print("[ERROR] Insufficient balance")
                return
            burn_penalty = max(1, amount_atom // 100) if amount_atom >= 100 else 0
            receive_amount = amount_atom - burn_penalty
            balances[from_address] = str(liq_bal - amount_atom)
            to_balance = int(balances.get(to_address, "0"))
            balances[to_address] = str(to_balance + receive_amount)
            total_supply = int(ledger.get("total_supply", "0"))
            ledger["total_supply"] = str(total_supply - burn_penalty)
            new_event = {"id": f"tx-{datetime.utcnow().timestamp()}", "event_type": "transfer", "from_address": from_address, "to_address": to_address, "amount_atom": str(amount_atom), "burn_penalty": str(burn_penalty), "created_at": datetime.utcnow().isoformat() + "Z", "cloud_validated": True}
        elif op in ["stake", "unstake"]:
            stk_bal = int(staked.get(from_address, "0"))
            if op == "stake":
                if liq_bal < amount_atom:
                    print("[ERROR] Insufficient balance"); return
                balances[from_address] = str(liq_bal - amount_atom)
                staked[from_address] = str(stk_bal + amount_atom)
            elif op == "unstake":
                if stk_bal < amount_atom:
                    print("[ERROR] Insufficient staked balance"); return
                staked[from_address] = str(stk_bal - amount_atom)
                balances[from_address] = str(liq_bal + amount_atom)
            new_event = {"id": f"{op}-{datetime.utcnow().timestamp()}", "event_type": op, "address": from_address, "amount_atom": str(amount_atom), "created_at": datetime.utcnow().isoformat() + "Z", "cloud_validated": True}
        
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    
    # Sync final balances to Cloud
    stk_bal = ledger.get("staked_balances", {}).get(from_address, "0")
    pos_liq = ledger.get("balances", {}).get(from_address, "0")
    update_supabase(from_address, amount_atom=pos_liq, staked_amount=stk_bal)
    
    print(f"[SUCCESS] Cloud Validator Processed: {new_event['id']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[ERROR] Payload required")
        sys.exit(1)
    process_transaction(sys.argv[1])
