import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying AuraChainAI Ecosystem with account:", deployer.address);

  // 1) Deploy AUR token
  console.log("⏳ Deploying AuraEternityToken...");
  const AuraEternityToken = await ethers.getContractFactory("AuraEternityToken");
  const auraToken = await AuraEternityToken.deploy();
  await auraToken.waitForDeployment();
  const auraTokenAddress = await auraToken.getAddress();
  console.log("✅ AuraEternityToken deployed to:", auraTokenAddress);

  // 2) Deploy EternityPool
  console.log("⏳ Deploying EternityPool...");
  const EternityPool = await ethers.getContractFactory("EternityPool");
  const eternityPool = await EternityPool.deploy(auraTokenAddress);
  await eternityPool.waitForDeployment();
  const poolAddress = await eternityPool.getAddress();
  console.log("✅ EternityPool deployed to:", poolAddress);

  // Token mint authority must point to EternityPool
  console.log("⏳ Setting Aura token distributor to EternityPool...");
  const setTokenDistTx = await auraToken.setDistributor(poolAddress);
  await setTokenDistTx.wait();
  console.log("✅ Aura token distributor set.");

  // 3) Deploy Reputation NFT
  console.log("⏳ Deploying AuraReputationNFT...");
  const AuraReputationNFT = await ethers.getContractFactory("AuraReputationNFT");
  const reputationNFT = await AuraReputationNFT.deploy();
  await reputationNFT.waitForDeployment();
  const nftAddress = await reputationNFT.getAddress();
  console.log("✅ AuraReputationNFT deployed to:", nftAddress);

  // 4) Deploy Reward Distributor wrapper
  console.log("⏳ Deploying AuraRewardDistributor linking to Pool:", poolAddress);
  const AuraRewardDistributor = await ethers.getContractFactory("AuraRewardDistributor");
  const distributor = await AuraRewardDistributor.deploy(poolAddress);
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();
  console.log("✅ AuraRewardDistributor deployed to:", distributorAddress);

  // 5) Link NFT to Distributor
  console.log("⏳ Linking NFT to Distributor...");
  const setRepTx = await distributor.setReputationNFT(nftAddress);
  await setRepTx.wait();
  console.log("✅ Linked.");

  // 6) Authorize distributor to trigger minute payouts on pool
  console.log("⏳ Authorizing RewardDistributor in EternityPool...");
  const setPoolDistTx = await eternityPool.setDistributor(distributorAddress);
  await setPoolDistTx.wait();
  console.log("✅ Authorized.");

  // Optional: pre-authorize a guardian address (if different from deployer).
  const guardianAddress = process.env.GUARDIAN_ADDRESS;
  if (guardianAddress && guardianAddress !== deployer.address) {
    console.log("⏳ Adding guardian:", guardianAddress);
    const addGuardianTx = await distributor.addGuardian(guardianAddress);
    await addGuardianTx.wait();
    console.log("✅ Guardian added.");
  }

  console.log("\n--- DEPLOYMENT SUMMARY ---");
  console.log("Aura Token:", auraTokenAddress);
  console.log("Eternity Pool:", poolAddress);
  console.log("Reputation NFT:", nftAddress);
  console.log("Reward Distributor:", distributorAddress);
  console.log("---------------------------\n");
  
  console.log("📝 Next Steps:");
  console.log("1. Set in aura-guardian-node/.env:");
  console.log(`   REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`   DISTRIBUTOR_PRIVATE_KEY=<owner key for ${deployer.address}>`);
  console.log("2. Run distributor bot every minute (cron/process manager).");
  console.log("3. Update frontend constants if needed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
