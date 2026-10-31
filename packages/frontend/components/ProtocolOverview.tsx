"use client";

import { useState } from "react";
import { deployments, PATCHPOOL_MAINNET_WRITES_ENABLED } from "patchpool-shared";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";

type Props = {
  chainId: number;
  bountyCount?: bigint;
  loading: boolean;
  readError?: Error | null;
  isDeployed: boolean;
  localE2E: boolean;
  walletConnected: boolean;
  bridgeKeyAuthorized: boolean;
};

const mainnet = deployments.mainnet.PatchPool;

export function ProtocolOverview({ chainId, bountyCount, loading, readError, isDeployed, localE2E, walletConnected, bridgeKeyAuthorized }: Props) {
  const [copied, setCopied] = useState(false);
  const isMainnetRead = chainId === mstMainnet.id;
  const isLocalRead = localE2E && chainId === patchPoolLocalE2E.id;
  const countValue = isMainnetRead || isLocalRead
    ? readError ? "Unavailable" : loading ? "Loading" : bountyCount?.toString() ?? "—"
    : "Connect Mainnet";
  const countCaption = isLocalRead
    ? "Local records · not MST activity"
    : isMainnetRead
      ? readError ? "RPC read failed · count not inferred" : "Read from the registered contract"
      : "Production bounty data is Mainnet only";
  const writeEligibility = !PATCHPOOL_MAINNET_WRITES_ENABLED
    ? "Disabled by frontend configuration"
    : isLocalRead
      ? "Local E2E cannot access Mainnet writes"
      : !walletConnected
        ? "Connect BridgeKey on chain 4646 to check eligibility"
        : !isMainnetRead
          ? "Switch the connected wallet to MST Mainnet · chain 4646"
          : !bridgeKeyAuthorized
            ? "Connected provider is not identified as BridgeKey"
            : "Connector and chain match · action role and state checks still apply";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(mainnet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="protocol-overview" aria-labelledby="protocol-title">
      <div className="protocol-heading">
        <div><span className="section-label">PATCHPOOL PROTOCOL</span><h2 id="protocol-title">Built on transparent rules.</h2></div>
        <span className={`protocol-network ${isLocalRead ? "local" : isMainnetRead ? "live" : "target"}`}><i />{isLocalRead ? "Local E2E · not MST" : isMainnetRead ? "MST Mainnet · chain 4646" : "Production target · MST Mainnet · 4646"}</span>
      </div>
      <div className="protocol-facts">
        <div className="protocol-count"><span className="protocol-key">REGISTERED BOUNTIES</span><strong aria-live="polite">{countValue}</strong><small>{countCaption}</small></div>
        <div className="protocol-contract"><span className="protocol-key">PRODUCTION CONTRACT</span><a href={`https://mstscan.com/address/${mainnet.address}#code`} target="_blank" rel="noopener noreferrer" className="protocol-address">{mainnet.address}<span aria-hidden="true">↗</span></a><button className="copy-address" type="button" onClick={() => void copyAddress()} aria-label={copied ? "Contract address copied" : "Copy Mainnet contract address"}>{copied ? "Copied" : "Copy"}</button></div>
        <div className="protocol-deployment"><span className="protocol-key">DEPLOYMENT</span><a href={`https://mstscan.com/tx/${mainnet.deploymentTransactionHash}`} target="_blank" rel="noopener noreferrer">Block {mainnet.deploymentBlock}<span aria-hidden="true">↗</span></a><small>{isMainnetRead && isDeployed ? "Verified deployment in active registry" : isLocalRead ? "Local contract · no MSTScan record" : "Mainnet deployment reference"}</small></div>
        <div className="protocol-writes"><span className="protocol-key">MAINNET WRITE CONFIG</span><strong className={PATCHPOOL_MAINNET_WRITES_ENABLED ? "write-configured" : "write-disabled"}>{PATCHPOOL_MAINNET_WRITES_ENABLED ? "Configured" : "Disabled"}</strong><small>{writeEligibility}</small></div>
      </div>
    </section>
  );
}
