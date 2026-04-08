import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const poolAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const recipient = "0xbc846dc93595e918a85c43a0a9d973b04cbe1676";
  const amount = ethers.parseUnits("1.0", 18);

  const [owner] = await ethers.getSigners();
  const token = await ethers.getContractAt("AuraEternityToken", tokenAddress, owner);

  console.log("🛠️ Preparing direct minting for test...");
  
  // 1. Temporarily set owner as distributor to allow direct minting for test
  const setDist1 = await token.setDistributor(owner.address);
  await setDist1.wait();
  
  // 2. Mint Exactly 1.0 AUR
  console.log(`📡 Minting 1.0 AUR to ${recipient}...`);
  const mintTx = await token.mint(recipient, amount);
  await mintTx.wait();

  // 3. Set distributor back to EternityPool
  const setDist2 = await token.setDistributor(poolAddress);
  await setDist2.wait();

  console.log(`✅ Success! 1.0 AUR is now in your Universal Balance.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
