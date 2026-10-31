import type { ContractDeployment, PendingDeployment } from "./writeDeployment";
import { assertDeploymentNetworkConfigured, MST_NETWORKS } from "../../../shared/src/networks";

const MST_CHAIN_IDS = {
  testnet: MST_NETWORKS.legacyTestnet.chainId,
  mainnet: MST_NETWORKS.mainnet.chainId,
} as const;

export function assertPendingSlotAvailable(
  network: "testnet" | "mainnet",
  previous: PendingDeployment | undefined
): void {
  if (previous && previous.network !== network) throw new Error("Pending deployment network key does not match its record.");
  if (previous && previous.status !== "finalized") {
    throw new Error(`Refusing to overwrite an unresolved ${network} deployment (${previous.status}).`);
  }
}

export function assertDeploymentSender(expected: string | undefined, actual: string | undefined): void {
  if (expected === undefined) return;
  if (!/^0x[0-9a-fA-F]{40}$/.test(expected) || !actual || !/^0x[0-9a-fA-F]{40}$/.test(actual)) {
    throw new Error("Deployment record or transaction is missing a valid deployer address.");
  }
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error("Deployment transaction sender does not match the recorded deployer address.");
  }
}

export function assertDeploymentCanBeActivated(
  record: PendingDeployment,
  expectedNetwork: "testnet" | "mainnet",
  actualChainId: number,
  active?: ContractDeployment
): void {
  if (record.network !== expectedNetwork) throw new Error("Pending deployment network does not match finalization target.");
  if (record.chainId !== MST_CHAIN_IDS[expectedNetwork] || actualChainId !== MST_CHAIN_IDS[expectedNetwork]) {
    throw new Error("Pending deployment or RPC chain ID does not match finalization target.");
  }
  if ((record.status !== "verified" && record.status !== "finalized") || !record.verifiedAt) {
    throw new Error("Only an MSTScan-verified pending deployment can enter the active registry.");
  }
  if (!record.verifiedContracts?.includes("PatchPool")) {
    throw new Error("Pending record does not confirm MSTScan verification of PatchPool.");
  }

  const candidate = record.contracts.PatchPool;
  if (!candidate?.address || !candidate.deploymentTransactionHash || !candidate.deploymentBytecodeHash) {
    throw new Error("Pending record is missing PatchPool deployment evidence.");
  }

  if (
    active?.address.toLowerCase() === candidate.address.toLowerCase() &&
    (active.deploymentTransactionHash?.toLowerCase() !== candidate.deploymentTransactionHash.toLowerCase() ||
      active.deploymentBytecodeHash !== candidate.deploymentBytecodeHash)
  ) {
    throw new Error("Active registry address belongs to a different deployment record.");
  }
  assertDeploymentNetworkConfigured(expectedNetwork);
}
