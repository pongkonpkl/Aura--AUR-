# Aura Sovereign Tokenomics (v3.1) 💎🛰️

Aura (AUR) is an autonomous, high-scarcity ecosystem designed to reward both capital commitment and computational effort through its **Hybrid Consensus** model.

## 1. Daily Mint Rate & Scarcity
Aura is designed with extreme scarcity to ensure long-term value preservation.
- **Total Rewards**: Exactly **2.0 AUR** is minted per 24-hour cycle.
- **Distribution Frequency**: 
    - **Staking**: Distributed every UTC midnight.
    - **Mining**: Settled hourly based on accumulated shares.

---

## 2. Yield Layers: The Dual-Incentive Model

### A. Proof of Stake (PoS) - Staking Rewards
- **Allocation**: **1.0 AUR** per day.
- **Eligibility**: Any user with a non-zero `staked_balance` in the Sovereign Vault.
- **Formula**:
  $$ Reward_{stake\_user} = \frac{Stake_{user}}{TotalStake_{global}} \times 1.0 AUR $$

### B. Proof of Effort (PoW) - Mining Rewards
- **Allocation**: **1.0 AUR** per day.
- **Eligibility**: Any user contributing computational effort via the Sovereign Miner.
- **Formula**:
  $$ Reward_{mine\_user} = \frac{Shares_{user}}{TotalShares_{global}} \times 1.0 AUR $$

---

## 3. The 1% Burn Rule (Deflationary Mechanism)
Every transfer, staking, or unstaking operation on the Aura network carries a mandatory **1% Burn Penalty**. 
- **Deflationary Pressure**: Tokens burned are permanently removed from the ledger.
- **Scarcity Driver**: As network utility and activity increase, the total supply of AUR naturally decreases, counteracting the daily emission.

---

## 4. Sovereignty & Liquidity
- **Auto-Compounding**: Mining rewards are settled hourly into your liquid balance, allowing for immediate staking to increase your share of the PoS pool.
- **Zero Lock-up**: Aura values absolute control. You can unstake or transfer your assets at any time without mandatory cooling periods.
- **Atomic Settlement**: All distributions are handled via SQL-native RPC functions, ensuring mathematical precision and immunity to partial settlements.

---
**"Sovereignty is earned through effort and secured by capital."**
*Aura Core Tokenomics Protocol*
