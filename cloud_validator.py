import sys
import json
import hashlib
from datetime import datetime
import os
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

# Configuration fetching
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or "").strip()

def get_supabase_headers():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[WARNING] Supabase environment variables missing. Headers may be invalid.")
        return {}
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def get_profile(address):
    headers = get_supabase_headers()
    # Singularity 1B: Use Sharded RPC Lookup
    resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/rpc_get_profile", headers=headers, json={"p_user_address": address.lower()})
    profiles = resp.json()
    
    if not profiles or (isinstance(profiles, list) and len(profiles) == 0):
        # Auto-onboarding for 1B Sharded Scale
        print(f"[INFO] Initializing new 1B profile for {address}")
        # In 1B, profiles are created via SQL trigger or direct insert if allowed. 
        # For simplicity, we assume rpc_get_profile might need to handle creation or we handle it here.
        return {"address": address.lower(), "balance_atom": 0, "staked_balance_atom": 0, "last_nonce": 0}
    
    profile = profiles[0] if isinstance(profiles, list) else profiles
    return profile

def update_supabase_profile(address, updates):
    # This is legacy direct patching. In 1B, we prefer RPC settlement.
    # However, for manual updates, we ensure column names are correct.
    headers = get_supabase_headers()
    # Map old keys to new if they leak through
    mapped_updates = {}
    if "balance" in updates: mapped_updates["balance_atom"] = updates["balance"]
    if "staked_balance" in updates: mapped_updates["staked_balance_atom"] = updates["staked_balance"]
    if "last_nonce" in updates: mapped_updates["last_nonce"] = updates["last_nonce"]
    
    requests.patch(f"{SUPABASE_URL}/rest/v1/profiles?address=eq.{address.lower()}", headers=headers, json=mapped_updates)

def log_transaction_to_supabase(tx_data):
    headers = get_supabase_headers()
    requests.post(f"{SUPABASE_URL}/rest/v1/transactions", headers=headers, json=tx_data)

def fetch_pending_transactions():
    headers = get_supabase_headers()
    # Fetch all transactions with 'pending' status
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/transactions?status=eq.pending&order=created_at.asc", headers=headers)
    return resp.json()

