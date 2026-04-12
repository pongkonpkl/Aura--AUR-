import json
import os
import shutil
from eth_account import Account
from eth_account.messages import encode_defunct
import subprocess

# --- TEST CONFIG ---
TEMP_LEDGER = "ledger_audit.json"
TEMP_NODES = "nodes_audit.json"
VALIDATOR = "cloud_validator.py"
DISTRIBUTOR = "distributor.py"

# Mock Identity (Test Account)
TEST_PRIV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TEST_ADDR = Account.from_key(TEST_PRIV_KEY).address
RECIPIENT_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

def setup_mock_env():
    initial_ledger = {
        "symbol": "AUR",
        "decimals": 18,
        "last_mint": "2026-04-10",
        "total_supply": "1000000000000000000000",
        "nonces": {},
        "balances": {
            TEST_ADDR: "50000000000000000000" # 50 AUR
        },
        "staked_balances": {},
        "history": []
    }
    with open(TEMP_LEDGER, "w") as f:
        json.dump(initial_ledger, f, indent=2)
    
    with open(TEMP_NODES, "w") as f:
        json.dump({"presence": { TEST_ADDR: "2026-04-12T00:00:00Z" }}, f, indent=2)

def run_validator(payload):
    shutil.copy(TEMP_LEDGER, "ledger.json") 
    res = subprocess.run(["python", VALIDATOR, json.dumps(payload)], capture_output=True, text=True)
    shutil.copy("ledger.json", TEMP_LEDGER)
    return res

def test_1_sync_legacy():
    print("\n[TEST 1] Legacy Restore Verification...")
    amount = 142857142857142857
    msg = f"SYNC_LEGACY:{amount}"
    signature = Account.sign_message(encode_defunct(text=msg), private_key=TEST_PRIV_KEY).signature.hex()
    
    payload = {
        "op": "sync_legacy",
        "tx": { "address": TEST_ADDR, "amount": str(amount) },
        "signature": signature
    }
    
    res = run_validator(payload)
    with open(TEMP_LEDGER, "r") as f:
        ledger = json.load(f)
    
    bal = ledger["balances"].get(TEST_ADDR)
    if str(amount) == bal:
        print("[PASS] Balance synced correctly.")
    else:
        print(f"[FAIL] Balance mismatch. Expected {amount}, Got {bal}")

def test_2_transfer_burn():
    print("\n[TEST 2] Transfer & Burn (1%) Validation...")
    with open(TEMP_LEDGER, "r") as f: ledger = json.load(f)
    ledger["balances"][TEST_ADDR] = "100000000000000000000" # 100 AUR
    ledger["nonces"][TEST_ADDR] = 0
    with open(TEMP_LEDGER, "w") as f: json.dump(ledger, f, indent=2)
    
    amt = 10000000000000000000 # 10 AUR
    nonce = 1
    msg = f"AUR_TX:{nonce}:{TEST_ADDR}:{RECIPIENT_ADDR}:{amt}"
    signature = Account.sign_message(encode_defunct(text=msg), private_key=TEST_PRIV_KEY).signature.hex()
    
    payload = {
        "op": "transfer",
        "tx": { "from_address": TEST_ADDR, "to_address": RECIPIENT_ADDR, "amount_atom": str(amt), "nonce": nonce },
        "signature": signature
    }
    
    run_validator(payload)
    
    with open(TEMP_LEDGER, "r") as f: ledger = json.load(f)
    
    burned = amt // 100
    expected_rec = amt - burned
    
    rec_bal = int(ledger["balances"].get(RECIPIENT_ADDR, "0"))
    if rec_bal == expected_rec:
        print(f"[PASS] Recipient received {rec_bal} (Burn verified).")
    else:
        print(f"[FAIL] Recipient balance mismatch. Expected {expected_rec}, Got {rec_bal}")

def test_3_staking():
    print("\n[TEST 3] Staking Flow Integrity Check...")
    with open(TEMP_LEDGER, "r") as f: ledger = json.load(f)
    ledger["nonces"][TEST_ADDR] = 1
    with open(TEMP_LEDGER, "w") as f: json.dump(ledger, f, indent=2)
    
    amt = 5000000000000000000 # 5 AUR
    nonce = 2
    msg = f"AUR_STAKE:{nonce}:{TEST_ADDR}:{amt}"
    signature = Account.sign_message(encode_defunct(text=msg), private_key=TEST_PRIV_KEY).signature.hex()
    
    payload = {
        "op": "stake",
        "tx": { "address": TEST_ADDR, "amount_atom": str(amt), "nonce": nonce },
        "signature": signature
    }
    
    run_validator(payload)
    with open(TEMP_LEDGER, "r") as f: ledger = json.load(f)
    
    staked = int(ledger["staked_balances"].get(TEST_ADDR, "0"))
    if staked == amt:
        print("[PASS] Staking balance updated.")
    else:
        print(f"[FAIL] Staked balance mismatch. Expected {amt}, Got {staked}")

def test_4_distribution():
    print("\n[TEST 4] Daily Distribution (80/20) Verification...")
    with open(TEMP_LEDGER, "r") as f: ledger = json.load(f)
    ledger["last_mint"] = "2026-04-11"
    with open(TEMP_LEDGER, "w") as f: json.dump(ledger, f, indent=2)
    
    shutil.copy(TEMP_LEDGER, "ledger.json")
    shutil.copy(TEMP_NODES, "nodes.json")
    
    subprocess.run(["python", DISTRIBUTOR], capture_output=True, text=True)
    
    with open("ledger.json", "r") as f: ledger = json.load(f)
    
    expected = 6000000000000000000
    final = int(ledger["staked_balances"].get(TEST_ADDR, "0"))
    
    if final == expected:
        print(f"[PASS] Distribution split verified. Final Staked: {final}")
    else:
        print(f"[FAIL] Distribution mismatch. Expected {expected}, Got {final}")

if __name__ == "__main__":
    print("=== AURA CORE SYSTEM AUDIT ===")
    setup_mock_env()
    try:
        test_1_sync_legacy()
        test_2_transfer_burn()
        test_3_staking()
        test_4_distribution()
    finally:
        for f in [TEMP_LEDGER, TEMP_NODES, "ledger.json", "nodes.json"]:
            if os.path.exists(f): os.remove(f)
    print("\nAudit Complete.")
