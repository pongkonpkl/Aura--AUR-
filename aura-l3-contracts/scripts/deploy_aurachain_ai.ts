import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying AuraChainAI Ecosystem with account:", deployer.address);

  // 1. Deploy Reputation NFT
  console.log("⏳ Deploying AuraReputationNFT...");
  const AuraReputationNFT = await ethers.getContractFactory("AuraReputationNFT");
  const reputationNFT = await AuraReputationNFT.deploy();
  await reputationNFT.waitForDeployment();
  const nftAddress = await reputationNFT.getAddress();
  console.log("✅ AuraReputationNFT deployed to:", nftAddress);

  // 2. Deploy Reward Distributor (Proxy/Wrapper for EternityPool)
  // Replace with actual EternityPool address if already deployed
  const ETERNITY_POOL_ADDRESS = process.env.ETERNITY_POOL_ADDRESS || "0x0000000000000000000000000000000000000000"; 
  console.log("⏳ Deploying AuraRewardDistributor linking to Pool:", ETERNITY_POOL_ADDRESS);
  
  const AuraRewardDistributor = await ethers.getContractFactory("AuraRewardDistributor");
  const distributor = await AuraRewardDistributor.deploy(ETERNITY_POOL_ADDRESS);
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();
  console.log("✅ AuraRewardDistributor deployed to:", distributorAddress);

  // 3. Link NFT to Distributor
  console.log("⏳ Linking NFT to Distributor...");
  await distributor.setReputationNFT(nftAddress);
  console.log("✅ Linked.");

  // 4. Link Distributor to EternityPool (Authorize distributor to trigger rewards)
  if (ETERNITY_POOL_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    console.log("⏳ Authorizing Distributor in EternityPool...");
    const EternityPool = await ethers.getContractAt("EternityPool", ETERNITY_POOL_ADDRESS);
    const tx = await EternityPool.setDistributor(distributorAddress);
    await tx.wait();
    console.log("✅ Authorized.");
  }

  // 4. Set Minting Authority (if needed)
  // Usually, ReputationNFT needs to grant certain roles to the distributor or vice versa
  // but in this implementation, the distributor reads from the NFT.

  console.log("\n--- DEPLOYMENT SUMMARY ---");
  console.log("Reputation NFT:", nftAddress);
  console.log("Reward Distributor:", distributorAddress);
  console.log("---------------------------\n");
  
  console.log("📝 Next Steps:");
  console.log("1. Update .env in aura-guardian-node with REWARD_DISTRIBUTOR_ADDRESS");
  console.log("2. Update constants in aura-wallet-ledger/web/src/constants.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
