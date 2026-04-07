import { ethers } from "hardhat";

const DISTRIBUTOR_ABI = [
  "function currentMinute() view returns (uint256)",
  "function getDistributionState(uint256 slotId) view returns (uint8)",
  "function approveDistribution(uint256 slotId) external",
  "function executeDistribution(uint256 slotId) external"
];

async function main() {
  const distributorAddress = process.env.LOCAL_DISTRIBUTOR_ADDRESS || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const distributor = await ethers.getContractAt(DISTRIBUTOR_ABI, distributorAddress);

  const nowSlot = Number(await distributor.currentMinute());
  let targetSlot = -1;
  let targetState = -1;

  for (let i = 0; i <= 5; i++) {
    const slot = nowSlot - i;
    const state = Number(await distributor.getDistributionState(slot));
    if (state === 1 || state === 2) {
      targetSlot = slot;
      targetState = state;
      break;
    }
  }

  if (targetSlot === -1) {
    console.log("No PENDING/APPROVED slot found to finalize.");
    return;
  }

  console.log(`Found slot ${targetSlot} with state ${targetState}`);
  if (targetState === 1) {
    const approveTx = await distributor.approveDistribution(targetSlot);
    await approveTx.wait();
    console.log(`Approved slot ${targetSlot}: ${approveTx.hash}`);
  }

  const executeTx = await distributor.executeDistribution(targetSlot);
  await executeTx.wait();
  console.log(`Executed slot ${targetSlot}: ${executeTx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
