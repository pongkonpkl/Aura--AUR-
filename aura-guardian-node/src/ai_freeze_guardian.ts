// ai_freeze_guardian.ts
// Listens for new distribution proposals, runs anomaly detection, and approves or freezes.

import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const GUARDIAN_PRIVATE_KEY = process.env.GUARDIAN_PRIVATE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);
const guardianWallet = new ethers.Wallet(GUARDIAN_PRIVATE_KEY, provider);

type BatchAnalysis = {
  overallRisk: "LOW" | "MEDIUM" | "HIGH";
  flaggedAddresses: Array<{ address: string }>;
};

// Local fallback analysis so this service builds standalone.
function analyzeDistributionBatch(recipients: string[]): BatchAnalysis {
  const counts = new Map<string, number>();
  for (const address of recipients) {
    counts.set(address, (counts.get(address) ?? 0) + 1);
  }
  const flaggedAddresses = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([address]) => ({ address }));
  const overallRisk: BatchAnalysis["overallRisk"] =
    flaggedAddresses.length > 0 ? "MEDIUM" : "LOW";

  return { overallRisk, flaggedAddresses };
}

// Simple polling loop – in production replace with contract event listener
async function pollProposals() {
  console.log("🔎 AI Freeze Guardian started – polling distribution proposals...");
  while (true) {
    const { data, error } = await supabase
      .from("distribution_proposals")
      .select("id, day_id, recipients, status")
      .eq("status", "PENDING")
      .limit(1);
    if (error) {
      console.error("Supabase poll error", error);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    if (data && data.length > 0) {
      const proposal = data[0];
      console.log(`📄 Evaluating proposal ${proposal.id} for ${proposal.day_id}`);
      // Run anti‑sybil analysis on the batch
      const analysis = analyzeDistributionBatch(proposal.recipients as string[]);
      if (analysis.overallRisk === "LOW") {
        // Approve via RPC
        const approveRes = await supabase.rpc("ai_approve_distribution", {
          p_day: proposal.day_id,
          p_oracle_address: guardianWallet.address,
          p_reason: "AI Guardian: low risk"
        });
        console.log("✅ Approved", approveRes);
      } else {
        // Freeze with reason and flagged addresses
        const flagged = analysis.flaggedAddresses.map((a: any) => a.address);
        const freezeRes = await supabase.rpc("ai_freeze_distribution", {
          p_day: proposal.day_id,
          p_oracle_address: guardianWallet.address,
          p_reason: `AI Guardian: ${analysis.overallRisk} risk detected`,
          p_flagged_addresses: JSON.stringify(flagged),
          p_risk_level: analysis.overallRisk
        });
        console.log("🚫 Frozen", freezeRes);
      }
    }
    // Wait 10 seconds before next poll
    await new Promise(r => setTimeout(r, 10000));
  }
}

pollProposals().catch(console.error);
