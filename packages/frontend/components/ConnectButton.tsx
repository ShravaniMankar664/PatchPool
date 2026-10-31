"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { mstMainnet } from "@/lib/chains";
import { isBridgeKeyConnector } from "@/lib/walletIdentity";

export function ConnectButton({ localE2E = false, expectedChainId = mstMainnet.id }: { localE2E?: boolean; expectedChainId?: number }) {
  const { address, chainId, connector, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const bridgeKeyConnectors = connectors.filter(isBridgeKeyConnector);
  const availableConnectors = localE2E
    ? connectors.filter((candidate) => candidate.id === "injected")
    : bridgeKeyConnectors;

  if (isConnected && address) {
    const connectedWithBridgeKey = isBridgeKeyConnector(connector);
    const isExpectedNetwork = chainId === expectedChainId;
    const connectionMessage = localE2E
      ? "LOCAL E2E · NOT MST · NOT BridgeKey"
      : !connectedWithBridgeKey
        ? "Wallet is not identified as BridgeKey. Disconnect and reconnect through BridgeKey before continuing."
        : !isExpectedNetwork
          ? `BridgeKey connected; switch to chain ${expectedChainId}.`
          : `BridgeKey advertised · connected to chain ${expectedChainId}`;
    const connectionVerified = localE2E || (connectedWithBridgeKey && isExpectedNetwork);

    return (
      <div className="wallet">
        <span className="wallet-address">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <span className={`wallet-state ${connectionVerified ? "verified" : "unverified"}`} role={connectionVerified ? "status" : "alert"}>{connectionMessage}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="wallet">
      {availableConnectors.map((availableConnector) => (
        <button key={availableConnector.uid} onClick={() => connect({ connector: availableConnector })} disabled={isPending}>
          {isPending ? "Connecting…" : localE2E ? "Connect local test wallet" : "Connect BridgeKey"}
        </button>
      ))}
      {availableConnectors.length === 0 && (
        localE2E
          ? <span role="status">No local test wallet detected.</span>
          : <details className="wallet-help">
              <summary role="status">BridgeKey not detected</summary>
              <p>Open PatchPool in BridgeKey’s dApp browser or enable the BridgeKey browser extension, then reload. Other wallets are not offered.</p>
            </details>
      )}
      {error && <span className="error-message" role="alert">Wallet connection failed: {error.message}</span>}
    </div>
  );
}
