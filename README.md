# AuraChainAI Ecosystem

## ⚡ Local Celestial Quickstart (One-Command)

หากต้องการรันระบบครบวงจร (Local Chain + Guardian Bot + UI) บนเครื่อง Windows:

1. เปิด Terminal ที่ root ของโปรเจกต์
2. รันคำสั่ง:
   ```bash
   npm run dev:local
   ```
ระบบจะเปิด 3 หน้าต่างใหม่ให้โดยอัตโนมัติ พร้อมสำหรับการทดสอบ End-to-End ทันทีครับ!

## Overview

**AuraChainAI** is a next‑generation, AI‑governed blockchain ecosystem built on the Aura platform. It introduces a fully autonomous reward distribution pipeline, AI‑driven governance, NFT‑based reputation, and real‑time UI visualizations. The system is designed to be **additive‑only**, preserving existing Aura functionality while extending it with powerful AI features.

---

## 1. Reward Distributor & AI Freeze Governance (Smart Contract Layer)

### Workflow
1. **Data Collection** – Backend or dApp aggregates daily uptime/mining weight for each address and sends it to the smart contract.
2. **Proposal** – Smart contract stores a `proposeDistribution(address[] users, uint256[] weights)` transaction. The distribution is marked **PENDING**.
3. **AI Guardian** – An AI/Guardian node listens for the `DistributionProposed` event, runs anomaly detection (sybil, bot, risk analysis) and returns an **approve** or **freeze** decision.
4. **Execution** –
   - `approveDistribution(dayId)` – mints and distributes AUR tokens according to weight and any NFT multiplier.
   - `freezeDistribution(dayId, reason)` – halts the distribution, logs the reason and notifies users.
   - Distribution cadence is **1 minute per slot** while preserving an exact cap of **1 AUR per day** (1,440 slots/day).
5. **Events** – Every action emits events for full auditability.

---

## 2. Proposal DAO, AI Participation, Multi‑layer Approval

### Workflow
1. **Create Proposal** – Anyone (Human or AI node) can call `createProposal(title, detail, proposerType)`.
2. **Voting** – Both human voters and AI oracle nodes cast votes via `voteProposal(proposalId, vote)`.
3. **Quorum** – When the quorum is reached, `executeProposal(proposalId)` runs automatically (e.g., upgrade contract, change distribution formula, freeze a node).
4. **Transparency** – All proposals, votes, and execution logs are on‑chain.

---

## 3. NFT Reputation & Utility

### Workflow
1. **Earn EXP** – Events such as mining, DAO voting, reporting anomalies award experience points.
2. **Badge Minting** – The `AuraReputationNFT` contract evaluates EXP and mints a soul‑bound badge (Bronze, Silver, Gold).
3. **Multiplier** – Each badge level provides a minting multiplier (e.g., +5 % for Bronze, +10 % for Silver, +15 % for Gold) that boosts reward distribution.
4. **Privileges** – Badges unlock higher voting weight and access to privileged DAO actions.

---

## 4. AI Oracle & Node Integration (Decentralized AI)

1. **AI Guardian Nodes** run anomaly‑detection models (LLM/ML) in a distributed fashion.
2. **Event Broadcast** – When an event occurs, AI nodes evaluate it and broadcast the result to the contract.
3. **Consensus** – If a majority of AI nodes agree, the action (approve/freeze) is executed.
4. **Incentives & Slashing** – Nodes earn incentives for correct decisions and are slashed for false reports.

---

## 5. Visualization & UX

- **Dashboard (Galaxy Explorer)** – Real‑time transaction flow, energy movement, and status of approvals/freeze.
- **Leaderboard & NFT Badge Dashboard** – Shows ranking, badge level, EXP progress, and multiplier.
- **Notification Center** – Pushes alerts for pending distributions, freezes, and DAO outcomes.
- **Onboarding Tutorial** – Guides new users through the AI‑governed ecosystem.

---

## 6. Monitoring, Testing & Reliability

- **Cron/Worker** – Per-minute distributor jobs process slot-by-slot payouts and verify consistency across backend, contracts, and UI.
- **Comprehensive Test Suite** – Unit and integration tests for all contract functions, AI guardian flows, and UI components.
- **Zero‑Downtime Sync** – Guarantees that UI always reflects the latest on‑chain state.

---

## 7. Smart Contract Interfaces (Solidity)

