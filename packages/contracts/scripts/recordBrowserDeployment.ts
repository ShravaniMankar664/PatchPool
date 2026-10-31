import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { MST_NETWORKS } from "../../shared/src/networks";
import { assertDeploymentSender } from "./lib/deploymentSafety";
import {
  assertNoUnresolvedDeployment,
  recordPendingDeployment,
  type PendingDeployment,
} from "./lib/writeDeployment";

const EXPECTED_DEPLOYER = "0x9C314BFEF33525582e8Fb5B1EFaDC77e94d89E27";

// Fail immediately — before any async work — so the message is never buried by
// npm lifecycle error wrapping. process.exit() flushes stdio synchronously.
const BROWSER_DEPLOYMENT_RECORD_FILE = process.env.PATCHPOOL_BROWSER_DEPLOYMENT_RECORD;
if (!BROWSER_DEPLOYMENT_RECORD_FILE) {
  process.stderr.write(
    "Error: PATCHPOOL_BROWSER_DEPLOYMENT_RECORD is not set.\n" +
    "Usage: PATCHPOOL_BROWSER_DEPLOYMENT_RECORD=<path/to/record.json> npm run record:testnet\n" +
    "       The file is the deployment record downloaded from the BridgeKey wallet flow.\n"
  );
  process.exit(1);
}

function readCandidate(): PendingDeployment {
  // BROWSER_DEPLOYMENT_RECORD_FILE is guaranteed non-empty by the module-level
  // process.exit(1) guard above, but TypeScript does not narrow through process.exit.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return JSON.parse(fs.readFileSync(path.resolve(BROWSER_DEPLOYMENT_RECORD_FILE!), "utf8")) as PendingDeployment;
}

async function main() {
  if (hre.network.name !== "testnet") {
    throw new Error("Browser deployment records may only be imported with the explicit Legacy Testnet network target.");
  }
  const expectedChainId = BigInt(MST_NETWORKS.legacyTestnet.chainId);
  const chain = await hre.ethers.provider.getNetwork();
  if (chain.chainId !== expectedChainId) {
    throw new Error(`Wrong MST Legacy Testnet chain ID: expected ${expectedChainId}, received ${chain.chainId}.`);
  }

  const record = readCandidate();
  if (
    record.network !== "testnet" || record.chainId !== Number(expectedChainId) ||
    record.status !== "pending_verification" || !Number.isFinite(Date.parse(record.recordedAt))
  ) {
    throw new Error("Downloaded deployment record has an invalid network, chain, state, or timestamp.");
  }
  assertDeploymentSender(EXPECTED_DEPLOYER, record.deployerAddress);
  const contractNames = Object.keys(record.contracts ?? {});
  if (contractNames.length !== 1 || contractNames[0] !== "PatchPool") {
    throw new Error("Downloaded record must contain exactly the PatchPool deployment.");
  }

  const sourcePath = path.join(__dirname, "..", "contracts", "PatchPool.sol");
  const source = fs.readFileSync(sourcePath);
  const sourceHash = hre.ethers.sha256(source);
  if (record.patchPoolSourceSha256 !== sourceHash.slice(2)) {
    throw new Error("Downloaded record source hash does not match the current PatchPool.sol file.");
  }

  const artifact = await hre.artifacts.readArtifact("PatchPool");
  const deployment = record.contracts.PatchPool;
  const abiMatches = JSON.stringify(deployment.abi) === JSON.stringify(artifact.abi);
  if (!abiMatches || deployment.constructorArguments.length !== 0) {
    throw new Error("Downloaded ABI or constructor arguments do not match the compiled PatchPool artifact.");
  }
  const artifactHash = hre.ethers.keccak256(artifact.deployedBytecode);
  if (deployment.deploymentBytecodeHash !== artifactHash) {
    throw new Error("Downloaded runtime hash does not match the compiled PatchPool artifact.");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(deployment.address) || !/^0x[0-9a-fA-F]{64}$/.test(deployment.deploymentTransactionHash)) {
    throw new Error("Downloaded record is missing a valid contract address or deployment transaction hash.");
  }

  const [transaction, receipt, code] = await Promise.all([
    hre.ethers.provider.getTransaction(deployment.deploymentTransactionHash),
    hre.ethers.provider.getTransactionReceipt(deployment.deploymentTransactionHash),
    hre.ethers.provider.getCode(deployment.address),
  ]);
  assertDeploymentSender(EXPECTED_DEPLOYER, transaction?.from);
  if (
    !receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== deployment.address.toLowerCase() ||
    receipt.blockNumber !== deployment.deploymentBlock
  ) {
    throw new Error("Testnet receipt does not match the downloaded address, status, and block number.");
  }
  if (code === "0x" || hre.ethers.keccak256(code) !== artifactHash) {
    throw new Error("On-chain PatchPool runtime bytecode does not match the compiled artifact.");
  }

  assertNoUnresolvedDeployment("testnet");
  recordPendingDeployment(record);
  console.log(`Recorded verified receipt for PatchPool at ${deployment.address}.`);
  console.log(`Transaction: ${deployment.deploymentTransactionHash}`);
  console.log(`Block: ${deployment.deploymentBlock}`);
  console.log("Record status is pending_verification; active registry and frontend write gates were not changed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to import the BridgeKey deployment record.");
  process.exitCode = 1;
});
