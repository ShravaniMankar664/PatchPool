import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { mstLegacyTestnet, mstMainnet, patchPoolLocalE2E } from "./chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const localE2EEnabled = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";
const configuredChains = process.env.NODE_ENV === "production"
  ? [mstMainnet] as const
  : localE2EEnabled
    ? [patchPoolLocalE2E, mstMainnet, mstLegacyTestnet] as const
    : [mstMainnet, mstLegacyTestnet] as const;

export const wagmiConfig = createConfig({
  ssr: true,
  // Wagmi's EIP-6963 discovery gives wallets an identity (name/RDNS); the
  // production connect UI offers only an advertised BridgeKey connector.
  multiInjectedProviderDiscovery: true,
  chains: configuredChains,
  connectors: [
    injected(),
    ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : []),
  ],
  // Mainnet is the only active production chain. Legacy Testnet remains in
  // development typing for the preserved, local-only historical tool route.
  transports: {
    // This transport is inert unless the development-only local chain is included above.
    [patchPoolLocalE2E.id]: http("http://127.0.0.1:18545"),
    [mstLegacyTestnet.id]: http("/api/rpc/testnet"),
    [mstMainnet.id]: http("/api/rpc/mainnet"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
