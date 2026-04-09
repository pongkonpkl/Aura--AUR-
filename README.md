# Aura: Fahsai ☁️

> A Sovereign, Ultra-Lightweight Proof-of-Presence Blockchain Ecosystem

Aura: Fahsai represents the final evolutionary step of the Aura network, pivoting from complex, heavy reliance on Hardhat/EVM towards a **Global Sovereign Shared Stack**. It provides an immediate, unblockable financial ledger where everyone contributes to network security via Proof-of-Presence (PoP).

---

## 🔱 Global Participation (Mining)

Aura: Fahsai is now a shared ecosystem. 1 AUR is minted daily and shared among all active nodes worldwide. 

- **Learn How to Mine**: [MINING_GUIDE.md](./MINING_GUIDE.md)
- **Proof-of-Presence**: No heavy hardware needed. Just your presence.

---

## Architecture

The system is stripped down to 3 essential layers, ensuring zero friction, extreme modularity, and unbreakable uptime:

### 1. The Global Core Engine (`fahsai_engine.py`)
A lightweight, Python Fast-API backend driving the entire logic:
- **Shared Minting (PoP)**: Automatically divides the midnight reward among all nodes that sent a "Heartbeat" (Proof-of-Presence) in the last 24 hours. 
- **Network Awareness**: Tracks global peers via `nodes.json` and syncs the ledger state across the community.
- **Sovereign Deflation**: Implements the native 1% Burn mechanism on every transfer.
- **Auto-Sync**: Automatically executes `git push` to synchronize changes to global repositories.

### 2. The Absolute Truth (`ledger.json`, `nodes.json` & `identity.json`)
Data is treated as primitive, portable files. 
- `ledger.json`: The singular source of truth for balances and global history.
- `nodes.json`: Local directory of active peers and network heartbeats.
- `identity.json`: Local wallet authority. **Never push this file publicly.**

### 3. The Celestial Interface (`aura-wallet-ledger/web`)
A robust React/Vite-based Presentation Layer.
- **Global Presence Widget**: Real-time monitoring of online nodes and estimated rewards.
- **Start Mining Switch**: One-click activation of the PoP heartbeat loop.
- **Redesigned UX**: Optimized for high-stakes sovereign transactions with zero-latency.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Git (configured for automatic ledger syncing)

### One-Click Launch (Windows)
Run the automated bootstrap script to spin up both the Python backend and React frontend simultaneously.
```bash
.\start-aura-local.ps1
```

*(This will start `fahsai_engine.py` on `http://localhost:8000` and the React App on `http://localhost:5173/`)*

### Manual Startup
**Backend Engine:**
```bash
pip install fastapi uvicorn
python fahsai_engine.py
```

**Frontend Presentation:**
```bash
cd aura-wallet-ledger\web
npm install
npm run dev
```

## Security

Running Aura: Fahsai assumes complete trust in the node runner. The CORS boundaries are deliberately stripped to allow local React to speak uninterrupted with the Local Engine. If preparing for public API deployment, ensure typical REST authentication logic is re-implemented in the FastAPI endpoints.

---
Built with sovereign autonomy by the Aura Core Foundation.
