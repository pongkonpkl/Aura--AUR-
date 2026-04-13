# Aura: Sovereign Infrastructure ☁️🛡️

> **A Cloud-Native, GitHub-Audited Proof-of-Stake Ecosystem (v3.0)**

Aura represents the final evolutionary step of the network, transitioning to an **Instant Cloud Settlement with Immutable Public Auditing** model. By leveraging Supabase for 1-second state confirmation and GitHub for immutable auditing, Aura provides a secure, zero-hardware financial ledger accessible from any device.

---

## 🔱 Global Participation (Staking Rewards)

Aura is a fully autonomous shared ecosystem where rewards are minted and distributed daily via the **Sovereign Cloud Distributor**.

- **Sovereign PoS**: 100% of the daily rewards (1.0 AUR) are distributed proportionally to all users who stake their assets in the L3 Vault.
- **Participation Guideline**: [STAKING_GUIDE.md](./STAKING_GUIDE.md)
- **Official Documentation**: [AURA_WHITE_PAPER_2026.md](./AURA_WHITE_PAPER_2026.md) | [TOKENOMICS.md](./TOKENOMICS.md)

---

## 🏗️ Sovereign Infrastructure Architecture (v3.0)

The system utilizes a dual-layer architecture designed for maximum speed and absolute transparency:

### 1. The Instant Settlement Layer (Supabase)
The real-time source of truth for the Aura network:
- **Aura Validator**: A Supabase Edge Function that verifies ECDSA signatures in milliseconds for instant settlement.
- **Profiles & Balances**: Authoritative storage for liquid and staked balances.
- **Atomic Protection**: SQL-native RPC functions ensure all transfers and stakes are 100% ACID compliant and immune to race conditions.

### 2. The Verification Layer (GitHub Actions)
The network's "Public Auditor" ensures total transparency:
- **Immutable Ledger**: Successful transactions are appended to `ledger.json` in this repository by the `github-ledger-sync` function.
- **Decentralized History**: Anyone can audit the full history of the network by simply browsing this GitHub repository.
- **Automated Distribution**: Daily rewards are calculated and distributed autonomously by the Cloud Reward Engine at midnight UTC.

### 3. The Celestial Dashboard (React + Vite)
A high-fidelity interface for the modern sovereign commander.
- **Optimistic UI**: Balances update instantly while waiting for cloud-confirmation.
- **Real-time Logs**: View live network activity and error codes in theActivity Feed.

---

## 🛠️ Tech Stack & Security

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **State** | Supabase (Postgres) | Authoritative Balance & Presence |
| **Logic** | Deno (Sovereign Validator) | Instant Transaction Settlement |
| **Ledger** | GitHub (JSON) | Public Immutable Audit Trail |
| **Automation** | Supabase Cron / GitHub | Daily Distribution (100% PoS) |
| **Frontend** | React, Vite, Tailwind | High-Fidelity Dashboard |

---

## Getting Started

### Prerequisites
- Node.js & npm
- A Supabase Project with the [correct schema](./supabase/schema.sql)

### Launch Dashboard
```bash
cd aura-wallet-ledger/web
npm install
npm run dev
```

---

## Security
Aura utilizes **EIP-191 compliant signatures** for every operation. Every transaction includes a **unique nonce** stored in Supabase to prevent replay attacks, ensuring that your sovereign assets remain under your absolute control in a zero-trust environment.

---
Built with sovereign autonomy by **Than** & The Aura Core Team • 2026.
