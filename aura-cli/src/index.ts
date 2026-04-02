#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { createL3 } from "./commands/create";
import { deployL3 } from "./commands/deploy";
import { statusL3 } from "./commands/status";

const program = new Command();

console.log(chalk.cyan(`
   █████╗ ██╗   ██╗██████╗  █████╗     ██╗     ██████╗ 
  ██╔══██╗██║   ██║██╔══██╗██╔══██╗    ██║     ╚════██╗
  ███████║██║   ██║██████╔╝███████║    ██║      █████╔╝
  ██╔══██║██║   ██║██╔══██╗██╔══██║    ██║      ╚═══██╗
  ██║  ██║╚██████╔╝██║  ██║██║  ██║    ███████╗██████╔╝
  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝╚═════╝
`));
console.log(chalk.gray("  Sovereign Rollup Framework CLI v1.0.0\n"));

program
  .name("aura-l3")
  .description("Aura L3 CLI — Create, deploy, and manage Sovereign Rollups")
  .version("1.0.0");

program
  .command("create")
  .description("Create a new L3 Sovereign Rollup configuration")
  .option("-t, --template <template>", "Template to use (pay, soul, mind, gaming, defi)", "pay")
  .option("-n, --name <name>", "Name for your L3 chain", "My Aura L3")
  .option("--burn <rate>", "Burn rate in percent (min 1%)", "1")
  .option("--heartbeat", "Enable Heartbeat Mining module", true)
  .action(createL3);

program
  .command("deploy")
  .description("Deploy L3 config to Aura Factory (requires AI Guardian approval)")
  .option("-c, --config <path>", "Path to L3 config JSON", "./aura-l3-config.json")
  .option("--network <network>", "Target network (local, testnet, mainnet)", "testnet")
  .action(deployL3);

program
  .command("status")
  .description("Check deployment status and AI Guardian audit result")
  .option("--hash <configHash>", "Config hash to check")
  .action(statusL3);

program.parse();
