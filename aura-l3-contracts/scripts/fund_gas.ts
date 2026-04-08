import { ethers } from "hardhat";

async function main() {
  const userAddress = "0x0Ae34eA7Ebe14cC8484Dc71b882cdC144E600586";
  const [owner] = await ethers.getSigners();

  console.log(`⛽ Funding User Wallet with Gas (ETH): ${userAddress}`);
  
  // Send 10 ETH for Gas Fees
  const tx = await owner.sendTransaction({
    to: userAddress,
    value: ethers.parseEther("10.0")
  });
  
  await tx.wait();

  console.log(`✅ Success! Your wallet now has 10 ETH for Gas Fees.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
