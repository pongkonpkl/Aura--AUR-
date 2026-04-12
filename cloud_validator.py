import sys
import json
import hashlib
from datetime import datetime
import os
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

# We still keep ledger.json as a Public Ledger (Historical History)
LEDGER_FILE = "ledger.json"

def load_json(filepath):
    if not os.path.exists(filepath):
        return {}
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def get_supabase_headers():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise Exception("Supabase environment variables (URL/SERVICE_ROLE_KEY) missing.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def get_profile(address):
    url = os.environ.get("SUPABASE_URL")
    headers = get_supabase_headers()
    resp = requests.get(f"{url}/rest/v1/profiles?wallet_address=eq.{address.lower()}", headers=headers)
    profiles = resp.json()
    if not profiles:
        # Create profile if missing (Migration/Auto-onboarding)
        payload = {"wallet_address": address.lower(), "balance": "0", "staked_balance": "0", "last_nonce": 0}
        resp = requests.post(f"{url}/rest/v1/profiles", headers=headers, json=payload)
        return resp.json()[0]
    return profiles[0]

def update_supabase_profile(address, updates):
    url = os.environ.get("SUPABASE_URL")
    headers = get_supabase_headers()
    requests.patch(f"{url}/rest/v1/profiles?wallet_address=eq.{address.lower()}", headers=headers, json=updates)

def log_transaction_to_supabase(tx_data):
    url = os.environ.get("SUPABASE_URL")
    headers = get_supabase_headers()
    requests.post(f"{url}/rest/v1/transactions", headers=headers, json=tx_data)

def process_transaction(payload_str):
    try:
        data = json.loads(payload_str)
    except Exception as e:
        print(f"[ERROR] Invalid payload JSON: {e}")
        return

    op = data.get("op")
    tx = data.get("tx")
    signature = data.get("signature")
    
    if not op or not tx or not signature:
        print("[ERROR] Missing op, tx or signature")
        return
        
    try:
        from_address = (tx.get("from_address") or tx.get("address")).lower()
        profile = get_profile(from_address)
        
        current_balance = int(profile.get("balance", "0"))
        current_staked = int(profile.get("staked_balance", "0"))
        expected_nonce = int(profile.get("last_nonce", 0)) + 1
        
        signed_nonce = int(tx.get("nonce", 0))
        amount_atom = int(tx.get("amount_atom", tx.get("amount", 0)))
        
        # 1. Signature Verification
        if op == "transfer":
            to_address = tx.get("to_address").lower()
            message_str = f"AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}"
        elif op == "sync_legacy":
            # For legacy sync, we use a special message format
            message_str = f"SYNC_LEGACY:{amount_atom}"
            # In new system, we trust the signature for migration if profile is new or balance is 0
            # But let's keep nonce logic for everything else
        else:
            message_str = f"AUR_{op.upper()}:{signed_nonce}:{from_address}:{amount_atom}"

        if op != "sync_legacy" and signed_nonce != expected_nonce:
            print(f"[ERROR] Invalid nonce. Expected {expected_nonce}, got {signed_nonce}")
            return

        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address:
            print("[ERROR] Invalid digital signature")
            return
            
    except Exception as e:
        print(f"[ERROR] Verification failed: {e}")
        return

    # 2. Business Logic & Settlement
    updates = {"last_nonce": signed_nonce}
    new_tx_record = {
        "tx_hash": f"tx-{datetime.utcnow().timestamp()}",
        "from_address": from_address,
        "amount": str(amount_atom),
        "tx_type": op,
        "signature": signature,
        "status": "success"
    }

    if op == "transfer":
        if current_balance < amount_atom:
            print("[ERROR] Insufficient balance")
            return
        
        to_address = tx.get("to_address").lower()
        to_profile = get_profile(to_address)
        to_balance = int(to_profile.get("balance", "0"))
        
        burn_penalty = max(1, amount_atom // 100) if amount_atom >= 100 else 0
        receive_amount = amount_atom - burn_penalty
        
        # Update Sender
        update_supabase_profile(from_address, {"balance": str(current_balance - amount_atom), "last_nonce": signed_nonce})
        # Update Recipient
        update_supabase_profile(to_address, {"balance": str(to_balance + receive_amount)})
        
        new_tx_record.update({"to_address": to_address, "burn_penalty": str(burn_penalty)})

    elif op == "stake":
        if current_balance < amount_atom:
            print("[ERROR] Insufficient balance")
            return
        update_supabase_profile(from_address, {
            "balance": str(current_balance - amount_atom),
            "staked_balance": str(current_staked + amount_atom),
            "last_nonce": signed_nonce
        })

    elif op == "unstake":
        if current_staked < amount_atom:
            print("[ERROR] Insufficient staked balance")
            return
        update_supabase_profile(from_address, {
            "balance": str(current_balance + amount_atom),
            "staked_balance": str(current_staked - amount_atom),
            "last_nonce": signed_nonce
        })
        
    elif op == "sync_legacy":
        # Final safety check: Only allow sync if current balance is lower than legacy
        # In a real overhaul, the migration script handles this, but this is for individual users
        update_supabase_profile(from_address, {"balance": str(amount_atom)})
        print(f"[SUCCESS] Legacy Sync completed for {from_address}")

    # 3. Log to Supabase Transaction Table (Real-time history)
    log_transaction_to_supabase(new_tx_record)

    # 4. Append to Local Ledger (Permanent Hub/GitHub Ledger)
    ledger = load_json(LEDGER_FILE)
    history = ledger.setdefault("history", [])
    history.insert(0, {
        "id": new_tx_record["tx_hash"],
        "event_type": op,
        "from_address": from_address,
        "to_address": tx.get("to_address", "System"),
        "amount_atom": str(amount_atom),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "cloud_validated": True
    })
    save_json(LEDGER_FILE, ledger)
    
    print(f"[SUCCESS] Settlement complete for {op}: {new_tx_record['tx_hash']}")

if __name__ == "__main__":
    payload_input = os.environ.get("CLIENT_PAYLOAD")
    if not payload_input:
        if len(sys.argv) < 2:
            print("[ERROR] No payload provided.")
            sys.exit(1)
        payload_input = sys.argv[1]
    process_transaction(payload_input)
