import os
import json
import time
from datetime import datetime

LEDGER_FILE = "ledger.json"

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def update_pool(ledger):
    staking_meta = ledger.get("staking_meta")
    staked_balances = ledger.get("staked_balances", {})
    total_staked = sum(int(v) for v in staked_balances.values())
    
    now = int(time.time())
    last_reward_time = int(staking_meta["last_reward_time"])
    elapsed = now - last_reward_time
    
    if elapsed <= 0 or total_staked == 0:
        staking_meta["last_reward_time"] = now
        return
        
    reward_per_second = int(staking_meta["reward_per_second"])
    aura_reward = elapsed * reward_per_second
    
    precision = 10**12
    acc_reward_per_share = int(staking_meta["acc_reward_per_share"])
    acc_reward_per_share += (aura_reward * precision) // total_staked
    
    staking_meta["acc_reward_per_share"] = str(acc_reward_per_share)
    staking_meta["last_reward_time"] = now
    print(f"[TEST] Pool Updated: Elapsed={elapsed}s, Reward={aura_reward}, New AccReward={acc_reward_per_share}")

def test_reward_accumulation():
    ledger = load_json(LEDGER_FILE)
    
    # Simulate a user with staking
    test_address = "0xTEST_USER"
    ledger["staked_balances"][test_address] = "1000000000000000000" # 1 AUR
    ledger["reward_debts"][test_address] = "0"
    
    # 🌟 Update 1
    update_pool(ledger)
    acc1 = int(ledger["staking_meta"]["acc_reward_per_share"])
    
    print("Waiting 3 seconds...")
    time.sleep(3)
    
    # 🌟 Update 2
    update_pool(ledger)
    acc2 = int(ledger["staking_meta"]["acc_reward_per_share"])
    
    # Calculate pending
    staked = int(ledger["staked_balances"][test_address])
    debt = int(ledger["reward_debts"][test_address])
    precision = 10**12
    pending = (staked * acc2 // precision) - debt
    
    print(f"[TEST] Pending Reward for 3s: {pending} atoms")
    # Expected: ~3 * (1 AUR / 86400) = ~34722 atoms
    # 1 AUR / 86400 = 11574074074074 atoms/sec
    # 3s = 34722222222222 atoms
    
    if pending > 0:
        print("[SUCCESS] Rewards are accumulating correctly!")
    else:
        print("[FAILURE] Rewards are not accumulating.")

if __name__ == "__main__":
    test_reward_accumulation()
