import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const DISTRIBUTOR_PRIVATE_KEY = process.env.DISTRIBUTOR_PRIVATE_KEY || "";
const ETERNITY_POOL_ADDRESS = process.env.ETERNITY_POOL_ADDRESS || "";

// ABI for EternityPool
const ETERNITY_POOL_ABI = [
  "function distribute(address[] calldata recipients, uint256[] calldata shares) external",
  "function lastMintDay() external view returns (uint256)",
  "function today() public view returns (uint256)"
];

const MIN_UPTIME_MINUTES = 60; // Minimum 1 hour online to qualify

async function main() {
  console.log("🚀 Starting Aura Eternity Pool Distributor Bot...");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DISTRIBUTOR_PRIVATE_KEY || !ETERNITY_POOL_ADDRESS) {
    console.error("❌ ERROR: Missing required environment variables.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(DISTRIBUTOR_PRIVATE_KEY, provider);
  const eternityPool = new ethers.Contract(ETERNITY_POOL_ADDRESS, ETERNITY_POOL_ABI, wallet);

  // 1. Check if we already distributed today
  try {
    const today = await eternityPool.today();
    const lastMintDay = await eternityPool.lastMintDay();

    if (today <= lastMintDay) {
      console.log(`✅ Already distributed for today (Day ${today}). Exiting.`);
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Warning: Cannot read from EternityPool contract. Is it deployed correctly?", error);
    // Proceeding for debugging purposes (in production, exit here)
  }

  // 2. Fetch recipients from Supabase (yesterday or today's eligible users)
  // For simplicity, we filter by date_key = today and uptime > MIN_UPTIME_MINUTES
  const todayStr = new Date().toISOString().split("T")[0];
  console.log(`📊 Fetching valid uptime logs for ${todayStr}...`);

  const { data: logs, error } = await supabase
    .from("daily_uptime_logs")
    .select("address, uptime_minutes")
    .eq("date_key", todayStr)
    .gte("uptime_minutes", MIN_UPTIME_MINUTES);

  if (error) {
    console.error("❌ Supabase query failed:", error);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log("ℹ️ No eligible wallets found for distribution today.");
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
  console.log("⏳ Sending distribute() transaction to blockchain...");
  try {
    const tx = await eternityPool.distribute(recipients, shares);
    console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`🎉 Distribution confirmed in block ${receipt.blockNumber}`);

    // 5. Log securely into Supabase history
    await supabase.from("daily_distribution_history").insert({
      distribution_date: todayStr,
      total_recipients: recipients.length,
      total_shares: totalShares,
      transaction_hash: receipt.hash || tx.hash
    });
    
    console.log("✅ Logged strictly to Supabase daily_distribution_history.");

  } catch (e) {
    console.error("❌ Transaction failed!");
    console.error(e);
  }
}

main().catch(console.error);
