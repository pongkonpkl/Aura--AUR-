import { ethers } from "ethers";
import { runAIAudit, L3Config } from "./ai_reviewer";
import * as dotenv from "dotenv";

dotenv.config();

// MOCK ABI for AuraL3Factory & GuardianOracle to listen to events
const AuraL3FactoryABI = [
  "event RequestL3Deploy(address indexed requester, bytes32 configHash, uint256 salt)"
];
const GuardianOracleABI = [
  "function postAuditResult(bytes32 configHash, bool approved) external"
];

// RPC setup (Defaults to Local Hardhat Node)
const providerUrl = process.env.RPC_URL || "http://127.0.0.1:8545"; 
const provider = new ethers.JsonRpcProvider(providerUrl);

// Set Guardian Wallet
const privateKey = process.env.GUARDIAN_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 
const guardianWallet = new ethers.Wallet(privateKey, provider);

// Placeholder contract addresses (will be replaced by actual deployed addresses)
const factoryAddress = process.env.FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const oracleAddress = process.env.ORACLE_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// Mock fetching from IPFS/Arweave
async function mockFetchConfigFromIPFS(hash: string): Promise<L3Config> {
  console.log(`\n🌐 [IPFS Mock] Fetching config payload for hash: ${hash}`);
  
  // Randomly simulate a malicious payload to test the AI review rejection
  const isMalicious = Math.random() > 0.7; 
  return {
    burnRate: isMalicious ? 0.5 : 1.5,
    hasHeartbeat: true,
    owner: "0xMockUser...",
    intent: isMalicious ? "Honeypot template without liquidity lock" : "Community Sovereign L3 for gaming"
  };
}

async function startGuardianWatcher() {
  console.log("🛡️ Aura AI Guardian Node is online and listening...");
  console.log(`🔗 Connected to RPC: ${providerUrl}`);
  console.log(`💼 Guardian Wallet: ${guardianWallet.address}`);
  console.log(`🏭 Watching Factory: ${factoryAddress}`);
  console.log(`⚖️  Oracle Admin: ${oracleAddress}\n`);
  
  const factory = new ethers.Contract(factoryAddress, AuraL3FactoryABI, provider);
  const oracle = new ethers.Contract(oracleAddress, GuardianOracleABI, guardianWallet);

  factory.on("RequestL3Deploy", async (requester, configHash, salt) => {
    console.log(`\n🚨 New L3 Deployment Request Detected!`);
    console.log(`- Requester: ${requester}`);
    console.log(`- Config Hash: ${configHash}`);
    
    try {
      // 1. Fetch Config mapping
      const l3Config = await mockFetchConfigFromIPFS(configHash);
      
      // 2. AI Guardian Audit
      const auditResult = await runAIAudit(configHash, l3Config);
      
      if (auditResult.approved) {
        console.log(`✅ L3 Config ${configHash} approved by AI.`);
        console.log(`   Reason: ${auditResult.reason}`);
        
        // 3. Post to Oracle On-chain
        console.log("   Submitting approval transaction...");
        try {
            // Note: This will fail if the local hardhat node isn't running or contracts aren't deployed 
            // We use a try/catch to gracefully handle the mock demonstration
            const tx = await oracle.postAuditResult(configHash, true);
            await tx.wait();
            console.log(`📜 ✅ Audit result posted on-chain! Tx: ${tx.hash}`);
        } catch (e: any) {
            console.log(`⚠️ On-chain transaction skipped (Local node/contract might not be ready): ${e.message}`);
        }

      } else {
         console.log(`❌ L3 Config ${configHash} REJECTED.`);
         console.log(`   Reason: ${auditResult.reason}`);
         
         // 4. Optionally post rejection on-chain
         console.log("   Submitting rejection transaction...");
         try {
             const tx = await oracle.postAuditResult(configHash, false);
             await tx.wait();
             console.log(`📜 🛑 Rejection posted on-chain! Tx: ${tx.hash}`);
         } catch (e: any) {
             console.log(`⚠️ On-chain transaction skipped: ${e.message}`);
         }
      }
      
    } catch (error) {
      console.error("Error processing L3 request:", error);
    }
  });
}

startGuardianWatcher().catch(console.error);
