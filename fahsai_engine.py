import os
import json
import asyncio
import subprocess
import hashlib
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from eth_account import Account
from eth_account.messages import encode_defunct

app = FastAPI(title="Aura: Fahsai Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

LEDGER_FILE = "ledger.json"
IDENTITY_FILE = "identity.json"

def load_json(filepath):
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to load {filepath}: {e}")
        return {}

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def auto_push_git():
    try:
        subprocess.run(["git", "add", "ledger.json"], check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Aura Fahsai: Auto update ledger"], check=True, capture_output=True)
        subprocess.run(["git", "push", "origin", "HEAD"], check=True, capture_output=True)
        print("[SUCCESS] Auto-Push to GitHub Successful")
    except Exception as e:
        print(f"[WARNING] Git Push Failed (this is typical if git is not fully configured locally): {e}")

@app.get("/identity")
def get_identity():
    return load_json(IDENTITY_FILE)

@app.get("/ledger")
def get_ledger():
    return load_json(LEDGER_FILE)

@app.get("/wallet-summary")
def get_wallet_summary(address: str):
    ledger = load_json(LEDGER_FILE)
    balances = ledger.get("balances", {})
    staked_balances = ledger.get("staked_balances", {})
    history = ledger.get("history", [])
    
    balance = balances.get(address, "0")
    staked_balance = staked_balances.get(address, "0")
    
    # Filter recent events for this address
    my_events = [ev for ev in history if ev.get("from_address") == address or ev.get("to_address") == address or ev.get("address") == address]
    
    return {
        "balance_atom": str(balance),
        "staked_balance_atom": str(staked_balance),
        "recent_events": my_events[:50],
        "pending_txs": []
    }

@app.post("/tx-submit")
async def tx_submit(request: Request):
    data = await request.json()
    tx = data.get("tx", {})
    signature = data.get("signature")
    
    from_address = tx.get("from_address")
    to_address = tx.get("to_address")
    amount_atom = int(tx.get("amount_atom", 0))
    
    if not signature:
        return {"ok": False, "error": "Missing digital signature"}
        
    try:
        # Reconstruct the exact message the client signed
        message_str = f"AUR_TX:{from_address}:{to_address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address.lower():
            return {"ok": False, "error": "Invalid digital signature"}
    except Exception as e:
        return {"ok": False, "error": f"Signature verification failed: {e}"}
    
    if amount_atom <= 0:
        return {"ok": False, "error": "Invalid amount"}
        
    ledger = load_json(LEDGER_FILE)
    balances = ledger.setdefault("balances", {})
    
    from_balance = int(balances.get(from_address, "0"))
    if from_balance < amount_atom:
        return {"ok": False, "error": "Insufficient balance"}
        
    # 🌟 1% Burn Rule (Minimum 1 drop for burn unless amount is too small)
    burn_penalty = max(1, amount_atom // 100) if amount_atom >= 100 else 0
    receive_amount = amount_atom - burn_penalty
    
    # Process modifications
    balances[from_address] = str(from_balance - amount_atom)
    to_balance = int(balances.get(to_address, "0"))
    balances[to_address] = str(to_balance + receive_amount)
    
    # Update total supply by subtracting the burned payload
    total_supply = int(ledger.get("total_supply", "0"))
    ledger["total_supply"] = str(total_supply - burn_penalty)
    
    # Record history
    new_event = {
        "id": f"tx-{datetime.utcnow().timestamp()}",
        "event_type": "transfer",
        "from_address": from_address,
        "to_address": to_address,
        "amount_atom": str(amount_atom), # original sent amount
        "burn_penalty": str(burn_penalty),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    
    # Push to GitHub
    auto_push_git()
    
    return {"ok": True, "inbox_id": new_event["id"]}

@app.post("/stake-op")
async def stake_op(request: Request):
    data = await request.json()
    op = data.get("op") # "stake" or "unstake"
    tx = data.get("tx", {})
    signature = data.get("signature")
    
    address = tx.get("address")
    amount_atom = int(tx.get("amount_atom", 0))
    
    if not signature:
        return {"ok": False, "error": "Missing digital signature"}
        
    try:
        message_str = f"AUR_{op.upper()}:{address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != address.lower():
            return {"ok": False, "error": "Invalid digital signature"}
    except Exception as e:
        return {"ok": False, "error": f"Signature verification failed: {e}"}
    
    if amount_atom <= 0:
        return {"ok": False, "error": "Invalid amount"}
        
    ledger = load_json(LEDGER_FILE)
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    
    liq_bal = int(balances.get(address, "0"))
    stk_bal = int(staked.get(address, "0"))
    
    if op == "stake":
        if liq_bal < amount_atom: return {"ok": False, "error": "Insufficient balance"}
        balances[address] = str(liq_bal - amount_atom)
        staked[address] = str(stk_bal + amount_atom)
    elif op == "unstake":
        if stk_bal < amount_atom: return {"ok": False, "error": "Insufficient staked balance"}
        staked[address] = str(stk_bal - amount_atom)
        balances[address] = str(liq_bal + amount_atom)
    else:
        return {"ok": False, "error": "Invalid operation"}
        
    new_event = {
        "id": f"{op}-{datetime.utcnow().timestamp()}",
        "event_type": op,
        "address": address,
        "amount_atom": str(amount_atom),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    auto_push_git()
    return {"ok": True, "inbox_id": new_event["id"]}

NODES_FILE = "nodes.json"

def get_nodes():
    return load_json(NODES_FILE)

def update_node_presence(address: str):
    nodes = get_nodes()
    presence = nodes.setdefault("presence", {})
    presence[address] = datetime.utcnow().isoformat() + "Z"
    save_json(NODES_FILE, nodes)

@app.post("/heartbeat")
async def heartbeat(request: Request):
    data = await request.json()
    address = data.get("address")
    if not address:
        return {"ok": False, "error": "No address"}
    update_node_presence(address)
    print(f"[HEARTBEAT] Node Presence Verified: {address}")
    
    # Optional: Return active count immediately
    nodes = get_nodes()
    presence = nodes.get("presence", {})
    active_count = 0
    now = datetime.utcnow()
    for addr, ts in presence.items():
        try:
            p_time = datetime.fromisoformat(ts.replace("Z", ""))
            if (now - p_time).total_seconds() < 86400: # 24 hours
                active_count += 1
        except:
            pass
            
    return {"ok": True, "active_count": max(1, active_count)}

@app.get("/network-stats")
def get_network_stats():
    nodes = get_nodes()
    presence = nodes.get("presence", {})
    
    # Count active nodes in last 24h
    active_count = 0
    now = datetime.utcnow()
    for addr, ts in presence.items():
        try:
            p_time = datetime.fromisoformat(ts.replace("Z", ""))
            if (now - p_time).total_seconds() < 86400: # 24 hours
                active_count += 1
        except:
            pass
            
    return {
        "active_nodes": max(1, active_count),
        "total_mint_per_day": "1000000000000000000" # 1 AUR
    }

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(midnight_mint_task())

async def midnight_mint_task():
    while True:
        now_utc = datetime.utcnow()
        today_str = now_utc.strftime("%Y-%m-%d")
        
        ledger = load_json(LEDGER_FILE)
        last_mint = ledger.get("last_mint")
        
        if last_mint != today_str:
            print(f"[INFO] {today_str}: Global Distribution Sequence Initiated...")
            
            nodes = get_nodes()
            presence = nodes.get("presence", {})
            
            # Identify active addresses in last 24h (all UTC) + Stakers
            active_addresses = set()
            for addr, ts in presence.items():
                try:
                    p_time = datetime.fromisoformat(ts.replace("Z", ""))
                    if (now_utc - p_time).total_seconds() < 86400:
                         active_addresses.add(addr)
                except: pass
            
            staked_balances = ledger.get("staked_balances", {})
            for addr, bstr in staked_balances.items():
                if int(bstr) > 0:
                    active_addresses.add(addr)
            
            # If no heartbeats found (unlikely), fallback to local identity
            if not active_addresses:
                identity = load_json(IDENTITY_FILE)
                if identity.get("address"):
                    active_addresses.add(identity["address"])
            
            # convert set to list for stable processing
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
                # Total supply check (add 1 AUR total)
                total_supply = int(ledger.get("total_supply", "0"))
                ledger["total_supply"] = str(total_supply + total_reward)
                
                save_json(LEDGER_FILE, ledger)
                auto_push_git()
                print(f"[SUCCESS] Global rewards distributed to {len(active_addresses)} nodes.")
                
        await asyncio.sleep(60)

if __name__ == "__main__":
    print("[INFO] Starting Aura: Fahsai Engine on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
