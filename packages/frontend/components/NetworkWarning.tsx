"use client";

import { useAccount } from "wagmi";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";

export function NetworkWarning() {
  const { chainId, isConnected } = useAccount();
  const localE2EEnabled = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";

  if (!isConnected || !chainId || chainId === mstMainnet.id) return null;
  if (localE2EEnabled && chainId === patchPoolLocalE2E.id) return null;

  return (
    <p className="network-warning" role="alert">
      Your wallet is connected to chain {chainId}. Switch to MST Mainnet (chain {mstMainnet.id}) in your wallet; PatchPool actions remain unavailable on other networks.
    </p>
  );
}