def update_transaction_status(tx_hash, status, error_msg=None):
    headers = get_supabase_headers()
    payload = {"status": status}
    if error_msg:
        payload["error_log"] = error_msg
    requests.patch(f"{SUPABASE_URL}/rest/v1/transactions?tx_hash=eq.{tx_hash}", headers=headers, json=payload)

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

    if not data or not isinstance(data, dict):
        print(f"[ERROR] Malformed transaction record: {payload_src}")
        return False

    tx_hash_id = data.get("tx_hash") # From DB (Supabase Row)
    print(f"[INFO] Processing TX: {tx_hash_id}")

    op = data.get("op")
    tx = data.get("tx")
    signature = data.get("signature")
    
    # Logic for Supabase Queue: If top-level keys are missing, extract from 'payload' JSONB
    if not op and "payload" in data:
        db_payload = data.get("payload") or {}
        if isinstance(db_payload, str):
            try:
                db_payload = json.loads(db_payload)
            except:
                db_payload = {}
        
        if isinstance(db_payload, dict):
            op = db_payload.get("op")
            tx = db_payload.get("tx")
            signature = db_payload.get("signature")

    # If it's a direct record from the 'transactions' table (like our high-speed queue)
    if data.get("tx_type") and not op:
        op = data.get("tx_type")
        tx = {"address": data.get("from_address"), "amount_atom": data.get("amount"), "nonce": 0} 
        # For High-Speed RPC, we might need to handle the nonce differently if it's not in the record
    
    if not op or not tx or not signature:
        print(f"[ERROR] Missing data components for {tx_hash_id or 'unknown'}")
        if tx_hash_id: update_transaction_status(tx_hash_id, "failed", "Missing op/tx/signature in payload")
        return False
        
    try:
        tx = tx or {}
        from_address = (tx.get("from_address") or tx.get("address") or "").lower()
        if not from_address:
            raise ValueError("Identity extraction failed: from_address is missing")
        profile = get_profile(from_address)
        
        expected_nonce = int(profile.get("last_nonce", 0)) + 1
        signed_nonce = int(tx.get("nonce", 0))
        amount_atom = int(tx.get("amount_atom", tx.get("amount", 0)))
        
        # Strict Nonce Enforcement: No bypasses allowed.
        if signed_nonce != expected_nonce:
            err = f"Invalid nonce. Expected {expected_nonce}, got {signed_nonce}"
            print(f"[ERROR] {err}")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", err)
            return False

        # Define message based on operation with Versioned Prefix
        prefix = "[Aura Sovereign v1] "
        message_variants = []
        if op == "withdraw":
            message_variants.append(f"{prefix}AUR_WITHDRAW_RPC:{signed_nonce}:{from_address}:{amount_atom}")
            message_variants.append(f"{prefix}AUR_WITHDRAW:{signed_nonce}:{from_address}:{amount_atom}")
        elif op == "transfer":
            to_address = tx.get("to_address", "").lower()
            message_variants.append(f"{prefix}AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}")
        elif op in ["stake", "unstake"]:
            message_variants.append(f"{prefix}AUR_{op.upper()}:{signed_nonce}:{from_address}:{amount_atom}")
        elif op == "swap":
            target = tx.get("target", "NATIVE")
            message_variants.append(f"{prefix}AUR_SWAP:{signed_nonce}:{from_address}:{amount_atom}:{target}")
        elif op == "claim":
            message_variants.append(f"{prefix}AUR_CLAIM:{signed_nonce}:{from_address}")
        
        # Identity verification
        verified = False
        for msg_str in message_variants:
            try:
                message = encode_defunct(text=msg_str)
                recovered = Account.recover_message(message, signature=signature)
                if recovered.lower() == from_address:
                    verified = True
                    break
            except: continue
            
        if not verified:
            print("[ERROR] Invalid digital signature (Checked all variants)")
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", "Invalid signature")
            return False
            
    except Exception as e:
        print(f"[ERROR] Verification failed: {e}")
        if tx_hash_id: update_transaction_status(tx_hash_id, "failed", str(e))
        return False

    # 2. Atomic Settlement via Supabase RPC
    headers = get_supabase_headers()
    print(f"[INFO] Settling {op} in database...")
    
    try:
        if op == "transfer":
            to_address = tx.get("to_address").lower()
            rpc_payload = {
                "p_from_address": from_address, "p_to_address": to_address,
                "p_amount_atom": amount_atom, "p_nonce": signed_nonce or expected_nonce,
                "p_tx_hash_id": tx_hash_id
            }
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/rpc_settle_transfer", headers=headers, json=rpc_payload)
            
        elif op in ["stake", "unstake"]:
            rpc_payload = {
                "p_op": op, "p_address": from_address,
                "p_amount_atom": amount_atom, "p_nonce": signed_nonce or expected_nonce,
                "p_tx_hash_id": tx_hash_id
            }
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/rpc_settle_staking", headers=headers, json=rpc_payload)

        elif op == "withdraw":
            rpc_payload = {
                "p_address": from_address, "p_amount_atom": amount_atom,
                "p_nonce": signed_nonce or expected_nonce, "p_tx_hash_id": tx_hash_id
            }
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/rpc_settle_withdrawal", headers=headers, json=rpc_payload)
        
        elif op == "swap":
            rpc_payload = {
                "p_user_address": from_address, "p_amount_aur_atom": amount_atom,
                "p_target_asset": tx.get("target", "NATIVE"),
                "p_nonce": signed_nonce or expected_nonce, "p_tx_id": tx_hash_id
            }
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/rpc_settle_swap", headers=headers, json=rpc_payload)
        
        else:
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", f"Unsupported op {op}")
            return False

        result = resp.json()
        print(f"[DEBUG] RPC Result: {result}")
        if isinstance(result, list): result = result[0]
        
        if isinstance(result, dict) and result.get("success") == True:
            print(f"[SUCCESS] {op} completed: {tx_hash_id}")
            return True
        else:
            error_msg = result.get("error") if isinstance(result, dict) else str(result)
            if tx_hash_id: update_transaction_status(tx_hash_id, "failed", error_msg)
            return False

    except Exception as e:
        print(f"[ERROR] DB Settlement Failure: {e}")
        if tx_hash_id: update_transaction_status(tx_hash_id, "failed", str(e))
        return False

if __name__ == "__main__":
    if os.environ.get("PROCESS_QUEUE") == "true":
        print("[INFO] Aura Cloud Validator v2: Processing Queue...")
        try:
            pending_txs = fetch_pending_transactions()
            print(f"[INFO] Found {len(pending_txs)} pending transactions.")
            for tx_record in pending_txs:
                try:
                    process_transaction(tx_record)
                except Exception as inner_e:
                    print(f"[ERROR] Failed to process record: {inner_e}")
        except Exception as e:
            print(f"[ERROR] Queue processing failed: {e}")
    else:
        payload_input = os.environ.get("CLIENT_PAYLOAD") or (sys.argv[1] if len(sys.argv) > 1 else None)
        if payload_input:
            process_transaction(payload_input)
        else:
            print("[ERROR] No input provided.")
