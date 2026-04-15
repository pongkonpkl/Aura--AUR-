import json
import os
from decimal import Decimal, ROUND_FLOOR
from datetime import datetime

# Configuration matching Supabase security_rpc.sql
REWARD_PER_SEC = Decimal("11574074074074") # 1 AUR / 86400s
DEFAULT_DURATION_SEC = 6 * 3600 # 6 hours
LEDGER_FILE = "ledger.json"

def load_ledger():
    if not os.path.exists(LEDGER_FILE):
        print(f"Error: {LEDGER_FILE} not found.")
        return None
    with open(LEDGER_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def format_aur(atoms_str):
    return Decimal(atoms_str) / Decimal("1000000000000000000")

def simulate():
    ledger = load_ledger()
    if not ledger:
        return

    staked_balances = ledger.get("staked_balances", {})
    balances = ledger.get("balances", {})

    total_staked = sum(Decimal(val) for val in staked_balances.values())
    total_reward = Decimal(str(DEFAULT_DURATION_SEC)) * REWARD_PER_SEC

    print("="*80)
    print(f" AURA SOVEREIGN REWARD SIMULATION (LOCAL TEST) ")
    print(f" Timestamp: {datetime.now().isoformat()}")
    print(f" Duration:  {DEFAULT_DURATION_SEC} seconds (6 Hours)")
    print(f" Rate:      {REWARD_PER_SEC} atoms/sec (1.0 AUR / 24h)")
    print(f" Total Dist: {format_aur(str(total_reward)):.8f} AUR")
    print("="*80)

    if total_staked == 0:
        print("No active stakers found in ledger.")
        return

    print(f"{'Wallet Address':<50} | {'Old Bal':<10} | {'Reward':<10} | {'New Bal':<10}")
    print("-" * 87)

    results = []
    actual_total_distributed = Decimal(0)

    for addr, staked in staked_balances.items():
        staked_val = Decimal(staked)
        user_reward = (staked_val * total_reward) / total_staked
        user_reward = user_reward.to_integral_value(rounding=ROUND_FLOOR)
        
        old_bal = Decimal(balances.get(addr, "0"))
        new_bal = old_bal + user_reward
        actual_total_distributed += user_reward

        print(f"{addr:<50} | {format_aur(str(old_bal)):.4f} | {format_aur(str(user_reward)):.6f} | {format_aur(str(new_bal)):.4f}")
        results.append({
            "address": addr,
            "old_balance": str(old_bal),
            "reward": str(user_reward),
            "new_balance": str(new_bal)
        })

    print("-" * 87)
    print(f"Total Actual Distributed: {format_aur(str(actual_total_distributed)):.8f} AUR")
    print(f"Precision Loss (Dust):    {format_aur(str(total_reward - actual_total_distributed)):.18f} AUR")
    print("="*80)
    print("\n[NOTE] This is a DRY RUN. No changes were made to ledger.json.")

if __name__ == "__main__":
    simulate()
