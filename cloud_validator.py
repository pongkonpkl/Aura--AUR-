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

def fetch_pending_transactions():
    url = os.environ.get("SUPABASE_URL")
    headers = get_supabase_headers()
    # Fetch all transactions with 'pending' status
    resp = requests.get(f"{url}/rest/v1/transactions?status=eq.pending", headers=headers)
    return resp.json()

def update_transaction_status(tx_hash, status, error_msg=None):
    url = os.environ.get("SUPABASE_URL")
    headers = get_supabase_headers()
    payload = {"status": status}
    if error_msg:
        payload["error_log"] = error_msg
    requests.patch(f"{url}/rest/v1/transactions?tx_hash=eq.{tx_hash}", headers=headers, json=payload)

def process_transaction(payload_src):
    """
    payload_src can be a JSON string (CLI) or a dictionary (from Supabase Queue)
    """
    if isinstance(payload_src, str):
        try:
            data = json.loads(payload_src)
        except Exception as e:
            print(f"[ERROR] Invalid payload JSON: {e}")
            return False
    else:
        data = payload_src

    op = data.get("op")
    tx = data.get("tx")
    signature = data.get("signature")
    tx_hash_id = data.get("tx_hash") # From DB
    
    if not op or not tx or not signature:
        print("[ERROR] Missing op, tx or signature")
        if tx_hash_id: update_transaction_status(tx_hash_id, "failed", "Missing op/tx/signature")
        return False
        
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
            message_str = f"SYNC_LEGACY:{amount_atom}"
        else:
            message_str = f"AUR_{op.upper()}:{signed_nonce}:{from_address}:{amount_atom}"

        if op != "sync_legacy" and signed_nonce != expected_nonce:
            err = f"Invalid nonce. Expected {expected_nonce}, got {signed_nonce}"
            print(f"[ERROR] {err}")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", err)
            return False

        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address:
            print("[ERROR] Invalid digital signature")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", "Invalid signature")
            return False
            
    except Exception as e:
        print(f"[ERROR] Verification failed: {e}")
        if tx_hash_id: update_transaction_status(tx_hash_id, "failed", str(e))
        return False

    # 2. Business Logic & Settlement
    tx_hash = f"tx-{datetime.utcnow().timestamp()}"
    
    if op == "transfer":
        if current_balance < amount_atom:
            err = "Insufficient balance"
            print(f"[ERROR] {err}")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", err)
            return False
        
        to_address = tx.get("to_address").lower()
        to_profile = get_profile(to_address)
        to_balance = int(to_profile.get("balance", "0"))
        
        burn_penalty = max(1, amount_atom // 100) if amount_atom >= 100 else 0
        receive_amount = amount_atom - burn_penalty
        
        update_supabase_profile(from_address, {"balance": str(current_balance - amount_atom), "last_nonce": signed_nonce})
        update_supabase_profile(to_address, {"balance": str(to_balance + receive_amount)})
        
    elif op == "stake":
        if current_balance < amount_atom:
            err = "Insufficient balance"
            print(f"[ERROR] {err}")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", err)
            return False
        update_supabase_profile(from_address, {
            "balance": str(current_balance - amount_atom),
            "staked_balance": str(current_staked + amount_atom),
            "last_nonce": signed_nonce
        })

    elif op == "unstake":
        if current_staked < amount_atom:
            err = "Insufficient staked balance"
            print(f"[ERROR] {err}")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", err)
            return False
        update_supabase_profile(from_address, {
            "balance": str(current_balance + amount_atom),
            "staked_balance": str(current_staked - amount_atom),
            "last_nonce": signed_nonce
        })
        
    elif op == "sync_legacy":
        staked_atom = int(tx.get("staked_atom", 0))
        update_supabase_profile(from_address, {
            "balance": str(amount_atom),
            "staked_balance": str(staked_atom)
        })
        print(f"[SUCCESS] Legacy Sync completed for {from_address}")

    # 3. Mark as Success in Supabase
    if tx_hash_id:
        update_transaction_status(tx_hash_id, "success")

    # 4. Append to Local Ledger (Permanent Hub/GitHub Ledger)
    ledger = load_json(LEDGER_FILE)
    history = ledger.setdefault("history", [])
    history.insert(0, {
        "id": tx_hash_id or tx_hash,
        "event_type": op,
        "from_address": from_address,
        "to_address": tx.get("to_address", "System"),
        "amount_atom": str(amount_atom),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "cloud_validated": True
    })
    save_json(LEDGER_FILE, ledger)
    
    print(f"[SUCCESS] Settlement complete for {op}: {tx_hash_id or tx_hash}")
    return True

if __name__ == "__main__":
    # Check if we should process the Supabase Queue
    if os.environ.get("PROCESS_QUEUE") == "true":
        print("[INFO] Aura Cloud: Processing Transaction Queue...")
        try:
            pending_txs = fetch_pending_transactions()
            if not pending_txs:
                print("[INFO] No pending transactions.")
            for tx_record in pending_txs:
                print(f"[INFO] Processing {tx_record.get('tx_hash')}...")
                process_transaction(tx_record)
        except Exception as e:
            print(f"[ERROR] Queue processing failed: {e}")
    else:
        # Legacy CLI mode
        payload_input = os.environ.get("CLIENT_PAYLOAD")
        if not payload_input:
            if len(sys.argv) < 2:
                print("[ERROR] No payload provided and PROCESS_QUEUE is not true.")
                sys.exit(1)
            payload_input = sys.argv[1]
        process_transaction(payload_input)