```solidity
function proposeDistribution(address[] memory users, uint256[] memory weights) external onlyOwner;
function approveDistribution(uint256 day) external onlyGuardian;
function freezeDistribution(uint256 day, string memory reason) external onlyGuardian;
function createProposal(string memory title, string memory detail, uint8 proposerType) external;
function voteProposal(uint256 proposalId, uint8 vote) external; // Human or AI Node
function mintReputationNFT(address to, uint8 badgeLevel) external;
function getUserMultiplier(address user) external view returns (uint256);
```

---

## 8. Repository Structure

```
Aura (AUR)/
├─ contracts/                # Solidity contracts (RewardDistributor, ReputationNFT, L3 Constitution)
├─ aura-guardian-node/       # AI Guardian services, heartbeat, oracle consensus
├─ aura-wallet-ledger/       # Front‑end (React/Vite) & mobile (React‑Native)
│   ├─ web/src/ui/pages/    # Dashboard, Leaderboard, Parliament, etc.
│   └─ mobile/src/screens/  # Mobile UI equivalents
├─ aura-l4-ai-agents/        # AI agents (anti‑sybil, risk assessment)
└─ README.md                # <‑ This document
```

---

## 9. Getting Started

```bash
# Clone the repository
git clone https://github.com/your-org/AuraChainAI.git
cd AuraChainAI

# Install dependencies (frontend)
cd aura-wallet-ledger/web
npm install
npm run dev   # start Vite dev server

# Deploy contracts (Hardhat example)
cd ../../contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network testnet

# Run Guardian node
cd ../../aura-guardian-node
npm install
npm run start   # launches AI Guardian services
```

---

## 10. CI / CD (GitHub Actions)

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install deps
        run: npm ci
      - name: Lint
        run: npm run lint
  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v3
      - name: Install deps
        run: npm ci
      - name: Test contracts
        run: npx hardhat test
      - name: Test UI
        run: npm run test
```

---

## 🚀 การเปิดใช้งาน AuraChainAI

1. เข้าสู่โฟลเดอร์โปรเจกต์
    ```bash
    cd aura-l3-contracts
    ```

2. ติดตั้ง dependencies ที่จำเป็น
    ```bash
    npm install
    ```

3. สร้างไฟล์ `.env` (โดย copy จาก `.env.example` และแก้ไขค่าจริง)
    ```bash
    cp .env.example .env
    # หรือสร้างใหม่แล้วกรอกข้อมูลที่จำเป็นให้ครบ
    ```
   ค่าอย่างน้อยที่ต้องมีสำหรับ deploy: `RPC_URL`, `PRIVATE_KEY` และ (ถ้ามี) `ETERNITY_POOL_ADDRESS`

4. Deploy Smart Contract ขึ้น AuraChain network
    ```bash
    npx hardhat run scripts/deploy_aurachain_ai.ts --network aurachain
    ```
   สคริปต์นี้จะ deploy ครบทั้ง `AuraEternityToken`, `EternityPool`, `AuraReputationNFT`, `AuraRewardDistributor`
   และตั้งค่าความสัมพันธ์ระหว่างสัญญาให้อัตโนมัติ

5. ตั้งค่า backend distributor ให้ตรงกับ contract ใหม่
    ```bash
    cd ../aura-guardian-node
    npm install
    npm run build
    npm run distribute
    ```
   สำหรับ production ให้ตั้ง scheduler ทุก 1 นาที (เช่น systemd/pm2/task scheduler/cron)
   และใช้ owner key ที่เป็น guardian ด้วย เพื่อให้ pipeline `propose -> approve -> execute` ครบในรอบเดียว

6. หากใช้ GitHub Actions สำหรับ auto-distribution
   - เพิ่ม secrets ให้ครบ: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RPC_URL`, `DISTRIBUTOR_PRIVATE_KEY`, `REWARD_DISTRIBUTOR_ADDRESS`
   - workflow ตั้งให้รันทุก 5 นาทีและวนจ่ายภายใน job นาทีต่อนาที

> **หมายเหตุ:**  
> - อย่า push ไฟล์ `.env` จริงขึ้น GitHub เด็ดขาด  
> - ตรวจสอบค่าทุก field ใน .env ให้ถูกต้องก่อน deploy
> - หลัง deploy สำเร็จ ให้นำ contract address ไปใช้งานในระบบ dashboard/front-end ต่อ หรืออัปเดตในไฟล์ env เพิ่มเติมตามที่โปรเจกต์แนะนำ

---

## 12. License & Contributions

- **License:** MIT
- **Contributing:** Fork the repo, create a feature branch, and submit a pull request. Follow the code‑style guidelines in `.eslintrc` and run `npm run lint` before committing.

---

*Prepared by the Antigravity AI assistant on 2026‑04‑05.*
