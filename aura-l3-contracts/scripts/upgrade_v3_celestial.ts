import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Upgrading Aura L3 Matrix (Deflationary Protocol)");

  // 1. Redeploy
  const AuraEternityToken = await ethers.getContractFactory("AuraEternityToken");
  const auraToken = await AuraEternityToken.deploy();
  await auraToken.waitForDeployment();
  const auraTokenAddress = await auraToken.getAddress();
  console.log("✅ New Aura Token Deployed:", auraTokenAddress);

  const EternityPool = await ethers.getContractFactory("EternityPool");
  const eternityPool = await EternityPool.deploy(auraTokenAddress);
  await eternityPool.waitForDeployment();
  const poolAddress = await eternityPool.getAddress();

  await (await auraToken.setDistributor(deployer.address)).wait();

  // 2. Seed the User's Wallet immediately
  const userAddress = "0x0Ae34eA7Ebe14cC8484Dc71b882cdC144E600586";
  console.log("📡 Seeding new deflationary AUR to user...");
  await (await auraToken.mint(userAddress, ethers.parseUnits("100.0", 18))).wait();

  // Return minting power to pool
  await (await auraToken.setDistributor(poolAddress)).wait();

  // 3. Update the UI's .env.local file
  const envPath = path.join(__dirname, "../../aura-wallet-ledger/web/.env.local");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(
    /VITE_LOCAL_AUR_TOKEN_ADDRESS=.*/,
    `VITE_LOCAL_AUR_TOKEN_ADDRESS=${auraTokenAddress}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated UI configuration with new Token Address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
