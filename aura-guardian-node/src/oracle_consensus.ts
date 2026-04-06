// oracle_consensus.ts
// Simple consensus logic for AI guardian nodes. Each node votes via the `oracle_votes` table.

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Submit a vote for a distribution proposal.
 * @param proposalId ID of the distribution proposal
 * @param vote "APPROVE" or "FREEZE"
 * @param reason Optional reason string
 */
export async function submitVote(proposalId: number, vote: "APPROVE" | "FREEZE", reason: string = "") {
  const oracleAddress = process.env.GUARDIAN_PRIVATE_KEY ? new Wallet(process.env.GUARDIAN_PRIVATE_KEY).address : "";
  const { data, error } = await supabase.from("oracle_votes").upsert({
    proposal_id: proposalId,
    oracle_address: oracleAddress,
    vote,
    reason,
    confidence_score: vote === "APPROVE" ? 100 : 80
  }, { onConflict: "proposal_id,oracle_address" });
  if (error) throw error;
  return data;
}

/**
 * Check if consensus reached for a proposal.
 * Simple majority of active nodes (configured in `ai_oracle_nodes` table).
 */
export async function hasConsensus(proposalId: number): Promise<boolean> {
  const { data: nodes, error: nErr } = await supabase.from("ai_oracle_nodes").select("node_address").eq("is_active", true);
  if (nErr) throw nErr;
  const activeCount = nodes?.length ?? 0;
  if (activeCount === 0) return false;

  const { data: votes, error: vErr } = await supabase.from("oracle_votes").select("vote").eq("proposal_id", proposalId);
  if (vErr) throw vErr;
  const approveCount = votes?.filter(v => v.vote === "APPROVE").length ?? 0;
  // Majority rule
  return approveCount > Math.floor(activeCount / 2);
}
