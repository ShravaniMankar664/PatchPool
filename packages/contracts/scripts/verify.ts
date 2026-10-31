import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import hre from "hardhat";
import { assertDeploymentNetworkConfigured, MST_NETWORKS } from "../../shared/src/networks";
import {
  getLatestPendingDeployment,
  updatePendingDeployment,
} from "./lib/writeDeployment";
import { assertDeploymentSender } from "./lib/deploymentSafety";

const CHAIN_IDS = { testnet: BigInt(MST_NETWORKS.legacyTestnet.chainId), mainnet: BigInt(MST_NETWORKS.mainnet.chainId) } as const;
const VERIFY_TIMEOUT_MS = 120_000;

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "MSTScan verification failed.";
  const apiKey = process.env.MSTSCAN_API_KEY;
  return apiKey ? message.split(apiKey).join("[redacted]") : message;
}

async function verifyWithTimeout(network: "testnet" | "mainnet", address: string, constructorArguments: unknown[]): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      network === "mainnet"
        ? hre.run("verify:blockscout", { address })
        : hre.run("verify:verify", { address, constructorArguments }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("MSTScan verification timed out after 120 seconds.")), VERIFY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  const network = hre.network.name;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("Verification must target the explicit MST Testnet or Mainnet network.");
  }
  assertDeploymentNetworkConfigured(network);
  const pending = getLatestPendingDeployment(network);
  if (!pending) throw new Error(`No pending ${network} deployment exists; the active registry was not changed.`);
  if (pending.status === "finalized") throw new Error("This deployment is already finalized in the active registry.");

  const transactionHash = pending.contracts.PatchPool?.deploymentTransactionHash;
  if (!transactionHash) throw new Error("Pending deployment record has no PatchPool transaction hash.");

  const verifiedContracts: string[] = [];
  try {
    const expectedChainId = CHAIN_IDS[network];
    const actualChainId = (await hre.ethers.provider.getNetwork()).chainId;
    if (actualChainId !== expectedChainId || pending.chainId !== Number(expectedChainId)) {
      throw new Error(`Pending deployment or RPC chain ID does not match MST ${network}.`);
    }

    const sourcePath = path.join(__dirname, "..", "contracts", "PatchPool.sol");
    const sourceHash = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
    if (sourceHash !== pending.patchPoolSourceSha256) {
      throw new Error("Current PatchPool source differs from the source hash captured at deployment.");
    }

    const patchPool = pending.contracts.PatchPool;
    if (pending.deployerAddress) {
      const deploymentTransaction = await hre.ethers.provider.getTransaction(transactionHash);
      assertDeploymentSender(pending.deployerAddress, deploymentTransaction?.from);
    }
    const patchPoolArtifact = await hre.artifacts.readArtifact("PatchPool");
    const currentPatchPoolHash = hre.ethers.keccak256(patchPoolArtifact.deployedBytecode);
    if (patchPool.deploymentBytecodeHash !== currentPatchPoolHash) {
      throw new Error("Current PatchPool artifact differs from the artifact recorded at deployment.");
    }

    for (const [name, contract] of Object.entries(pending.contracts)) {
      const artifact = await hre.artifacts.readArtifact(name);
      const code = await hre.ethers.provider.getCode(contract.address);
      if (code === "0x" || hre.ethers.keccak256(code) !== contract.deploymentBytecodeHash) {
        throw new Error(`${name} runtime bytecode at the recorded address does not match its deployment artifact.`);
      }

      const receipt = await hre.ethers.provider.getTransactionReceipt(contract.deploymentTransactionHash);
      if (
        !receipt || receipt.status !== 1 || receipt.blockNumber !== contract.deploymentBlock ||
        receipt.contractAddress?.toLowerCase() !== contract.address.toLowerCase()
      ) {
        throw new Error(`${name} deployment receipt does not match the pending record.`);
      }

      if (hre.ethers.keccak256(artifact.deployedBytecode) !== contract.deploymentBytecodeHash) {
        throw new Error(`Current ${name} artifact differs from the pending deployment record.`);
      }
    }

    for (const [name, contract] of Object.entries(pending.contracts)) {
      console.log(`Submitting ${name} source verification to MSTScan at ${contract.address}...`);
      await verifyWithTimeout(network, contract.address, contract.constructorArguments);
      verifiedContracts.push(name);
      console.log(`MSTScan confirmed ${name} verification.`);
    }

    updatePendingDeployment(network, transactionHash, (record) => ({
      ...record,
      status: "verified",
      verifiedAt: new Date().toISOString(),
      verifiedContracts,
      verificationError: undefined,
    }));
    console.log("Pending deployment is verified. Run the explicit finalize command to update the active registry.");
  } catch (error) {
    const message = errorText(error);
    updatePendingDeployment(network, transactionHash, (record) => ({
      ...record,
      status: "verification_failed",
      verifiedAt: undefined,
      verifiedContracts,
      verificationError: message,
    }));
    console.error(`Deployment remains unverified; active registry and frontend write gates were not changed. ${message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(errorText(error));
  process.exitCode = 1;
});
