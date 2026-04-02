# 🌀 Aura Layer 2: Blockchain Infrastructure Upgrade

We have successfully transitioned the Aura ledger from a single-layer database to a full **Layer 2 (L2) Blockchain Architecture**. This implementation provides trust-minimized scaling with an automated sequencer and batch finalization.

## 🏗️ Architecture Overview

The new flow follows the standard Rollup/L2 pattern:
1.  **Submission**: Client signs a TX and sends it to the `tx-submit` Edge Function.
2.  **Inbox**: The TX is recorded in `l2_tx_inbox` with status `PENDING`.
3.  **Sequencing**: The `aura-sequencer` worker pulls pending TXs, applies them to the state, and produces a **Block**.
4.  **Batching**: Multiple blocks are aggregated into a **Batch** with a `data_hash` (DA) and a `state_root`.
5.  **Settlement**: Batches are "committed" to L1 (simulated) and enter a 24-hour **Challenge Window**.
6.  **Finalization**: If no challenges occur, the batch is marked as `FINALIZED`.

---

## 🛠️ Components Implemented

### 1. Automated Sequencer (`aura-sequencer`)
Located at [aura-sequencer](file:///c:/Users/pklpo/OneDrive/Desktop/Aura%20%28AUR%29/aura-wallet-ledger/supabase/functions/aura-sequencer/index.ts). This worker:
-   Calls `sequencer_produce_block()` to process pending TXs.
-   Creates new batches automatically via `sequencer_run_auto_batch()`.
-   Finalizes expired batches and records simulated L1 settlements.

### 2. Refactored TX Pipeline
Transactions now go through an "Inbox" first.
-   **RPC**: `public.rpc_submit_l2_tx` handles secure insertion into the inbox.
-   **Edge Function**: [tx-submit](file:///c:/Users/pklpo/OneDrive/Desktop/Aura%20%28AUR%29/aura-wallet-ledger/supabase/functions/tx-submit/index.ts) now calls the inbox RPC instead of applying state directly.

### 3. Batch Lifecycle & Fraud Proof Readiness
Added logic for the full batch lifecycle in [004_l2_advanced_logic.sql](file:///c:/Users/pklpo/OneDrive/Desktop/Aura%20%28AUR%29/aura-wallet-ledger/supabase/schema/004_l2_advanced_logic.sql):
-   **Status Transition**: `CREATED` -> `CHALLENGED` or `FINALIZED`.
-   **Challenges**: New `l2_challenges` table and `challenge_batch()` function for dispute resolution.
-   **Finalization**: `finalize_expired_batches()` automatically closes the window after 24 hours.

### 4. Data Availability (DA) & L1 Settlement
-   **DA Retrieval**: `get_batch_da_data(batch_id)` allows anyone to reconstruct the state by fetching the canonical JSON list of transactions.
-   **L1 Records**: `l1_settlements` table tracks the commitment of batches to an external layer (simulated).

---

## 🚀 How to Run

### Execute the SQL Migrations
Apply the following files in order to your Supabase database:
1.  [003_l2_inbox_blocks_batches.sql](file:///c:/Users/pklpo/OneDrive/Desktop/Aura%20%28AUR%29/aura-wallet-ledger/supabase/schema/003_l2_inbox_blocks_batches.sql) (Core L2 tables/functions)
2.  [004_l2_advanced_logic.sql](file:///c:/Users/pklpo/OneDrive/Desktop/Aura%20%28AUR%29/aura-wallet-ledger/supabase/schema/004_l2_advanced_logic.sql) (Advanced logic added today)

### Trigger the Sequencer
In a production environment, you would set up a cron job to call the `aura-sequencer` Edge Function every few seconds.
For testing, you can trigger it manually:
```bash
# Example manual trigger via curl
curl -X POST https://[YOUR_PROJECT_ID].supabase.co/functions/v1/aura-sequencer \
-H "Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]"
```

## 🛡️ Verification (Trust Minimization)
Anyone can verify the Sequencer's honesty by:
1.  Fetching the `data_hash` from a batch.
2.  Downloading the full tx list using `get_batch_da_data()`.
3.  Replaying the transactions locally against the previous `state_root`.
4.  Comparing the result with the new `state_root` from the batch.
