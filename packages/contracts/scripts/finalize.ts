import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import hre from "hardhat";
import { assertDeploymentNetworkConfigured, MST_NETWORKS } from "../../shared/src/networks";
import promptSyncFactory from "prompt-sync";
import { assertDeploymentCanBeActivated, assertDeploymentSender } from "./lib/deploymentSafety";
import {
  getActiveDeployments,
  getLatestPendingDeployment,
  updatePendingDeployment,
  writeVerifiedDeploymentToRegistry,
} from "./lib/writeDeployment";

const CHAIN_IDS = { testnet: BigInt(MST_NETWORKS.legacyTestnet.chainId), mainnet: BigInt(MST_NETWORKS.mainnet.chainId) } as const;

async function main() {
  const network = hre.network.name;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("Finalization requires an explicit MST Testnet or Mainnet target.");
  }
  assertDeploymentNetworkConfigured(network);

  const pending = getLatestPendingDeployment(network);
  if (!pending) throw new Error(`No pending ${network} deployment exists.`);
  if (pending.status !== "verified" && pending.status !== "finalized") {
    throw new Error(`Refusing to finalize a ${network} deployment with status "${pending.status}".`);
  }
  if (!pending.verifiedAt) throw new Error("Pending deployment has no successful MSTScan verification timestamp.");

  const expectedChainId = CHAIN_IDS[network];
  const actualChainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (actualChainId !== expectedChainId || pending.chainId !== Number(expectedChainId)) {
    throw new Error(`Pending deployment or RPC chain ID does not match MST ${network}.`);
  }

  const patchPool = pending.contracts.PatchPool;
  if (!patchPool?.deploymentTransactionHash || !patchPool.deploymentBlock || !patchPool.address) {
    throw new Error("Pending record is missing required PatchPool deployment evidence.");
  }

  const artifact = await hre.artifacts.readArtifact("PatchPool");
  const artifactHash = hre.ethers.keccak256(artifact.deployedBytecode);
  const sourcePath = path.join(__dirname, "..", "contracts", "PatchPool.sol");
  const sourceHash = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
  if (artifactHash !== patchPool.deploymentBytecodeHash || sourceHash !== pending.patchPoolSourceSha256) {
    throw new Error(`Current PatchPool source/artifact does not match the verified MST ${network} deployment.`);
  }

  const code = await hre.ethers.provider.getCode(patchPool.address);
  if (code === "0x" || hre.ethers.keccak256(code) !== artifactHash) {
    throw new Error("Deployed PatchPool bytecode does not match the verified local artifact.");
  }
  const receipt = await hre.ethers.provider.getTransactionReceipt(patchPool.deploymentTransactionHash);
  if (pending.deployerAddress) {
    const deploymentTransaction = await hre.ethers.provider.getTransaction(patchPool.deploymentTransactionHash);
    assertDeploymentSender(pending.deployerAddress, deploymentTransaction?.from);
  }
  if (
    !receipt || receipt.status !== 1 || receipt.blockNumber !== patchPool.deploymentBlock ||
    receipt.contractAddress?.toLowerCase() !== patchPool.address.toLowerCase()
  ) {
    throw new Error(`MST ${network} deployment receipt does not match the verified pending record.`);
  }

  const active = getActiveDeployments()[network]?.PatchPool;
  assertDeploymentCanBeActivated(pending, network, Number(actualChainId), active);
  const alreadyRegistered = active?.address.toLowerCase() === patchPool.address.toLowerCase() &&
    active.deploymentTransactionHash?.toLowerCase() === patchPool.deploymentTransactionHash.toLowerCase() &&
    active.deploymentBytecodeHash === patchPool.deploymentBytecodeHash;
  if (pending.status === "finalized" || alreadyRegistered) {
    if (!alreadyRegistered) throw new Error(`Finalized ${network} record does not match the active registry.`);
    writeVerifiedDeploymentToRegistry(pending);
    if (pending.status !== "finalized") {
      updatePendingDeployment(network, patchPool.deploymentTransactionHash, (record) => ({ ...record, status: "finalized" }));
    }
    console.log(`Verified MST ${network} deployment is registered at ${patchPool.address}; registry files were synchronized.`);
    console.log("Frontend write gates remain disabled.");
    return;
  }

  console.log(`Verified MST ${network} PatchPool: ${patchPool.address}`);
  if (active?.address) console.log(`Current active MST ${network} address will be replaced: ${active.address}`);
  const prompt = promptSyncFactory({ sigint: true });
  const expectedPhrase = `finalize verified MST ${network === "testnet" ? "Testnet" : "Mainnet"} deployment`;
  const phrase = prompt(`Type '${expectedPhrase}' to update the active registry: `);
  if (phrase !== expectedPhrase) throw new Error("Finalization cancelled; active registry was not changed.");

  writeVerifiedDeploymentToRegistry(pending);
  updatePendingDeployment(network, patchPool.deploymentTransactionHash, (record) => ({ ...record, status: "finalized" }));
  console.log(`Active MST ${network} ABI/address registry updated after verification.`);
  console.log("Both frontend write gates remain disabled and require a separate deliberate code change.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "MST deployment finalization failed.");
  process.exitCode = 1;
});
