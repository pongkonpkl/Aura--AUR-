import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const poolAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const amount = ethers.parseUnits("10.0", 18);

  const [owner, acc1, acc2, acc3, acc4] = await ethers.getSigners();
  const recipients = [owner.address, acc1.address, acc2.address, acc3.address, acc4.address];

  console.log("🛠️ Preparing Super Seeding for 5 accounts...");
  
  const token = await ethers.getContractAt("AuraEternityToken", tokenAddress, owner);

  // 1. Temporarily set owner as distributor
  await (await token.setDistributor(owner.address)).wait();
  
  for (const adr of recipients) {
    console.log(`📡 Minting 10.0 AUR to ${adr}...`);
    await (await token.mint(adr, amount)).wait();
  }

  // 2. Set distributor back to EternityPool
  await (await token.setDistributor(poolAddress)).wait();

  console.log(`✅ Success! All 5 test accounts now have 10.0 AUR each.`);
  console.log(`Primary Account (#0): ${owner.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
