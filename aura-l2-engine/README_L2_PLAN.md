# 🌀 Aura Layer 2 (L2) Scaling Roadmap

This directory is reserved for the **Aura L2 Execution Layer**.

## 🎯 Objective
Scale the Aura (AUR) ecosystem by implementing a high-speed execution layer that batches transactions before settling on the Aura L1 (Supabase Core).

## 🛰️ Connection Strategy (L1 <-> L2)
- **L1 (Core)**: Current Supabase + Edge Functions (Final Settlement).
- **L2 (Speed)**: Will handle rapid balance updates and micropayments.

## 🛠️ Tech Stack for L2
- **State Compression**: Aggregating multiple TXs into a single settlement.
- **Off-chain Logic**: High-speed processing for game-fi or rapid trading inside Aura.

## 🤖 AI Context
If you are an AI assistant helping with Aura L2:
1.  **Reference L1 Core**: See `aura-wallet-ledger` for the primary ledger logic.
2.  **Maintain Security**: ALL signing must still happen in the user's browser (non-custodial).

---
*Created by Antigravity for User 'Than' - Gateway to the Celestial Scaling.*
