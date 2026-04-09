# Aura: Fahsai Mining & Rewards Guide ⛏️🌍

Welcome to the **Sovereign Presence Network**. Mining AUR is not about solving complex mathematical puzzles that waste energy; it is about providing **Proof of Presence (PoP)** to secure and witness the growth of the Aura ecosystem.

---

## 🔱 The Mining Concept: Proof of Presence (PoP)

Aura: Fahsai uses a **Fair-Share Minting** mechanism. By running an Aura Node, you act as a "Witness" to the ledger. As long as your node is active and connected, you are eligible for the daily reward distribution.

### 1. The Shared Reward Pool
Every day at **00:00 UTC**, the system mints exactly **1 AUR**. 
- This 1 AUR is a "Global Pool" shared among all active nodes.
- **Your Reward** = `1 AUR / (Total Active Nodes)`.
- If you are the only one online, you get 1.0 AUR.
- If 1,000 people are online, you get 0.001 AUR.

### 2. How to "Mine"
Mining in Aura: Fahsai is as simple as keeping your engine running and toggling a switch.
1. **Launch the Engine**: Your local `fahsai_engine.py` must be running.
2. **Start Mining**: In the Web Dashboard, toggle the **"Start Mining"** switch.
3. **Heartbeat**: Once toggled, your node sends a secure "Heartbeat" to the network every 30 seconds.
4. **The Payout**: When midnight (UTC) passes, the Engine calculates the participants and updates your local `ledger.json` with your share.

---

## 🚀 Step-by-Step Setup for New Miners

### 1. Prerequisites
- **Python 3.10+**: Powering the backend engine.
- **Git**: Used for synchronizing the ledger to the global repository.

### 2. Installation
Clone the repository and install the lightweight dependencies:
```bash
git clone https://github.com/your-repo/aura-fahsai.git
cd aura-fahsai
pip install fastapi uvicorn
```

### 3. Identity Creation
Upon first launch, the engine will generate an `identity.json` for you. This contains your private key and master address. 
> [!CAUTION]
> **NEVER** share your `identity.json` or push it to GitHub. It is your only access to your funds.

### 4. Running the Node
**Start the Backend:**
```bash
python fahsai_engine.py
```
**Access the UI:**
Open `http://localhost:5173` (or your local UI address) and click **"Start Mining"** on the Dashboard.

---

## 🛡️ Security & Scalability

- **Validator Consensus**: Your node periodically checks the integrity of the ledger. If it detects tampering (someone trying to give themselves fake AUR), it will reject that version of the ledger and stay synced with the "True" majority history.
- **Ultra-Lightweight**: Mining takes less than 1% of your CPU. You can run it on a Raspberry Pi, an old laptop, or even in the background of your gaming PC.
- **Global Sync**: Every reward distribution is automatically committed to GitHub, creating a permanent, unblockable record of the network state.

---

## 📈 The Road to 2046
The goal of Aura: Fahsai is to reach 1 billion nodes, where every human has a sovereign, AI-governed wallet that values **Presence** over **Computing Power**. 

Welcome to the future of decentralized fairness.
