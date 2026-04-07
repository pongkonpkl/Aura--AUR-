import { ethers } from "hardhat";

const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

async function main() {
  const tokenAddress = process.env.LOCAL_TOKEN_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const userAddress = process.env.LOCAL_FUND_RECEIVER || "0xbc846dc93595e918a85c43a0a9d973b04cbe1676";

  const token = await ethers.getContractAt(TOKEN_ABI, tokenAddress);
  const balance = await token.balanceOf(userAddress);
  console.log(`AUR token balance for ${userAddress}: ${ethers.formatEther(balance)} AUR`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
