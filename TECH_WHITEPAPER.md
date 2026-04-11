# Project Aura: Sovereign Cloud Technology Whitepaper

## Executive Summary
Project Aura is a sovereign financial infrastructure designed for high-availability, zero-latency, and autonomous operation. By transitioning from a local-only node architecture to a **Sovereign Cloud Shared Stack**, Aura achieves institutional-grade reliability while maintaining decentralized user control via cryptographic secondary keys.

---

## ⚖️ Hybrid Consensus Model
Aura utilizes a dual-reward mechanism to ensure network stability and fair distribution:

### 1. Proof-of-Presence (PoP) - 80% Share
Designed for active participation. Nodes are rewarded for their "Presence" in the ecosystem. 
- **Mechanism**: Every active session in the Aura Dashboard sends a periodic "Quantum Heartbeat" to the Cloud.
- **Verification**: The Cloud Reward Engine (Edge Function) audits these heartbeats hourly to calculate active nodes.
- **Benefit**: Allows users with zero capital to earn AUR by contributing to network liquidity and presence.

### 2. Proof-of-Stake (PoS) - 20% Share
Designed for long-term security and deflationary support.
- **Mechanism**: Users lock AUR tokens into the Sovereign Staking Vault.
- **Verification**: The engine calculates rewards proportionally based on the weighted average of the staked pool.
- **Benefit**: incentivizes holding and reduces circulating supply, preventing inflation.

---

## 🛡️ Security & Sovereignty

### Replay Protection (Nonces)
To ensure transactions cannot be intercepted and re-broadcast, Aura implements a strict **Sequential Nonce System**:
- Every `TRANSFER` or `STAKE` operation includes a `nonce`.
- The ledger only accepts `nonce N+1` for any given address.
- This ensures that even if a cloud node is compromised, an attacker cannot repeat your transactions.

### Row Level Security (RLS)
Data integrity on the cloud is enforced by Postgres RLS:
- **Identity Isolation**: User A can never read or write to User B's profile.
- **Service Role Enforcement**: Only the internal Reward Engine has the "God Mode" (Service Role) required to distribute minting rewards.

---

## ⚡ Cloud Integration (Supabase)

### Edge Infrastructure
Aura's core logic is decentralized across **Supabase Edge Functions**:
- **Deno Runtime**: Highly secure, sandboxed environment for execution.
- **Zero Cold Starts**: Rewards are distributed with sub-millisecond precision.

### Real-time Ledger (WAL)
Leveraging Postgres's **Write-Ahead Log (WAL)**, the Aura Dashboard provides a "Zero Latency" experience:
- New transactions are streamed directly to the UI via WebSockets.
- Optimistic UI updates ensure the interface feels alive while waiting for cloud validation.

---

## 💎 The Sovereign Promise
Project Aura is built on the belief that code is law, and your keys are your identity. By combining the ease of Cloud with the security of Cryptography, we are building the future of sovereign finance.

---
**Aura Core Foundation**
*Release Version 1.2 - "Sovereign Cloud"*
