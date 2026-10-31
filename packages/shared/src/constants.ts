import { MST_NETWORKS } from "./networks";

/** Backward-compatible alias for the explicitly deprecated legacy Testnet. */
export const MST_TESTNET = {
  id: MST_NETWORKS.legacyTestnet.chainId,
  name: MST_NETWORKS.legacyTestnet.name,
  rpcUrl: MST_NETWORKS.legacyTestnet.rpcUrl,
  explorerUrl: MST_NETWORKS.legacyTestnet.explorerUrl,
  status: MST_NETWORKS.legacyTestnet.status,
} as const;

export const MST_MAINNET = {
  id: MST_NETWORKS.mainnet.chainId,
  name: MST_NETWORKS.mainnet.name,
  rpcUrl: MST_NETWORKS.mainnet.rpcUrl,
  explorerUrl: MST_NETWORKS.mainnet.explorerUrl,
  status: MST_NETWORKS.mainnet.status,
} as const;

// Legacy Testnet records are historical; its frontend writes stay disabled.
export const PATCHPOOL_TESTNET_WRITES_ENABLED = false;
// Enabled only after the verified MST Mainnet deployment was finalized in the
// active registry. The app still requires BridgeKey and chain 4646 per action.
export const PATCHPOOL_MAINNET_WRITES_ENABLED = true;
