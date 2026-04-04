<div align="center">
  <img src="./aura-logo.png" alt="Aura Logo" width="150" />
  <h1>Aura (AUR) Network 🌌</h1>
  <p><strong>The Universal Sovereign Rollup Framework & Eternity Identity Mining Protocol</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Version: V1](https://img.shields.io/badge/Version-1.0-purple.svg)]()
  [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-success)](#)
</div>

<br/>

Aura is a cutting-edge **Layer 3 Sovereign Framework** driven by AI Governance and a completely novel tokenomics model called the **Eternity Pool**. Designed for hyper-scale decentralization, it transforms everyday wallet users into network validators via seamless heartbeat mechanics.

---

## ⚡ Core Pillars

1. **Eternity Pool (Hyper-Scarcity Protocol) 🪙**
   - A hard-coded monetary policy issuing **exactly 1 AUR per day**, divided among all active citizens.
   - Built for eternal distribution. Whether there are 10 users or 10 million, the system distributes proportional fractional shares (Sparks/Wei) ensuring ultimate scarcity.
2. **Proof of Presence (Heartbeat Mining) ⏱️**
   - No expensive ASICs required. Users generate value simply by keeping their Aura Wallet connected and active.
   - The `useHeartbeat` React hook streams uptime data verified by backend Guard nodes.
3. **AI Guardian Nodes 🤖**
   - Automated server-side validators (`aura-guardian-node`) that audit L3 configurations, sanitize heartbeats, and securely dispatch the daily AUR distributions.
4. **Frictionless Sovereign Identity 🛡️**
   - The frontend gracefully bridges Web3 veterans (via MetaMask) while silently generating sovereign local identities for newcomers.

---

## 🏗️ Architecture

Aura operates as a Monorepo composed of decoupled but synergized modules:

| Module | Description | Location |
|--------|-------------|----------|
| **Aura Wallet** | React-based frontend hub with Eternity Mining Dashboard. | `/aura-wallet` |
| **Guardian Node** | TypeScript backend tracking pings and running the distributor cron bot. | `/aura-guardian-node` |
| **L3 Contracts** | Solidity contracts, including the `EternityPool.sol` distributor. | `/aura-l3-contracts` |
| **Aura CLI** | Developer tool for spinning up sovereign rollups effortlessly. | `/aura-cli` |
| **Ledger DB** | Supabase/PostgreSQL schema tracking daily uptime (`schema_v1.sql`). | `/` (root level) |

---

## 🚀 Quick Start Guide

Want to run the Aura network locally and witness the Eternity Pool in action?

### 1. Database Setup
Ensure you have an active Supabase project.
- Run `schema_v1.sql` in your Supabase SQL editor to create the necessary tables (`aura_accounts`, `daily_uptime_logs`) and the crucial `heartbeat_increment` RPC function.

### 2. Backend Guardian & Ping Listener
Navigate to the guardian node directory and configure your `.env` (Supabase Keys, RPC URL, Distributor PK):
```bash
cd aura-guardian-node
npm install

# Start the Heartbeat listener on port 4000
npm run api 
```

### 3. Open the Aura Wallet
Launch the frontend to start mining:
```bash
cd aura-wallet
npm install
npm run dev
```
> *Click **Connect Web3 Wallet**. You will see the Eternity Mining logic begin syncing with the backend instantly!*

### 4. Distribute the Pool (Midnight Cron)
To finalize the loop and distribute today's 1 AUR fractionally based on uptime:
```bash
cd aura-guardian-node
npm run distribute
```

---

## 📜 Smart Contract Highlight: The Eternity Rule

The integrity of Aura rests upon local immutability. Only the distributor protocol can mint, and it is brutally restricted by blockchain timestamps.
```solidity
uint256 public constant DAILY_AUR = 1e18; 
function distribute(address[] calldata recipients, uint256[] calldata shares) external {
    require(today() > lastMintDay, "Algorithms forbid inflation: 1 a day only.");
    // ... distributes relative to user uptime weight
}
```

---

## 🤝 Contributing & AI DAO
Aura thrives on community evolution guided by our internal AI Manifesto. Before submitting major PRs, consult the `AURA_MANIFESTO.md` to ensure your architecture aligns with sovereign autonomy principles.

*Created for the Future. Maintained by the Citizens of Aura.*
