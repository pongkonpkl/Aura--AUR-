import sys
import json
import hashlib
from datetime import datetime
import os
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

def process_transaction(payload_str):
    try:
        data = json.loads(payload_str)
    except Exception as e:
        print(f"[ERROR] Invalid payload JSON: {e}")
        return

    op = data.get("op", "transfer") # default to transfer
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
            
        # 🌟 Replay Protection: Nonce check
        ledger = load_json(LEDGER_FILE)
        nonces = ledger.setdefault("nonces", {})
        expected_nonce = int(nonces.get(from_address, "0")) + 1
        signed_nonce = int(tx.get("nonce", 0))
        
        amount_atom = int(tx.get("amount_atom", 0))
        if op == "transfer":
            to_address = tx.get("to_address")
            message_str = f"AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}"
        else:
            message_str = f"AUR_{op.upper()}:{signed_nonce}:{from_address}:{amount_atom}"
            
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address.lower():
            print("[ERROR] Invalid digital signature")
            return
            
        if signed_nonce != expected_nonce:
            print(f"[ERROR] Invalid nonce. Expected {expected_nonce}, got {signed_nonce}")
            return
            
    except Exception as e:
        print(f"[ERROR] Signature verification failed: {e}")
        return
        
    if amount_atom <= 0:
        print("[ERROR] Invalid amount")
        return
        
    # Update nonce in ledger
    nonces[from_address] = str(expected_nonce)
        
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    
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
        
        new_event = {
            "id": f"tx-{datetime.utcnow().timestamp()}",
            "event_type": "transfer",
            "from_address": from_address,
            "to_address": to_address,
            "amount_atom": str(amount_atom),
            "burn_penalty": str(burn_penalty),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "cloud_validated": True
        }
        
    elif op in ["stake", "unstake"]:
        stk_bal = int(staked.get(from_address, "0"))
        if op == "stake":
            if liq_bal < amount_atom:
                print("[ERROR] Insufficient balance")
                return
            balances[from_address] = str(liq_bal - amount_atom)
            staked[from_address] = str(stk_bal + amount_atom)
        elif op == "unstake":
            if stk_bal < amount_atom:
                print("[ERROR] Insufficient staked balance")
                return
            staked[from_address] = str(stk_bal - amount_atom)
            balances[from_address] = str(liq_bal + amount_atom)
            
        new_event = {
            "id": f"{op}-{datetime.utcnow().timestamp()}",
            "event_type": op,
            "address": from_address,
            "amount_atom": str(amount_atom),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "cloud_validated": True
        }
        
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    print(f"[SUCCESS] Cloud Validator Processed: {new_event['id']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[ERROR] Payload required")
        sys.exit(1)
    
    process_transaction(sys.argv[1])
