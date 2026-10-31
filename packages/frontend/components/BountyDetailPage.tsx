"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { formatEther, keccak256, parseAbiItem, stringToHex, zeroAddress } from "viem";
import { ConnectButton } from "@/components/ConnectButton";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { NetworkWarning } from "@/components/NetworkWarning";
import { usePatchPool } from "@/hooks/usePatchPool";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";

type TaskMetadata = { title: string; description: string };
type BountyDetails = {
  sponsor: `0x${string}`;
  reviewer: `0x${string}`;
  reward: bigint;
  submissionDeadline: bigint;
  settlementDeadline: bigint;
  taskHash: `0x${string}`;
  status: number;
  approvedSubmissionId: bigint;
};
type Submission = {
  id: bigint;
  submitter: `0x${string}`;
  payee: `0x${string}`;
  commitHash: `0x${string}`;
  commitIsSha256: boolean;
  evidenceHash: `0x${string}`;
  submittedAt: bigint;
  rejected: boolean;
};

const statusLabels = ["Open", "Approved", "Paid", "Refunded", "Refunding"];
const metadataEvent = parseAbiItem("event BountyMetadata(uint256 indexed bountyId, bytes32 indexed taskHash, string taskMetadataJson)");
const readEvent = parseAbiItem("event BountyCreated(uint256 indexed bountyId, address indexed sponsor, address indexed reviewer, uint256 reward, bytes32 taskHash, uint64 submissionDeadline, uint64 settlementDeadline)");
const refundGrace = BigInt(7 * 24 * 60 * 60);
type ContractRead = { data?: unknown; isLoading?: boolean; isError?: boolean; refetch: () => unknown };
type ContractReads = { data?: Array<{ status: string; result?: unknown }>; isLoading?: boolean };

