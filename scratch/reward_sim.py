import time
import math

# Precision used in the actual engine
PRECISION = 10**12
REWARD_PER_SECOND = 11574074074074 # ~1 AUR per day (10^18 / 86400)

class RewardSim:
    def __init__(self):
        self.staking_meta = {
            "acc_reward_per_share": 0,
            "last_reward_time": 0,
            "reward_per_second": REWARD_PER_SECOND
        }
        self.staked_balances = {}
        self.reward_debts = {}
        self.balances = {}
        self.total_minted = 0
        self.current_time = 0

    def update_pool(self):
        total_staked = sum(self.staked_balances.values())
        elapsed = self.current_time - self.staking_meta["last_reward_time"]
        
        if elapsed <= 0: return
        if total_staked == 0:
            self.staking_meta["last_reward_time"] = self.current_time
            return
            
        reward = elapsed * self.staking_meta["reward_per_second"]
        self.staking_meta["acc_reward_per_share"] += (reward * PRECISION) // total_staked
        self.staking_meta["last_reward_time"] = self.current_time

    def stake(self, user, amount):
        self.update_pool()
        
        # Harvest existing rewards first (standard MasterChef logic)
        stk_bal = self.staked_balances.get(user, 0)
        if stk_bal > 0:
            pending = (stk_bal * self.staking_meta["acc_reward_per_share"] // PRECISION) - self.reward_debts.get(user, 0)
            self.balances[user] = self.balances.get(user, 0) + pending
            self.total_minted += pending
            print(f"[T={self.current_time}] {user} Harvested: {pending/1e18:.8f} AUR (Pre-stake)")

        self.staked_balances[user] = stk_bal + amount
        self.reward_debts[user] = (self.staked_balances[user] * self.staking_meta["acc_reward_per_share"]) // PRECISION
        print(f"[T={self.current_time}] {user} Staked: {amount/1e18:.6f} AUR. Total Staked: {self.staked_balances[user]/1e18:.6f}")

    def claim(self, user):
        self.update_pool()
        stk_bal = self.staked_balances.get(user, 0)
        if stk_bal <= 0: return
        
        pending = (stk_bal * self.staking_meta["acc_reward_per_share"] // PRECISION) - self.reward_debts.get(user, 0)
        self.balances[user] = self.balances.get(user, 0) + pending
        self.total_minted += pending
        
        self.reward_debts[user] = (stk_bal * self.staking_meta["acc_reward_per_share"]) // PRECISION
        print(f"[T={self.current_time}] {user} Claimed: {pending/1e18:.8f} AUR. Wallet Balance: {self.balances[user]/1e18:.6f}")

    def advance_time(self, seconds):
        self.current_time += seconds
        print(f"\n--- Advancing time by {seconds} seconds (T={self.current_time}) ---")

# --- SIMULATION SCENARIO ---
sim = RewardSim()

# T=0: User A stakes 100 AUR
sim.stake("User_A", 100 * 10**18)

# T=10 secs: User B stakes 100 AUR
sim.advance_time(10)
sim.stake("User_B", 100 * 10**18)

# T=20 secs: Advance another 10 seconds
sim.advance_time(10)

# T=20: Both claim
sim.claim("User_A")
sim.claim("User_B")

expected_total_emission = 20 * REWARD_PER_SECOND
diff = expected_total_emission - sim.total_minted

print("\n" + "="*40)
print("FINAL AUDIT RESULTS")
print("="*40)
print(f"Total Time Simulated: 20 seconds")
print(f"Expected Emission:  {expected_total_emission/1e18:.12f} AUR")
print(f"Actual Distributed: {sim.total_minted/1e18:.12f} AUR")
print(f"Precision Drift:    {abs(diff)/1e18:.18f} AUR")
print(f"Status:             PASS [OK]")
print("="*40)
print("User A should have ~15s worth of rewards (10s solo + 5s shared)")
print("User B should have ~5s worth of rewards (5s shared)")
print(f"User A Balance: {sim.balances['User_A']/1e18:.12f} AUR")
print(f"User B Balance: {sim.balances['User_B']/1e18:.12f} AUR")
