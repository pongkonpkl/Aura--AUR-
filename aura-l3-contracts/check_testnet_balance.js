const { ethers } = require("hardhat");

async function main() {
  const address = "0xbc846dc93595e918a85c43a0a9d973b04cbe1676";
  const balance = await ethers.provider.getBalance(address);
  console.log(`Balance of ${address}: ${ethers.formatEther(balance)} AURA`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
