/**
 * MST network inventory. Mainnet is the only production target; Legacy Testnet
 * remains here solely to identify its preserved historical deployment.
 * Coral values remain absent until MST confirms its full configuration.
 */
export const MST_NETWORKS = {
  legacyTestnet: {
    status: "sunsetting" as const,
    name: "MST Legacy Testnet (sunsetting)",
    chainId: 91562037,
    currencySymbol: "tMSTC",
    rpcUrl: "https://testnetrpc.mstblockchain.com",
    explorerUrl: "https://testnet.mstscan.com",
    faucetUrl: "https://faucet.mstblockchain.com",
  },
  coralTestnet: {
    status: "awaiting_official_confirmation" as const,
    name: "MST Coral Testnet",
    // Chain ID supplied in the organizer instructions; deployment remains
    // disabled until the RPC and verification settings are confirmed.
    chainId: 54635,
    currencySymbol: undefined,
    rpcUrl: undefined,
    explorerUrl: undefined,
    faucetUrl: undefined,
  },
  mainnet: {
    status: "configured" as const,
    name: "MST Mainnet",
    chainId: 4646,
    currencySymbol: "MSTC",
    rpcUrl: "https://mariorpc.mstblockchain.com",
    explorerUrl: "https://mstscan.com",
  },
} as const;

export type DeploymentNetwork = "testnet" | "mainnet";

/** Historical Testnet records remain addressable; Mainnet is the live target. */
export function isDeploymentNetworkConfigured(network: DeploymentNetwork): boolean {
  return network === "testnet" || network === "mainnet";
}

export function assertDeploymentNetworkConfigured(network: DeploymentNetwork): void {
  if (!isDeploymentNetworkConfigured(network)) {
    throw new Error(
      "The selected MST deployment network is not configured."
    );
  }
}
