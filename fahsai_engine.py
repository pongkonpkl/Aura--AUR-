import os
import json
import asyncio
import subprocess
import hashlib
import time
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
    # 🌟 Security: Atomic write using temporary file swap
    tmp_path = filepath + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, filepath)

def auto_push_git():
    try:
        subprocess.run(["git", "add", "ledger.json"], check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Aura Fahsai: Auto update ledger"], check=True, capture_output=True)
        subprocess.run(["git", "push", "origin", "HEAD"], check=True, capture_output=True)
        print("[SUCCESS] Auto-Push to GitHub Successful")
    except Exception as e:
        print(f"[WARNING] Git Push Failed: {e}")

@app.get("/identity")
def get_identity():
    return load_json(IDENTITY_FILE)

@app.get("/ledger")
def get_ledger():
    return load_json(LEDGER_FILE)

@app.get("/wallet-summary")
async def wallet_summary(address: str):
    ledger = load_json(LEDGER_FILE)
    address = address.lower()
    
    # Normalize keys for lookups
    balances = {k.lower(): v for k, v in ledger.get("balances", {}).items()}
    staked_balances = {k.lower(): v for k, v in ledger.get("staked_balances", {}).items()}
    reward_debts = {k.lower(): v for k, v in ledger.get("reward_debts", {}).items()}
    history = ledger.get("history", [])
    
    balance = balances.get(address, "0")
    staked_balance = staked_balances.get(address, "0")
    
    # Filter recent events for this address
    my_events = [ev for ev in history if 
                  ev.get("from_address", "").lower() == address or 
                  ev.get("to_address", "").lower() == address or 
                  ev.get("address", "").lower() == address]
    
    # Calculate PENDING rewards locally for UI view (Shadowing the Algorithm)
    staking_meta = ledger.get("staking_meta", {})
    precision = 10**12
    pending_claim = "0"
    if staking_meta:
        total_staked_global = sum(int(v) for v in staked_balances.values())
        acc_reward = int(staking_meta["acc_reward_per_share"])
        
        # Simulate time jump to 'now'
        now = int(time.time())
        last_reward_time = int(staking_meta["last_reward_time"])
        elapsed = max(0, now - last_reward_time)
        if total_staked_global > 0:
            reward_per_sec = int(staking_meta["reward_per_second"])
            acc_reward += (elapsed * reward_per_sec * precision) // total_staked_global
            
        user_staked = int(staked_balance)
        user_debt = int(reward_debts.get(address, "0"))
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
    
    from_address = tx.get("from_address", "").lower()
    to_address = tx.get("to_address", "").lower()
    amount_atom = int(tx.get("amount_atom", 0))
    
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(from_address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        message_str = f"[Aura Sovereign v1] AUR_TX:{signed_nonce}:{from_address}:{to_address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        if recovered_address.lower() != from_address:
            return {"ok": False, "error": "Invalid digital signature"}
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": f"Invalid nonce. Expected {expected_nonce}"}
    except Exception as e:
        return {"ok": False, "error": f"Verification failed: {e}"}
    
    if amount_atom <= 0: return {"ok": False, "error": "Invalid amount"}
    
    balances = ledger.setdefault("balances", {})
    from_bal = int(balances.get(from_address, "0"))
    if from_bal < amount_atom: return {"ok": False, "error": "Insufficient balance"}
        
    burn_penalty = max(1, amount_atom // 100) if amount_atom >= 100 else 0
    receive_amount = amount_atom - burn_penalty
    
    # Process
    balances[from_address] = str(from_bal - amount_atom)
    to_bal = int(balances.get(to_address, "0"))
    balances[to_address] = str(to_bal + receive_amount)
    ledger["total_supply"] = str(int(ledger.get("total_supply", "0")) - burn_penalty)
    ledger["nonces"][from_address] = str(expected_nonce)

    new_event = {
        "id": f"tx-{time.time()}",
        "event_type": "transfer",
        "from_address": from_address,
        "to_address": to_address,
        "amount_atom": str(amount_atom),
        "burn_penalty": str(burn_penalty),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    auto_push_git()
    return {"ok": True, "inbox_id": new_event["id"]}

def update_pool(ledger):
    staking_meta = ledger.setdefault("staking_meta", {
        "acc_reward_per_share": "0",
        "last_reward_time": int(time.time()),
        "reward_per_second": "11574074074074"
    })
    
    staked_balances = {k.lower(): v for k, v in ledger.get("staked_balances", {}).items()}
    total_staked = sum(int(v) for v in staked_balances.values())
    
    now = int(time.time())
    last_reward_time = int(staking_meta["last_reward_time"])
    
    if now <= last_reward_time: return
    if total_staked == 0:
        staking_meta["last_reward_time"] = now
        return
        
    multiplier = now - last_reward_time
    aura_reward = multiplier * int(staking_meta["reward_per_second"])
    
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
    address = tx.get("address", "").lower()
    amount_atom = int(tx.get("amount_atom", 0))
    
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        message_str = f"[Aura Sovereign v1] AUR_{op.upper()}:{signed_nonce}:{address}:{amount_atom}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        if recovered_address.lower() != address:
            return {"ok": False, "error": "Invalid signature"}
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": f"Invalid nonce"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    update_pool(ledger)
    acc_reward_per_share = int(ledger["staking_meta"]["acc_reward_per_share"])
    precision = 10**12
    
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    reward_debts = ledger.setdefault("reward_debts", {})
    
    liq_bal = int(balances.get(address, "0"))
    stk_bal = int(staked.get(address, "0"))
    user_reward_debt = int(reward_debts.get(address, "0"))
    
    # Harvest
    if stk_bal > 0:
        pending = (stk_bal * acc_reward_per_share // precision) - user_reward_debt
        if pending > 0:
            liq_bal += pending
            balances[address] = str(liq_bal)
            ledger["total_supply"] = str(int(ledger.get("total_supply", "0")) + pending)
    
    if op == "stake":
        if liq_bal < amount_atom: return {"ok": False, "error": "Insufficient balance"}
        balances[address] = str(liq_bal - amount_atom)
        staked[address] = str(stk_bal + amount_atom)
        stk_bal += amount_atom
    elif op == "unstake":
        if stk_bal < amount_atom: return {"ok": False, "error": "Insufficient stake"}
        staked[address] = str(stk_bal - amount_atom)
        balances[address] = str(liq_bal + amount_atom)
        stk_bal -= amount_atom
        
    reward_debts[address] = str(stk_bal * acc_reward_per_share // precision)
    ledger["nonces"][address] = str(expected_nonce)
    
    new_event = {
        "id": f"{op}-{time.time()}",
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
    address = tx.get("address", "").lower()
    
    ledger = load_json(LEDGER_FILE)
    nonces = ledger.setdefault("nonces", {})
    expected_nonce = int(nonces.get(address, "0")) + 1
    signed_nonce = int(tx.get("nonce", 0))

    try:
        message_str = f"[Aura Sovereign v1] AUR_CLAIM:{signed_nonce}:{address}"
        message = encode_defunct(text=message_str)
        recovered_address = Account.recover_message(message, signature=signature)
        if recovered_address.lower() != address:
            return {"ok": False, "error": "Invalid signature"}
        if signed_nonce != expected_nonce:
            return {"ok": False, "error": "Invalid nonce"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    update_pool(ledger)
    acc_reward_per_share = int(ledger["staking_meta"]["acc_reward_per_share"])
    precision = 10**12
    
    balances = ledger.setdefault("balances", {})
    staked = ledger.setdefault("staked_balances", {})
    reward_debts = ledger.setdefault("reward_debts", {})
    
    stk_bal = int(staked.get(address, "0"))
    user_reward_debt = int(reward_debts.get(address, "0"))
    pending = (stk_bal * acc_reward_per_share // precision) - user_reward_debt
    
    if pending <= 0: return {"ok": False, "error": "No rewards"}
    
    balances[address] = str(int(balances.get(address, "0")) + pending)
    reward_debts[address] = str(stk_bal * acc_reward_per_share // precision)
    ledger["total_supply"] = str(int(ledger.get("total_supply", "0")) + pending)
    ledger["nonces"][address] = str(expected_nonce)

    new_event = {"id": f"claim-{time.time()}", "event_type": "claim", "address": address, "amount_atom": str(pending), "created_at": datetime.utcnow().isoformat() + "Z"}
    ledger.setdefault("history", []).insert(0, new_event)
    save_json(LEDGER_FILE, ledger)
    auto_push_git()
    return {"ok": True, "amount_atom": str(pending)}

NODES_FILE = "nodes.json"
def get_nodes(): return load_json(NODES_FILE)
def update_node_presence(address: str):
    nodes = get_nodes()
    nodes.setdefault("presence", {})[address] = datetime.utcnow().isoformat() + "Z"
    save_json(NODES_FILE, nodes)

@app.post("/heartbeat")
async def heartbeat(request: Request):
    data = await request.json()
    address = data.get("address")
    if not address: return {"ok": False}
    update_node_presence(address)
    active_count = sum(1 for ts in get_nodes().get("presence", {}).values() if (datetime.utcnow() - datetime.fromisoformat(ts.replace("Z", ""))).total_seconds() < 86400)
    return {"ok": True, "active_count": max(1, active_count)}

@app.get("/nonce")
async def get_nonce(address: str):
    ledger = load_json(LEDGER_FILE)
    return {"nonce": int(ledger.get("nonces", {}).get(address.lower(), "0"))}

@app.get("/network-stats")
def get_network_stats():
    ledger = load_json(LEDGER_FILE)
    balances = ledger.get("balances", {})
    staked = ledger.get("staked_balances", {})
    
    # Calculate Sum
    total_supply_atom = sum(int(v) if isinstance(v, str) and v.isdigit() else 0 for v in balances.values())
    total_supply_atom += sum(int(v) if isinstance(v, str) and v.isdigit() else 0 for v in staked.values())
    
    nodes = get_nodes()
    active_count = sum(1 for ts in nodes.get("presence", {}).values() if (datetime.utcnow() - datetime.fromisoformat(ts.replace("Z", ""))).total_seconds() < 86400)
    
    return {
        "active_nodes": max(1, active_count),
        "total_supply_atom": str(total_supply_atom),
        "total_mint_per_day": "1000000000000000000" # 1.0 AUR
    }

@app.on_event("startup")
async def startup_event(): asyncio.create_task(midnight_mint_task())

async def midnight_mint_task():
    while True:
        ledger = load_json(LEDGER_FILE)
        update_pool(ledger)
        save_json(LEDGER_FILE, ledger)
        await asyncio.sleep(600)

if __name__ == "__main__":
    print("[INFO] Starting Aura: Fahsai Engine on http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