function readTuple<T>(record: unknown, name: string, index: number): T {
  if (record && typeof record === "object" && name in record) return (record as Record<string, unknown>)[name] as T;
  return (Array.isArray(record) ? record[index] : undefined) as T;
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function dateTime(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function explorerAddress(address: `0x${string}`, chainId: number) {
  return chainId === mstMainnet.id ? `https://mstscan.com/address/${address}` : undefined;
}

function explorerTransaction(hash: `0x${string}`, chainId: number) {
  return chainId === mstMainnet.id ? `https://mstscan.com/tx/${hash}` : undefined;
}

export default function BountyDetailPage({ bountyId }: { bountyId: string }) {
  const parsedId = useMemo(() => {
    if (!/^[1-9]\d{0,77}$/.test(bountyId)) return undefined;
    try { return BigInt(bountyId); } catch { return undefined; }
  }, [bountyId]);
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const configuredChainId = useChainId();
  const chainId = walletChainId ?? configuredChainId;
  const localE2E = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";
  const { address: contractAddress, abi, bountyCount, loadingBountyCount, bountyCountError, isDeployed, deploymentBlock } = usePatchPool();
  const isSupportedReadNetwork = chainId === mstMainnet.id || Boolean(localE2E && chainId === patchPoolLocalE2E.id);
  const canReadRegisteredDeployment = isSupportedReadNetwork && isDeployed;
  const clientChainId = localE2E && chainId === patchPoolLocalE2E.id ? patchPoolLocalE2E.id : mstMainnet.id;
  const publicClient = usePublicClient({ chainId: clientChainId });
  const exists = Boolean(parsedId && bountyCount !== undefined && parsedId <= bountyCount);
  const bountyRead = useReadContract({
    address: canReadRegisteredDeployment && exists ? contractAddress : undefined,
    abi: abi as never,
    functionName: "getBounty",
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: Boolean(canReadRegisteredDeployment && exists && contractAddress && abi), refetchInterval: 15_000 },
  }) as unknown as ContractRead;
  const countRead = useReadContract({
    address: canReadRegisteredDeployment && exists ? contractAddress : undefined,
    abi: abi as never,
    functionName: "submissionCounts",
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: Boolean(canReadRegisteredDeployment && exists && contractAddress && abi), refetchInterval: 15_000 },
  }) as unknown as ContractRead;
  const bounty = useMemo<BountyDetails | undefined>(() => {
    if (!bountyRead.data) return undefined;
    const raw = bountyRead.data;
    return {
      sponsor: readTuple(raw, "sponsor", 0),
      reviewer: readTuple(raw, "reviewer", 1),
      reward: readTuple(raw, "reward", 2),
      submissionDeadline: readTuple(raw, "submissionDeadline", 3),
      settlementDeadline: readTuple(raw, "settlementDeadline", 4),
      taskHash: readTuple(raw, "taskHash", 5),
      status: Number(readTuple(raw, "status", 6)),
      approvedSubmissionId: readTuple(raw, "approvedSubmissionId", 7),
    };
  }, [bountyRead.data]);
  const submissionCount = typeof countRead.data === "bigint" ? countRead.data : BigInt(0);
  const submissionIds = useMemo(() => {
    const length = submissionCount > BigInt(10) ? BigInt(10) : submissionCount;
    const ids = Array.from({ length: Number(length) }, (_, index) => submissionCount - BigInt(index));
    if (bounty?.approvedSubmissionId && bounty.approvedSubmissionId > BigInt(0) && !ids.includes(bounty.approvedSubmissionId)) ids.push(bounty.approvedSubmissionId);
    return ids;
  }, [submissionCount, bounty?.approvedSubmissionId]);
  const submissionReads = useReadContracts({
    contracts: submissionIds.map((submissionId) => ({
      address: contractAddress!, abi: abi as never, functionName: "getSubmission", args: [parsedId!, submissionId],
    })) as never,
    query: { enabled: Boolean(canReadRegisteredDeployment && exists && contractAddress && abi && submissionIds.length), refetchInterval: 15_000 },
  }) as unknown as ContractReads;
  const submissions = useMemo<Submission[]>(() => {
    const results = submissionReads.data ?? [];
    return results.flatMap((result, index) => {
      if (result.status !== "success") return [];
      const raw = result.result;
      return [{
        id: submissionIds[index],
        submitter: readTuple(raw, "submitter", 0),
        payee: readTuple(raw, "payee", 1),
        commitHash: readTuple(raw, "commitHash", 2),
        commitIsSha256: readTuple(raw, "commitIsSha256", 3),
        evidenceHash: readTuple(raw, "evidenceHash", 4),
        submittedAt: readTuple(raw, "submittedAt", 5),
        rejected: readTuple(raw, "rejected", 6),
      }];
    });
  }, [submissionReads.data, submissionIds]);

  const [metadata, setMetadata] = useState<TaskMetadata>();
  const [metadataState, setMetadataState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");
  const [metadataError, setMetadataError] = useState("");
  const [creationHash, setCreationHash] = useState<`0x${string}`>();
  const [selectedContribution, setSelectedContribution] = useState<bigint>();
  const [refundableBalance, setRefundableBalance] = useState<bigint>();
  const [blockTime, setBlockTime] = useState<bigint>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contributionRead = useReadContract({
    address: canReadRegisteredDeployment && exists ? contractAddress : undefined,
    abi: abi as never,
    functionName: "contributions",
    args: parsedId ? [parsedId, address ?? zeroAddress] : undefined,
    query: { enabled: Boolean(canReadRegisteredDeployment && exists && contractAddress && abi && isConnected), refetchInterval: 15_000 },
  }) as unknown as ContractRead;
  const refundRead = useReadContract({
    address: canReadRegisteredDeployment && exists ? contractAddress : undefined,
    abi: abi as never,
    functionName: "refundableBalance",
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: Boolean(canReadRegisteredDeployment && exists && contractAddress && abi), refetchInterval: 15_000 },
  }) as unknown as ContractRead;

  useEffect(() => {
    setSelectedContribution(typeof contributionRead.data === "bigint" ? contributionRead.data : undefined);
  }, [contributionRead.data]);
  useEffect(() => {
    setRefundableBalance(typeof refundRead.data === "bigint" ? refundRead.data : undefined);
  }, [refundRead.data]);
  useEffect(() => {
    let cancelled = false;
    if (!publicClient || !contractAddress || !deploymentBlock || !parsedId || !isSupportedReadNetwork || !exists) {
      setMetadata(undefined);
      setCreationHash(undefined);
      setMetadataState("idle");
      return () => { cancelled = true; };
    }
    setMetadataState("loading");
    setMetadataError("");
    void (async () => {
      const anchor = await publicClient.getBlockNumber({ cacheTime: 0 });
      const firstBlock = BigInt(deploymentBlock);
      let cursor = anchor;
      let pages = 0;
      let task: TaskMetadata | undefined;
      let createdAt: `0x${string}` | undefined;
      while (cursor >= firstBlock && pages < 20 && !task) {
        const start = cursor - firstBlock >= BigInt(1_999) ? cursor - BigInt(1_999) : firstBlock;
        const [metadataLogs, creationLogs] = await Promise.all([
          publicClient.getLogs({ address: contractAddress, event: metadataEvent, args: { bountyId: parsedId }, fromBlock: start, toBlock: cursor }),
          publicClient.getLogs({ address: contractAddress, event: readEvent, args: { bountyId: parsedId }, fromBlock: start, toBlock: cursor }),
        ]);
        for (const log of creationLogs) if (log.transactionHash) createdAt = log.transactionHash;
        for (const log of metadataLogs) {
          const rawJson = log.args.taskMetadataJson;
          const committedHash = log.args.taskHash;
          if (typeof rawJson !== "string" || !committedHash || keccak256(stringToHex(rawJson)) !== committedHash.toLowerCase()) continue;
          try {
            const decoded: unknown = JSON.parse(rawJson);
            if (decoded && typeof decoded === "object" && "title" in decoded && "description" in decoded) {
              const fields = decoded as { title: unknown; description: unknown };
              if (typeof fields.title === "string" && typeof fields.description === "string") task = { title: fields.title, description: fields.description };
            }
          } catch {
            // Invalid public metadata stays unavailable; the committed digest remains visible.
          }
        }
        if (start === firstBlock) break;
        cursor = start - BigInt(1);
        pages += 1;
      }
      if (!cancelled) {
        setMetadata(task);
        setCreationHash(createdAt);
        setMetadataState(task ? "ready" : "missing");
      }
    })().catch((error: unknown) => {
      if (!cancelled) {
        setMetadataError(error instanceof Error ? error.message : "Could not read bounty metadata from the selected network.");
        setMetadataState("error");
      }
    });
    return () => { cancelled = true; };
  }, [publicClient, contractAddress, deploymentBlock, parsedId, isSupportedReadNetwork, exists]);

  useEffect(() => {
    let cancelled = false;
    if (!publicClient || !isSupportedReadNetwork) return () => { cancelled = true; };
    void publicClient.getBlock({ blockTag: "latest" }).then((current) => {
      if (!cancelled) setBlockTime(current.timestamp);
    }).catch(() => {
      if (!cancelled) setBlockTime(undefined);
    });
    return () => { cancelled = true; };
  }, [publicClient, isSupportedReadNetwork]);

  const eligibleRefund = Boolean(bounty && selectedContribution && selectedContribution > BigInt(0) && blockTime && bounty.status !== 1 && bounty.status !== 2 && bounty.status !== 3 && blockTime > bounty.settlementDeadline + refundGrace);
  const currencySymbol = localE2E && chainId === patchPoolLocalE2E.id ? "local ETH" : "MSTC";
  const title = metadata?.title ?? `Bounty #${bountyId}`;
  const statusLabel = bounty ? statusLabels[bounty.status] ?? "Unknown" : "";
  const assignedReview = address && bounty && address.toLowerCase() === bounty.reviewer.toLowerCase()
    ? submissions.find((submission) => !submission.rejected && bounty.status === 0)
    : undefined;
  const contributorContext = Boolean(address && bounty && address.toLowerCase() !== bounty.reviewer.toLowerCase() && address.toLowerCase() !== bounty.sponsor.toLowerCase());
  const actionWorkspaceUrl = assignedReview
    ? `/reviewer?bounty=${encodeURIComponent(bountyId)}&submission=${assignedReview.id.toString()}`
    : contributorContext
      ? `/contributor?bounty=${encodeURIComponent(bountyId)}&action=submit`
      : `/?bounty=${encodeURIComponent(bountyId)}#bounties`;
  const actionWorkspaceLabel = assignedReview ? "Open assigned review" : contributorContext ? "Open contributor workspace" : "Open action workspace";
  const sponsorHref = bounty ? explorerAddress(bounty.sponsor, chainId) : undefined;
  const reviewerHref = bounty ? explorerAddress(bounty.reviewer, chainId) : undefined;
  const creationHref = creationHash ? explorerTransaction(creationHash, chainId) : undefined;

  return (
    <main className="detail-app">
      <a className="skip-link" href="#detail-content">Skip to content</a>
      <header className="topbar detail-topbar">
        <Link className="brand" href="/" aria-label="PatchPool home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span><span className="brand-name" style={{ display: "block" }}>PATCHPOOL</span><span className="brand-subtitle">OPEN-SOURCE WORK, FUNDED</span></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation"><Link href="/#bounties">Bounties</Link><Link href="/#trail">How it works</Link><Link href="/#trust">Trust &amp; Security</Link></nav>
        <div className="header-actions"><NetworkSwitcher /><ConnectButton localE2E={localE2E} /></div>
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} aria-controls="detail-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /></button>
      </header>
      <nav className={`mobile-nav-panel${mobileMenuOpen ? " is-open" : ""}`} id="detail-mobile-navigation" aria-label="Mobile navigation" aria-hidden={!mobileMenuOpen} hidden={!mobileMenuOpen}>
        <Link href="/#bounties" onClick={() => setMobileMenuOpen(false)}>Bounties</Link><Link href="/#trail" onClick={() => setMobileMenuOpen(false)}>How it works</Link><Link href="/#trust" onClick={() => setMobileMenuOpen(false)}>Trust &amp; Security</Link>
      </nav>
      <NetworkWarning />
      <div id="detail-content" className="detail-content" tabIndex={-1}>
        <nav className="detail-breadcrumb" aria-label="Breadcrumb"><Link href="/#bounties">Bounties</Link><span aria-hidden="true">/</span><span>Bounty #{bountyId}</span></nav>

        {!parsedId ? <section className="detail-state detail-error"><span className="detail-overline">INVALID BOUNTY ID</span><h1>This bounty address isn’t valid.</h1><p>Use a positive numeric bounty ID from the PatchPool marketplace.</p><Link className="button primary" href="/#bounties">Return to marketplace</Link></section>
          : loadingBountyCount ? <section className="detail-state" aria-live="polite"><span className="detail-overline">PATCHPOOL REGISTRY</span><h1>Loading bounty #{bountyId}</h1><p>Reading the selected network’s registered contract.</p></section>
            : bountyCountError ? <section className="detail-state detail-error" role="alert"><span className="detail-overline">REGISTRY UNAVAILABLE</span><h1>We couldn’t reach the bounty registry.</h1><p>The network read failed. This does not mean the bounty is missing.</p><button className="button primary" type="button" onClick={() => void bountyRead.refetch()}>Retry read</button></section>
              : !canReadRegisteredDeployment || !contractAddress ? <section className="detail-state detail-error"><span className="detail-overline">NETWORK NOT AVAILABLE</span><h1>PatchPool isn’t available on this network.</h1><p>Production bounty details are read from MST Mainnet (chain {mstMainnet.id}). Historical Testnet records are not treated as production activity.</p><Link className="button primary" href="/#bounties">Return to marketplace</Link></section>
                : !exists ? <section className="detail-state"><span className="detail-overline">BOUNTY NOT FOUND</span><h1>No bounty #{bountyId} exists.</h1><p>The registry currently contains {bountyCount?.toString() ?? "no"} bounty records on this network.</p><Link className="button primary" href="/#bounties">Browse bounties</Link></section>
                  : bountyRead.isError ? <section className="detail-state detail-error" role="alert"><span className="detail-overline">BOUNTY READ FAILED</span><h1>We couldn’t load bounty #{bountyId}.</h1><p>The record may be temporarily unavailable from this RPC endpoint.</p><button className="button primary" type="button" onClick={() => void bountyRead.refetch()}>Retry read</button></section>
                    : !bounty ? <section className="detail-state" aria-live="polite"><span className="detail-overline">BOUNTY #{bountyId}</span><h1>Loading verified terms…</h1><p>Fetching the bounty’s contract state.</p></section>
                      : <>
                        <header className="detail-hero">
                          <div className="detail-hero-copy">
                            <div className="detail-overline"><span>SOFTWARE-FIX BOUNTY</span><span aria-hidden="true">·</span><span>#{bountyId}</span></div>
                            <h1>{metadata ? title : `Bounty #${bountyId}`}</h1>
                            {metadata ? <p className="detail-description">{metadata.description}</p>
                              : metadataState === "loading" ? <p className="detail-description" role="status">Verifying the public task description against its on-chain commitment…</p>
                                : <p className="detail-description">The public task description is unavailable. The on-chain commitment is shown below so the record remains independently identifiable.</p>}
                            <div className="detail-hero-actions"><Link className="button primary" href={actionWorkspaceUrl} prefetch={false}>{actionWorkspaceLabel} <span aria-hidden="true">↗</span></Link><Link className="button detail-secondary" href="/#bounties">Back to marketplace</Link></div>
                            <p className="detail-action-note">Wallet actions are handled in the PatchPool workspace and remain subject to network, role, lifecycle, and contract checks.</p>
                          </div>
                          <aside className="detail-reward-panel" aria-label="Bounty reward and status">
                            <span className="detail-overline">BOUNTY REWARD</span>
                            <strong>{formatEther(bounty.reward)} <small>{currencySymbol}</small></strong>
                            <span className={`detail-status detail-status-${bounty.status}`}>{statusLabel}</span>
                            <p>{bounty.status === 2 ? "The contract records this bounty as paid." : bounty.status === 3 ? "All eligible refunds have been claimed." : bounty.status === 4 ? "Some eligible contributor refunds remain unclaimed." : bounty.status === 1 ? "A submission was approved; settlement can be initiated." : "Funding and submissions follow the contract deadlines."}</p>
                          </aside>
                        </header>

                        <div className="detail-grid">
                          <div className="detail-main-column">
                            <section className="detail-section" aria-labelledby="terms-heading">
                              <div className="detail-section-heading"><span className="detail-overline">01 / THE TERMS</span><h2 id="terms-heading">What this bounty asks for</h2></div>
                              {metadata ? <p className="detail-long-description">{metadata.description}</p> : <div className="detail-metadata-note" role={metadataState === "error" ? "alert" : "status"}><strong>{metadataState === "error" ? "Metadata read failed" : metadataState === "loading" ? "Checking public metadata" : "Description not verified"}</strong><p>{metadataState === "error" ? metadataError : "This interface will not substitute sample text. Compare the committed hash below with the metadata event on-chain."}</p></div>}
                              <div className="detail-hash"><span className="detail-overline">TASK COMMITMENT · KECCAK-256</span><code>{bounty.taskHash}</code></div>
                            </section>
                            <section className="detail-section" aria-labelledby="submissions-heading">
                              <div className="detail-section-heading"><span className="detail-overline">02 / SUBMISSIONS</span><h2 id="submissions-heading">Work submitted <span className="detail-count">{typeof countRead.data === "bigint" ? submissionCount.toString() : "…"}</span></h2></div>
                              {countRead.isLoading ? <p className="detail-muted" role="status">Reading the submission count from the contract…</p>
                                : countRead.isError ? <p className="detail-muted" role="alert">The bounty loaded, but the submission count is temporarily unavailable.</p>
                                : submissionReads.isLoading ? <p className="detail-muted" role="status">Reading submissions from the contract…</p>
                                : submissionCount === BigInt(0) ? <p className="detail-muted">No submissions have been recorded for this bounty.</p>
                                  : submissions.length === 0 ? <p className="detail-muted" role="status">Submission records could not be read. The contract reports {submissionCount.toString()} submission(s).</p>
                                    : <div className="detail-submissions">{submissions.map((submission) => {
                                      const approved = bounty.approvedSubmissionId === submission.id;
                                      const state = approved ? "Approved" : submission.rejected ? "Rejected" : "Awaiting review";
                                      return <article className="detail-submission" key={submission.id.toString()}>
                                        <div className="detail-submission-heading"><strong>Submission #{submission.id.toString()}</strong><span>{state}</span></div>
                                        <dl><div><dt>Submitted</dt><dd>{dateTime(submission.submittedAt)}</dd></div><div><dt>Contributor</dt><dd>{shortAddress(submission.submitter)}</dd></div><div><dt>Recorded payee</dt><dd>{shortAddress(submission.payee)}</dd></div></dl>
                                        <div className="detail-hash"><span className="detail-overline">GIT COMMIT · {submission.commitIsSha256 ? "SHA-256" : "SHA-1"}</span><code>{submission.commitIsSha256 ? submission.commitHash.slice(2) : submission.commitHash.slice(-40)}</code></div>
                                        <div className="detail-hash"><span className="detail-overline">EVIDENCE SHA-256 DIGEST</span><code>{submission.evidenceHash}</code></div>
                                        <p className="detail-evidence-note">Evidence files are off-chain. A matching digest confirms bytes, not the truth or quality of the submitted work.</p>
                                      </article>;
                                    })}{submissionCount > BigInt(submissions.length) && <p className="detail-muted">Showing the latest {submissions.length} readable submission records.</p>}</div>}
                            </section>
                          </div>
                          <aside className="detail-side-column">
                            <section className="detail-section detail-facts" aria-labelledby="facts-heading">
                              <div className="detail-section-heading"><span className="detail-overline">03 / ON-CHAIN RECORD</span><h2 id="facts-heading">Bounty facts</h2></div>
                              <dl>
                                <div><dt>Sponsor</dt><dd>{sponsorHref ? <a href={sponsorHref} target="_blank" rel="noreferrer">{shortAddress(bounty.sponsor)} ↗</a> : shortAddress(bounty.sponsor)}</dd></div>
                                <div><dt>Assigned reviewer</dt><dd>{reviewerHref ? <a href={reviewerHref} target="_blank" rel="noreferrer">{shortAddress(bounty.reviewer)} ↗</a> : shortAddress(bounty.reviewer)}</dd></div>
                                <div><dt>Submission deadline</dt><dd>{dateTime(bounty.submissionDeadline)}</dd></div>
                                <div><dt>Review / settlement deadline</dt><dd>{dateTime(bounty.settlementDeadline)}</dd></div>
                                <div><dt>Refundable pool</dt><dd>{refundRead.isError ? "Unavailable" : refundableBalance === undefined ? "Reading…" : `${formatEther(refundableBalance)} ${currencySymbol}`}</dd></div>
                                {creationHref && <div><dt>Created on-chain</dt><dd><a href={creationHref} target="_blank" rel="noreferrer">View transaction ↗</a></dd></div>}
                              </dl>
                              <p className="detail-side-note">The contract does not expose a list of funders. When connected, your own contribution is read directly from the selected network.</p>
                              {isConnected ? <p className="detail-contribution">Your recorded contribution <strong>{contributionRead.isError ? "Unavailable" : selectedContribution === undefined ? "Reading…" : `${formatEther(selectedContribution)} ${currencySymbol}`}</strong></p> : <div className="detail-connect-note"><strong>Connect to view your contribution.</strong><ConnectButton localE2E={localE2E} /></div>}
                              {eligibleRefund && <a className="detail-refund-link" href={actionWorkspaceUrl}>A refund may be claimable · open action workspace</a>}
                            </section>
                            <section className="detail-section detail-model" aria-labelledby="model-heading"><span className="detail-overline">HOW THIS WORKS</span><h2 id="model-heading">Human review. Contract settlement.</h2><p>The assigned reviewer evaluates the work. The contract enforces role restrictions and settlement rules; it does not verify code quality.</p><Link href="/#trust">Read the security model ↗</Link></section>
                            <p className="detail-network-note">{localE2E && chainId === patchPoolLocalE2E.id ? "Local E2E · not MST Mainnet activity" : `Reading registered MST Mainnet deployment · chain ${mstMainnet.id}`}</p>
                          </aside>
                        </div>
                      </>}
      </div>
      <footer className="detail-footer"><Link className="brand" href="/" aria-label="PatchPool home"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-name">PATCHPOOL</span></Link><a href="https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338#code" target="_blank" rel="noreferrer">Verify the production contract ↗</a></footer>
    </main>
  );
}
