"use client";

import { useState, type FormEvent } from "react";
import { formatEther, isAddress } from "viem";
import { type WorkspaceBounty, type WorkspaceSubmission, useRoleWorkspaceData } from "@/hooks/useRoleWorkspaceData";
import { reviewEligibility, submissionEligibility, submissionStatus } from "@/lib/patchpoolLifecycle";
import { useWorkspaceTransaction } from "@/hooks/useWorkspaceTransaction";

type Draft = { commit: string; evidence: string; payee: string };
type Data = ReturnType<typeof useRoleWorkspaceData>;

export function RoleLifecycleAction({
  role, bounty, submission, title, description, data, draft, onDraftChange, onCancel, onShowProgress,
}: {
  role: "contributor" | "reviewer";
  bounty: WorkspaceBounty;
  submission?: WorkspaceSubmission;
  title: string;
  description?: string;
  data: Data;
  draft: Draft;
  onDraftChange: (next: Partial<Draft>) => void;
  onCancel: () => void;
  onShowProgress: () => void;
}) {
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [decision, setDecision] = useState<boolean>();
  const [formError, setFormError] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const tx = useWorkspaceTransaction({
    connected: data.isConnected,
    address: data.address,
    authorizedWallet: data.authorizedWallet,
    supportedNetwork: data.supportedNetwork,
    writesEnabled: data.writesEnabled,
  }, data.refresh);
  const isReviewerAction = role === "reviewer" && submission !== undefined;
  const reviewRecorded = isReviewerAction && submission !== undefined && (submission.rejected || bounty.approvedSubmissionId === submission.id);
  const isContributorRecord = role === "contributor" && submission !== undefined;
  const transactionConfirmed = tx.state.status === "confirmed" || tx.state.status === "confirmed-unrefreshed";
  const eligibility = isReviewerAction && submission
    ? reviewEligibility({ bounty, submission, address: data.address, connected: data.isConnected, authorizedWallet: data.authorizedWallet, supportedNetwork: data.supportedNetwork, writesEnabled: data.writesEnabled, blockTime: data.blockTime })
    : submissionEligibility({ bounty, address: data.address, connected: data.isConnected, authorizedWallet: data.authorizedWallet, supportedNetwork: data.supportedNetwork, writesEnabled: data.writesEnabled, blockTime: data.blockTime });

  function validateSubmission() {
    const commit = draft.commit.trim().toLowerCase().replace(/^0x/, "");
    const evidence = draft.evidence.trim();
    const payee = draft.payee.trim();
    if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(commit) || /^0+$/.test(commit)) return "Enter a non-zero 40 or 64 character hexadecimal Git commit ID.";
    if (!/^0x[0-9a-f]{64}$/i.test(evidence) || /^0x0{64}$/i.test(evidence)) return "Enter a non-zero 0x-prefixed SHA-256 digest.";
    if (!isAddress(payee)) return "Enter a valid payout address.";
    if (payee.toLowerCase() === bounty.sponsor.toLowerCase()) return "The bounty creator cannot receive this payout.";
    if (payee.toLowerCase() === bounty.reviewer.toLowerCase()) return "The assigned reviewer cannot receive this payout.";
    if (bounty.myContribution > BigInt(0) && payee.toLowerCase() === data.address?.toLowerCase()) return "A bounty contributor cannot receive this payout.";
    return "";
  }

  function continueToReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!eligibility.eligible) return setFormError(eligibility.reason);
    const error = validateSubmission();
    if (error) return setFormError(error);
    setStep("confirm");
  }

  async function submitWork() {
    setFormError("");
    if (!eligibility.eligible) return setFormError(eligibility.reason);
    if (!data.contractAddress || !data.abi || !data.address || !data.publicClient) return setFormError("Contract details or RPC reads are unavailable. Refresh this workspace and try again.");
    const error = validateSubmission();
    if (error) return setFormError(error);
    const commit = draft.commit.trim().toLowerCase().replace(/^0x/, "");
    const evidence = draft.evidence.trim() as `0x${string}`;
    const payee = draft.payee.trim() as `0x${string}`;
    try {
      const payeeContribution = await data.publicClient.readContract({
        address: data.contractAddress,
        abi: data.abi as never,
        functionName: "contributions",
        args: [bounty.id, payee],
      } as never) as bigint;
      if (payeeContribution > BigInt(0)) return setFormError("A bounty contributor cannot receive the payout. Choose an address with no contribution to this bounty.");
    } catch (error) {
      return setFormError(error instanceof Error ? `Could not verify payout eligibility: ${error.message}` : "Could not verify payout eligibility. Refresh the workspace and retry.");
    }
    const commitIsSha256 = commit.length === 64;
    const commitHash = `0x${commit.padStart(64, "0")}` as `0x${string}`;
    await tx.execute(`Submit to bounty #${bounty.id.toString()}`, {
      address: data.contractAddress,
      abi: data.abi as never,
      functionName: "submitWork",
      args: [bounty.id, commitHash, commitIsSha256, evidence, payee],
    });
  }

  async function digestFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Files over 10 MiB are not hashed in-browser. Calculate a SHA-256 digest locally instead.");
      if (!window.crypto?.subtle) throw new Error("Browser SHA-256 is unavailable. Enter a digest calculated locally.");
      const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      onDraftChange({ evidence: hash });
      setFileMessage("Digest calculated. The file remains in this browser and was not uploaded.");
      setFormError("");
    } catch (error) {
      setFileMessage("");
      setFormError(error instanceof Error ? error.message : "Could not calculate a SHA-256 digest.");
    }
  }

  async function decide() {
    if (!submission || decision === undefined) return;
    if (!eligibility.eligible) return setFormError(eligibility.reason);
    if (!data.contractAddress || !data.abi) return setFormError("Contract details are unavailable. Refresh this workspace and try again.");
    setFormError("");
    await tx.execute(`${decision ? "Approve" : "Reject"} submission #${submission.id.toString()}`, {
      address: data.contractAddress,
      abi: data.abi as never,
      functionName: "reviewSubmission",
      args: [bounty.id, submission.id, decision],
    });
  }

  const currency = data.localE2E && data.chainId === 31337 ? "local ETH" : "MSTC";

  return <section className="role-action-panel" aria-labelledby="role-action-title" aria-live="polite">
    <div className="role-action-heading"><div><span className="role-overline">{isReviewerAction ? "REVIEW DECISION" : "CONTRIBUTOR SUBMISSION"}</span><h2 id="role-action-title">{isReviewerAction ? `Submission #${submission.id.toString()} · ${title}` : `Submit to ${title}`}</h2><p>Bounty #{bounty.id.toString()} · {formatEther(bounty.reward)} {currency} escrowed</p></div><button className="button ghost" type="button" onClick={onCancel} disabled={tx.isBusy}>Back to workspace</button></div>
    <div className="role-action-context"><span className="role-overline">ORIGINAL TASK</span><p>{description || "Verified task description is unavailable. Review the committed task hash on the bounty detail page."}</p><div className="role-action-deadlines"><span>SUBMIT BY · {new Date(Number(bounty.submissionDeadline) * 1000).toLocaleString()}</span><span>REVIEW BY · {new Date(Number(bounty.settlementDeadline) * 1000).toLocaleString()}</span></div></div>

    {isReviewerAction && submission ? <>
      <div className="role-review-evidence"><div><span className="role-overline">SUBMITTED BY · {submission.submitter.slice(0, 8)}…{submission.submitter.slice(-6)}</span><p>Submitted {new Date(Number(submission.submittedAt) * 1000).toLocaleString()}</p></div><div><span className="role-overline">GIT COMMIT · {submission.commitIsSha256 ? "SHA-256" : "SHA-1"}</span><code>{submission.commitIsSha256 ? submission.commitHash.slice(2) : submission.commitHash.slice(-40)}</code></div><div><span className="role-overline">EVIDENCE SHA-256 DIGEST</span><code>{submission.evidenceHash}</code></div><p className="role-evidence-note">The evidence file is not stored or retrievable here. This digest identifies submitted bytes; it does not prove the evidence is truthful or the code is correct.</p></div>
      {reviewRecorded ? <div className="role-confirm-box"><span className="role-overline">DECISION ALREADY RECORDED</span><h3>{submission.rejected ? "Submission rejected" : "Submission approved"}</h3><p>{submission.rejected ? "The bounty remains open for another eligible submission." : "The bounty is Approved. Reward release remains a separate eligible transaction."}</p><button className="button primary" type="button" onClick={onShowProgress}>View decision history</button></div>
        : transactionConfirmed ? <div className="role-confirm-box"><span className="role-overline">DECISION CONFIRMED ON-CHAIN</span><h3>{decision ? "Submission approved" : "Submission rejected"}</h3><p>{decision ? "The bounty is Approved. Reward release remains a separate eligible transaction." : "This submission is rejected. The bounty remains open for another eligible submission."}</p>{tx.state.status === "confirmed-unrefreshed" && <p>The transaction is confirmed, but the latest contract state could not be refreshed yet.</p>}<button className="button primary" type="button" onClick={onShowProgress}>View decision history</button></div>
          : <>{decision === undefined ? <div className="role-decision-choices"><div><span className="role-overline">DECISION CONSEQUENCES</span><p><strong>Approve:</strong> records the selected submission as approved and makes the bounty eligible for a separate reward release to its recorded payee.</p><p><strong>Reject:</strong> marks this submission rejected; the bounty stays open and another non-rejected submission may be reviewed before the deadline.</p></div><div className="role-work-actions"><button className="button primary" type="button" disabled={!eligibility.eligible || tx.isBusy} onClick={() => setDecision(true)}>Choose approval</button><button className="button ghost" type="button" disabled={!eligibility.eligible || tx.isBusy} onClick={() => setDecision(false)}>Choose rejection</button></div></div>
            : <div className="role-confirm-box"><span className="role-overline">CONFIRM {decision ? "APPROVAL" : "REJECTION"}</span><p>{decision ? "The bounty becomes Approved. Reward release remains a separate transaction." : "This submission becomes rejected. The bounty stays open for another valid submission."} No rejection reason is recorded by the contract.</p><div className="role-work-actions"><button className="button primary" type="button" disabled={!eligibility.eligible || tx.isBusy} onClick={() => void decide()}>{tx.isBusy ? "Waiting for transaction…" : `Confirm ${decision ? "approval" : "rejection"}`}</button><button className="button ghost" type="button" disabled={tx.isBusy} onClick={() => setDecision(undefined)}>Change decision</button></div></div>}
            {!eligibility.eligible && <p className="role-action-note" role="status">{eligibility.reason}</p>}</>}
    </> : isContributorRecord && submission ? <div className="role-confirm-box"><span className="role-overline">YOUR SUBMISSION · #{submission.id.toString()}</span><h3>{submissionStatus(bounty, submission)}</h3><p>Submitted {new Date(Number(submission.submittedAt) * 1000).toLocaleString()}. The reviewer evaluates the work off-chain; the contract records the decision and settlement state.</p><div className="role-review-evidence"><div><span className="role-overline">GIT COMMIT · {submission.commitIsSha256 ? "SHA-256" : "SHA-1"}</span><code>{submission.commitIsSha256 ? submission.commitHash.slice(2) : submission.commitHash.slice(-40)}</code></div><div><span className="role-overline">EVIDENCE SHA-256 DIGEST</span><code>{submission.evidenceHash}</code></div><div><span className="role-overline">RECORDED PAYEE</span><code>{submission.payee}</code></div></div><p>Evidence files are not stored or retrieved here. The digest identifies bytes but does not prove their truth or code correctness.</p><div className="role-work-actions"><a className="button ghost" href={`/bounties/${bounty.id.toString()}`}>Open bounty details</a><button className="button primary" type="button" onClick={onCancel}>Back to submissions</button></div></div> : transactionConfirmed ? <div className="role-confirm-box"><span className="role-overline">SUBMISSION CONFIRMED ON-CHAIN</span><h3>Your submission has been recorded.</h3><p>The workspace has refreshed its contract reads. The assigned reviewer can now evaluate the submission. The contract does not verify code quality.</p>{tx.state.status === "confirmed-unrefreshed" && <p>The transaction is confirmed, but the latest submission record could not be refreshed yet.</p>}<div className="role-work-actions"><button className="button primary" type="button" onClick={onShowProgress}>View my submissions</button><a className="button ghost" href={`/bounties/${bounty.id.toString()}`}>Open bounty details</a></div></div> : <>
      {step === "edit" ? <form className="role-submission-form" onSubmit={continueToReview}>
        <div className="role-action-form-heading"><span className="role-overline">SUBMISSION MATERIALS</span><p>Only the commit ID, evidence digest, and payout address are submitted to the contract.</p></div>
        <div className="field full"><label htmlFor={`workspace-commit-${bounty.id}`}>Git commit ID (40 or 64 hex characters)</label><input id={`workspace-commit-${bounty.id}`} value={draft.commit} onChange={(event) => onDraftChange({ commit: event.target.value })} required autoComplete="off" placeholder="Repository commit under review" /><small>SHA-1 IDs are zero-padded into bytes32. SHA-256 IDs use all 32 bytes.</small></div>
        <div className="field full"><label htmlFor={`workspace-evidence-file-${bounty.id}`}>Evidence file · optional local SHA-256</label><input id={`workspace-evidence-file-${bounty.id}`} type="file" accept="*/*" onChange={(event) => void digestFile(event.currentTarget.files?.[0])} /><small>The file stays in this browser. It is not uploaded or stored by PatchPool.</small>{fileMessage && <span className="success-message" role="status">{fileMessage}</span>}</div>
        <div className="field full"><label htmlFor={`workspace-evidence-hash-${bounty.id}`}>Evidence digest · SHA-256</label><input id={`workspace-evidence-hash-${bounty.id}`} value={draft.evidence} onChange={(event) => onDraftChange({ evidence: event.target.value })} required autoComplete="off" placeholder="0x followed by 64 hexadecimal characters" /><small>A digest supports integrity comparison; it does not prove correctness.</small></div>
        <div className="field full"><label htmlFor={`workspace-payee-${bounty.id}`}>Payout address</label><input id={`workspace-payee-${bounty.id}`} value={draft.payee} onChange={(event) => onDraftChange({ payee: event.target.value })} required autoComplete="off" placeholder="0x…" /><small>Must not be the creator, reviewer, or any bounty contributor. Contract eligibility is checked before the wallet request and again on-chain.</small></div>
        {!eligibility.eligible && <p className="role-action-note" role="status">{eligibility.reason}</p>}
        {formError && <p className="error-message" role="alert">{formError}</p>}
        <div className="role-work-actions"><button className="button primary" type="submit" disabled={!eligibility.eligible || tx.isBusy}>Review submission</button><a className="button ghost" href={`/bounties/${bounty.id.toString()}`}>Open full bounty details</a></div>
      </form> : <div className="role-confirm-box"><span className="role-overline">CHECK BEFORE WALLET CONFIRMATION</span><dl><div><dt>COMMIT</dt><dd><code>{draft.commit}</code></dd></div><div><dt>EVIDENCE SHA-256</dt><dd><code>{draft.evidence}</code></dd></div><div><dt>PAYOUT ADDRESS</dt><dd><code>{draft.payee}</code></dd></div></dl><p>The file itself stays off-chain. The contract records only the digest and does not verify code correctness.</p><p className="role-wallet-requirement">{!data.isConnected ? "Connect BridgeKey before submitting." : !data.authorizedWallet ? "The connected wallet is not identified as BridgeKey." : !data.supportedNetwork ? "Switch to MST Mainnet (chain 4646)." : !data.writesEnabled ? "Transactions are disabled for this network." : "Your wallet will ask for an explicit confirmation."}</p>{formError && <p className="error-message" role="alert">{formError}</p>}<div className="role-work-actions"><button className="button primary" type="button" disabled={!eligibility.eligible || tx.isBusy} onClick={() => void submitWork()}>{tx.isBusy ? "Waiting for transaction…" : "Confirm and submit ↗"}</button><button className="button ghost" type="button" disabled={tx.isBusy} onClick={() => { setStep("edit"); setFormError(""); }}>Edit submission</button><a className="button ghost" href={`/bounties/${bounty.id.toString()}`}>Bounty details</a></div></div>}
    </>}

    {formError && (isReviewerAction || step === "confirm") && <p className="error-message" role="alert">{formError}</p>}
    {tx.state.status !== "idle" && <div className={`role-transaction role-transaction-${tx.state.status}`} role={tx.state.status === "failed" || tx.state.status === "rejected" ? "alert" : "status"}>
      <span className="role-overline">{tx.state.status === "confirmed" || tx.state.status === "confirmed-unrefreshed" ? "CONFIRMED" : tx.state.status === "rejected" ? "WALLET REQUEST REJECTED" : tx.state.status === "failed" ? "TRANSACTION FAILED" : tx.state.status === "pending" || tx.state.status === "refreshing" ? "TRANSACTION PENDING" : "WALLET REQUEST"}</span>
      <p>{tx.state.message}</p>{tx.state.hash && <code>{tx.state.hash}</code>}
      {(tx.state.status === "rejected" || tx.state.status === "failed") && <button className="button ghost" type="button" onClick={tx.reset}>Retry</button>}
    </div>}
  </section>;
}
