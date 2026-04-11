import json
import os
from supabase import create_client, Client

# === CONFIGURATION ===
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "YOUR_SERVICE_ROLE_KEY")
LEDGER_FILE = "ledger.json"

def migrate():
    if not os.path.exists(LEDGER_FILE):
        print(f"[ERROR] {LEDGER_FILE} not found.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"[INFO] Reading {LEDGER_FILE}...")
    with open(LEDGER_FILE, 'r', encoding='utf-8-sig') as f:
        ledger = json.load(f)

    balances = ledger.get("balances", {})
    staked_balances = ledger.get("staked_balances", {})
    history = ledger.get("history", [])

    print(f"[INFO] Migrating {len(balances)} profiles...")

    # 1. Migrate Profiles and Balances
    for addr, bal in balances.items():
        try:
            data = {
                "wallet_address": addr,
                "total_accumulated": int(bal),
                "nickname": "Legacy Member"
            }
            # Use upsert to create or update profiles by wallet_address
            # Note: We don't have Auth UIDs for everyone yet, but profiles can exist.
            res = supabase.table("profiles").upsert(data, on_conflict="wallet_address").execute()
            print(f"[SUCCESS] Synced balance for {addr}")
        except Exception as e:
            print(f"[ERROR] Failed to sync {addr}: {e}")

    # 2. Migrate Staked Balances
    print(f"[INFO] Migrating {len(staked_balances)} stakes...")
    for addr, s_bal in staked_balances.items():
        if int(s_bal) > 0:
            try:
                # Find profile ID first
                profile = supabase.table("profiles").select("id").eq("wallet_address", addr).execute()
                if profile.data:
                    p_id = profile.data[0]['id']
                    supabase.table("stakes").upsert({
                        "user_id": p_id,
                        "amount": int(s_bal),
                        "last_stake_at": "now()"
                    }, on_conflict="user_id").execute()
                    print(f"[SUCCESS] Synced stake for {addr}")
            except Exception as e:
                print(f"[ERROR] Failed to sync stake for {addr}: {e}")

    # 3. Migrate Distribution History (Last 50 items)
    print(f"[INFO] Migrating history items...")
    for item in history[-50:]: 
        try:
            supabase.table("distributions").insert({
                "recipient_address": item.get("to_address") or item.get("address") or item.get("identity"),
                "amount": int(item.get("amount_atom", "0")),
                "event_type": item.get("event_type", "LEGACY"),
                "created_at": item.get("created_at")
            }).execute()
        except Exception as e:
            pass

    print("[DONE] Migration complete.")

if __name__ == "__main__":
    migrate()
