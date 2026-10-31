"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import {
  deployments,
  PATCHPOOL_MAINNET_WRITES_ENABLED,
  PATCHPOOL_TESTNET_WRITES_ENABLED,
} from "patchpool-shared";
import { mstLegacyTestnet, mstMainnet, patchPoolLocalE2E } from "@/lib/chains";
import patchPoolE2eAbi from "@/lib/patchpoolE2eAbi.json";

type ContractEntry = {
  address: `0x${string}`;
  abi: readonly unknown[];
  deploymentTransactionHash?: `0x${string}`;
  deploymentBlock?: number;
  deploymentBytecodeHash?: `0x${string}`;
};

export function usePatchPool() {
  const { chainId: walletChainId, isConnected } = useAccount();
  const configuredChainId = useChainId();
  // Public reads use the configured default network while disconnected.
  // Writes remain gated on an actual connected wallet below.
  const chainId = walletChainId ?? configuredChainId;
  const localE2EEnabled = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";
  const localE2EAddress = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_ADDRESS;

  const network = chainId === mstMainnet.id
    ? "mainnet"
    : chainId === mstLegacyTestnet.id
      ? "testnet"
      : localE2EEnabled && chainId === patchPoolLocalE2E.id
        ? "local"
      : undefined;

  const registryEntry = (
    deployments as Record<string, Record<string, ContractEntry> | undefined>
  )[network ?? ""]?.PatchPool;
  const localEntry: ContractEntry | undefined = localE2EEnabled && localE2EAddress
    ? {
        address: localE2EAddress as `0x${string}`,
        abi: patchPoolE2eAbi,
        deploymentTransactionHash: process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_DEPLOYMENT_TX as `0x${string}` | undefined,
        deploymentBlock: Number(process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_DEPLOYMENT_BLOCK),
        deploymentBytecodeHash: process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_BYTECODE_HASH as `0x${string}` | undefined,
      }
    : undefined;
  const entry = network === "local" ? localEntry : registryEntry;
  const hasDeploymentEvidence = Boolean(
    entry?.address && /^0x[0-9a-fA-F]{40}$/.test(entry.address) &&
    entry.deploymentTransactionHash && /^0x[0-9a-fA-F]{64}$/.test(entry.deploymentTransactionHash) &&
    Number.isSafeInteger(entry.deploymentBlock) &&
    entry.deploymentBlock! > 0 &&
    entry.deploymentBytecodeHash &&
    /^0x[0-9a-fA-F]{64}$/.test(entry.deploymentBytecodeHash)
  );

  const { data: bountyCount, isLoading: loadingBountyCount, error: bountyCountError, refetch: refetchBountyCount } = useReadContract({
    address: hasDeploymentEvidence ? entry?.address : undefined,
    abi: hasDeploymentEvidence ? entry?.abi as never : undefined,
    functionName: "bountyCount",
    query: {
      enabled: hasDeploymentEvidence,
      refetchInterval: 15_000,
    },
  });

  return {
    address: hasDeploymentEvidence ? entry?.address : undefined,
    abi: hasDeploymentEvidence ? entry?.abi : undefined,
    deploymentTransactionHash: hasDeploymentEvidence ? entry?.deploymentTransactionHash : undefined,
    deploymentBlock: hasDeploymentEvidence ? entry?.deploymentBlock : undefined,
    bountyCount: bountyCount as bigint | undefined,
    loadingBountyCount,
    bountyCountError,
    refetchBountyCount,
    isDeployed: hasDeploymentEvidence,
    mainnetWritesConfigured: PATCHPOOL_MAINNET_WRITES_ENABLED,
    writesEnabled: isConnected && (network === "local" && localE2EEnabled
      ? hasDeploymentEvidence
      : network === "testnet"
      ? PATCHPOOL_TESTNET_WRITES_ENABLED
      : network === "mainnet" && PATCHPOOL_MAINNET_WRITES_ENABLED),
  };
}
