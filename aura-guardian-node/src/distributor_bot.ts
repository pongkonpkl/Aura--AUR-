import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { NonceManager } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const DISTRIBUTOR_PRIVATE_KEY = process.env.DISTRIBUTOR_PRIVATE_KEY || "";
const REWARD_DISTRIBUTOR_ADDRESS = process.env.REWARD_DISTRIBUTOR_ADDRESS || "";
const LOCAL_TEST_RECIPIENT = process.env.LOCAL_TEST_RECIPIENT || "";
const LOCAL_TEST_UPTIME_MINUTES = Number(process.env.LOCAL_TEST_UPTIME_MINUTES || "120");

// ABI for AuraRewardDistributor (Wraps EternityPool)
const REWARD_DISTRIBUTOR_ABI = [
  "function proposeDistribution(address[] calldata recipients, uint256[] calldata shares) external",
  "function approveDistribution(uint256 dayId) external",
  "function executeDistribution(uint256 dayId) external",
  "function getDistributionState(uint256 dayId) external view returns (uint8)",
  "function currentMinute() public view returns (uint256)",
  "function owner() public view returns (address)",
  "function isGuardian(address) public view returns (bool)"
];

const MIN_UPTIME_MINUTES = 1; // minute-by-minute payout visibility

async function finalizeSlot(distributor: ethers.Contract, minuteSlot: number, currentState?: number) {
  const state = currentState ?? Number(await distributor.getDistributionState(minuteSlot));
  if (state === 1) {
    const approveTx = await distributor.approveDistribution(minuteSlot);
    await approveTx.wait();
    console.log(`✅ Approved slot ${minuteSlot}: ${approveTx.hash}`);
  }
  const latestState = Number(await distributor.getDistributionState(minuteSlot));
  if (latestState === 2) {
    const executeTx = await distributor.executeDistribution(minuteSlot);
    const executeReceipt = await executeTx.wait();
    console.log(`💸 Executed slot ${minuteSlot} in block ${executeReceipt.blockNumber}`);
    return executeReceipt?.hash || executeTx.hash;
  }
  return null;
}

async function main() {
  console.log("🚀 Starting Aura Eternity Pool Distributor Bot...");

  if (!DISTRIBUTOR_PRIVATE_KEY || !REWARD_DISTRIBUTOR_ADDRESS) {
    console.error("❌ ERROR: Missing required environment variables.");
    process.exit(1);
  }

  const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
  const supabase = hasSupabase ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const baseWallet = new ethers.Wallet(DISTRIBUTOR_PRIVATE_KEY, provider);
  const wallet = new NonceManager(baseWallet);
  const distributor = new ethers.Contract(REWARD_DISTRIBUTOR_ADDRESS, REWARD_DISTRIBUTOR_ABI, wallet);

  // Pre-flight ownership/guardian checks to avoid silent no-mint runs.
  const owner: string = await distributor.owner();
  const signerAddress = await wallet.getAddress();
  const isGuardian: boolean = await distributor.isGuardian(signerAddress);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error(`❌ DISTRIBUTOR_PRIVATE_KEY is not contract owner. owner=${owner}, wallet=${signerAddress}`);
    process.exit(1);
  }
  if (!isGuardian) {
    console.error(`❌ Wallet ${signerAddress} is not an authorized guardian.`);
    process.exit(1);
  }

  // 1. Check if current minute slot already processed
  try {
    const today = await distributor.currentMinute();
    const rawStatus = await distributor.getDistributionState(today);
    const status = Number(rawStatus);

    if (status === 1 || status === 2) {
      console.log(`🔁 Minute slot ${today} already exists with state ${status}, finalizing...`);
      await finalizeSlot(distributor, Number(today), status);
      process.exit(0);
    }
    if (status !== 0) { // 3=frozen,4=distributed
      console.log(`✅ Minute slot ${today} already finalized (status: ${status}). Exiting.`);
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Warning: Cannot read from RewardDistributor contract.", error);
  }

  // 2. Fetch recipients from Supabase
  // Use daily logs as rolling weight source for minute slots.
  const todayStr = new Date().toISOString().split("T")[0];
  console.log(`📊 Preparing eligibility data for ${todayStr}...`);
  let logs: Array<{ address: string; uptime_minutes: number }> = [];

  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from("daily_uptime_logs")
      .select("address, uptime_minutes")
      .eq("date_key", todayStr)
      .gte("uptime_minutes", MIN_UPTIME_MINUTES);

    if (error) {
      console.error("❌ Supabase query failed:", error);
      process.exit(1);
    }
    logs = data || [];
  } else if (LOCAL_TEST_RECIPIENT) {
    // Local-mode fallback for end-to-end testing without Supabase linkage.
    logs = [{ address: LOCAL_TEST_RECIPIENT.toLowerCase(), uptime_minutes: LOCAL_TEST_UPTIME_MINUTES }];
    console.log(`🧪 Local mode active: recipient ${LOCAL_TEST_RECIPIENT}, uptime ${LOCAL_TEST_UPTIME_MINUTES}m`);
  }

  if (logs.length === 0) {
    console.log("ℹ️ No eligible wallets found for distribution.");
    process.exit(0);
  }

  // 3. Prepare data for the Smart Contract
  const recipients: string[] = [];
  const shares: number[] = [];
  let totalShares = 0;

  for (const log of logs) {
    recipients.push(log.address);
    shares.push(log.uptime_minutes); // Using minutes directly as weight
    totalShares += log.uptime_minutes;
  }

  console.log(`🎯 Found ${recipients.length} eligible recipients. Total weights: ${totalShares}`);

  // 4. Send transaction
  console.log("⏳ Sending proposeDistribution() to AuraRewardDistributor...");
  try {
    const tx = await distributor.proposeDistribution(recipients, shares);
    console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    let minuteSlot = Number(await distributor.currentMinute());
    let slotState = Number(await distributor.getDistributionState(minuteSlot));
    if (slotState !== 1) {
      const previousSlot = minuteSlot - 1;
      const previousState = Number(await distributor.getDistributionState(previousSlot));
      if (previousState === 1) {
        minuteSlot = previousSlot;
        slotState = previousState;
      }
    }
    if (slotState !== 1) {
      console.error(`❌ Could not find pending slot after propose. currentSlot=${minuteSlot}, state=${slotState}`);
      process.exit(1);
    }
    console.log(`🎉 Proposal confirmed in block ${receipt.blockNumber} (slot ${minuteSlot})`);

    // 5. Complete pipeline in same run: approve + execute.
    const executedHash = await finalizeSlot(distributor, minuteSlot);

    // 6. Log securely into Supabase history
    if (hasSupabase && supabase) {
      await supabase.from("daily_distribution_history").insert({
        distribution_date: todayStr,
        total_recipients: recipients.length,
        total_shares: totalShares,
        transaction_hash: executedHash
      });
      console.log("✅ Logged strictly to Supabase daily_distribution_history.");
    }

  } catch (e) {
    console.error("❌ Transaction failed!");
    console.error(e);
  }
}

main().catch(console.error);
