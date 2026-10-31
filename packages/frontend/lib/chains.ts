import { defineChain } from "viem";
import { MST_NETWORKS } from "patchpool-shared";

export const mstLegacyTestnet = defineChain({
  id: MST_NETWORKS.legacyTestnet.chainId,
  name: MST_NETWORKS.legacyTestnet.name,
  nativeCurrency: { name: "Legacy Test MST Coin", symbol: MST_NETWORKS.legacyTestnet.currencySymbol, decimals: 18 },
  rpcUrls: {
    default: { http: [MST_NETWORKS.legacyTestnet.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "MSTScan Legacy Testnet", url: MST_NETWORKS.legacyTestnet.explorerUrl },
  },
  testnet: true,
});

/** Compatibility alias for the SDK playground; this is the deprecated legacy chain. */
export const mstTestnet = mstLegacyTestnet;

export const mstMainnet = defineChain({
  id: MST_NETWORKS.mainnet.chainId,
  name: MST_NETWORKS.mainnet.name,
  nativeCurrency: { name: "MST Coin", symbol: MST_NETWORKS.mainnet.currencySymbol, decimals: 18 },
  rpcUrls: {
    default: { http: [MST_NETWORKS.mainnet.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "MSTScan", url: MST_NETWORKS.mainnet.explorerUrl },
  },
});

/** Local-only chain. Included in Wagmi only by the isolated browser E2E runner. */
export const patchPoolLocalE2E = defineChain({
  id: 31337,
  name: "PatchPool Local E2E",
  nativeCurrency: { name: "Local Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:18545"] } },
  testnet: true,
});
