"use client";

import { useAccount, useChainId } from "wagmi";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";

export function NetworkSwitcher() {
  const { chainId, isConnected } = useAccount();
  const configuredChainId = useChainId();
  const activeChainId = chainId ?? configuredChainId;
  const localE2EEnabled = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";

  if (localE2EEnabled && activeChainId === patchPoolLocalE2E.id) return <span className="network-switcher">Local E2E · NOT MST · chain 31337</span>;

  if (!isConnected) {
    return <span className="network-switcher" aria-live="polite"><span className="network-led" />Production network · MST Mainnet · chain {mstMainnet.id}</span>;
  }

  if (activeChainId === mstMainnet.id) {
    return <span className="network-switcher is-mainnet" aria-live="polite"><span className="network-led" />Connected to MST Mainnet · chain {mstMainnet.id}</span>;
  }

  return <span className="network-switcher is-wrong-network" aria-live="polite"><span className="network-led" />Wallet chain {activeChainId} · switch to MST Mainnet ({mstMainnet.id}) · writes disabled</span>;
}
