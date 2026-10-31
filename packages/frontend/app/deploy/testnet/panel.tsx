"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatEther, isAddress, keccak256, type Abi, type Hex } from "viem";
import { ConnectButton } from "@/components/ConnectButton";
import { isBridgeKeyConnector } from "@/lib/walletIdentity";
import { mstLegacyTestnet } from "@/lib/chains";

const EXPECTED_ACCOUNT = "0x9C314BFEF33525582e8Fb5B1EFaDC77e94d89E27" as const;
const EXPECTED_CHAIN_ID = 91562037;
const GAS_MARGIN_NUMERATOR = BigInt(120);
const GAS_MARGIN_DENOMINATOR = BigInt(100);
const TX_STORAGE_KEY = "patchpool:testnet:deployment:transaction";

type DeploymentArtifact = {
  contractName: string;
  sourceName: string;
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
  patchPoolSourceSha256: string;
  canCreatePendingRecord: boolean;
  latestPendingStatus: string | null;
};

type PendingRecord = {
  network: "testnet";
  chainId: number;
  status: "pending_verification" | "verification_failed" | "verified" | "finalized";
  recordedAt: string;
  patchPoolSourceSha256: string;
  deployerAddress?: string;
  contracts: Record<string, {
    address: `0x${string}`;
    abi: Abi;
    constructorArguments: unknown[];
    deploymentTransactionHash: Hex;
    deploymentBlock: number;
    deploymentBytecodeHash: Hex;
  }>;
};

type Preflight = {
  walletChainId: number;
  rpcChainId: number;
  account: `0x${string}`;
  balance: bigint;
  gasEstimate: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedFee: bigint;
  maximumBudget: bigint;
  runtimeHash: Hex;
  initCodeHash: Hex;
};

