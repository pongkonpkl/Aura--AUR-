# Aura: Sovereign Infrastructure ☁️🛡️

> **A Cloud-Settled, GitHub-Audited Proof-of-Presence & Proof-of-Stake Ecosystem**

Aura represents the final evolutionary step of the network, transitioning to an **Off-chain Settlement with Centralized Data Availability** model. By leveraging Supabase for high-speed state and GitHub for immutable public auditing, Aura provides a secure, unblockable financial ledger accessible from any device.

---

## 🔱 Global Participation (Mining & Staking)

Aura is a fully autonomous shared ecosystem where rewards are minted and distributed daily via the Cloud Reward Engine (GitHub Actions).

- **Hybrid Rewards**: 
  - **80% PoP (Proof-of-Presence)**: Shared among all nodes active in the cloud (Heartbeat verified).
  - **20% PoS (Proof-of-Stake)**: Shared among all AUR stakers based on their locked balance.
- **Official Documentation**: [AURA_WHITE_PAPER_2026.md](./AURA_WHITE_PAPER_2026.md) | [MINING_GUIDE.md](./MINING_GUIDE.md)

---

## 🏗️ Sovereign Infrastructure Architecture

The system utilizes a dual-layer architecture designed for maximum speed and absolute transparency:

### 1. The Settlement Layer (Supabase)
The real-time source of truth for the Aura network:
- **Profiles & Balances**: Authoritative storage for liquid and staked balances.
- **Supabase Real-time**: State changes are pushed to the dashboard instantly.
- **RLS Guard**: Cryptographic isolation ensures that only the Validator and the owner can interact with profile data.

### 2. The Verification Layer (GitHub Actions)
The network's "Validator Node" runs autonomously on GitHub:
- **Signature Verification**: Every transaction (Send/Stake) is cryptographically signed by the user and verified by the Cloud Validator.
- **Immutable Ledger**: Successful transactions are appended to `ledger.json` in this repository, creating a permanent, public audit trail.
- **Automated Distribution**: Daily rewards are calculated and distributed by the GitHub Cloud Distributor at midnight UTC.

### 3. The Celestial Dashboard (React + Vite)
A high-fidelity interface for the modern sovereign commander.
- **Full Transparency**: View real-time network logs, active node counts, and personal treasury status.
- **Optimization**: Optimized for mobile and desktop with a premium glassmorphic design.

---

## 🛠️ Tech Stack & Security

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **State** | Supabase (Postgres) | Authoritative Balance & Presence |
| **Logic** | Python (Cloud Validator) | Transaction Settlement |
| **Ledger** | GitHub (JSON) | Public Immutable Audit Trail |
| **Automation** | GitHub Actions | Daily Distribution (PoP/PoS) |
| **Frontend** | React, Vite, Framer Motion | High-Fidelity Dashboard |

---

## Getting Started

### Prerequisites
- Node.js & npm
- A Supabase Project with the [correct schema](./supabase/schema.sql)

### Installation
```bash
# Clone the repository
git clone https://github.com/pongkonpkl/Aura--AUR-
cd aura-wallet-ledger/web
npm install
```

### Launch
```bash
npm run dev
```

---

## Security
Aura utilizes **EIP-191 compliant signatures** for every operation. Every transaction includes a **unique nonce** stored in Supabase to prevent replay attacks, ensuring that your sovereign assets remain under your absolute control even in a cloud-native environment.

---
Built with sovereign autonomy by **Than** & The Aura Core Team • 2026.
