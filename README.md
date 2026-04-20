# Aura: Sovereign Infrastructure ☁️🛡️

> **A Hybrid Proof-of-Stake & Proof-of-Effort Ecosystem (v3.1)**

Aura represents the final evolutionary step of the network, transitioning to an **Instant Cloud Settlement with Immutable Public Auditing** model. By leveraging Supabase for 1-second state confirmation and GitHub for immutable auditing, Aura provides a secure, zero-hardware financial ledger accessible from any device.

---

## 🔱 Global Participation (Dual-Yield Model)

Aura is a fully autonomous shared ecosystem where rewards are minted and distributed autonomously via the **Sovereign Cloud Engine**.

### 1. Sovereign Staking (PoS)
- **Mechanism**: 100% of the daily staking rewards (**1.0 AUR**) are distributed proportionally to all users who stake their assets in the Sovereign Vault.
- **Goal**: Rewards capital commitment and long-term network stability.
- **Participation**: [STAKING_GUIDE.md](./STAKING_GUIDE.md)

### 2. Computational Vault (Miner)
- **Mechanism**: 100% of the daily mining rewards (**1.0 AUR**) are distributed based on computational effort (**Proof-of-Effort**).
- **Goal**: Rewards active participation and provides a fair-launch distribution for new users.
- **Engine**: Browser-native SHA-256 hashing (No specialized hardware required).

---

## 🏗️ Sovereign Infrastructure Architecture

The system utilizes a multi-layer architecture designed for maximum speed and absolute transparency:

### 1. The Instant Settlement Layer (Supabase)
The real-time source of truth for the Aura network:
- **Aura Validator**: A Supabase Edge Function that verifies ECDSA signatures in milliseconds.
- **Quantum Mapper**: SQL-native RPC functions ensure all transfers, stakes, and mining shares are 100% ACID compliant.

### 2. The Verification Layer (GitHub Actions)
The network's "Public Auditor" ensures total transparency:
- **Immutable Ledger**: Successful transactions are appended to `ledger.json` for public scrutiny.
- **Sovereign Distributor**: Daily rewards are calculated and settled autonomously at midnight UTC.

### 3. The Celestial Dashboard (React + Vite)
A high-fidelity interface for the modern sovereign commander.
- **Quantum Mining HUD**: Real-time hashrate telemetry and share tracking.
- **Peer Telemetry Stream**: Live logs of network heartbeats and cloud settlements.

---

## 🛠️ Tech Stack & Security

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **State** | Supabase (Postgres) | Authoritative Balance & Presence |
| **Logic** | Deno (Sovereign Validator) | Instant Transaction Settlement |
| **Mining** | Web Workers (SubtleCrypto) | Background SHA-256 Hashing |
| **Ledger** | GitHub (JSON) | Public Immutable Audit Trail |
| **Automation** | Supabase Cron / Python | Hourly Mining & Daily Staking Settlement |
| **Frontend** | React, Vite, CSS3 | High-Fidelity Dashboard |

---

## Getting Started

### Prerequisites
- Node.js & npm
- A Supabase Project with the [correct schema](./supabase/migrations/setup_miner.sql)

### Launch Dashboard
```bash
cd aura-wallet-ledger/web
npm install
npm run dev
```

---

## 🛡️ Security Protocol
Aura utilizes **EIP-191 compliant signatures** for every operation. Every transaction and mining share includes a **unique nonce** or seed stored in Supabase to prevent duplicate work or replay attacks, ensuring that your sovereign assets remain under your absolute control.

---
[AURA_WHITE_PAPER_2026.md](./AURA_WHITE_PAPER_2026.md) | [TOKENOMICS.md](./TOKENOMICS.md)

Built with sovereign autonomy by **Than** & The Aura Core Team • 2026.