export default function DeploymentPanel() {
  const { address, chainId, connector, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: EXPECTED_CHAIN_ID });
  const publicClient = usePublicClient({ chainId: EXPECTED_CHAIN_ID });
  const [artifact, setArtifact] = useState<DeploymentArtifact>();
  const [artifactError, setArtifactError] = useState("");
  const [preflight, setPreflight] = useState<Preflight>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [pendingRecord, setPendingRecord] = useState<PendingRecord>();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/deployment-artifact", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load the compiled artifact.");
        if (!cancelled) setArtifact(data as DeploymentArtifact);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setArtifactError(cause instanceof Error ? cause.message : "Unable to load the compiled artifact.");
      });
    const storedHash = window.sessionStorage.getItem(TX_STORAGE_KEY);
    if (storedHash && /^0x[0-9a-fA-F]{64}$/.test(storedHash)) setTransactionHash(storedHash as Hex);
    return () => { cancelled = true; };
  }, []);

  const verifyContextAndEstimate = useCallback(async (): Promise<Preflight> => {
    if (!artifact) throw new Error("Compiled PatchPool artifact is not loaded.");
    if (!artifact.canCreatePendingRecord) {
      throw new Error(`An unresolved Testnet deployment record exists (${artifact.latestPendingStatus ?? "unknown status"}). Resolve it before deploying again.`);
    }
    if (!isConnected || !address || !connector || !walletClient) {
      throw new Error("Connect BridgeKey before running deployment preflight.");
    }
    if (!isBridgeKeyConnector(connector)) {
      throw new Error("The connected provider is not identified as BridgeKey by its injected connector metadata.");
    }
    if (!isAddress(address) || address.toLowerCase() !== EXPECTED_ACCOUNT.toLowerCase()) {
      throw new Error(`Connected account must match ${EXPECTED_ACCOUNT}. No network switch or alternate account is allowed.`);
    }
    if (!publicClient) throw new Error("The configured Legacy Testnet RPC client is unavailable.");

    const [walletAccounts, walletChainId, rpcChainId] = await Promise.all([
      walletClient.getAddresses(),
      walletClient.getChainId(),
      publicClient.getChainId(),
    ]);
    if (!walletAccounts.some((account) => account.toLowerCase() === EXPECTED_ACCOUNT.toLowerCase())) {
      throw new Error("BridgeKey did not return the expected account from eth_accounts.");
    }
    if (chainId !== EXPECTED_CHAIN_ID || walletChainId !== EXPECTED_CHAIN_ID) {
      throw new Error(`BridgeKey must already be on MST Legacy Testnet (${EXPECTED_CHAIN_ID}); reported chain ${walletChainId}. The tool will not switch networks.`);
    }
    if (rpcChainId !== EXPECTED_CHAIN_ID) {
      throw new Error(`Configured RPC chain mismatch: expected ${EXPECTED_CHAIN_ID}, received ${rpcChainId}.`);
    }

    const constructors = artifact.abi.filter((item) => item.type === "constructor");
    if (constructors.length > 1 || (constructors[0]?.inputs.length ?? 0) !== 0) {
      throw new Error("PatchPool constructor does not match the expected no-argument deployment.");
    }
    if (!artifact.bytecode.startsWith("0x") || artifact.bytecode.length <= 2 || artifact.deployedBytecode.length <= 2) {
      throw new Error("Compiled PatchPool creation or runtime bytecode is missing.");
    }

    const [balance, gasEstimate, gasPrice] = await Promise.all([
      publicClient.getBalance({ address: EXPECTED_ACCOUNT }),
      publicClient.estimateGas({ account: EXPECTED_ACCOUNT, data: artifact.bytecode }),
      publicClient.getGasPrice(),
    ]);
    const gasLimit = (gasEstimate * GAS_MARGIN_NUMERATOR + GAS_MARGIN_DENOMINATOR - BigInt(1)) / GAS_MARGIN_DENOMINATOR;
    const estimatedFee = gasEstimate * gasPrice;
    const maximumBudget = gasLimit * gasPrice;
    if (balance < maximumBudget) {
      throw new Error(`Balance ${formatEther(balance)} tMSTC does not cover the buffered gas budget ${formatEther(maximumBudget)} tMSTC.`);
    }

    return {
      walletChainId,
      rpcChainId,
      account: EXPECTED_ACCOUNT,
      balance,
      gasEstimate,
      gasLimit,
      gasPrice,
      estimatedFee,
      maximumBudget,
      runtimeHash: keccak256(artifact.deployedBytecode),
      initCodeHash: keccak256(artifact.bytecode),
    };
  }, [address, artifact, chainId, connector, isConnected, publicClient, walletClient]);

  const runPreflight = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    setPendingRecord(undefined);
    try {
      const result = await verifyContextAndEstimate();
      setPreflight(result);
      setMessage("Preflight passed. No transaction has been created or sent.");
    } catch (cause) {
      setPreflight(undefined);
      setError(cause instanceof Error ? cause.message : "Deployment preflight failed.");
    } finally {
      setBusy(false);
    }
  }, [verifyContextAndEstimate]);

  const verifyReceipt = useCallback(async (hash: Hex) => {
    if (!publicClient || !artifact) throw new Error("RPC client or compiled artifact is unavailable.");
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
    if (receipt.status !== "success" || !receipt.contractAddress) {
      throw new Error(`Deployment transaction ${hash} did not produce a successful contract-creation receipt.`);
    }
    const code = await publicClient.getCode({ address: receipt.contractAddress });
    if (!code || code === "0x" || keccak256(code) !== keccak256(artifact.deployedBytecode)) {
      throw new Error(`Receipt confirmed at ${receipt.contractAddress}, but the runtime bytecode did not match the compiled PatchPool artifact. Do not record or retry this deployment.`);
    }

    const record: PendingRecord = {
      network: "testnet",
      chainId: EXPECTED_CHAIN_ID,
      status: "pending_verification",
      recordedAt: new Date().toISOString(),
      patchPoolSourceSha256: artifact.patchPoolSourceSha256,
      deployerAddress: EXPECTED_ACCOUNT,
      contracts: {
        PatchPool: {
          address: receipt.contractAddress,
          abi: artifact.abi,
          constructorArguments: [],
          deploymentTransactionHash: hash,
          deploymentBlock: Number(receipt.blockNumber),
          deploymentBytecodeHash: keccak256(artifact.deployedBytecode),
        },
      },
    };
    setPendingRecord(record);
    setMessage(`Receipt confirmed in block ${receipt.blockNumber}; deployed bytecode matches the local artifact. The active registry remains unchanged.`);
  }, [artifact, publicClient]);

  const requestApproval = async () => {
    if (!walletClient || !artifact) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPendingRecord(undefined);
    let submittedHash: Hex | undefined;
    try {
      const current = await verifyContextAndEstimate();
      setPreflight(current);
      setMessage("Preflight refreshed. BridgeKey will now show the deployment transaction for your review.");
      submittedHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        account: current.account,
        chain: mstLegacyTestnet,
        gas: current.gasLimit,
        gasPrice: current.gasPrice,
      });
      window.sessionStorage.setItem(TX_STORAGE_KEY, submittedHash);
      setTransactionHash(submittedHash);
      setMessage(`BridgeKey submitted ${submittedHash}. Waiting for the Legacy Testnet receipt; do not repeat the deployment.`);
      await verifyReceipt(submittedHash);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Wallet deployment request failed.";
      setError(submittedHash
        ? `Deployment is not yet verified. Transaction ${submittedHash} may still be pending; check its receipt before taking any further action. ${detail}`
        : detail);
    } finally {
      setBusy(false);
    }
  };

  const checkReceipt = async () => {
    if (!transactionHash) return;
    setBusy(true);
    setError("");
    try {
      await verifyReceipt(transactionHash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify the deployment receipt yet.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPendingRecord = () => {
    if (!pendingRecord) return;
    const contents = JSON.stringify(pendingRecord, null, 2);
    const url = URL.createObjectURL(new Blob([`${contents}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "patchpool-testnet-deployment-record.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="deploy-tool">
      <p className="eyebrow">LOCAL DEPLOYMENT TOOL · TESTNET ONLY</p>
      <h1>Deploy PatchPool with BridgeKey</h1>
      <p>Preflight checks the injected BridgeKey account and the configured Legacy Testnet RPC independently. Nothing is sent until you request the wallet approval below.</p>
      <div className="deploy-warning" role="note">
        <strong>Irreversible network action:</strong> contract creation spends tMSTC gas and permanently places bytecode on the selected chain. This legacy testnet is scheduled to sunset. Deployment does not verify source or enable bounty writes.
      </div>
      <section className="card deploy-section">
        <h2>Wallet</h2>
      <ConnectButton expectedChainId={EXPECTED_CHAIN_ID} />
        <p>Required account: <code>{EXPECTED_ACCOUNT}</code></p>
        <p>Required network: <strong>MST Legacy Testnet · {EXPECTED_CHAIN_ID}</strong>. Switch manually in BridgeKey if needed; this tool never requests a network switch.</p>
      </section>

      <section className="card deploy-section">
        <h2>Compiled artifact</h2>
        {artifactError && <p className="error-message" role="alert">{artifactError}</p>}
        {artifact && <>
          <p>{artifact.contractName} · {artifact.sourceName} · no constructor arguments</p>
          <p>Runtime artifact hash: <code>{keccak256(artifact.deployedBytecode)}</code></p>
          <p>Creation bytecode hash: <code>{keccak256(artifact.bytecode)}</code></p>
          <p>Source SHA-256: <code>{artifact.patchPoolSourceSha256}</code></p>
          {!artifact.canCreatePendingRecord && <p className="error-message" role="alert">An unresolved pending deployment ({artifact.latestPendingStatus}) exists. Resolve it before deploying again.</p>}
        </>}
        <button className="button ghost" onClick={runPreflight} disabled={busy || !artifact || !isConnected}>
          {busy ? "Checking…" : "Run deployment preflight"}
        </button>
      </section>

      {preflight && <section className="card deploy-section" aria-label="Deployment preflight result">
        <h2>Preflight passed</h2>
        <dl className="deploy-facts">
          <dt>BridgeKey account</dt><dd><code>{preflight.account}</code></dd>
          <dt>Wallet chain ID</dt><dd>{preflight.walletChainId}</dd>
          <dt>RPC chain ID</dt><dd>{preflight.rpcChainId}</dd>
          <dt>Balance</dt><dd>{formatEther(preflight.balance)} tMSTC</dd>
          <dt>Estimated gas</dt><dd>{preflight.gasEstimate.toString()} (limit with 20% margin: {preflight.gasLimit.toString()})</dd>
          <dt>Gas price</dt><dd>{formatEther(preflight.gasPrice)} tMSTC / gas</dd>
          <dt>Estimated fee</dt><dd>{formatEther(preflight.estimatedFee)} tMSTC</dd>
          <dt>Maximum budget at buffered gas limit</dt><dd>{formatEther(preflight.maximumBudget)} tMSTC</dd>
          <dt>Runtime bytecode hash</dt><dd><code>{preflight.runtimeHash}</code></dd>
          <dt>Creation bytecode hash</dt><dd><code>{preflight.initCodeHash}</code></dd>
        </dl>
        <p>Before continuing, inspect the recipient-free contract-creation transaction in BridgeKey. Reject it if the network, account, gas, or action differs from this summary.</p>
        <button className="button primary" onClick={requestApproval} disabled={busy || Boolean(transactionHash) || !artifact?.canCreatePendingRecord}>
          {busy ? "Waiting for wallet / receipt…" : "Request BridgeKey deployment approval"}
        </button>
      </section>}

      {transactionHash && <section className="card deploy-section" aria-label="Deployment transaction status">
        <h2>Transaction status</h2>
        <p>Hash: <code>{transactionHash}</code></p>
        <button className="button ghost" onClick={checkReceipt} disabled={busy || Boolean(pendingRecord)}>Check receipt and deployed bytecode</button>
      </section>}

      {pendingRecord && <section className="card deploy-section" aria-label="Pending deployment record">
        <h2>Deployment verified locally; explorer verification remains</h2>
        <p>Contract: <code>{pendingRecord.contracts.PatchPool.address}</code></p>
        <p>Transaction: <a href={`${mstLegacyTestnet.blockExplorers.default.url}/tx/${pendingRecord.contracts.PatchPool.deploymentTransactionHash}`} target="_blank" rel="noreferrer">{pendingRecord.contracts.PatchPool.deploymentTransactionHash}</a></p>
        <p>Block: {pendingRecord.contracts.PatchPool.deploymentBlock}. The downloaded record remains pending verification and does not update the frontend registry.</p>
        <button className="button ghost" onClick={downloadPendingRecord}>Download verified deployment record</button>
        <p>Then validate and append this record without replacing existing deployment history using <code>PATCHPOOL_BROWSER_DEPLOYMENT_RECORD=/path/to/patchpool-testnet-deployment-record.json npm run --workspace contracts record:testnet</code>. The existing Testnet verification and explicit finalization steps follow; finalization still keeps bounty writes disabled.</p>
      </section>}

      {message && <p role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <p><Link href="/">← Back to PatchPool</Link></p>
    </main>
  );
}
