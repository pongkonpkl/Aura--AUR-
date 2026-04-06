// dao_ai_voter.ts
// AI agent that monitors new DAO proposals and auto‑votes based on policy compliance.

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const GUARDIAN_PRIVATE_KEY = process.env.GUARDIAN_PRIVATE_KEY || "";
const guardianAddress = GUARDIAN_PRIVATE_KEY ? new Wallet(GUARDIAN_PRIVATE_KEY).address : "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ProposalDecision = { vote: "YES" | "NO" | "ABSTAIN" };

function analyzeProposal(title: string, body: string): ProposalDecision {
  const text = `${title} ${body}`.toLowerCase();
  const rejectKeywords = ["rug", "scam", "honeypot", "drainer", "backdoor"];
  if (rejectKeywords.some((k) => text.includes(k))) return { vote: "NO" };
  if (text.includes("upgrade") || text.includes("improve") || text.includes("security")) {
    return { vote: "YES" };
  }
  return { vote: "ABSTAIN" };
}

/**
 * Poll for newly created proposals that have not been voted on by the AI node.
 * The `proposals` table includes a `ai_voted` boolean flag (added via migration).
 */
async function pollProposals() {
  console.log("🤖 DAO AI Voter started – polling proposals...");
  while (true) {
    const { data, error } = await supabase
      .from("proposals")
      .select("id, title, body, proposer, proposer_type")
      .eq("status", "OPEN")
      .eq("ai_voted", false)
      .limit(1);
    if (error) {
      console.error("Supabase poll error", error);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    if (data && data.length > 0) {
      const proposal = data[0];
      console.log(`📄 Evaluating proposal ${proposal.id}: ${proposal.title}`);
      const decision = analyzeProposal(String(proposal.title ?? ""), String((proposal as any).body ?? ""));
      // decision: {vote: "YES"|"NO"|"ABSTAIN", reason?: string}
      const voteChoice = decision.vote === "YES" ? 1 : decision.vote === "NO" ? 2 : 3;
      // Call the enhanced cast_vote_v2 RPC
      const rpcRes = await supabase.rpc("cast_vote_v2", {
        p_proposal_id: proposal.id,
        p_voter: guardianAddress,
        p_choice: voteChoice,
        p_voter_type: 1 // AI node
      });
      console.log(`🗳️ AI voted ${decision.vote} on proposal ${proposal.id}`, rpcRes);
      // Mark as voted to avoid re‑processing
      await supabase.from("proposals").update({ ai_voted: true }).eq("id", proposal.id);
    }
    await new Promise(r => setTimeout(r, 8000));
  }
}

pollProposals().catch(console.error);
