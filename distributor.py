import json
import hashlib
from datetime import datetime
import os
import requests

LEDGER_FILE = "ledger.json"
NODES_FILE = "nodes.json"

def load_json(filepath):
    if not os.path.exists(filepath):
        return {}
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def distribute():
    now_utc = datetime.utcnow()
    today_str = now_utc.strftime("%Y-%m-%d")
    
    ledger = load_json(LEDGER_FILE)
    last_mint = ledger.get("last_mint")
    
    if last_mint == today_str:
        print(f"[INFO] {today_str}: Distribution already completed today.")
        return
        
    print(f"[INFO] {today_str}: Global Distribution Sequence Initiated...")
    
    nodes = load_json(NODES_FILE)
    presence = nodes.get("presence", {})
    
    # Identify pools
    node_addresses = set()
    for addr, ts in presence.items():
        try:
            p_time = datetime.fromisoformat(ts.replace("Z", ""))
            if (now_utc - p_time).total_seconds() < 86400:
                 node_addresses.add(addr)
        except: pass
        
    staker_addresses = set()
    staked_balances = ledger.setdefault("staked_balances", {})
    for addr, bstr in staked_balances.items():
        if int(bstr) > 0:
            staker_addresses.add(addr)
    
    # 🌟 Survival Mode Logic: If no nodes, stakers take all. 
    # If no nothing, owner takes all to keep ledger alive.
    active_addresses = node_addresses.union(staker_addresses)
    if not active_addresses:
        # Fallback to a default address if possible or just log warning
        print("[WARNING] No active nodes or stakers. Network halted.")
        return
    
    if active_addresses:
        total_reward = 1_000_000_000_000_000_000 # 1 AUR Total / Day
        
        # Calculate pool sizes
        if node_addresses and staker_addresses:
            pop_pool = int(total_reward * 0.8) # 80% Presence
            pos_pool = int(total_reward * 0.2) # 20% Stake
        elif node_addresses:
            pop_pool = total_reward
            pos_pool = 0
        else: # Survival Mode: Only Stakers exist
            pop_pool = 0
            pos_pool = total_reward
        
        print(f"[INFO] Economy: Split 1 AUR (PoP: {pop_pool}, PoS: {pos_pool})")
        
        staked = ledger.setdefault("staked_balances", {})
        
        # Process PoP Pool (80%)
        if node_addresses:
            per_node = pop_pool // len(node_addresses)
            for addr in node_addresses:
                cur = int(staked.get(addr, "0"))
                staked[addr] = str(cur + per_node)
                
                proof_hash = hashlib.sha256(f"{today_str}-{addr}-PoP".encode()).hexdigest()
                ledger.setdefault("history", []).insert(0, {
                    "id": proof_hash, "event_type": "mining_reward_pop",
                    "from_address": "System", "to_address": addr,
                    "amount_atom": str(per_node), "created_at": datetime.utcnow().isoformat() + "Z"
                })

        # Process PoS Pool (20%)
        if staker_addresses:
            per_staker = pos_pool // len(staker_addresses)
            for addr in staker_addresses:
                cur = int(staked.get(addr, "0"))
                staked[addr] = str(cur + per_staker)
                
                proof_hash = hashlib.sha256(f"{today_str}-{addr}-PoS".encode()).hexdigest()
                ledger.setdefault("history", []).insert(0, {
                    "id": proof_hash, "event_type": "mining_reward_pos",
                    "from_address": "System", "to_address": addr,
                    "amount_atom": str(per_staker), "created_at": datetime.utcnow().isoformat() + "Z"
                })

        ledger["last_mint"] = today_str
        total_supply = int(ledger.get("total_supply", "0"))
        ledger["total_supply"] = str(total_supply + total_reward)
        
        save_json(LEDGER_FILE, ledger)
        
        # 🌟 CLOUD SYNC: Log the distribution event and update profiles
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            headers = { "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" }
            
            # 1. Update Every Staker's Profile in Supabase
            for addr, bstr in staked.items():
                if int(bstr) > 0:
                    profile_payload = {
                        "wallet_address": addr.lower(),
                        "staked_balance": bstr
                    }
                    requests.post(f"{url}/rest/v1/profiles", headers=headers, json=profile_payload)

            # 2. Log the total daily reward event
            requests.post(f"{url}/rest/v1/distributions", headers=headers, json={
                "amount": str(total_reward),
                "dist_type": "presence" # Fixed column name from schema
            })
            print("[CLOUD] Distributions and Profile balances synchronized to Supabase.")

        print(f"[SUCCESS] Global rewards distributed.")

    else:
        print("[WARNING] No active nodes or stakers found.")

if __name__ == "__main__":
    distribute()
