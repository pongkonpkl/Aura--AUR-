import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

interface DeployOptions {
  config: string;
  network: string;
}

const NETWORKS: Record<string, { rpc: string; factory: string }> = {
  local: {
    rpc: "http://127.0.0.1:8545",
    factory: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  },
  testnet: {
    rpc: "https://rpc2.sepolia.org",
    factory: "0x0000000000000000000000000000000000000000", // Placeholder
  },
  mainnet: {
    rpc: "https://eth.llamarpc.com",
    factory: "0x0000000000000000000000000000000000000000", // Placeholder
  },
};

const AuraL3FactoryABI = [
  "function requestL3Deploy(bytes32 configHash, uint256 salt) external",
  "event RequestL3Deploy(address indexed requester, bytes32 configHash, uint256 salt)",
];

export async function deployL3(options: DeployOptions) {
  const { config: configPath, network } = options;

  console.log(chalk.yellow("🚀 Deploying L3 to Aura Factory...\n"));

  // 1. Load config
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath)) {
    console.log(chalk.red(`❌ Config file not found: ${fullPath}`));
    console.log(chalk.gray(`   Run "aura-l3 create" first to generate a config.`));
    process.exit(1);
  }

  const configJson = fs.readFileSync(fullPath, "utf-8");
  const config = JSON.parse(configJson);
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(configJson));
  const salt = Date.now();

  console.log(chalk.white(`  Network:     ${chalk.cyan(network)}`));
  console.log(chalk.white(`  Config:      ${chalk.cyan(config.name)}`));
  console.log(chalk.white(`  Template:    ${chalk.cyan(config.template)}`));
  console.log(chalk.white(`  Config Hash: ${chalk.gray(configHash)}`));
  console.log(chalk.white(`  Salt:        ${chalk.gray(salt.toString())}\n`));

  // 2. Connect to network
  const net = NETWORKS[network];
  if (!net) {
    console.log(chalk.red(`❌ Unknown network: ${network}. Available: ${Object.keys(NETWORKS).join(", ")}`));
    process.exit(1);
  }

  try {
    const provider = new ethers.JsonRpcProvider(net.rpc);
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(chalk.gray(`  Deployer: ${wallet.address}`));

    const factory = new ethers.Contract(net.factory, AuraL3FactoryABI, wallet);

    console.log(chalk.yellow("\n📡 Submitting deployment request to AuraL3Factory..."));
    
    const tx = await factory.requestL3Deploy(configHash, salt);
    console.log(chalk.gray(`  Tx Hash: ${tx.hash}`));
    
    const receipt = await tx.wait();
    console.log(chalk.green(`\n✅ Deployment request submitted successfully!`));
    console.log(chalk.gray(`  Block: ${receipt?.blockNumber}`));
    console.log(chalk.yellow(`\n🛡️  AI Guardian is now reviewing your L3 configuration...`));
    console.log(chalk.gray(`  Use "aura-l3 status --hash ${configHash}" to check progress.\n`));

  } catch (error: any) {
    if (network !== "local") {
      console.log(chalk.red(`\n❌ Transaction failed: ${error.message}`));
      console.log(chalk.gray("   Make sure the Factory contract is deployed on this network."));
    } else {
      console.log(chalk.red(`\n❌ Local node connection failed.`));
      console.log(chalk.gray("   Run 'npx hardhat node' in the aura-l3-contracts directory first."));
    }
  }
}
