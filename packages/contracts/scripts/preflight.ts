import hre from "hardhat";
import { inspectDeployment } from "./lib/deploymentPreflight";

async function main() {
  const network = hre.network.name;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("Preflight requires an explicit MST Testnet or Mainnet target.");
  }
  const result = await inspectDeployment(hre, network);
  if (!result.configured) {
    console.log(`MST ${network === "testnet" ? "Testnet" : "Mainnet"} signer: not configured`);
    console.log(network === "testnet"
      ? "BridgeKey is required for Testnet signing; this CLI intentionally has no Testnet key signer."
      : "Configure a dedicated Mainnet signer locally only when Mainnet deployment is explicitly authorized.");
    console.log(`Confirmed chain ID: ${result.chainId}`);
    console.log(`Estimated deployment budget (20% margin; placeholder sender): ${hre.ethers.formatEther(result.estimatedBudget)} ${result.currencySymbol}`);
    console.log("No transaction was created or sent.");
    return;
  }

  console.log(`Deployer: ${result.deployerAddress}`);
  console.log(`Confirmed chain ID: ${result.chainId}`);
  console.log(`Wallet balance: ${hre.ethers.formatEther(result.balance)} ${result.currencySymbol}`);
  console.log(`Estimated deployment budget (20% margin): ${hre.ethers.formatEther(result.estimatedBudget)} ${result.currencySymbol}`);
  console.log(`Budget sufficient: ${result.sufficientBalance ? "yes" : "no"}`);
  console.log("Preflight is read-only; no transaction was created or sent.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Testnet preflight failed.";
  const key = process.env.MST_TESTNET_PRIVATE_KEY ?? process.env.MST_MAINNET_PRIVATE_KEY;
  console.error(key ? message.split(key).join("[redacted]") : message);
  process.exitCode = 1;
});
