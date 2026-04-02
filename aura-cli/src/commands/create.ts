import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

interface CreateOptions {
  template: string;
  name: string;
  burn: string;
  heartbeat: boolean;
}

const TEMPLATES: Record<string, object> = {
  pay: {
    description: "Payment & Transfer focused L3",
    modules: ["burn", "heartbeat", "account-abstraction", "paymaster"],
    defaultTPS: 10000,
  },
  soul: {
    description: "Identity & Reputation L3 (Soulbound)",
    modules: ["burn", "heartbeat", "soulbound-nft", "reputation"],
    defaultTPS: 5000,
  },
  mind: {
    description: "AI Agent & Compute L3",
    modules: ["burn", "heartbeat", "ai-agent-runtime", "compute-oracle"],
    defaultTPS: 3000,
  },
  gaming: {
    description: "Gaming & Metaverse L3",
    modules: ["burn", "heartbeat", "nft-engine", "marketplace"],
    defaultTPS: 15000,
  },
  defi: {
    description: "DeFi & AMM L3",
    modules: ["burn", "heartbeat", "amm-core", "lending", "oracle"],
    defaultTPS: 8000,
  },
};

export async function createL3(options: CreateOptions) {
  const { template, name, burn, heartbeat } = options;
  const burnRate = parseFloat(burn);

  console.log(chalk.yellow("⚙️  Creating new Aura L3 Sovereign Rollup...\n"));

  // Validate
  if (burnRate < 1) {
    console.log(chalk.red("❌ Error: Burn rate must be >= 1% (Aura Manifesto requirement)"));
    process.exit(1);
  }
  if (!heartbeat) {
    console.log(chalk.red("❌ Error: Heartbeat module is mandatory (Aura Manifesto requirement)"));
    process.exit(1);
  }

  const tmpl = TEMPLATES[template];
  if (!tmpl) {
    console.log(chalk.red(`❌ Unknown template: ${template}. Available: ${Object.keys(TEMPLATES).join(", ")}`));
    process.exit(1);
  }

  console.log(chalk.white(`  Template:  ${chalk.cyan(template)}`));
  console.log(chalk.white(`  Name:      ${chalk.cyan(name)}`));
  console.log(chalk.white(`  Burn Rate: ${chalk.cyan(burnRate + "%")}`));
  console.log(chalk.white(`  Heartbeat: ${chalk.green("✓ Enabled")}`));
  console.log(chalk.white(`  Modules:   ${chalk.cyan((tmpl as any).modules.join(", "))}\n`));

  // Generate config
  const config = {
    name,
    template,
    version: "1.0.0",
    burnRateBps: burnRate * 100, // basis points
    heartbeatEnabled: true,
    modules: (tmpl as any).modules,
    targetTPS: (tmpl as any).defaultTPS,
    settlement: "aura-l2",
    createdAt: new Date().toISOString(),
  };

  // Generate configHash
  const configJson = JSON.stringify(config, null, 2);
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(configJson));

  const outputPath = path.resolve("./aura-l3-config.json");
  fs.writeFileSync(outputPath, configJson, "utf-8");

  console.log(chalk.green(`✅ L3 Config created successfully!`));
  console.log(chalk.gray(`   File: ${outputPath}`));
  console.log(chalk.gray(`   Config Hash: ${configHash}`));
  console.log(chalk.yellow(`\n📋 Next step: Run "aura-l3 deploy" to submit to AI Guardian for review.\n`));
}
