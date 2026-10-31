import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import hre from "hardhat";
import promptSyncFactory from "prompt-sync";
import { deployPatchPool } from "../deploy.config";
import { assertDeploymentNetworkConfigured, MST_NETWORKS } from "../../shared/src/networks";
import { assertNoUnresolvedDeployment, recordPendingDeployment, type ContractDeployment } from "./lib/writeDeployment";

async function main() {
  const network = hre.network.name;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(`Deployment is restricted to explicit MST networks; received "${network}".`);
  }
  assertDeploymentNetworkConfigured(network);

  assertNoUnresolvedDeployment(network);

  if (network === "testnet") {
    throw new Error(
      "Testnet deployment through this CLI is disabled: it cannot use the required BridgeKey wallet. Do not configure or use a private key; deployment requires an approved BridgeKey transaction flow. No transaction was sent."
    );
  }

  const expectedChainId = BigInt(MST_NETWORKS.mainnet.chainId);
  const actualChainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Wrong ${network} chain ID: expected ${expectedChainId}, received ${actualChainId}. Deployment cancelled.`
    );
  }

  const keyVariable = "MST_MAINNET_PRIVATE_KEY";
  if (!process.env[keyVariable]) throw new Error(`${keyVariable} must be supplied in the current process environment through a hidden local prompt; wallet credentials are never read from .env.local or chat.`);

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error(`No deployer signer is configured for ${network}.`);
  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  const feeData = await hre.ethers.provider.getFeeData();
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (feePerGas === null) throw new Error("RPC did not provide a gas price; deployment cost is unknown.");

  const patchPoolFactory = await hre.ethers.getContractFactory("PatchPool", deployer);
  const patchPoolRequest = await patchPoolFactory.getDeployTransaction();
  if (!patchPoolRequest.data) throw new Error("PatchPool deployment bytecode is missing from local artifacts.");
  const patchPoolGas = await hre.ethers.provider.estimateGas({ from: deployerAddress, data: patchPoolRequest.data });
  const estimatedBudget = (patchPoolGas * feePerGas * 120n) / 100n;
  if (balance < estimatedBudget) {
    throw new Error(
      `Deployer balance ${hre.ethers.formatEther(balance)} is below the estimated deployment budget ${hre.ethers.formatEther(estimatedBudget)}.`
    );
  }

  const patchPoolArtifact = await hre.artifacts.readArtifact("PatchPool");
  const patchPoolSourcePath = path.join(__dirname, "..", "contracts", "PatchPool.sol");
  const patchPoolSourceSha256 = createHash("sha256").update(fs.readFileSync(patchPoolSourcePath)).digest("hex");

  console.log("MST Mainnet deployment preflight");
  console.log(`Chain ID: ${actualChainId}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Available balance: ${hre.ethers.formatEther(balance)} MSTC`);
  console.log(`Estimated budget with 20% margin: ${hre.ethers.formatEther(estimatedBudget)} MSTC`);
  console.log(`PatchPool runtime artifact hash: ${hre.ethers.keccak256(patchPoolArtifact.deployedBytecode)}`);

  const promptSync = promptSyncFactory({ sigint: true });
  const expectedPhrase = "yes, deploy to MST Mainnet";
  const confirm = promptSync(`Type '${expectedPhrase}' to broadcast: `);
  if (confirm !== expectedPhrase) throw new Error("Deployment cancelled; no transaction was sent.");

  const results = await deployPatchPool(hre);
  const deployed: Record<string, ContractDeployment> = {};
  for (const [name, result] of Object.entries(results)) {
    const artifact = await hre.artifacts.readArtifact(name);
    deployed[name] = {
      address: result.address,
      abi: artifact.abi,
      constructorArguments: result.constructorArguments,
      deploymentTransactionHash: result.deploymentTransactionHash,
      deploymentBlock: result.deploymentBlock,
      deploymentBytecodeHash: hre.ethers.keccak256(artifact.deployedBytecode),
    };
  }

  const patchPool = deployed.PatchPool;
  if (!patchPool) throw new Error("PatchPool deployment result is missing; active registry was not changed.");

  console.log("Deployment confirmed. Active frontend registry was not changed.");
  for (const [name, contract] of Object.entries(deployed)) {
    console.log(`  ${name}: ${contract.address}`);
    console.log(`    deployment tx: ${contract.deploymentTransactionHash}`);
    console.log(`    deployment block: ${contract.deploymentBlock}`);
    console.log(`    runtime artifact hash: ${contract.deploymentBytecodeHash}`);
  }

  recordPendingDeployment({
    network,
    chainId: Number(expectedChainId),
    status: "pending_verification",
    recordedAt: new Date().toISOString(),
    patchPoolSourceSha256,
    contracts: deployed,
  });
  console.log("Pending deployment record written. Run the matching verify command, then finalize only after verification succeeds.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Deployment failed.");
  process.exitCode = 1;
});
