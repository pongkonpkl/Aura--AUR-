import { ethers } from "hardhat";

async function main() {
  const poolAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const recipient = "0xbc846dc93595e918a85c43a0a9d973b04cbe1676";
  
  console.log(`📡 Distributing 1.0 AUR via EternityPool to ${recipient}...`);
  
  const [owner] = await ethers.getSigners();
  const pool = await ethers.getContractAt("EternityPool", poolAddress, owner);

  // Distribute focusing all 1.0 emission to the recipient for this test slot
  // Note: Only works once per minute due to contract rules
  try {
    const tx = await pool.distribute([recipient], [1000]);
    await tx.wait();
    console.log(`✅ Success! 1.0 AUR has been distributed according to protocol rules.`);
    console.log(`🔗 Tx Hash: ${tx.hash}`);
  } catch (e: any) {
    if (e.message.includes("Already this minute")) {
       console.log("⚠️ This minute was already processed. Please wait 60 seconds or check your balance.");
    } else {
       throw e;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
