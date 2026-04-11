# Aura: Sovereign Cloud ☁️

> **A Cloud-Native, Autonomous Proof-of-Presence & Proof-of-Stake Ecosystem**

Aura represents the final evolutionary step of the network, transitioning from local-only hardware to a **Global Sovereign Cloud Shared Stack**. By leveraging Supabase and Edge Computing, Aura provides an unblockable, 24/7 financial ledger accessible via HTTPS from any device.

---

## 🔱 Global Participation (Mining & Staking)

Aura is now a fully autonomous shared ecosystem. Rewards are minted and distributed hourly via the Cloud Reward Engine.

- **Hybrid Rewards**: 
  - **80% PoP (Proof-of-Presence)**: Shared among all nodes active in the cloud in the last hour.
  - **20% PoS (Proof-of-Stake)**: Shared among all AUR stakers based on their locked balance.
- **Learn How to Participate**: [MINING_GUIDE.md](./MINING_GUIDE.md) | [Sovereign Tech Whitepaper](./TECH_WHITEPAPER.md)

---

## 🏗️ Cloud-Native Architecture

The system has been upgraded to a professional cloud stack, ensuring zero downtime, extreme scalability, and unbreakable uptime:

### 1. The Sovereign Cloud Core (Supabase)
Instead of a local Python process, Aura now breathes on the **Supabase Cloud Platform**:
- **Real-time Synchronization**: State changes (balances, stakes) are pushed to the dashboard instantly via WebSockets.
- **Edge Computing**: Reward distribution logic runs on Deno-based Edge Functions, ensuring 24/7 operation without local hardware.
- **Row Level Security (RLS)**: Cryptographic isolation ensuring only you can access and modify your sovereign profile.

### 2. The Transparent Ledger (Postgres)
- **Profiles**: Stores total accumulated AUR and node presence history.
- **Stakes**: Manages off-chain staking balances and pending rewards.
- **Distributions**: A permanent, transparent log of every POP and POS reward event.

### 3. The Celestial Interface (React + Vite)
A high-fidelity dashboard built for the modern sovereign user.
- **HTTPS Compliant**: No more "Sovereign Link Restricted" errors; connects securely to the cloud.
- **Auto-Sync**: Automatically registers your node and heartbeats upon login.
- **Glassmorphic UX**: Optimized for high-stakes transactions with smooth micro-animations.

---

## 🛠️ Tech Stack & Security

| Layer | Technology | Status |
| :--- | :--- | :--- |
| **Backend** | Supabase (Postgres + GoTrue) | Global Ready |
| **Logic** | Deno Edge Functions | Automated |
| **Security** | Replay Protection (Nonces) | Active |
| **Frontend** | React 18, Vite, GSAP | Premium Glass |

---

## Getting Started

### Prerequisites
- Node.js & npm
- A Supabase Project ([Setup Guide](./SUPABASE_SETUP.md))

### Installation
```bash
cd aura-wallet-ledger/web
npm install
```

### Configure Environment
Create a `.env.local` file in `aura-wallet-ledger/web/`:
```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Launch
```bash
npm run dev
```

---

## Security
Aura utilizes cryptographic signatures for every sensitive operation (Transfer/Stake). Every transaction includes a **unique nonce** to prevent replay attacks and ensures that even on a public cloud, your assets remain under your absolute control.

---
Built with sovereign autonomy by the Aura Core Foundation • 2026.
