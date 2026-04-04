<div align="center">
  <img src="./aura-logo.png" alt="Aura Logo" width="160" />
  <h1>Aura (AUR) · Sovereign Stack</h1>
  <p><strong>The World's First AI-Regulated Proof-of-Presence L3 Ecosystem</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/Version-2.0_Sovereign-a855f7.svg)]()
  [![Build](https://img.shields.io/github/actions/workflow/status/pongkonpkl/Wallet-Aura/pages.yml?label=GitHub%20Pages&logo=github)](https://github.com/pongkonpkl/Wallet-Aura/actions)
  [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-success)](https://nodejs.org)
  [![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
</div>

<br/>

> **Aura** is not just a wallet. It is a fully self-governing digital nation — where citizens mine tokens by being present, vote on governance with Karma-weighted ballots, and are protected by AI-regulated constitutional law. All automated. All transparent.

---

## ✨ The 5 Pillars of the Aura Sovereign Stack

### 🪙 1. Eternity Pool (Proof-of-Presence Mining)
The most user-friendly mining protocol in Web3. **No GPUs. No ASICs. Just open the app.**

- Exactly **1 AUR** is issued per day, split proportionally among all active citizens
- Uptime is tracked per-minute via a heartbeat signal from the React frontend
- The daily pool is distributed automatically at midnight by the Guardian Bot via **GitHub Actions**

### 🏛️ 2. Parliament (AI-Regulated On-Chain Democracy)
A governance system where **no single person has absolute power** — not even the creator.

- Any Citizen can submit a Proposal (new features, rule changes, treasury moves)
- Citizens vote with **Karma-weighted ballots** — the more you mine, the louder your voice
- All proposals must pass through the **AI Regulator** (Constitutional Guardian) before execution
- Prevents rug pulls and malicious governance attacks by design

### 🏆 3. Leaderboard (Gamified Engagement)
Turn passive holding into active competition.

- Real-time daily ranking of top miners
- Shows estimated AUR reward each Citizen will earn tonight
- Refreshes every 60 seconds — creates a "live" feeling and keeps users engaged

### 🛡️ 4. Anti-Sybil Defense (Multi-Layer Security)
Three independent security layers that work together:

| Layer | Mechanism | Effect |
|---|---|---|
| **Client** | `document.hidden` tab check | Pauses mining when user away |
| **Server** | 45-second rate limit in PostgreSQL RPC | Drops rapid-fire bot pings silently |
| **Database** | Hard cap `uptime_minutes <= 1440` | Physically impossible to exceed 24h/day |
| **Analytics** | `suspicious_miners` View | Flags anyone >20h/day for review |

### 🤖 5. Guardian Node (Zero-Trust Automation)
A fully autonomous reward engine that runs every night without human intervention.

- **GitHub Actions** cron job triggers at 00:00 ICT (17:00 UTC) every day
- Reads uptime from Supabase, calculates each citizen's share, and dispatches AUR
- Requires zero server maintenance — runs on GitHub's free infrastructure

---

## 🏗️ Repository Architecture

```
Aura (AUR)/                         ← Monorepo Root
├── .github/workflows/
│   ├── pages.yml                   ← CI/CD: Deploy wallet to GitHub Pages
│   └── distributor.yml             ← CRON: Nightly AUR distribution bot
│
├── aura-wallet-ledger/web/         ← ⭐ MAIN FRONTEND (React + Vite)
│   └── src/ui/pages/
│       ├── Dashboard.tsx           ← Mining interface
│       ├── Leaderboard.tsx         ← Live rankings
│       ├── Parliament.tsx          ← Governance & voting
│       ├── Explorer.tsx            ← Transaction ledger
│       └── MasterNodeDashboard.tsx ← Guardian Node status
│
├── aura-guardian-node/             ← Backend bot (TypeScript)
│   └── distributor_bot.ts          ← Nightly reward distributor
│
├── contracts/
│   └── AuraL3_AIConstitution.sol   ← Solidity: Governance smart contract
│
└── schema_v1.sql                   ← Full PostgreSQL schema (Supabase)
```

---

## 🚀 Quick Start (Full Stack)

### Step 1: Database Setup (Supabase)
1. Create a free project at [app.supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** and run the entire `schema_v1.sql` file
3. This creates all tables: `daily_uptime_logs`, `citizens`, `proposals`, `votes`, `referrals`

### Step 2: Configure GitHub Secrets
Go to your GitHub repo → **Settings → Secrets and variables → Actions** → **New repository secret**

Add these **6 secrets**:

| Secret Name | Where to Get It |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `SUPABASE_URL` | Same as above |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → `service_role` key (**keep secret!**) |
| `RPC_URL` | [Alchemy](https://alchemy.com) or [Infura](https://infura.io) — get a free API key |
| `DISTRIBUTOR_PRIVATE_KEY` | Your master distributor wallet's private key |

### Step 3: Deploy
Push to `main` branch — GitHub Actions will automatically:
1. **Build** the React wallet and deploy to GitHub Pages
2. **Run** the nightly distributor bot every midnight ICT

---

## 📜 Smart Contract: AuraL3 AI Constitution

The `AuraL3_AIConstitution.sol` contract enforces constitutional law on every governance action:

```solidity
// No proposal can execute without:
// 1. A democratic majority (yesVotes > noVotes)
// 2. An AI Regulator approval (policyHash must match)
function executeProposal(uint256 proposalId, bytes32 policyHash) external onlyRegulator {
    require(p.yesVotes > p.noVotes, "No majority");
    require(aiPolicyApproved[policyHash], "No AI approval");
    // ... execute
}
```

This dual-key mechanism makes governance **manipulation-resistant by design**.

---

## 🤝 Contributing

Aura is governed by its citizens. Before submitting major changes, read `AURA_MANIFESTO.md` to ensure your contribution aligns with the sovereign autonomy principles.

*Built for the future. Maintained by the Citizens of Aura.*
