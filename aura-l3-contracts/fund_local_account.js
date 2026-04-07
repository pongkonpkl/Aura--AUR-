const { ethers } = require("hardhat");

async function main() {
  console.log(`[${new Date().toISOString()}] Starting funding script...`);
  
  // 1. Get Signers
  console.log(`[${new Date().toISOString()}] Getting signers...`);
  const [sender] = await ethers.getSigners();
  const receiverAddress = process.env.LOCAL_FUND_RECEIVER || "0xbc846dc93595e918a85c43a0a9d973b04cbe1676";
  const transferAmount = process.env.LOCAL_FUND_AMOUNT || "1.0";
  
  console.log(`[${new Date().toISOString()}] Sender: ${sender.address}`);
  console.log(`[${new Date().toISOString()}] Receiver: ${receiverAddress}`);

  // 2. Initial Balance
  const initialBalance = await ethers.provider.getBalance(receiverAddress);
  console.log(`[${new Date().toISOString()}] Initial Balance: ${ethers.formatEther(initialBalance)} AUR`);

  // 3. Send Transaction
  console.log(`[${new Date().toISOString()}] Sending ${transferAmount} AUR transaction...`);
  const tx = await sender.sendTransaction({
    to: receiverAddress,
    value: ethers.parseEther(transferAmount)
  });

  console.log(`[${new Date().toISOString()}] Transaction hash: ${tx.hash}`);
  
  // 4. Wait for confirmation
  console.log(`[${new Date().toISOString()}] Waiting for confirmation...`);
  const receipt = await tx.wait();
  console.log(`[${new Date().toISOString()}] Transaction confirmed in block ${receipt.blockNumber}`);

  // 5. Final Balance
  const finalBalance = await ethers.provider.getBalance(receiverAddress);
  console.log(`[${new Date().toISOString()}] Final Balance: ${ethers.formatEther(finalBalance)} AUR`);
  
  console.log(`[${new Date().toISOString()}] Funding complete!`);
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Error during funding:`, error);
  process.exitCode = 1;
});
