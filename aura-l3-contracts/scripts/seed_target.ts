import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const poolAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const userAddress = "0x0Ae34eA7Ebe14cC8484Dc71b882cdC144E600586";
  const amount = ethers.parseUnits("10.0", 18);

  const [owner] = await ethers.getSigners();
  console.log(`🛠️ Funding User Wallet: ${userAddress}`);
  
  const token = await ethers.getContractAt("AuraEternityToken", tokenAddress, owner);

  // set owner as temporary distributor
  await (await token.setDistributor(owner.address)).wait();
  
  console.log(`📡 Minting 10.0 AUR to user account...`);
  await (await token.mint(userAddress, amount)).wait();

  // set back
  await (await token.setDistributor(poolAddress)).wait();

  console.log(`✅ Success! Your wallet ${userAddress} is now funded with 10.0 AUR.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
