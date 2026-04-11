import json
import hashlib
from datetime import datetime
import os

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
    
    active_addresses = set()
    for addr, ts in presence.items():
        try:
            p_time = datetime.fromisoformat(ts.replace("Z", ""))
            if (now_utc - p_time).total_seconds() < 86400:
                active_addresses.add(addr)
        except: pass
    
    staked_balances = ledger.setdefault("staked_balances", {})
    for addr, bstr in staked_balances.items():
        if int(bstr) > 0:
            active_addresses.add(addr)
            
    active_addresses = list(active_addresses)
    
    if active_addresses:
        total_reward = 1_000_000_000_000_000_000 # 1 AUR
        per_node_reward = total_reward // len(active_addresses)
        
        print(f"[INFO] Splitting 1 AUR ({total_reward}) among {len(active_addresses)} nodes.")
        
        balances = ledger.setdefault("balances", {})
        
        for addr in active_addresses:
            current_bal = int(balances.get(addr, "0"))
            balances[addr] = str(current_bal + per_node_reward)
            
            proof_hash = hashlib.sha256(f"{today_str}-{addr}-G0LD".encode()).hexdigest()
            new_event = {
                "id": proof_hash,
                "event_type": "mining_reward",
                "from_address": "System",
                "to_address": addr,
                "amount_atom": str(per_node_reward),
                "created_at": datetime.utcnow().isoformat() + "Z"
            }
            ledger.setdefault("history", []).insert(0, new_event)

        ledger["last_mint"] = today_str
        total_supply = int(ledger.get("total_supply", "0"))
        ledger["total_supply"] = str(total_supply + total_reward)
        
        save_json(LEDGER_FILE, ledger)
        print(f"[SUCCESS] Global rewards distributed to {len(active_addresses)} nodes.")
    else:
        print("[WARNING] No active nodes or stakers found.")

if __name__ == "__main__":
    distribute()
