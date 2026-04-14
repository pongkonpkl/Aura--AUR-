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
    # Filter recent events for this address
    my_events = [ev for ev in history if ev.get("from_address") == address or ev.get("to_address") == address or ev.get("address") == address]
    
    # Calculate PENDING rewards locally for UI view (Shadowing the Algorithm)
    staking_meta = ledger.get("staking_meta", {})
    precision = 10**12
    pending_claim = "0"
    if staking_meta:
        total_staked_global = sum(int(v) for v in staked_balances.values())
        acc_reward = int(staking_meta["acc_reward_per_share"])
        
        # Simulate time jump to 'now'
        now = int(datetime.utcnow().timestamp())
        elapsed = max(0, now - int(staking_meta["last_reward_time"]))
        if total_staked_global > 0:
            reward_per_sec = int(staking_meta["reward_per_second"])
            acc_reward += (elapsed * reward_per_sec * precision) // total_staked_global
            
        user_staked = int(staked_balance)
        user_debt = int(ledger.get("reward_debts", {}).get(address, "0"))
        pending_calc = (user_staked * acc_reward // precision) - user_debt
        pending_claim = str(max(0, pending_calc))

    return {
        "balance_atom": str(balance),
        "staked_balance_atom": str(staked_balance),
        "pending_reward_atom": pending_claim,
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
    
    # 🌟 Replay Protection: Nonce check
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(from_address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        # Reconstruct message WITH nonce
        message_str = f"AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        
        if recovered_address.lower() != from_address.lower():
            return {"ok": False, "error": "Invalid digital signature"}
        
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": f"Invalid nonce. Expected {expected_nonce}, got {signed_nonce}"}
            
    except Exception as e:
        return {"ok": False, "error": f"Signature verification failed: {e}"}
    
    # Update nonce in ledger
    nonces[from_address] = str(expected_nonce)
    
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

def get_now_ts():
    return int(datetime.utcnow().timestamp())

def update_pool(ledger):
    staking_meta = ledger.setdefault("staking_meta", {
        "acc_reward_per_share": "0",
        "last_reward_time": get_now_ts(),
        "reward_per_second": "11574074074074" # 1 AUR / 86400 sec
    })
    
    total_staked = 0
    staked_balances = ledger.get("staked_balances", {})
    for addr, val in staked_balances.items():
        total_staked += int(val)
    
    now = get_now_ts()
    last_reward_time = int(staking_meta["last_reward_time"])
    
    if now <= last_reward_time:
        return
        
    if total_staked == 0:
        staking_meta["last_reward_time"] = now
        return
        
    multiplier = now - last_reward_time
    reward_per_second = int(staking_meta["reward_per_second"])
    aura_reward = multiplier * reward_per_second
    
    precision = 10**12
    acc_reward_per_share = int(staking_meta["acc_reward_per_share"])
    acc_reward_per_share += (aura_reward * precision) // total_staked
    
    staking_meta["acc_reward_per_share"] = str(acc_reward_per_share)
    staking_meta["last_reward_time"] = now

@app.post("/stake-op")
async def stake_op(request: Request):
    data = await request.json()
    op = data.get("op") # "stake" or "unstake"
    tx = data.get("tx", {})
    signature = data.get("signature")
    
    address = tx.get("address")
    amount_atom = int(tx.get("amount_atom", 0))
    
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        message_str = f"AUR_{op.upper()}:{signed_nonce}:{address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        if recovered_address.lower() != address.lower():
            return {"ok": False, "error": "Invalid digital signature"}
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": f"Invalid nonce. Expected {expected_nonce}, got {signed_nonce}"}
    except Exception as e:
        return {"ok": False, "error": f"Signature verification failed: {e}"}
        
    nonces[address] = str(expected_nonce)
    
    if amount_atom < 0:
        return {"ok": False, "error": "Invalid amount"}
        
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    reward_debts = ledger.setdefault("reward_debts", {})
    
    # 🌟 Step 1: Update Global Pool
    update_pool(ledger)
    acc_reward_per_share = int(ledger["staking_meta"]["acc_reward_per_share"])
    precision = 10**12
    
    liq_bal = int(balances.get(address, "0"))
    stk_bal = int(staked.get(address, "0"))
    user_reward_debt = int(reward_debts.get(address, "0"))
    
    # 🌟 Step 2: Harvest Pending Rewards
    if stk_bal > 0:
        pending = (stk_bal * acc_reward_per_share // precision) - user_reward_debt
        if pending > 0:
            balances[address] = str(liq_bal + pending)
            liq_bal += pending
            total_supply = int(ledger.get("total_supply", "0"))
            ledger["total_supply"] = str(total_supply + pending)
            # Record Reward History
            ledger.setdefault("history", []).insert(0, {
                "id": f"harvest-{datetime.utcnow().timestamp()}",
                "event_type": "harvest",
                "address": address,
                "amount_atom": str(pending),
                "created_at": datetime.utcnow().isoformat() + "Z"
            })

    # 🌟 Step 3: Process Stake/Unstake
    if op == "stake":
        if liq_bal < amount_atom: return {"ok": False, "error": "Insufficient balance"}
        balances[address] = str(liq_bal - amount_atom)
        staked[address] = str(stk_bal + amount_atom)
        stk_bal += amount_atom
    elif op == "unstake":
        if stk_bal < amount_atom: return {"ok": False, "error": "Insufficient staked balance"}
        staked[address] = str(stk_bal - amount_atom)
        balances[address] = str(liq_bal + amount_atom)
        stk_bal -= amount_atom
    else:
        return {"ok": False, "error": "Invalid operation"}
        
    # 🌟 Step 4: Update User Reward Debt
    reward_debts[address] = str(stk_bal * acc_reward_per_share // precision)
    
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

@app.post("/claim-op")
async def claim_op(request: Request):
    data = await request.json()
    tx = data.get("tx", {})
    signature = data.get("signature")
    address = tx.get("address")
    
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        message_str = f"AUR_CLAIM:{signed_nonce}:{address}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        if recovered_address.lower() != address.lower():
            return {"ok": False, "error": "Invalid digital signature"}
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": f"Invalid nonce"}
    except Exception as e:
        return {"ok": False, "error": f"Verification failed: {e}"}

    nonces[address] = str(expected_nonce)
    
    update_pool(ledger)
    
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    reward_debts = ledger.setdefault("reward_debts", {})
    
    stk_bal = int(staked.get(address, "0"))
    user_reward_debt = int(reward_debts.get(address, "0"))
    acc_reward_per_share = int(ledger["staking_meta"]["acc_reward_per_share"])
    precision = 10**12
    
    pending = (stk_bal * acc_reward_per_share // precision) - user_reward_debt
    if pending <= 0:
        return {"ok": False, "error": "No pending rewards"}
        
    # Process Reward
    liq_bal = int(balances.get(address, "0"))
    balances[address] = str(liq_bal + pending)
    
    # Reset Reward Debt
    reward_debts[address] = str(stk_bal * acc_reward_per_share // precision)
    
    # Update Supply
    total_supply = int(ledger.get("total_supply", "0"))
    ledger["total_supply"] = str(total_supply + pending)
    
    new_event = {
        "id": f"claim-{datetime.utcnow().timestamp()}",
        "event_type": "claim",
        "address": address,
        "amount_atom": str(pending),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    auto_push_git()
    return {"ok": True, "amount_atom": str(pending)}

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

@app.post("/force-distribution")
async def force_distribution():
    return {"ok": False, "message": "Distribution logic has been replaced by automated pool updates."}

@app.get("/nonce")
async def get_nonce(address: str):
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.get("nonces", {})
    current_nonce = int(nonces.get(address, "0"))
    return {"nonce": current_nonce}

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
        # 🌟 Passive Model: updatePool is triggered by user interactions.
        # However, we can keep a heartbeat if we want to update the timestamp regularly.
        ledger = load_json(LEDGER_FILE)
        update_pool(ledger)
        save_json(LEDGER_FILE, ledger)
        await asyncio.sleep(600) # Every 10 mins is enough for heartbeat

if __name__ == "__main__":
    print("[INFO] Starting Aura: Fahsai Engine on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
