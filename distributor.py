import os
import json
import requests
from datetime import datetime
from decimal import Decimal

# Configuration
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or "").strip()
LEDGER_FILE = "ledger.json"

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

def run_distribution():
    print(f"[{datetime.now()}] Triggering cloud reward distribution...")
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/rpc_distribute_rewards",
            headers=get_headers()
        )
        if resp.status_code == 200 and resp.json().get('success') is True:
            print("Successfully triggered distribution RPC.")
            return resp.json()
        elif resp.status_code == 200 and resp.json().get('success') is False:
             print(f"RPC returned error: {resp.text}")
             exit(1)
        else:
            print(f"Failed to trigger distribution HTTP {resp.status_code}: {resp.text}")
            exit(1)
    except Exception as e:
        print(f"Error during RPC call: {e}")
        exit(1)

def sync_ledger():
    print(f"[{datetime.now()}] Synchronizing local ledger with cloud state...")
    try:
        # Fetch all profiles
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles?select=wallet_address,balance,staked_balance,last_nonce",
            headers=get_headers()
        )
        if resp.status_code != 200:
            print(f"Failed to fetch profiles: {resp.text}")
            return

        profiles = resp.json()
        
        # Load existing ledger
        with open(LEDGER_FILE, 'r', encoding='utf-8') as f:
            ledger = json.load(f)

        # Update balances and staked_balances
        new_balances = {}
        new_staked = {}
        new_nonces = {}
        
        total_supply = Decimal(0)
        total_staked = Decimal(0)

        for p in profiles:
            addr = p['wallet_address'].lower()
            # Professional: Use Decimal for string-based high-precision math
            bal_dec = Decimal(str(p['balance']))
            staked_dec = Decimal(str(p['staked_balance']))
            nonce = str(p['last_nonce'] or "0")
            
            new_balances[addr] = str(bal_dec)
            new_staked[addr] = str(staked_dec)
            new_nonces[addr] = nonce
            
            total_supply += bal_dec + staked_dec
            total_staked += staked_dec

        ledger['balances'] = new_balances
        ledger['staked_balances'] = new_staked
        ledger['nonces'] = new_nonces
        ledger['total_supply'] = str(total_supply)
        ledger['total_staked'] = str(total_staked)
        ledger['last_sync'] = datetime.now().isoformat()

        # Save back to ledger.json
        with open(LEDGER_FILE, 'w', encoding='utf-8') as f:
            json.dump(ledger, f, indent=2)
        
        print(f"Ledger synced successfully. Total Supply: {total_supply}")

    except Exception as e:
        print(f"Error during ledger sync: {e}")

if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
        exit(1)

    # 1. Distribute rewards (The "Pulse")
    # Singularity 1B: High-speed Sharded Distribution
    run_distribution()

    print("Sovereign Distribution Pulse completed successfully.")
    # 2. Sync for transparency (DISABLED for 1B Scale - ledger.json is too large for GitHub)
    # sync_ledger() 
