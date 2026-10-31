"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { ConnectButton } from "@/components/ConnectButton";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { NetworkWarning } from "@/components/NetworkWarning";
import { useRoleWorkspaceData, type WorkspaceBounty, type WorkspaceSubmission } from "@/hooks/useRoleWorkspaceData";
import { reviewEligibility, submissionEligibility, submissionStatus } from "@/lib/patchpoolLifecycle";
import { mstMainnet } from "@/lib/chains";
import { RoleLifecycleAction } from "@/components/RoleLifecycleAction";

type WorkspaceRole = "contributor" | "reviewer";
type WorkspaceTab = "discover" | "submissions" | "reviews";

const bountyStatuses = ["Open", "Approved", "Paid", "Refunded", "Refunding"];

function compactAddress(value?: string) {
  return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "Unavailable";
}

function displayDate(value: bigint) {
  return new Date(Number(value) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function summaryStatus(bounty: WorkspaceBounty, submission: WorkspaceSubmission) {
  return submissionStatus(bounty, submission);
}

function WorkspaceHeader({ role, localE2E }: { role: WorkspaceRole; localE2E: boolean }) {
  return <>
    <a className="skip-link" href="#role-main">Skip to workspace</a>
    <header className="topbar role-topbar">
      <Link className="brand" href="/" aria-label="PatchPool home"><span className="brand-mark" aria-hidden="true"><span /></span><span><span className="brand-name" style={{ display: "block" }}>PATCHPOOL</span><span className="brand-subtitle">OPEN-SOURCE WORK, FUNDED</span></span></Link>
      <nav className="primary-nav role-nav" aria-label="Main navigation"><Link href="/#bounties">Marketplace</Link><Link href="/contributor" aria-current={role === "contributor" ? "page" : undefined}>Contribute</Link><Link href="/reviewer" aria-current={role === "reviewer" ? "page" : undefined}>Review</Link><Link href="/#trust">Security</Link></nav>
      <div className="header-actions"><NetworkSwitcher /><ConnectButton localE2E={localE2E} /></div>
    </header>
    <NetworkWarning />
  </>;
}

function WorkspaceBountyCard({
  role,
  bounty,
  submission,
  title,
  description,
  localE2E,
  canAct,
  actionReason,
  onAction,
}: {
  role: WorkspaceRole;
  bounty: WorkspaceBounty;
  submission?: WorkspaceSubmission;
  title: string;
  description?: string;
  localE2E: boolean;
  canAct: boolean;
  actionReason?: string;
  onAction: () => void;
}) {
  const state = submission ? summaryStatus(bounty, submission) : bountyStatuses[bounty.status] ?? "Unknown";
  const currency = localE2E ? "local ETH" : "MSTC";
  const isReview = role === "reviewer" && Boolean(submission);
  return <article className="role-work-card">
    <div className="role-work-card-top"><span className="role-overline">BOUNTY #{bounty.id.toString()}{submission ? ` · SUBMISSION #${submission.id.toString()}` : ""}</span><span className={`role-status role-status-${state.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{state}</span></div>
    <div className="role-work-card-heading"><div><h3>{title}</h3><p>{description || "Task metadata is not currently available or could not be verified against the on-chain commitment."}</p></div><div className="role-reward"><small>ESCROWED POOL</small><strong>{formatEther(bounty.reward)} <span>{currency}</span></strong></div></div>
    <div className="role-work-facts"><div><span>{isReview ? "SUBMITTED" : "SUBMIT BY"}</span><strong>{submission ? displayDate(submission.submittedAt) : displayDate(bounty.submissionDeadline)}</strong></div><div><span>{isReview ? "CONTRIBUTOR" : "REVIEWER"}</span><strong>{isReview && submission ? compactAddress(submission.submitter) : compactAddress(bounty.reviewer)}</strong></div><div><span>REVIEW / SETTLEMENT</span><strong>{displayDate(bounty.settlementDeadline)}</strong></div></div>
    {submission && <details className="role-submission-detail"><summary>{isReview ? "Compare task requirements and submitted evidence" : "Submission and review details"}</summary><div className="role-evidence-grid"><div><span className="role-overline">GIT COMMIT · {submission.commitIsSha256 ? "SHA-256" : "SHA-1"}</span><code>{submission.commitIsSha256 ? submission.commitHash.slice(2) : submission.commitHash.slice(-40)}</code></div><div><span className="role-overline">EVIDENCE SHA-256 DIGEST</span><code>{submission.evidenceHash}</code></div><div><span className="role-overline">RECORDED PAYEE</span><code>{submission.payee}</code></div></div><p className="role-evidence-note">Evidence files are off-chain. The digest can identify matching bytes; it does not prove that evidence is truthful or that code is correct.</p></details>}
    <div className="role-work-actions"><Link className="button ghost" href={`/bounties/${bounty.id.toString()}`}>Open bounty details</Link><button className={canAct ? "button primary" : "button ghost"} type="button" onClick={onAction}>{isReview ? "Inspect and decide" : submission ? "View submission" : canAct ? "Prepare submission" : "Check participation"}</button></div>
    {!canAct && actionReason && <p className="role-action-note" role="status">{actionReason}</p>}
    {submission && bounty.approvedSubmissionId === submission.id && bounty.status === 1 && <p className="role-action-note">The contract records this submission as approved. Reward release is a separate on-chain transaction.</p>}
  </article>;
}

export function RoleWorkspace({ role }: { role: WorkspaceRole }) {
  const data = useRoleWorkspaceData();
  const workspaceBountyCount = data.bountyCount;
  const workspacePage = data.page;
  const loadWorkspacePage = data.loadPage;
  const [tab, setTab] = useState<WorkspaceTab>(role === "contributor" ? "discover" : "reviews");
  const [focusedBountyId, setFocusedBountyId] = useState<bigint>();
  const [query, setQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<{ kind: "submit"; bountyId: bigint } | { kind: "review"; bountyId: bigint; submissionId: bigint }>();
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, { commit: string; evidence: string; payee: string }>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get("bounty");
    if (rawId && /^[1-9]\d{0,77}$/.test(rawId)) setFocusedBountyId(BigInt(rawId));
    const rawSubmission = params.get("submission");
    if (role === "reviewer" && rawId && rawSubmission && /^[1-9]\d{0,77}$/.test(rawId) && /^[1-9]\d{0,77}$/.test(rawSubmission)) {
      setSelectedAction({ kind: "review", bountyId: BigInt(rawId), submissionId: BigInt(rawSubmission) });
      setTab("reviews");
    } else if (role === "contributor" && rawId && params.get("action") === "submit" && /^[1-9]\d{0,77}$/.test(rawId)) {
      setSelectedAction({ kind: "submit", bountyId: BigInt(rawId) });
    }
  }, [role]);

  useEffect(() => {
    if (!focusedBountyId || workspaceBountyCount === undefined || focusedBountyId > workspaceBountyCount) return;
    const targetPage = Number((workspaceBountyCount - focusedBountyId) / BigInt(20));
    if (targetPage !== workspacePage) loadWorkspacePage(targetPage);
  }, [focusedBountyId, workspaceBountyCount, workspacePage, loadWorkspacePage]);

  const bountyById = useMemo(() => new Map(data.bounties.map((bounty) => [bounty.id.toString(), bounty])), [data.bounties]);
  const submissionById = useMemo(() => new Map(data.submissions.map((submission) => [`${submission.bountyId}:${submission.id}`, submission])), [data.submissions]);
  const now = data.blockTime;
  const addressLower = data.address?.toLowerCase();
  const ownSubmissions = useMemo(() => data.submissions.filter((submission) => addressLower && (
    submission.submitter.toLowerCase() === addressLower || submission.payee.toLowerCase() === addressLower
  )), [data.submissions, addressLower]);
  const discoverable = useMemo(() => data.bounties.filter((bounty) => {
    if (bounty.status !== 0 || (now !== undefined && now > bounty.submissionDeadline)) return false;
    if (!addressLower) return true;
    return bounty.reviewer.toLowerCase() !== addressLower && bounty.myContribution === BigInt(0);
  }), [data.bounties, addressLower, now]);
  const reviewQueue = useMemo(() => data.submissions.flatMap((submission) => {
    const bounty = bountyById.get(submission.bountyId.toString());
    if (!bounty || !addressLower || bounty.reviewer.toLowerCase() !== addressLower || bounty.status !== 0 || submission.rejected) return [];
    return [{ bounty, submission }];
  }), [data.submissions, bountyById, addressLower]);
  const reviewHistory = useMemo(() => data.submissions.flatMap((submission) => {
    const bounty = bountyById.get(submission.bountyId.toString());
    if (!bounty || !addressLower || bounty.reviewer.toLowerCase() !== addressLower) return [];
    if (!submission.rejected && bounty.approvedSubmissionId !== submission.id) return [];
    return [{ bounty, submission }];
  }), [data.submissions, bountyById, addressLower]);

  const baseSearch = query.trim().toLowerCase();
  const matchBounty = (bounty: WorkspaceBounty) => {
    if (focusedBountyId && bounty.id !== focusedBountyId) return false;
    if (!baseSearch) return true;
    const task = data.tasks[bounty.id.toString()];
    return [bounty.id.toString(), task?.title, task?.description, bounty.sponsor, bounty.reviewer].some((value) => value?.toLowerCase().includes(baseSearch));
  };
  const visibleDiscover = discoverable.filter(matchBounty);
  const visibleOwn = ownSubmissions.flatMap((submission) => {
    const bounty = bountyById.get(submission.bountyId.toString());
    return bounty && matchBounty(bounty) ? [{ bounty, submission }] : [];
  });
  const visibleQueue = reviewQueue.filter(({ bounty }) => matchBounty(bounty));
  const visibleHistory = reviewHistory.filter(({ bounty }) => matchBounty(bounty));
  const pendingContributor = ownSubmissions.filter((submission) => {
    const bounty = bountyById.get(submission.bountyId.toString());
    return bounty && submissionStatus(bounty, submission) === "Awaiting review";
  }).length;
  const approvedContributor = ownSubmissions.filter((submission) => {
    const bounty = bountyById.get(submission.bountyId.toString());
    return bounty && (submissionStatus(bounty, submission).startsWith("Approved") || submissionStatus(bounty, submission) === "Paid");
  }).length;

  const currency = data.localE2E && data.chainId === 31337 ? "local ETH" : "MSTC";
  const selectedBounty = selectedAction ? bountyById.get(selectedAction.bountyId.toString()) : undefined;
  const selectedSubmission = selectedAction?.kind === "review" ? submissionById.get(`${selectedAction.bountyId}:${selectedAction.submissionId}`) : undefined;
  const selectedTask = selectedAction ? data.tasks[selectedAction.bountyId.toString()] : undefined;
  const selectedDraft = selectedAction?.kind === "submit"
    ? submissionDrafts[selectedAction.bountyId.toString()] ?? { commit: "", evidence: "", payee: data.address ?? "" }
    : undefined;
  const headline = role === "contributor" ? "Find the fix worth shipping." : "Review work with the full context.";
  const intro = role === "contributor"
    ? "Explore funded software work, track the submissions linked to this wallet, and see what needs your attention next."
    : "A focused queue for the submissions assigned to this wallet. Compare the original task with recorded evidence before deciding.";

  return <div className="role-app">
    <WorkspaceHeader role={role} localE2E={data.localE2E} />
    <main id="role-main" className="role-content" tabIndex={-1}>
      <header className="role-hero"><div><div className="role-overline">PATCHPOOL / {role === "contributor" ? "CONTRIBUTOR" : "REVIEWER"} WORKSPACE</div><h1>{headline}</h1><p>{intro}</p></div><div className="role-hero-side"><span>{data.localE2E && data.chainId === 31337 ? "LOCAL E2E · NOT MST ACTIVITY" : `MST MAINNET · CHAIN ${mstMainnet.id}`}</span><small>Wallet-linked records only</small></div></header>

      <div className="role-metrics" aria-label={`${role} workspace summary`}>
        {role === "contributor" ? <>
          <div><span>OPEN OPPORTUNITIES · LOADED</span><strong>{data.loading ? "…" : addressLower ? discoverable.length : "—"}</strong><small>{addressLower ? "Eligible by current role and contract state" : "Connect a wallet to check eligibility"}</small></div>
          <div><span>MY SUBMISSIONS · LOADED</span><strong>{data.loading ? "…" : addressLower ? ownSubmissions.length : "—"}</strong><small>Latest 10 submission records per bounty</small></div>
          <div><span>AWAITING REVIEW</span><strong>{data.loading ? "…" : addressLower ? pendingContributor : "—"}</strong><small>From readable loaded submissions</small></div>
          <div><span>APPROVED OR PAID</span><strong>{data.loading ? "…" : addressLower ? approvedContributor : "—"}</strong><small>Approval does not mean payout is confirmed</small></div>
        </> : <>
          <div><span>REVIEW QUEUE · LOADED</span><strong>{data.loading ? "…" : addressLower ? reviewQueue.length : "—"}</strong><small>{addressLower ? "Readable, non-rejected submissions" : "Connect the assigned reviewer wallet"}</small></div>
          <div><span>DECISIONS RECORDED · LOADED</span><strong>{data.loading ? "…" : addressLower ? reviewHistory.length : "—"}</strong><small>Based on the latest 10 records per bounty</small></div>
          <div><span>BOUNTY PAGE</span><strong>{data.page + 1}<small>{data.pageCount ? ` / ${data.pageCount}` : ""}</small></strong><small>20 bounty records per page</small></div>
          <div><span>DECISION MODEL</span><strong>1 reviewer</strong><small>Human decision, contract-enforced settlement</small></div>
        </>}
      </div>

      <div className="role-data-boundary"><span className="role-boundary-mark">i</span><p>On-chain records are read directly. This workspace loads 20 bounties at a time and up to 10 latest submissions for each bounty; it is not a complete account history. Task descriptions are shown only when their public event metadata matches the on-chain hash.</p><button type="button" onClick={data.retry} disabled={data.loading}>Refresh reads</button></div>

      {selectedAction && <section className="role-native-action" aria-label={role === "contributor" ? "Submit work" : "Review submission"}>
        {data.readError ? <div className="role-empty" role="alert"><h2>Contract state is unavailable.</h2><p>{data.readError.message}</p><button className="button ghost" type="button" onClick={data.retry}>Retry reads</button></div>
          : !data.supportedNetwork ? <div className="role-empty" role="alert"><h2>Connect to MST Mainnet to load this bounty.</h2><p>Production reads and actions require chain 4646. The historical Testnet is not a production network.</p><NetworkSwitcher /></div>
            : data.loading && !selectedBounty ? <div className="role-loading" role="status"><p>Loading the selected bounty and contract state…</p></div>
          : !selectedBounty ? <div className="role-empty" role="alert"><h2>This bounty is outside the loaded record scope.</h2><p>Return to its detail page or load the relevant bounty page before starting a guarded action.</p><Link className="button ghost" href={`/bounties/${selectedAction.bountyId}`}>Open bounty detail</Link></div>
            : selectedAction.kind === "review" && !selectedSubmission ? <div className="role-empty" role="alert"><h2>This submission is not in the loaded recent records.</h2><p>The workspace reads at most 10 latest submissions per bounty. It will not guess or fabricate the requested submission.</p><button className="button ghost" type="button" onClick={() => setSelectedAction(undefined)}>Back to review queue</button></div>
              : <RoleLifecycleAction
                key={selectedAction.kind === "submit" ? `submit-${selectedAction.bountyId}` : `review-${selectedAction.bountyId}-${selectedAction.submissionId}`}
                role={role}
                bounty={selectedBounty}
                submission={selectedSubmission}
                title={selectedTask?.title ?? `Bounty #${selectedBounty.id.toString()}`}
                description={selectedTask?.description}
                data={data}
                draft={selectedDraft ?? { commit: "", evidence: "", payee: "" }}
                onDraftChange={(next) => {
                  if (selectedAction.kind !== "submit") return;
                  const key = selectedAction.bountyId.toString();
                  setSubmissionDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? { commit: "", evidence: "", payee: data.address ?? "" }), ...next } }));
                }}
                onCancel={() => setSelectedAction(undefined)}
                onShowProgress={() => { setSelectedAction(undefined); setTab("submissions"); }}
              />}
      </section>}

      {!data.supportedNetwork && <section className="role-state role-error" role="alert"><span className="role-overline">NETWORK NOT SUPPORTED</span><h2>Connect to MST Mainnet to load production work.</h2><p>PatchPool production records are read from chain 4646. Historical Testnet is not shown as production activity.</p><NetworkSwitcher /></section>}
      {data.supportedNetwork && !data.isDeployed && !data.loading && <section className="role-state role-error" role="alert"><span className="role-overline">REGISTRY NOT AVAILABLE</span><h2>No verified deployment is configured for this network.</h2><p>Reads and actions are disabled until the registered deployment evidence is available.</p></section>}
      {data.readError && <section className="role-state role-error" role="alert"><span className="role-overline">CONTRACT READ FAILED</span><h2>Workspace records could not be loaded.</h2><p>{data.readError.message}</p><button className="button ghost" type="button" onClick={data.retry}>Retry reads</button></section>}
      {data.hasPartialReads && !data.readError && <p className="role-partial-read" role="status">Some contract records could not be read. Counts and cards below include only successful reads.</p>}
      {data.metadataState === "error" && <p className="role-partial-read" role="alert">Task metadata reads failed: {data.metadataError}</p>}
      {data.metadataState === "partial" && <p className="role-partial-read" role="status">The bounded metadata scan did not find every loaded task description. Missing text remains unavailable instead of being replaced with sample content.</p>}

      <div className="role-workspace-layout">
        <section className="role-workspace-main" aria-labelledby="role-list-heading">
          <div className="role-list-heading"><div><span className="role-overline">{role === "contributor" ? "YOUR CONTRIBUTION DESK" : "ASSIGNED REVIEW QUEUE"}</span><h2 id="role-list-heading">{role === "contributor" ? "Work and submissions" : "Review work"}</h2></div><div className="role-list-controls"><label className="sr-only" htmlFor="role-search">Search loaded records</label><input id="role-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded records" /></div></div>
          <div className="role-tabs" role="tablist" aria-label={role === "contributor" ? "Contributor views" : "Reviewer views"}>
            {role === "contributor" ? <><button type="button" role="tab" aria-selected={tab === "discover"} onClick={() => setTab("discover")}>Discover work <span>{discoverable.length}</span></button><button type="button" role="tab" aria-selected={tab === "submissions"} onClick={() => setTab("submissions")}>My submissions <span>{ownSubmissions.length}</span></button></>
              : <><button type="button" role="tab" aria-selected={tab === "reviews"} onClick={() => setTab("reviews")}>Needs a decision <span>{reviewQueue.length}</span></button><button type="button" role="tab" aria-selected={tab === "submissions"} onClick={() => setTab("submissions")}>Decision history <span>{reviewHistory.length}</span></button></>}
          </div>

          {data.loading && <div className="role-loading" role="status"><span className="role-overline">READING CONTRACT STATE</span><p>Loading bounty and submission records from the selected registered network…</p><div className="role-skeleton" /><div className="role-skeleton" /></div>}
          {!data.loading && !data.readError && data.supportedNetwork && data.isDeployed && <>
            {role === "contributor" && tab === "discover" && (visibleDiscover.length ? <div className="role-card-list">{visibleDiscover.map((bounty) => {
              const eligibility = submissionEligibility({ bounty, address: data.address, connected: data.isConnected, authorizedWallet: data.authorizedWallet, supportedNetwork: data.supportedNetwork, writesEnabled: data.writesEnabled, blockTime: now });
              const task = data.tasks[bounty.id.toString()];
              return <WorkspaceBountyCard key={bounty.id.toString()} role={role} bounty={bounty} title={task?.title ?? `Bounty #${bounty.id.toString()}`} description={task?.description} localE2E={data.localE2E && data.chainId === 31337} canAct={eligibility.eligible} actionReason={eligibility.eligible ? undefined : eligibility.reason} onAction={() => setSelectedAction({ kind: "submit", bountyId: bounty.id })} />;
            })}</div> : <div className="role-empty"><span className="role-overline">NO MATCHING OPPORTUNITIES</span><h3>{addressLower ? "No currently eligible loaded bounties." : "Connect a wallet to check participation eligibility."}</h3><p>{addressLower ? "Open bounties outside the loaded page, closed deadlines, reviewer assignments, and your existing funding can affect eligibility." : "You can browse public bounty details before connecting. Eligibility is checked against the connected address and contract state."}</p><Link className="button ghost" href="/#bounties">Browse marketplace ↗</Link></div>)}
            {role === "contributor" && tab === "submissions" && (visibleOwn.length ? <div className="role-card-list">{visibleOwn.map(({ bounty, submission }) => <WorkspaceBountyCard key={`${bounty.id}:${submission.id}`} role={role} bounty={bounty} submission={submission} title={data.tasks[bounty.id.toString()]?.title ?? `Bounty #${bounty.id.toString()}`} description={data.tasks[bounty.id.toString()]?.description} localE2E={data.localE2E && data.chainId === 31337} canAct={false} onAction={() => role === "contributor" ? setSelectedAction({ kind: "submit", bountyId: bounty.id }) : setSelectedAction({ kind: "review", bountyId: bounty.id, submissionId: submission.id })} />)}</div> : <div className="role-empty"><span className="role-overline">NO SUBMISSIONS IN LOADED RECORDS</span><h3>{addressLower ? "This wallet has no readable recent submissions." : "Connect your wallet to see its submissions."}</h3><p>Submission history is limited to the latest 10 records per loaded bounty and current bounty page.</p></div>)}
            {role === "reviewer" && tab === "reviews" && (addressLower ? visibleQueue.length ? <div className="role-card-list">{visibleQueue.map(({ bounty, submission }) => {
              const eligibility = reviewEligibility({ bounty, submission, address: data.address, connected: data.isConnected, authorizedWallet: data.authorizedWallet, supportedNetwork: data.supportedNetwork, writesEnabled: data.writesEnabled, blockTime: now });
              return <WorkspaceBountyCard key={`${bounty.id}:${submission.id}`} role={role} bounty={bounty} submission={submission} title={data.tasks[bounty.id.toString()]?.title ?? `Bounty #${bounty.id.toString()}`} description={data.tasks[bounty.id.toString()]?.description} localE2E={data.localE2E && data.chainId === 31337} canAct={eligibility.eligible} actionReason={eligibility.eligible ? undefined : eligibility.reason} onAction={() => setSelectedAction({ kind: "review", bountyId: bounty.id, submissionId: submission.id })} />;
            })}</div> : <div className="role-empty"><span className="role-overline">QUEUE CLEAR</span><h3>No readable pending submissions are assigned to this wallet.</h3><p>The queue is limited to loaded bounty pages and the latest 10 submission records per bounty.</p></div> : <div className="role-empty"><span className="role-overline">CONNECT REVIEWER WALLET</span><h3>Your assigned queue is address-specific.</h3><p>Connect the wallet recorded as reviewer on a bounty to view eligible submissions. The reviewer role is enforced by the contract.</p><ConnectButton localE2E={data.localE2E} /></div>)}
            {role === "reviewer" && tab === "submissions" && (addressLower ? visibleHistory.length ? <div className="role-card-list">{visibleHistory.map(({ bounty, submission }) => <WorkspaceBountyCard key={`${bounty.id}:${submission.id}`} role={role} bounty={bounty} submission={submission} title={data.tasks[bounty.id.toString()]?.title ?? `Bounty #${bounty.id.toString()}`} description={data.tasks[bounty.id.toString()]?.description} localE2E={data.localE2E && data.chainId === 31337} canAct={false} onAction={() => setSelectedAction({ kind: "review", bountyId: bounty.id, submissionId: submission.id })} />)}</div> : <div className="role-empty"><span className="role-overline">NO DECISIONS IN LOADED RECORDS</span><h3>No completed review decisions were found in this loaded scope.</h3><p>This view does not claim to be complete review history.</p></div> : <div className="role-empty"><h3>Connect the assigned reviewer wallet to read its decisions.</h3><ConnectButton localE2E={data.localE2E} /></div>)}
          </>}
          {focusedBountyId && !data.loading && !data.bounties.some((bounty) => bounty.id === focusedBountyId) && <div className="role-focus-note" role="status">Bounty #{focusedBountyId.toString()} is not in the currently loaded page. Load older records or open it directly from the detail route.</div>}
          {data.canLoadOlder && <div className="role-pagination"><span>Showing bounty page {data.page + 1} of {data.pageCount}, 20 records per page.</span><button className="button ghost" type="button" disabled={data.loading} onClick={data.loadOlder}>Load older bounty records</button></div>}
        </section>

        <aside className="role-workspace-aside">
          {role === "contributor" ? <><section><span className="role-overline">SUBMISSION CHECKLIST</span><h2>Before you submit</h2><ol><li>Read the verified task description and deadlines.</li><li>Prepare a Git commit ID and evidence digest.</li><li>Choose a payout address that is not the creator, reviewer, or a contributor.</li><li>Review the contract action before approving it in your wallet.</li></ol><p>Evidence files remain in your browser. Only the digest is submitted on-chain.</p></section><section><span className="role-overline">AFTER SUBMISSION</span><h2>What happens next</h2><p>The assigned human reviewer can approve or reject the submission before the review deadline. Approval records a payee; a separate confirmed transaction releases the reward.</p></section></>
            : <><section><span className="role-overline">REVIEW STANDARD</span><h2>Human judgment, clear evidence</h2><p>Compare the committed task description with the submitted commit and digest. The contract does not run or verify code.</p><p>There is one assigned reviewer. The protocol has no quorum or dispute flow.</p></section><section><span className="role-overline">DECISION CONSEQUENCES</span><h2>Before you decide</h2><ul><li>Approval makes the bounty eligible for reward release to the payee recorded with that submission.</li><li>Rejection is recorded on-chain. Another non-rejected submission may still be reviewed while the bounty remains open.</li></ul><p>No rejection-reason field is recorded by this contract.</p></section></>}
          <section className="role-security-link"><span className="role-overline">PROTOCOL TRANSPARENCY</span><p>Role checks, escrow, and settlement rules are enforced by the deployed contract. Address roles are not identity verification.</p><Link href="/#trust">Read Trust &amp; Security ↗</Link></section>
        </aside>
      </div>
    </main>
    <footer className="role-footer"><span>PATCHPOOL · {data.localE2E && data.chainId === 31337 ? "LOCAL TEST DATA ONLY" : "MST MAINNET · 4646"}</span><Link href="/#bounties">Marketplace</Link>{focusedBountyId && <Link href={`/bounties/${focusedBountyId.toString()}`}>Bounty details</Link>}</footer>
  </div>;
}
