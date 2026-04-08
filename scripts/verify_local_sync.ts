
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

function readEnv(filepath: string) {
  if (!fs.existsSync(filepath)) {
    console.warn("⚠️ Not found:", filepath);
    return {};
  }
  return dotenv.parse(fs.readFileSync(filepath));
}

// Map relative paths from the root where this script is expected to run
const webEnvPath = path.join(process.cwd(), "aura-wallet-ledger", "web", ".env.local");
const botEnvPath = path.join(process.cwd(), "aura-guardian-node", ".env");
const contractLogPath = path.join(process.cwd(), "aura-l3-contracts", "deployments", "localhost.latest.json");

console.log("\n🔍 Aura Local Stack configuration check...");
console.log("-------------------------------------------");

const webEnv = readEnv(webEnvPath);
const botEnv = readEnv(botEnvPath);

// 1. Check Recipient Alignment
const webEvmAddr = webEnv.VITE_LOCAL_EVM_ADDRESS;
const botTestRecipient = botEnv.LOCAL_TEST_RECIPIENT;

console.log("\n📬 Address Alignment:");
console.log(`- Web UI (Watching):  ${webEvmAddr || "NOT SET"}`);
console.log(`- Bot (Paying):       ${botTestRecipient || "NOT SET"}`);

if (webEvmAddr && botTestRecipient && webEvmAddr.toLowerCase() === botTestRecipient.toLowerCase()) {
  console.log("✅ MATCH: Web UI is watching the same address the bot funds.");
} else {
  console.log("❌ MISMATCH: Web UI and Bot are using different addresses!");
}

// 2. Check Token Alignment
console.log("\n💎 Token Alignment:");
let actualToken = "UNKNOWN";
if (fs.existsSync(contractLogPath)) {
  const log = JSON.parse(fs.readFileSync(contractLogPath, "utf-8"));
  actualToken = log.contracts.AuraEternityToken;
  console.log(`- Local Chain (L3):   ${actualToken}`);
} else {
  console.log("- Local Chain (L3):   Deployments log not found.");
}

const webTokenAddr = webEnv.VITE_LOCAL_AUR_TOKEN_ADDRESS;
console.log(`- Web UI (Configured): ${webTokenAddr || "NOT SET"}`);

if (webTokenAddr && actualToken !== "UNKNOWN" && webTokenAddr.toLowerCase() === actualToken.toLowerCase()) {
  console.log("✅ MATCH: Web UI is tracking the correct token contract.");
} else {
  console.log("❌ MISMATCH: Token address in web/.env.local is incorrect.");
}

console.log("\n-------------------------------------------");
if (webEvmAddr && botTestRecipient && webTokenAddr && actualToken !== "UNKNOWN") {
    console.log("🚀 All systems aligned. Distribution should be visible on UI.");
} else {
    console.log("🛠️ Please fix the mismatches above in your .env files.");
}
