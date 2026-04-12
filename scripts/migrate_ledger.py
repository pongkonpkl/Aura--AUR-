import json
import os
import requests
from datetime import datetime

# Configuration - To be filled or passed via env
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
LEDGER_FILE = "ledger.json"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.")
    exit(1)

def migrate():
    if not os.path.exists(LEDGER_FILE):
        print(f"Error: {LEDGER_FILE} not found.")
        return

    with open(LEDGER_FILE, 'r', encoding='utf-8') as f:
        ledger = json.load(f)

    balances = ledger.get("balances", {})
    staked_balances = ledger.get("staked_balances", {})
    nonces = ledger.get("nonces", {})

    # Combine all unique addresses
    all_addresses = set(list(balances.keys()) + list(staked_balances.keys()) + list(nonces.keys()))

    print(f"Found {len(all_addresses)} unique addresses to migrate.")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    for addr in all_addresses:
        balance = balances.get(addr, "0")
        staked = staked_balances.get(addr, "0")
        nonce = nonces.get(addr, 0)

        # 1. Upsert Profile
        profile_payload = {
            "wallet_address": addr.lower(),
            "balance": str(balance),
            "staked_balance": str(staked),
            "last_nonce": int(nonce)
        }
        
        # Using RPC or REST Upsert with wallet_address as conflict target
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers=headers,
            json=profile_payload
        )

        if resp.status_code in [201, 204]:
            print(f"Successfully migrated: {addr}")
            
            # 2. Log Restoration Transaction
            tx_payload = {
                "tx_hash": f"migration-{int(datetime.now().timestamp())}-{addr[:8]}",
                "from_address": "System",
                "to_address": addr.lower(),
                "amount": str(balance),
                "tx_type": "migration",
                "status": "success",
                "signature": "SYSTEM_MIGRATION_V1"
            }
            requests.post(f"{SUPABASE_URL}/rest/v1/transactions", headers=headers, json=tx_payload)
        else:
            print(f"Failed to migrate {addr}: {resp.text}")

    print("\nMigration Complete. Aura is now live on Supabase!")

if __name__ == "__main__":
    migrate()
