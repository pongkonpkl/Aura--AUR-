# Aura Sovereign Tokenomics (v3.0) 💎🛰️

Aura (AUR) is an autonomous, high-scarcity ecosystem designed to reward network security and long-term capital commitment through its **Proof of Stake (PoS)** model.

## 1. Daily Mint Rate & Scarcity
Aura is designed with extreme scarcity to ensure long-term value preservation.
- **Total Rewards**: Exactly **1.0 AUR** is minted per 24-hour cycle.
- **Distribution Frequency**: Every UTC midnight, the `daily-distributor` atomicaly calculates and distributes the reward.

## 2. Distribution Model: 100% Staking Rewards
Starting from v3.0, Aura has transitioned to a pure **Staking-First** economy. This rewards users who provide the most significant security to the protocol by locking their assets.

### A. Proof of Stake (PoS)
- **Eligibility**: Any user with a non-zero `staked_balance` in the L3 Sovereign Vault.
- **Reward Allocation**: 100% of the daily 1.0 AUR is distributed proportionally among all stakers.
- **The Formula**:
  $$ Reward_{user} = \frac{Stake_{user}}{TotalStake_{global}} \times 1.0 AUR $$

### B. Fair Participation
There are no "whales-only" tiers. Every single "wei" of AUR staked contributes to your proportional share of the daily rewards.

## 3. The 1% Burn Rule (Deflationary Mechanism)
Every transfer or staking operation on the Aura network carries a mandatory **1% Burn Penalty**. 
- **Deflationary Pressure**: Tokens burned are permanently removed from circulation.
- **Scarcity Driver**: As network activity increases, the total supply of AUR naturally decreases, making each remaining token more valuable.

## 4. Auto-Compounding & Liquidity
- **Auto-Compounding**: Rewards of the day are added to your balance, which can be immediately staked to increase your share for the next day.
- **Instant Unstaking**: Aura values sovereignty. You can unstake your assets at any time without mandatory lock-up periods, though doing so will decrease your reward share for the following cycle.

## 5. Sovereign Security
All transaction settlement and reward distribution are handled via **Atomic RPC functions** in the Sovereign Cloud, verified by ECDSA signatures, and audited on the public GitHub ledger.

---
**"Scarcity is the foundation of digital sovereignty."**
