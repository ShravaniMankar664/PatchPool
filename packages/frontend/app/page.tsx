"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  useAccount,
  useBlock,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  decodeEventLog,
  formatEther,
  isAddress,
  keccak256,
  parseEther,
  stringToHex,
  zeroAddress,
} from "viem";
import { ConnectButton } from "@/components/ConnectButton";
import { BountyCard } from "@/components/BountyCard";
import { HeroWorkflowPreview } from "@/components/HeroWorkflowPreview";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { NetworkWarning } from "@/components/NetworkWarning";
import { ProtocolOverview } from "@/components/ProtocolOverview";
import { usePatchPool } from "@/hooks/usePatchPool";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";
import { isBridgeKeyConnector } from "@/lib/walletIdentity";
import { reviewEligibility, submissionEligibility, transactionEligibility } from "@/lib/patchpoolLifecycle";
import { deployments } from "patchpool-shared";

type TaskMetadata = { title: string; description: string };
type BountyRecord = {
  sponsor: `0x${string}`;
  reviewer: `0x${string}`;
  reward: bigint;
  submissionDeadline: bigint;
  settlementDeadline: bigint;
  taskHash: `0x${string}`;
  status: number;
  approvedSubmissionId: bigint;
  count: bigint;
  myContribution: bigint;
  refundableBalance: bigint;
  id: bigint;
};
type SubmissionRecord = {
  id: bigint;
  bountyId: bigint;
  submitter: `0x${string}`;
  payee: `0x${string}`;
  commitHash: `0x${string}`;
  commitIsSha256: boolean;
  evidenceHash: `0x${string}`;
  submittedAt: bigint;
  rejected: boolean;
};
type ActivityRecord = {
  eventName: string;
  bountyId: string;
  submissionId?: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  summary: string;
  contributor?: string;
};

const STATUS = ["Open", "Approved", "Paid", "Refunded", "Refunding"];
const REFUND_GRACE_SECONDS = BigInt(7 * 24 * 60 * 60);
const MAX_TASK_METADATA_BYTES = 16_384;
const BOUNTY_PAGE_SIZE = 20;
const EVENT_BLOCK_PAGE_SIZE = BigInt(2_000);

function tupleValue<T>(value: any, name: string, index: number): T {
  return (value?.[name] ?? value?.[index]) as T;
}

function toDateTime(value: bigint) {
  return new Date(Number(value) * 1000).toLocaleString();
}

function displayFormDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? toDateTime(BigInt(Math.floor(timestamp / 1000))) : "Choose a date";
}

function shortAddress(value?: string) {
  return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "Unavailable";
}

function txLink(hash: `0x${string}`, chainId?: number) {
  const explorer = chainId === mstMainnet.id
    ? "https://mstscan.com"
    : chainId === 91562037
      ? "https://testnet.mstscan.com"
      : undefined;
  return explorer ? `${explorer}/tx/${hash}` : "#";
}

function addressLink(address: string, chainId?: number) {
  const explorer = chainId === mstMainnet.id
    ? "https://mstscan.com"
    : chainId === 91562037
      ? "https://testnet.mstscan.com"
      : undefined;
  return explorer ? `${explorer}/address/${address}` : "#";
}

const mainnetDeployment = deployments.mainnet.PatchPool;

export default function Home() {
  const { address, chainId: walletChainId, isConnected, connector } = useAccount();
  const configuredChainId = useChainId();
  const chainId = walletChainId ?? configuredChainId;
  const { address: contractAddress, abi, bountyCount, loadingBountyCount, bountyCountError, isDeployed, writesEnabled, mainnetWritesConfigured, deploymentBlock, refetchBountyCount } = usePatchPool();
  const { writeContractAsync, isPending: isWalletPending } = useWriteContract();
  const [actionHash, setActionHash] = useState<`0x${string}`>();
  const [actionName, setActionName] = useState("");
  const [actionError, setActionError] = useState("");
  const [createdBountyId, setCreatedBountyId] = useState("");
  const handledReceipt = useRef<string>();
  const transactionLock = useRef(false);
  const { data: receipt, isLoading: isConfirming, isSuccess: receiptReady, isError: receiptFailed, error: receiptError } =
    useWaitForTransactionReceipt({ hash: actionHash });
  const isLocalE2E = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";
  const isAuthorizedWallet = isLocalE2E
    ? connector?.id === "injected"
    : isBridgeKeyConnector(connector);
  const activeConfiguredChainId = isLocalE2E && chainId === patchPoolLocalE2E.id
    ? patchPoolLocalE2E.id
    : mstMainnet.id;
  const { data: block } = useBlock({ chainId: activeConfiguredChainId, watch: true, query: { enabled: chainId === mstMainnet.id || Boolean(isLocalE2E && chainId === patchPoolLocalE2E.id) } });
  const publicClient = usePublicClient({ chainId: activeConfiguredChainId });
  const [metadata, setMetadata] = useState<Record<string, TaskMetadata>>({});
  const [bountyQuery, setBountyQuery] = useState("");
  const [bountyStatusFilter, setBountyStatusFilter] = useState("all");
  const [bountyRoleFilter, setBountyRoleFilter] = useState("all");
  const [bountySort, setBountySort] = useState("newest");
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [activityState, setActivityState] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const [activityError, setActivityError] = useState("");
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [activityHasOlder, setActivityHasOlder] = useState(false);
  const activityAnchor = useRef<bigint>();
  const [eventDisplayPages, setEventDisplayPages] = useState<Record<string, number>>({});
  const [bountyPage, setBountyPage] = useState(0);
  const [targetBountyId, setTargetBountyId] = useState<bigint>();
  const [targetSubmissionId, setTargetSubmissionId] = useState<string>();
  const [evidenceChecks, setEvidenceChecks] = useState<Record<string, string>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [reward, setReward] = useState("");
  const [creationStep, setCreationStep] = useState(1);
  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});
  const [reviewer, setReviewer] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [settlementDeadline, setSettlementDeadline] = useState("");
  const currencySymbol = isLocalE2E && chainId === patchPoolLocalE2E.id ? "local ETH" : "MSTC";
  const isSupportedNetwork = chainId === mstMainnet.id || Boolean(isLocalE2E && chainId === patchPoolLocalE2E.id);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("bounty");
    if (value && /^[1-9]\d{0,77}$/.test(value)) setTargetBountyId(BigInt(value));
    const submission = params.get("submission");
    if (submission && /^[1-9]\d{0,77}$/.test(submission)) setTargetSubmissionId(submission);
  }, []);

  useEffect(() => {
    if (!targetBountyId || bountyCount === undefined) return;
    if (targetBountyId > bountyCount) {
      setTargetBountyId(undefined);
      return;
    }
    setBountyPage(Number((bountyCount - targetBountyId) / BigInt(BOUNTY_PAGE_SIZE)));
    setBountyQuery(targetBountyId.toString());
    setBountyStatusFilter("all");
    setBountyRoleFilter("all");
    setBountySort("newest");
  }, [targetBountyId, bountyCount]);

  useEffect(() => {
    if (!receiptReady || !receipt || !actionHash || handledReceipt.current === actionHash) return;
    handledReceipt.current = actionHash;
    transactionLock.current = false;
    if (receipt.status === "success") {
      if (abi) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: abi as never, data: log.data, topics: log.topics });
            if (decoded.eventName === "BountyCreated") {
              setCreatedBountyId(String((decoded.args as any).bountyId));
              setCreationStep(1);
              setTaskTitle("");
              setTaskDescription("");
              setReward("");
              setReviewer("");
              setSubmissionDeadline("");
              setSettlementDeadline("");
              break;
            }
          } catch {
            // Other contract logs in this receipt are expected.
          }
        }
      }
      setActionError("");
      void refetchBountyCount();
      void refetchRecords();
      activityAnchor.current = undefined;
      setActivity([]);
      setActivityPage(0);
      setActivityRefresh((value) => value + 1);
    } else {
      setActionError("The transaction was mined but reverted. No lifecycle change was applied.");
    }
  // refetchRecords is declared below and stable for the active query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptReady, receipt, actionHash]);

  useEffect(() => {
    if (receiptFailed && receiptError) {
      transactionLock.current = false;
      setActionError(receiptError.message);
    }
  }, [receiptFailed, receiptError]);

  const latestBountyIds = useMemo(() => {
    if (bountyCount === undefined || bountyCount === BigInt(0)) return [];
    const end = bountyCount - BigInt(bountyPage * BOUNTY_PAGE_SIZE);
    if (end <= BigInt(0)) return [];
    const remaining = end > BigInt(BOUNTY_PAGE_SIZE) ? BigInt(BOUNTY_PAGE_SIZE) : end;
    return Array.from({ length: Number(remaining) }, (_, i) => end - BigInt(i));
  }, [bountyCount, bountyPage]);

  const bountyPageCount = bountyCount === undefined ? 0 : Math.ceil(Number(bountyCount) / BOUNTY_PAGE_SIZE);

  useEffect(() => {
    if (bountyPageCount > 0 && bountyPage >= bountyPageCount) setBountyPage(bountyPageCount - 1);
  }, [bountyPage, bountyPageCount]);

  const { data: bountyReadsRaw, isLoading: loadingBounties, error: bountyReadError, refetch: refetchRecords } = useReadContracts({
    contracts: latestBountyIds.flatMap((id) => [
      { address: contractAddress!, abi: abi as never, functionName: "getBounty", args: [id] },
      { address: contractAddress!, abi: abi as never, functionName: "submissionCounts", args: [id] },
      { address: contractAddress!, abi: abi as never, functionName: "contributions", args: [id, address ?? zeroAddress] },
      { address: contractAddress!, abi: abi as never, functionName: "refundableBalance", args: [id] },
    ]) as never,
    query: { enabled: Boolean(isDeployed && contractAddress && abi && latestBountyIds.length), refetchInterval: 15_000 },
  });

  const bountyRecords = useMemo<BountyRecord[]>(() => {
    const reads = (bountyReadsRaw ?? []) as Array<{ status: string; result?: any }>;
    return latestBountyIds.flatMap((id, i) => {
      const raw = reads[i * 4];
      const countRaw = reads[i * 4 + 1];
      const contributionRaw = reads[i * 4 + 2];
      const refundableRaw = reads[i * 4 + 3];
      if (raw?.status !== "success" || countRaw?.status !== "success" || contributionRaw?.status !== "success" || refundableRaw?.status !== "success") return [];
      const record = raw.result;
      return [{
        id,
        sponsor: tupleValue(record, "sponsor", 0),
        reviewer: tupleValue(record, "reviewer", 1),
        reward: tupleValue(record, "reward", 2),
        submissionDeadline: tupleValue(record, "submissionDeadline", 3),
        settlementDeadline: tupleValue(record, "settlementDeadline", 4),
        taskHash: tupleValue(record, "taskHash", 5),
        status: Number(tupleValue(record, "status", 6)),
        approvedSubmissionId: tupleValue(record, "approvedSubmissionId", 7),
        count: countRaw.result as bigint,
        myContribution: contributionRaw.result as bigint,
        refundableBalance: refundableRaw.result as bigint,
      }];
    });
  }, [bountyReadsRaw, latestBountyIds]);

  const submissionQueries = useMemo(() => bountyRecords.flatMap((bounty) => {
    const total = bounty.count > BigInt(10) ? BigInt(10) : bounty.count;
    const ids = Array.from({ length: Number(total) }, (_, i) => bounty.count - BigInt(i));
    if (bounty.approvedSubmissionId > BigInt(0) && !ids.includes(bounty.approvedSubmissionId)) ids.push(bounty.approvedSubmissionId);
    return ids.map((submissionId) => {
      return { address: contractAddress!, abi: abi as never, functionName: "getSubmission", args: [bounty.id, submissionId], bountyId: bounty.id, submissionId };
    });
  }), [bountyRecords, contractAddress, abi]);

  const { data: submissionReadsRaw, isLoading: loadingSubmissions, refetch: refetchSubmissions } = useReadContracts({
    contracts: submissionQueries.map(({ address: target, abi: contractAbi, functionName, args }) => ({ address: target, abi: contractAbi, functionName, args })) as never,
    query: { enabled: Boolean(isDeployed && submissionQueries.length), refetchInterval: 15_000 },
  });

  useEffect(() => {
    let cancelled = false;
    const isConfiguredNetwork = chainId === mstMainnet.id || Boolean(isLocalE2E && chainId === patchPoolLocalE2E.id);
    if (!isDeployed || !contractAddress || !abi || !isConfiguredNetwork || !deploymentBlock || !publicClient) {
      setActivity([]);
      activityAnchor.current = undefined;
      setActivityHasOlder(false);
      setActivityState(isDeployed && !deploymentBlock ? "unavailable" : "idle");
      setActivityError("");
      return () => { cancelled = true; };
    }

    setActivityState("loading");
    setActivityError("");
    void (async () => {
      const anchor = activityAnchor.current ?? await publicClient.getBlockNumber({ cacheTime: 0 });
      if (cancelled) return;
      activityAnchor.current = anchor;
      const pageEndOffset = BigInt(activityPage) * EVENT_BLOCK_PAGE_SIZE;
      if (anchor < pageEndOffset || anchor - pageEndOffset < BigInt(deploymentBlock)) {
        setActivityHasOlder(false);
        setActivityState("ready");
        return;
      }
      const toBlock = anchor - pageEndOffset;
      const pageStart = toBlock >= EVENT_BLOCK_PAGE_SIZE - BigInt(1)
        ? toBlock - EVENT_BLOCK_PAGE_SIZE + BigInt(1)
        : BigInt(0);
      const fromBlock = pageStart > BigInt(deploymentBlock) ? pageStart : BigInt(deploymentBlock);
      const logs = await publicClient.getLogs({ address: contractAddress, fromBlock, toBlock });
      setActivityHasOlder(fromBlock > BigInt(deploymentBlock));
      const discoveredMetadata: Record<string, TaskMetadata> = {};
      const records = logs.flatMap((log) => {
          if (!log.transactionHash || log.blockNumber === null) return [];
          try {
            const decoded: any = decodeEventLog({ abi: abi as never, data: log.data, topics: log.topics });
            const args = (decoded.args ?? {}) as Record<string, any>;
            const bountyId = String(args.bountyId ?? "");
            const submissionId = args.submissionId === undefined ? undefined : String(args.submissionId);
            if (decoded.eventName === "BountyMetadata") {
              const metadataJson = args.taskMetadataJson;
              const taskHash = String(args.taskHash ?? "").toLowerCase();
              if (typeof metadataJson === "string" && keccak256(stringToHex(metadataJson)) === taskHash) {
                try {
                  const parsed = JSON.parse(metadataJson) as Partial<TaskMetadata>;
                  if (typeof parsed.title === "string" && typeof parsed.description === "string") {
                    discoveredMetadata[taskHash] = { title: parsed.title, description: parsed.description };
                  }
                } catch {
                  // Invalid JSON stays unavailable; the committed hash remains visible.
                }
              }
              return [];
            }
            let contributor: string | undefined;
            let summary: string = decoded.eventName;
            if (decoded.eventName === "BountyCreated") {
              contributor = String(args.sponsor);
              summary = `Funded ${formatEther(args.reward as bigint)} ${currencySymbol}`;
            }
            if (decoded.eventName === "BountyFunded") {
              contributor = String(args.contributor);
              summary = `${shortAddress(args.contributor)} added ${formatEther(args.amount as bigint)} ${currencySymbol} · pool ${formatEther(args.totalReward as bigint)} ${currencySymbol}`;
            }
            if (decoded.eventName === "WorkSubmitted") summary = `Submission #${submissionId} recorded`;
            if (decoded.eventName === "SubmissionReviewed") summary = `Submission #${submissionId} ${args.approved ? "approved" : "rejected"}`;
            if (decoded.eventName === "RewardReleased") summary = `Reward released: ${formatEther(args.amount as bigint)} ${currencySymbol}`;
            if (decoded.eventName === "BountyRefunded") summary = `Refunded ${formatEther(args.amount as bigint)} ${currencySymbol}`;
            if (decoded.eventName === "ContributionRefunded") summary = `${shortAddress(args.contributor)} claimed ${formatEther(args.amount as bigint)} ${currencySymbol}`;
            return [{ eventName: String(decoded.eventName), bountyId, submissionId, blockNumber: log.blockNumber, transactionHash: log.transactionHash, summary, contributor }];
          } catch {
            return [];
          }
      });
      if (!cancelled) {
        setMetadata((current) => ({ ...current, ...discoveredMetadata }));
        setActivity((current) => {
          const existing = new Set(current.map((event) => event.transactionHash + event.eventName + event.bountyId + (event.submissionId ?? "")));
          return [...current, ...records.filter((event) => !existing.has(event.transactionHash + event.eventName + event.bountyId + (event.submissionId ?? "")))];
        });
        setActivityState("ready");
      }
    })().catch((error: unknown) => {
        if (!cancelled) {
          setActivityError(error instanceof Error ? error.message : "Unable to load contract event history.");
          setActivityState("error");
        }
      });
    return () => { cancelled = true; };
  }, [isDeployed, contractAddress, abi, chainId, deploymentBlock, publicClient, activityRefresh, activityPage, currencySymbol, isLocalE2E]);

  const submissions = useMemo<SubmissionRecord[]>(() => {
    const reads = (submissionReadsRaw ?? []) as Array<{ status: string; result?: any }>;
    return submissionQueries.flatMap((query, i) => {
      const item = reads[i];
      if (item?.status !== "success") return [];
      const record = item.result;
      return [{
        id: query.submissionId,
        bountyId: query.bountyId,
        submitter: tupleValue(record, "submitter", 0),
        payee: tupleValue(record, "payee", 1),
        commitHash: tupleValue(record, "commitHash", 2),
        commitIsSha256: tupleValue(record, "commitIsSha256", 3),
        evidenceHash: tupleValue(record, "evidenceHash", 4),
        submittedAt: tupleValue(record, "submittedAt", 5),
        rejected: tupleValue(record, "rejected", 6),
      }];
    });
  }, [submissionReadsRaw, submissionQueries]);

  useEffect(() => {
    if (!targetBountyId || !targetSubmissionId || !submissions.some((item) => item.bountyId === targetBountyId && item.id.toString() === targetSubmissionId)) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(`submission-${targetBountyId}-${targetSubmissionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [targetBountyId, targetSubmissionId, submissions]);

  const visibleBountyRecords = useMemo(() => {
    const query = bountyQuery.trim().toLowerCase();
    const connectedAddress = address?.toLowerCase();
    const filtered = bountyRecords.filter((bounty) => {
      if (bountyStatusFilter !== "all" && bounty.status !== Number(bountyStatusFilter)) return false;
      if (bountyRoleFilter === "sponsor" && (!connectedAddress || bounty.sponsor.toLowerCase() !== connectedAddress)) return false;
      if (bountyRoleFilter === "contributor" && (!connectedAddress || (
        bounty.myContribution === BigInt(0) &&
        !submissions.some((submission) => submission.bountyId === bounty.id && (
          submission.submitter.toLowerCase() === connectedAddress || submission.payee.toLowerCase() === connectedAddress
        ))
      ))) return false;
      if (bountyRoleFilter === "reviewer" && (!connectedAddress || bounty.reviewer.toLowerCase() !== connectedAddress || bounty.status !== 0 || !submissions.some((submission) => submission.bountyId === bounty.id && !submission.rejected))) return false;
      if (!query) return true;
      const task = metadata[bounty.taskHash.toLowerCase()];
      const readable = task && keccak256(stringToHex(JSON.stringify(task))) === bounty.taskHash ? task : undefined;
      return [bounty.id.toString(), bounty.sponsor, bounty.reviewer, readable?.title, readable?.description]
        .some((value) => value?.toLowerCase().includes(query));
    });
    return filtered.sort((a, b) => {
      if (bountySort === "reward-high") return a.reward === b.reward ? (a.id > b.id ? -1 : 1) : a.reward > b.reward ? -1 : 1;
      if (bountySort === "reward-low") return a.reward === b.reward ? (a.id > b.id ? -1 : 1) : a.reward < b.reward ? -1 : 1;
      if (bountySort === "deadline-soon") return a.submissionDeadline === b.submissionDeadline ? (a.id > b.id ? -1 : 1) : a.submissionDeadline < b.submissionDeadline ? -1 : 1;
      return a.id === b.id ? 0 : a.id > b.id ? -1 : 1;
    });
  }, [bountyRecords, bountyQuery, bountyRoleFilter, bountySort, bountyStatusFilter, metadata, address, submissions]);

  const isBusy = isWalletPending || isConfirming;
  const blockTime = block?.timestamp;

  async function sendTransaction(label: string, request: any) {
    if (transactionLock.current) return;
    transactionLock.current = true;
    setActionError("");
    setCreatedBountyId("");
    setActionName(label);
    setActionHash(undefined);
    try {
      const eligibility = transactionEligibility({ connected: isConnected, address, authorizedWallet: isAuthorizedWallet, supportedNetwork: isSupportedNetwork, writesEnabled });
      if (!eligibility.eligible) throw new Error(eligibility.reason);
      const hash = await writeContractAsync(request);
      setActionHash(hash);
    } catch (error) {
      transactionLock.current = false;
      setActionError(error instanceof Error ? error.message : "Wallet rejected or transaction could not be submitted.");
    }
  }

  async function createBounty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    if (!isConnected || !address) return setActionError("Connect a wallet first.");
    if (!isSupportedNetwork) return setActionError(`Wrong network. Select MST Mainnet (chain ${mstMainnet.id}) in your wallet.`);
    if (!isDeployed || !contractAddress || !abi) return setActionError("No PatchPool deployment is configured for this network.");
    if (!writesEnabled) return setActionError("PatchPool transactions are currently disabled for this network.");
    if (!taskTitle.trim() || !taskDescription.trim()) return setActionError("Enter a title and task description.");
    if (!isAddress(reviewer) || reviewer.toLowerCase() === address.toLowerCase()) return setActionError("Enter a valid reviewer address different from the sponsor.");
    const submitAt = new Date(submissionDeadline).getTime();
    const settleAt = new Date(settlementDeadline).getTime();
    if (!Number.isFinite(submitAt) || !Number.isFinite(settleAt) || submitAt <= Date.now() || settleAt <= submitAt) {
      return setActionError("Choose a future submission deadline and a later settlement deadline.");
    }
    let value: bigint;
    try {
      value = parseEther(reward);
      if (value <= BigInt(0)) return setActionError("Reward must be greater than zero.");
    } catch {
      return setActionError("Enter a valid MST amount.");
    }
    const task: TaskMetadata = { title: taskTitle.trim(), description: taskDescription.trim() };
    const taskMetadataJson = JSON.stringify(task);
    if (new TextEncoder().encode(taskMetadataJson).byteLength > MAX_TASK_METADATA_BYTES) {
      return setActionError("Task details exceed the 16 KiB public metadata limit. Shorten the description before funding.");
    }
    const taskHash = keccak256(stringToHex(taskMetadataJson));
    await sendTransaction("Create bounty", {
      address: contractAddress,
      abi: abi as never,
      functionName: "createBounty",
      args: [taskHash, taskMetadataJson, reviewer as `0x${string}`, BigInt(Math.floor(submitAt / 1000)), BigInt(Math.floor(settleAt / 1000))],
      value,
    } as never);
  }

  function advanceCreationStep() {
    setActionError("");
    if (creationStep === 1) {
      if (!taskTitle.trim()) return setActionError("Add a clear task title before continuing.");
      if (!taskDescription.trim()) return setActionError("Describe the problem and how the fix will be accepted.");
      const metadataJson = JSON.stringify({ title: taskTitle.trim(), description: taskDescription.trim() });
      if (new TextEncoder().encode(metadataJson).byteLength > MAX_TASK_METADATA_BYTES) {
        return setActionError("Task details exceed the 16 KiB public metadata limit. Shorten the description before continuing.");
      }
      setCreationStep(2);
      return;
    }
    if (creationStep === 2) {
      if (!reward.trim()) return setActionError("Set the initial escrow amount before continuing.");
      try {
        if (parseEther(reward) <= BigInt(0)) return setActionError("Reward must be greater than zero.");
      } catch {
        return setActionError("Enter a valid MST amount.");
      }
      if (!address || !isAddress(reviewer) || reviewer.toLowerCase() === address.toLowerCase()) {
        return setActionError("Enter a valid reviewer address different from the connected sponsor.");
      }
      const submitAt = new Date(submissionDeadline).getTime();
      const settleAt = new Date(settlementDeadline).getTime();
      if (!Number.isFinite(submitAt) || !Number.isFinite(settleAt) || submitAt <= Date.now() || settleAt <= submitAt) {
        return setActionError("Choose a future submission deadline and a later review / settlement deadline.");
      }
      setCreationStep(3);
    }
  }

  function contribute(bounty: BountyRecord) {
    if (!address || !contractAddress || !abi) return setActionError("Connect BridgeKey and select a supported network.");
    if (!writesEnabled) return setActionError("Funding is currently disabled for this network.");
    if (!isConnected || !isAuthorizedWallet) return setActionError("Only the identified BridgeKey provider can submit funding transactions.");
    if (address?.toLowerCase() === bounty.reviewer.toLowerCase()) return setActionError("The assigned reviewer cannot fund this bounty. Use a separate wallet address.");
    if (submissions.some((submission) => submission.bountyId === bounty.id && (
      submission.submitter.toLowerCase() === address?.toLowerCase() ||
      submission.payee.toLowerCase() === address?.toLowerCase()
    ))) return setActionError("A submitter or named payee cannot later fund this bounty. Use a separate wallet address.");
    if (!blockTime || bounty.status !== 0 || blockTime > bounty.submissionDeadline) return setActionError("This bounty is not accepting funding; the pool closes at its submission deadline.");
    let value: bigint;
    try {
      value = parseEther(contributionAmounts[bounty.id.toString()] ?? "");
      if (value <= BigInt(0)) return setActionError("Contribution must be greater than zero.");
    } catch {
      return setActionError("Enter a valid contribution amount.");
    }
    void sendTransaction(`Contribute to bounty #${bounty.id}`, {
      address: contractAddress,
      abi: abi as never,
      functionName: "fundBounty",
      args: [bounty.id],
      value,
    } as never);
  }

  function submitWork(event: FormEvent<HTMLFormElement>, bounty: BountyRecord, form: HTMLFormElement) {
    event.preventDefault();
    if (!address || !contractAddress || !abi) return setActionError("Connect a wallet and select a supported network.");
    const eligibility = submissionEligibility({ bounty, address, connected: isConnected, authorizedWallet: isAuthorizedWallet, supportedNetwork: isSupportedNetwork, writesEnabled, blockTime });
    if (!eligibility.eligible) return setActionError(eligibility.reason);
    const data = new FormData(form);
    const commit = String(data.get("commit") ?? "").trim().toLowerCase().replace(/^0x/, "");
    const evidence = String(data.get("evidence") ?? "").trim();
    const payee = String(data.get("payee") ?? "").trim();
    if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(commit) || /^0+$/.test(commit)) return setActionError("Enter a non-zero 40 or 64 character Git commit ID in hexadecimal.");
    if (!/^0x[0-9a-fA-F]{64}$/.test(evidence)) return setActionError("Enter a 0x-prefixed 32-byte SHA-256 evidence digest.");
    if (/^0x0{64}$/i.test(evidence)) return setActionError("The evidence digest cannot be zero.");
    if (!isAddress(payee)) return setActionError("Enter a valid payout address.");
    const normalizedPayee = payee.toLowerCase();
    if (normalizedPayee === bounty.reviewer.toLowerCase()) return setActionError("The assigned reviewer cannot receive a payout.");
    if (normalizedPayee === bounty.sponsor.toLowerCase()) return setActionError("The bounty creator cannot receive a payout.");
    if (address.toLowerCase() === normalizedPayee && bounty.myContribution > BigInt(0)) return setActionError("Bounty contributors cannot receive a payout.");
    const commitIsSha256 = commit.length === 64;
    const commitHash = `0x${commit.padStart(64, "0")}` as `0x${string}`;
    void sendTransaction(`Submit to bounty #${bounty.id}`, {
      address: contractAddress,
      abi: abi as never,
      functionName: "submitWork",
      args: [bounty.id, commitHash, commitIsSha256, evidence as `0x${string}`, payee as `0x${string}`],
    } as never);
  }

  async function digestEvidenceFile(file: File | undefined, form: HTMLFormElement | null) {
    if (!file || !form) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Evidence files over 10 MiB are not hashed in-browser. Enter a SHA-256 digest calculated locally instead.");
      if (!window.crypto?.subtle) throw new Error("Browser SHA-256 is unavailable. Use a secure browser context or enter a digest from a trusted local tool.");
      const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const evidenceInput = form.elements.namedItem("evidence") as HTMLInputElement | null;
      if (evidenceInput) evidenceInput.value = `0x${hex}`;
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not calculate SHA-256 for this file.");
    }
  }

  async function verifyEvidenceFile(file: File | undefined, expectedHash: `0x${string}`, key: string) {
    if (!file) return;
    setEvidenceChecks((current) => ({ ...current, [key]: "Checking file…" }));
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Files over 10 MiB are not hashed in-browser.");
      if (!window.crypto?.subtle) throw new Error("Browser SHA-256 is unavailable in this context.");
      const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const actualHash = `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      setEvidenceChecks((current) => ({
        ...current,
        [key]: actualHash.toLowerCase() === expectedHash.toLowerCase()
          ? "MATCH · file bytes match the on-chain SHA-256 digest"
          : "MISMATCH · file bytes do not match the on-chain SHA-256 digest",
      }));
    } catch (error) {
      setEvidenceChecks((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Could not verify this file.",
      }));
    }
  }

  function review(bounty: BountyRecord, submission: SubmissionRecord, approve: boolean) {
    const eligibility = reviewEligibility({ bounty, submission, address, connected: isConnected, authorizedWallet: isAuthorizedWallet, supportedNetwork: isSupportedNetwork, writesEnabled, blockTime });
    if (!eligibility.eligible) return setActionError(eligibility.reason);
    if (!contractAddress || !abi) return;
    if (!writesEnabled) return setActionError("PatchPool transactions are currently disabled for this network.");
    void sendTransaction(`${approve ? "Approve" : "Reject"} submission #${submission.id}`, {
      address: contractAddress,
      abi: abi as never,
      functionName: "reviewSubmission",
      args: [bounty.id, submission.id, approve],
    } as never);
  }

  function release(bounty: BountyRecord) {
    if (!contractAddress || !abi) return;
    if (!writesEnabled) return setActionError("PatchPool transactions are currently disabled for this network.");
    if (bounty.status !== 1) return setActionError("Only a bounty with an approved submission can release its reward.");
    void sendTransaction(`Release bounty #${bounty.id}`, { address: contractAddress, abi: abi as never, functionName: "releaseReward", args: [bounty.id] } as never);
  }

  function refund(bounty: BountyRecord) {
    if (!contractAddress || !abi || !address) return;
    if (!writesEnabled) return setActionError("PatchPool transactions are currently disabled for this network.");
    if (bounty.myContribution <= BigInt(0)) return setActionError("This connected wallet has no refundable contribution.");
    if ((bounty.status !== 0 && bounty.status !== 4) || !blockTime || blockTime <= bounty.settlementDeadline + REFUND_GRACE_SECONDS) return setActionError("Refund is available to each contributor only after the on-chain grace period.");
    void sendTransaction(`Refund contribution for bounty #${bounty.id}`, { address: contractAddress, abi: abi as never, functionName: "refundExpired", args: [bounty.id] } as never);
  }

  function readableTask(bounty: BountyRecord) {
    const item = metadata[bounty.taskHash.toLowerCase()];
    if (!item) return undefined;
    return keccak256(stringToHex(JSON.stringify(item))) === bounty.taskHash ? item : undefined;
  }

  async function refresh() {
    await Promise.all([refetchBountyCount(), refetchRecords(), refetchSubmissions()]);
    activityAnchor.current = undefined;
    setActivity([]);
    setActivityPage(0);
    setActivityRefresh((value) => value + 1);
  }

  return (
    <main>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="PatchPool home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span><span className="brand-name" style={{ display: "block" }}>PATCHPOOL</span><span className="brand-subtitle">OPEN-SOURCE WORK, FUNDED</span></span>
        </a>
        <nav className="primary-nav" aria-label="Main navigation">
          <a href="#bounties">Bounties</a>
          <a href="/contributor">Contribute</a>
          <a href="/reviewer">Review</a>
          <a href="#trail">Process</a>
          <a href="#trust">Security</a>
        </nav>
        <div className="header-actions"><NetworkSwitcher /><ConnectButton localE2E={isLocalE2E} /></div>
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /></button>
      </header>
      <nav className={`mobile-nav-panel${mobileMenuOpen ? " is-open" : ""}`} id="mobile-navigation" aria-label="Mobile navigation" aria-hidden={!mobileMenuOpen} hidden={!mobileMenuOpen}>
        <a href="#bounties" onClick={() => setMobileMenuOpen(false)}>Bounties</a>
        <a href="/contributor" onClick={() => setMobileMenuOpen(false)}>Contributor workspace</a>
        <a href="/reviewer" onClick={() => setMobileMenuOpen(false)}>Reviewer workspace</a>
        <a href="#trail" onClick={() => setMobileMenuOpen(false)}>How it works</a>
        <a href="#trust" onClick={() => setMobileMenuOpen(false)}>Trust &amp; Security</a>
      </nav>
      <NetworkWarning />

      <section className="hero" id="home" aria-labelledby="hero-title">
        <div>
          <div className="eyebrow"><span className="eyebrow-mark" /> OPEN-SOURCE WORK, FUNDED</div>
          <h1 id="hero-title">Fund the fix.<br /><span>Verify the work.</span><br />Release the reward.</h1>
          <p className="hero-copy">PatchPool connects software sponsors, contributors and assigned reviewers through transparent, blockchain-backed software-fix bounties.</p>
          <div className="hero-actions"><a className="button primary" href="#bounties">Explore bounties <span aria-hidden="true">↗</span></a><a className="button ghost" href="#create">Create a bounty</a></div>
          <div className="hero-proof"><span className="proof-mark">✓</span><span>Escrow rules enforced by the contract</span><span className="proof-divider" /><span>MST Mainnet · 4646</span></div>
        </div>
        <HeroWorkflowPreview />
      </section>

      <ProtocolOverview chainId={chainId} bountyCount={bountyCount} loading={loadingBountyCount} readError={bountyCountError} isDeployed={isDeployed} localE2E={isLocalE2E} walletConnected={isConnected} bridgeKeyAuthorized={isAuthorizedWallet} />

      <section className="value-strip" aria-label="PatchPool product principles">
        <div><span className="value-index">01</span><strong>Shared funding</strong><span>One escrow, multiple sponsors.</span></div>
        <div><span className="value-index">02</span><strong>Human review</strong><span>Clear roles, accountable decisions.</span></div>
        <div><span className="value-index">03</span><strong>Rule-based settlement</strong><span>Funds move on contract terms.</span></div>
      </section>
      <section className="trail card" id="trail" aria-labelledby="trail-title">
        <div className="trail-heading">
          <div><div className="section-label">HOW IT WORKS</div><h2 id="trail-title">A clear path from problem to payout.</h2><p>Every step has a defined role. The contract records commitments and enforces settlement rules.</p></div>
          <span className={`badge ${isLocalE2E && chainId === patchPoolLocalE2E.id ? "warning" : "success"}`}>{isLocalE2E && chainId === patchPoolLocalE2E.id ? "LOCAL E2E · TEST ONLY" : "MST MAINNET · PRODUCTION"}</span>
        </div>
        <ol className="trail-steps">
          <li><a href="#create"><span className="trail-index">01</span><span><strong>Define &amp; fund</strong><small>Sponsor, reviewer, terms and escrow</small><em>Contract record</em></span></a></li>
          <li><a href="#bounties"><span className="trail-index">02</span><span><strong>Submit evidence</strong><small>Git commit, digest and payout address</small><em>Digest on-chain · file stays local</em></span></a></li>
          <li><a href="#bounties"><span className="trail-index">03</span><span><strong>Review the work</strong><small>Assigned reviewer approves or rejects</small><em>Reviewer decision on-chain</em></span></a></li>
          <li><a href="#bounties"><span className="trail-index">04</span><span><strong>Settle by rule</strong><small>Approved payout or eligible sponsor refund</small><em>Receipt &amp; events when available</em></span></a></li>
        </ol>
        <p className="trail-footnote">Workflow illustration only. Bounties and activity appear only when read from the registered contract.</p>
      </section>
      <section className="shared-funding" id="collective" aria-labelledby="shared-funding-title">
        <div className="shared-funding-copy"><span className="section-label">A DIFFERENT WAY TO FUND OPEN SOURCE</span><h2 id="shared-funding-title">One software fix.<br /><span>Many sponsors.</span></h2><p>Organizations and individuals can contribute to the same bounty before its submission deadline. One shared escrow tracks the pool under transparent contract rules.</p><a href="#bounties" className="text-link">Explore the funding flow <span aria-hidden="true">↗</span></a></div>
        <div className="shared-funding-visual" aria-label="Conceptual flow: multiple sponsors contribute to one escrow; an assigned reviewer evaluates submitted work; an approved reward goes to the recorded payee">
          <div className="shared-funding-caption"><span>CONCEPTUAL FLOW</span><span>Not live activity</span></div>
          <div className="funding-diagram">
            <div className="funding-source"><div className="source-orbit" aria-hidden="true"><i /><i /><i /><i /><b /></div><strong>Multiple sponsors</strong><small>Creator + backers</small></div>
            <span className="diagram-link" aria-hidden="true"><i /></span>
            <div className="funding-vault"><span className="vault-glyph" aria-hidden="true">⌑</span><strong>Shared escrow</strong><small>Contract governed</small></div>
            <span className="diagram-link" aria-hidden="true"><i /></span>
            <div className="funding-destination"><span className="destination-glyph" aria-hidden="true">✓</span><strong>Approved payee</strong><small>Recorded submission</small></div>
          </div>
          <div className="funding-review-bridge"><span>Fix submitted</span><i aria-hidden="true" /><span>Human review</span><i aria-hidden="true" /><span>Settlement by rule</span></div>
          <p>Contributor totals and funding records appear only when read from the selected registered contract.</p>
        </div>
      </section>
      {isLocalE2E && chainId === patchPoolLocalE2E.id && <div className="notice"><strong>Local test mode:</strong> This isolated Hardhat chain is for automated testing only. It is not MST Testnet or Mainnet, and transactions here are not public evidence.</div>}
      {chainId === mstMainnet.id && !isDeployed && <div className="notice"><strong>Mainnet deployment unavailable:</strong> verified contract evidence is not available in the active registry, so bounty reads and transaction controls are unavailable.</div>}
      {chainId === mstMainnet.id && isDeployed && !mainnetWritesConfigured && <div className="notice"><strong>Mainnet writes are disabled by configuration.</strong> Transaction controls are unavailable until the frontend write gate is enabled.</div>}
      <div className="content-grid" id="main-content" tabIndex={-1}>
        <div>
          <section className="card" id="create">
            <div className="card-heading"><div><div className="section-label">FOR SPONSORS</div><h2 style={{ marginTop: 8 }}>Create a bounty</h2><p>Define the fix, assign its reviewer and fund the first contribution.</p></div><span className="badge accent">SHARED ESCROW</span></div>
            <form onSubmit={creationStep === 3 ? createBounty : (event) => { event.preventDefault(); advanceCreationStep(); }}>
              <ol className="creation-progress" aria-label="Bounty creation steps">
                {["Task details", "Reward & deadlines", "Review & fund"].map((step, index) => <li key={step} className={creationStep === index + 1 ? "current" : creationStep > index + 1 ? "complete" : ""}><span>{creationStep > index + 1 ? "✓" : `0${index + 1}`}</span><strong>{step}</strong></li>)}
              </ol>
              {creationStep === 1 && <div className="creation-stage" aria-labelledby="creation-stage-title">
                <div className="form-step-heading field full"><span>01</span><div><strong id="creation-stage-title">Define the work</strong><small>Make the task specific, public, and verifiable.</small></div></div>
                <div className="field full"><label htmlFor="task-title">Task title</label><input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={100} required placeholder="Fix token balance rounding" /></div>
                <div className="field full"><label htmlFor="task-description">Description and acceptance criteria</label><textarea id="task-description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} maxLength={5000} required placeholder="Describe the bug, expected behavior, and how the fix will be checked." /><small>Title and description become permanent public metadata in a contract event. Never include secrets or personal information. Maximum encoded size: 16 KiB.</small></div>
                <div className="creation-actions"><span className="panel-caption">You can return to edit these details before funding.</span><button className="button primary" type="button" onClick={advanceCreationStep}>Continue to reward <span aria-hidden="true">→</span></button></div>
              </div>}
              {creationStep === 2 && <div className="creation-stage" aria-labelledby="creation-stage-title">
                <div className="form-step-heading field full"><span>02</span><div><strong id="creation-stage-title">Set reward and deadlines</strong><small>The sponsor funds first; the assigned reviewer decides.</small></div></div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="reward">Initial escrow ({currencySymbol})</label><input id="reward" type="number" min="0.000000000000000001" step="any" value={reward} onChange={(e) => setReward(e.target.value)} required placeholder="e.g. 2" /><small>This amount is sent with the create transaction.</small></div>
                  <div className="field"><label htmlFor="reviewer">Assigned reviewer address</label><input id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} required placeholder="0x…" /><small>The reviewer must use a different address from the sponsor.</small></div>
                  <div className="field"><label htmlFor="submission-deadline">Submission deadline</label><input id="submission-deadline" type="datetime-local" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} required /></div>
                  <div className="field"><label htmlFor="settlement-deadline">Review / settlement deadline</label><input id="settlement-deadline" type="datetime-local" value={settlementDeadline} onChange={(e) => setSettlementDeadline(e.target.value)} required /><small>Must be later than the submission deadline.</small></div>
                </div>
                <div className="creation-actions"><button className="button ghost" type="button" onClick={() => { setActionError(""); setCreationStep(1); }}>← Back to task details</button><button className="button primary" type="button" onClick={advanceCreationStep}>Review bounty <span aria-hidden="true">→</span></button></div>
              </div>}
              {creationStep === 3 && <div className="creation-stage" aria-labelledby="creation-stage-title">
                <div className="form-step-heading field full"><span>03</span><div><strong id="creation-stage-title">Review before funding</strong><small>Check the permanent task terms and exact initial escrow.</small></div></div>
                <div className="terms-summary"><div className="terms-summary-heading"><span>BOUNTY DRAFT</span><span>Not submitted</span></div><strong>{taskTitle.trim()}</strong><p className="creation-review-description">{taskDescription.trim()}</p><dl><div><dt>Initial escrow</dt><dd>{reward} {currencySymbol}</dd></div><div><dt>Assigned reviewer</dt><dd><code>{reviewer}</code></dd></div><div><dt>Submission deadline</dt><dd>{displayFormDate(submissionDeadline)}</dd></div><div><dt>Review / settlement</dt><dd>{displayFormDate(settlementDeadline)}</dd></div></dl></div>
                <p className="creation-disclosure"><strong>Before you continue:</strong> the task metadata is public and permanent. The contract stores the task digest, reviewer, deadlines, and escrow. A human reviewer evaluates work; the contract enforces role and settlement rules. Refunds follow the contract deadline plus its seven-day grace period.</p>
                <div className="creation-wallet-state" role="status">{!isConnected ? "Connect BridgeKey before funding." : !isAuthorizedWallet ? "The connected provider is not eligible to submit PatchPool transactions." : !isSupportedNetwork ? `Switch to MST Mainnet (chain ${mstMainnet.id}) in your wallet.` : !isDeployed ? "Registered contract evidence is unavailable." : !writesEnabled ? "Transactions are disabled for this network." : `Ready to request an explicit wallet confirmation for ${reward} ${currencySymbol}.`}</div>
                <div className="creation-actions"><button className="button ghost" type="button" onClick={() => { setActionError(""); setCreationStep(2); }}>← Edit reward &amp; deadlines</button><button className="button primary" disabled={!isConnected || !isAuthorizedWallet || !isSupportedNetwork || !isDeployed || !writesEnabled || isBusy}>{isBusy && actionName === "Create bounty" ? "Waiting for wallet…" : "Create & fund bounty ↗"}</button></div>
              </div>}
              {actionError && <p className="error-message" role="alert">{actionError}</p>}
            </form>
          </section>

          <section className="card" id="bounties">
            <div className="card-heading"><div><div className="section-label">THE MARKETPLACE</div><h2 style={{ marginTop: 8 }}>Discover funded opportunities.</h2><p>Find software problems worth solving.</p></div><button className="button small-button" type="button" onClick={() => void refresh()} disabled={!isDeployed || isBusy}><span aria-hidden="true">↻</span> Refresh</button></div>
            {!isDeployed ? <div className="empty-state"><h3>{chainId === mstMainnet.id ? "Mainnet deployment record unavailable" : "Select MST Mainnet"}</h3><p>{chainId === mstMainnet.id ? "The verified Mainnet deployment is finalized in the active registry. Refresh the app if its registry data is unavailable." : `PatchPool production reads and transactions are available only on MST Mainnet (chain ${mstMainnet.id}).`}</p></div>
              : bountyCountError || bountyReadError ? <div className="state-panel state-error"><span className="state-icon">!</span><h3>We couldn’t reach the bounty registry.</h3><p>This may be an RPC or network issue. Your wallet and funds are not affected.</p><details><summary>Technical details</summary><code>{(bountyCountError ?? bountyReadError)?.message}</code></details><button className="button ghost" type="button" onClick={() => void refresh()}>Retry read</button></div>
              : loadingBountyCount || loadingBounties && !bountyReadsRaw ? <div className="skeleton-list" aria-label="Loading on-chain bounty records"><div className="skeleton-card" /><div className="skeleton-card" /></div>
              : bountyCount === BigInt(0) ? <div className="empty-state"><span className="empty-visual" aria-hidden="true"><i /><i /><i /><b>+</b></span><span className="empty-kicker">A NEW KIND OF OPEN-SOURCE FUNDING</span><h3>Be part of the first funded fix.</h3><p>No active bounties are available yet. Sponsors can create the first opportunity and fund a software fix.</p><a className="button primary" href="#create">Create the first bounty <span aria-hidden="true">↗</span></a><small>Only live on-chain records are shown here.</small></div>
              : bountyRecords.length === 0 ? <div className="state-panel state-error"><span className="state-icon">!</span><h3>Bounty records are temporarily unavailable.</h3><p>The contract is registered, but the current RPC read did not return usable records.</p><button className="button ghost" type="button" onClick={() => void refresh()}>Retry read</button></div>
              : <>
              <div className="marketplace-controls">
                <div className="field"><label htmlFor="bounty-search">Search bounties</label><input id="bounty-search" type="search" value={bountyQuery} onChange={(event) => setBountyQuery(event.target.value)} placeholder="Title, details, sponsor, reviewer, or ID" /></div>
                <div className="field"><label htmlFor="bounty-status">Status</label><select id="bounty-status" value={bountyStatusFilter} onChange={(event) => setBountyStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUS.map((status, index) => <option key={status} value={String(index)}>{status}</option>)}</select></div>
                <div className="field"><label htmlFor="bounty-role">My workspace</label><select id="bounty-role" value={bountyRoleFilter} onChange={(event) => setBountyRoleFilter(event.target.value)} disabled={!address}><option value="all">All public bounties</option><option value="sponsor">I sponsored</option><option value="contributor">I contributed or submitted</option><option value="reviewer">My review queue</option></select></div>
                <div className="field"><label htmlFor="bounty-sort">Sort loaded records</label><select id="bounty-sort" value={bountySort} onChange={(event) => setBountySort(event.target.value)}><option value="newest">Newest first</option><option value="reward-high">Highest reward</option><option value="reward-low">Lowest reward</option><option value="deadline-soon">Submission deadline</option></select></div>
              </div>
              {!loadingBounties && bountyReadsRaw && bountyRecords.length < latestBountyIds.length && <div className="marketplace-partial-read" role="status"><span><strong>Some bounty records could not be read.</strong> The list below includes only complete contract reads.</span><button className="text-button" type="button" onClick={() => void refresh()}>Retry reads</button></div>}
              <div className="filter-summary"><span role="status" aria-live="polite">Showing {visibleBountyRecords.length} of {bountyRecords.length} records loaded from the registered contract{!address ? " · connect a wallet for your workspace" : ""}</span>{(bountyQuery || bountyStatusFilter !== "all" || bountyRoleFilter !== "all" || bountySort !== "newest") && <button className="text-button" type="button" onClick={() => { setBountyQuery(""); setBountyStatusFilter("all"); setBountyRoleFilter("all"); setBountySort("newest"); }}>Clear filters</button>}</div>
              {bountyPageCount > 1 && <div className="form-actions" aria-label="Bounty pages">
                <button className="ghost" type="button" onClick={() => setBountyPage((page) => Math.max(0, page - 1))} disabled={bountyPage === 0}>Newer bounties</button>
                <span className="panel-caption" role="status" aria-live="polite">Page {bountyPage + 1} of {bountyPageCount} · {latestBountyIds.length} records per page</span>
                <button className="ghost" type="button" onClick={() => setBountyPage((page) => Math.min(bountyPageCount - 1, page + 1))} disabled={bountyPage + 1 >= bountyPageCount}>Older bounties</button>
              </div>}
              {visibleBountyRecords.length === 0
                ? <div className="empty-state"><h3>No matching bounties</h3><p>Change your search or filters. Results include only records loaded from the registered contract.</p><button className="ghost" type="button" onClick={() => { setBountyQuery(""); setBountyStatusFilter("all"); setBountyRoleFilter("all"); setBountySort("newest"); }}>Clear filters</button></div>
                : <div className="marketplace-list">
                {visibleBountyRecords.map((bounty) => {
                  const task = readableTask(bounty);
                  const related = submissions.filter((s) => s.bountyId === bounty.id);
                  const connectedLower = address?.toLowerCase();
                  const isAssignedReviewer = Boolean(connectedLower && connectedLower === bounty.reviewer.toLowerCase());
                  const isBountyContributor = bounty.myContribution > BigInt(0);
                  const isSubmissionParticipant = Boolean(connectedLower && related.some((submission) =>
                    submission.submitter.toLowerCase() === connectedLower || submission.payee.toLowerCase() === connectedLower
                  ));
                  const bountyActivity = activity.filter((event) => event.bountyId === bounty.id.toString()).sort((a, b) => a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0);
                  const visibleEventCount = (eventDisplayPages[bounty.id.toString()] ?? 1) * 20;
                  const contributorAddresses = new Set(bountyActivity.flatMap((event) => event.contributor ? [event.contributor.toLowerCase()] : []));
                  const fundingModel = activityState !== "ready"
                    ? "Contributor history unavailable"
                    : contributorAddresses.size > 1
                      ? `Shared · ${contributorAddresses.size} contributors`
                      : contributorAddresses.size === 1
                        ? "Individual · one sponsor"
                        : "No funding events indexed";
                  const approved = related.find((s) => s.id === bounty.approvedSubmissionId);
                  const now = blockTime;
                  const submitEligibility = submissionEligibility({ bounty, address, connected: isConnected, authorizedWallet: isAuthorizedWallet, supportedNetwork: isSupportedNetwork, writesEnabled, blockTime: now });
                  const canSubmit = submitEligibility.eligible;
                  const submitUnavailableReason = submitEligibility.eligible ? "" : submitEligibility.reason;
                  const canReview = related.some((submission) => reviewEligibility({ bounty, submission, address, connected: isConnected, authorizedWallet: isAuthorizedWallet, supportedNetwork: isSupportedNetwork, writesEnabled, blockTime: now }).eligible);
                  const canRelease = Boolean(writesEnabled && isAuthorizedWallet && bounty.status === 1);
                  const canContribute = Boolean(writesEnabled && isConnected && isAuthorizedWallet && isSupportedNetwork && !isAssignedReviewer && !isSubmissionParticipant && now && bounty.status === 0 && now <= bounty.submissionDeadline);
                  const canRefund = Boolean(writesEnabled && isAuthorizedWallet && address && bounty.myContribution > BigInt(0) && (bounty.status === 0 || bounty.status === 4) && now && now > bounty.settlementDeadline + REFUND_GRACE_SECONDS);
                  return <BountyCard
                    key={bounty.id.toString()}
                    id={bounty.id.toString()}
                    title={task?.title ?? "Task details unavailable"}
                    description={task?.description ?? "Committed task details could not be read or verified. Open the details for the on-chain task hash."}
                    reward={`${formatEther(bounty.reward)} ${currencySymbol}`}
                    status={bounty.status}
                    statusLabel={STATUS[bounty.status] ?? "Unknown"}
                    submitBy={toDateTime(bounty.submissionDeadline)}
                    submitDateTime={new Date(Number(bounty.submissionDeadline) * 1000).toISOString()}
                    reviewBy={toDateTime(bounty.settlementDeadline)}
                    reviewDateTime={new Date(Number(bounty.settlementDeadline) * 1000).toISOString()}
                    reviewer={shortAddress(bounty.reviewer)}
                    reviewerHref={addressLink(bounty.reviewer, chainId) === "#" ? undefined : addressLink(bounty.reviewer, chainId)}
                    autoOpen={targetBountyId === bounty.id}
                  >
                    {!task && <p className="panel-caption">No valid readable metadata event was found for this task, or its commitment did not match. On-chain task hash: <code>{bounty.taskHash}</code></p>}
                    <div className="form-grid">
                      <div><div className="panel-label">FUNDING MODEL · FROM LOADED EVENTS</div><strong>{fundingModel}</strong></div>
                      <div><div className="panel-label">TOTAL ESCROWED POOL</div><strong>{formatEther(bounty.reward)} {currencySymbol}</strong></div>
                      <div><div className="panel-label">THIS WALLET CONTRIBUTED</div><strong>{formatEther(bounty.myContribution)} {currencySymbol}</strong></div>
                      <div><div className="panel-label">REFUND ACCOUNTING BALANCE</div><strong>{formatEther(bounty.refundableBalance)} {currencySymbol}</strong><small className="panel-caption">Contributor claims only apply to Open or Refunding bounties after the settlement deadline plus seven days.</small></div>
                      <div><div className="panel-label">SPONSOR</div><a href={addressLink(bounty.sponsor, chainId)} target="_blank" rel="noreferrer"><code>{shortAddress(bounty.sponsor)}</code></a></div>
                      <div><div className="panel-label">REVIEWER</div><a href={addressLink(bounty.reviewer, chainId)} target="_blank" rel="noreferrer"><code>{shortAddress(bounty.reviewer)}</code></a></div>
                      <div><div className="panel-label">SUBMIT BY</div>{toDateTime(bounty.submissionDeadline)}</div>
                      <div><div className="panel-label">SETTLEMENT DEADLINE</div>{toDateTime(bounty.settlementDeadline)}</div>
                      <div><div className="panel-label">ON-CHAIN TASK HASH</div><code style={{ overflowWrap: "anywhere" }}>{bounty.taskHash}</code></div>
                    </div>
                    <p className="panel-caption" style={{ marginTop: 12 }}><strong>Terms locked:</strong> The contract records the task digest, reviewer, and deadlines; this UI has no term-editing action. Contributions follow the open-funding deadline. The title and description are published in a permanent, public contract event and verified against the task digest. Never include secrets or personal data.</p>

                    {bounty.status === 0 && <form onSubmit={(event) => { event.preventDefault(); contribute(bounty); }} className="form-actions" style={{ marginTop: 16 }}>
                      <div className="field"><label htmlFor={`contribution-${bounty.id}`}>Add to this shared bounty ({currencySymbol})</label><input id={`contribution-${bounty.id}`} type="number" min="0.000000000000000001" step="any" value={contributionAmounts[bounty.id.toString()] ?? ""} onChange={(event) => setContributionAmounts((current) => ({ ...current, [bounty.id.toString()]: event.target.value }))} placeholder="Contribution amount" /></div>
                      <button className="ghost" type="submit" disabled={!canContribute || isBusy || !isSupportedNetwork || !writesEnabled || !isAuthorizedWallet}>Add contribution ↗</button>
                      <span className="panel-caption">{isAssignedReviewer ? "The assigned reviewer cannot fund this bounty." : isSubmissionParticipant ? "A submitter or named payee cannot later fund this bounty." : "Contributions are recorded per wallet on-chain. Funding closes at the submission deadline; each contributor can claim their own eligible refund."}</span>
                    </form>}

                      {bounty.status === 0 && canSubmit && <form key={address ?? "disconnected"} onSubmit={(e) => submitWork(e, bounty, e.currentTarget)} style={{ marginTop: 20 }}>
                      <div className="section-label">DEVELOPER / SUBMIT WORK</div><div className="form-grid" style={{ marginTop: 10 }}>
                        <div className="field full"><label htmlFor={`commit-${bounty.id}`}>Git commit ID (40 or 64 hex characters)</label><input id={`commit-${bounty.id}`} name="commit" required placeholder="Commit from the repository under review" pattern="(?:0x)?[a-fA-F0-9]{40}|(?:0x)?[a-fA-F0-9]{64}" /><small>The exact Git object ID is recorded on-chain. SHA-1 IDs are zero-padded in bytes32; SHA-256 IDs use all 32 bytes.</small></div>
                        <div className="field full"><label htmlFor={`evidence-file-${bounty.id}`}>Evidence file (optional local SHA-256)</label><input id={`evidence-file-${bounty.id}`} type="file" onChange={(event) => void digestEvidenceFile(event.currentTarget.files?.[0], event.currentTarget.form)} /><small>The file stays in this browser; it is not uploaded or stored. Selecting it calculates a digest for the field below.</small></div>
                        <div className="field full"><label htmlFor={`evidence-hash-${bounty.id}`}>Evidence digest (SHA-256)</label><input id={`evidence-hash-${bounty.id}`} name="evidence" required placeholder="0x followed by 64 hex characters" pattern="0x[a-fA-F0-9]{64}" /><small>Digest of test logs or evidence. It supports integrity checking but does not prove truth or code correctness.</small></div>
                        <div className="field full"><label htmlFor={`payee-${bounty.id}`}>Payout address</label><input id={`payee-${bounty.id}`} name="payee" required defaultValue={address} placeholder="0x…" /></div>
                      </div><button className="primary" type="submit" disabled={isBusy || !writesEnabled || !isAuthorizedWallet}>Submit work ↗</button>
                    </form>}
                    {bounty.status === 0 && !canSubmit && <p className="panel-caption" role="status">{submitUnavailableReason}</p>}

                    <div style={{ marginTop: 20 }}><div className="section-label">SUBMISSIONS ({bounty.count.toString()} ON-CHAIN)</div>
                      {loadingSubmissions && related.length === 0 ? <p className="panel-caption">Loading submissions…</p> : bounty.count === BigInt(0) ? <p className="panel-caption">No submissions recorded yet.</p> : related.length === 0 ? <p className="panel-caption">Submission reads are unavailable.</p> : <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                        {related.map((submission) => <div id={`submission-${bounty.id}-${submission.id}`} className="notice" key={`${bounty.id}-${submission.id}`}>
                          <div className="status-line"><strong>Submission #{submission.id.toString()}</strong><span className="badge">{bounty.approvedSubmissionId === submission.id ? "APPROVED" : submission.rejected ? "REJECTED" : "PENDING REVIEW"}</span></div>
                          <p className="panel-caption">Submitted {toDateTime(submission.submittedAt)}</p>
                          <div className="panel-label">SUBMITTER</div><a href={addressLink(submission.submitter, chainId)} target="_blank" rel="noreferrer"><code>{submission.submitter}</code></a>
                          <div className="panel-label" style={{ marginTop: 8 }}>PAYOUT ADDRESS</div><a href={addressLink(submission.payee, chainId)} target="_blank" rel="noreferrer"><code>{submission.payee}</code></a>
                          <div className="panel-label" style={{ marginTop: 8 }}>GIT COMMIT ID ({submission.commitIsSha256 ? "SHA-256" : "SHA-1"})</div><code style={{ overflowWrap: "anywhere" }}>{submission.commitIsSha256 ? submission.commitHash.slice(2) : submission.commitHash.slice(-40)}</code>
                          <div className="panel-label" style={{ marginTop: 8 }}>EVIDENCE SHA-256</div><code style={{ overflowWrap: "anywhere" }}>{submission.evidenceHash}</code>
                          <div className="field" style={{ marginTop: 10 }}>
                            <label htmlFor={`evidence-check-${bounty.id}-${submission.id}`}>Check evidence file against this digest</label>
                            <input id={`evidence-check-${bounty.id}-${submission.id}`} type="file" onChange={(event) => void verifyEvidenceFile(event.currentTarget.files?.[0], submission.evidenceHash, `${bounty.id}-${submission.id}`)} />
                            <small>The file stays in this browser. Matching bytes confirm the digest; a mismatch detects changed bytes, not whether the evidence is truthful.</small>
                            {evidenceChecks[`${bounty.id}-${submission.id}`] && <span role="status" className={evidenceChecks[`${bounty.id}-${submission.id}`].startsWith("MATCH") ? "success-message" : evidenceChecks[`${bounty.id}-${submission.id}`].startsWith("MISMATCH") ? "error-message" : "panel-caption"}>{evidenceChecks[`${bounty.id}-${submission.id}`]}</span>}
                          </div>
                          {canReview && !submission.rejected && bounty.approvedSubmissionId === BigInt(0) && <div className="form-actions"><button type="button" className="primary" disabled={isBusy || !writesEnabled || !isAuthorizedWallet} onClick={() => review(bounty, submission, true)}>Approve this submission</button><button type="button" className="ghost" disabled={isBusy || !writesEnabled || !isAuthorizedWallet} onClick={() => review(bounty, submission, false)}>Reject</button></div>}
                        </div>)}
                        {bounty.count > BigInt(related.length) && <p className="panel-caption">Showing the latest {related.length} submissions for this bounty.</p>}
                      </div>}
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div className="section-label">ON-CHAIN EVENT HISTORY</div>
                      {activityState === "loading" ? <p className="panel-caption">Loading one bounded 2,000-block event page…</p>
                        : activityState === "unavailable" ? <p className="panel-caption">This deployment record has no deployment block, so historical event scanning is unavailable.</p>
                        : activityState === "error" ? <p className="error-message" role="alert">Event history unavailable: {activityError}</p>
                        : bountyActivity.length === 0 ? <p className="panel-caption">No events for this bounty in the loaded block pages yet.</p>
                        : <div className="steps">{bountyActivity.slice(0, visibleEventCount).map((event, index) => <div className="step" key={`${event.transactionHash}-${index}`}>
                          <div className="step-number">{index + 1}</div>
                          <div><h3>{event.summary}</h3><p>Block {event.blockNumber.toString()}{event.submissionId ? ` · submission #${event.submissionId}` : ""}</p>
                            <a href={txLink(event.transactionHash, chainId)} target="_blank" rel="noreferrer">{shortAddress(event.transactionHash)} ↗</a>
                          </div>
                        </div>)}</div>}
                      {bountyActivity.length > visibleEventCount && <button className="ghost" type="button" onClick={() => setEventDisplayPages((current) => ({ ...current, [bounty.id.toString()]: (current[bounty.id.toString()] ?? 1) + 1 }))}>Show older loaded events</button>}
                      {activityState === "ready" && activityHasOlder && <button className="ghost" type="button" onClick={() => setActivityPage((page) => page + 1)}>Load older event page · 2,000 blocks</button>}
                      {activityState === "ready" && activityPage > 0 && <button className="ghost" type="button" onClick={() => setActivityPage((page) => Math.max(0, page - 1))}>Load newer event page</button>}
                    </div>

                    {bounty.status === 1 && approved && <div className="notice" style={{ marginTop: 16 }}><strong>Approved submission #{approved.id.toString()}</strong><p>Reward: {formatEther(bounty.reward)} {currencySymbol} → {shortAddress(approved.payee)}</p><p className="panel-caption">Release is permissionless and remains available after approval. It sends funds to the payee recorded in this immutable submission.</p><button className="primary" type="button" disabled={!canRelease || isBusy || !isSupportedNetwork || !writesEnabled || !isAuthorizedWallet} onClick={() => release(bounty)}>Release reward ↗</button></div>}
                    {(bounty.status === 0 || bounty.status === 4) && <div className="form-actions" style={{ marginTop: 16 }}><span className="panel-caption">Each contributor may claim their own amount after the settlement deadline plus seven days. Current selected-chain block time is used.</span>{canRefund && <button className="ghost" type="button" disabled={isBusy || !isSupportedNetwork || !writesEnabled || !isAuthorizedWallet} onClick={() => refund(bounty)}>Claim my expired contribution</button>}</div>}
                    {bounty.status === 1 && !approved && <p className="panel-caption">Approved submission details are not available in the latest loaded records.</p>}
                    {bounty.status === 2 && <p className="success-message">Paid on-chain. The bounty contract records the final status.</p>}
                    {bounty.status === 3 && <p className="panel-caption">Refunded on-chain. The bounty is closed.</p>}
                  </BountyCard>;
                })}
              </div>}
              </>}
          </section>
        </div>

        <aside>
          <section className="card trust-card" id="trust" aria-labelledby="trust-title">
            <div className="section-label">VERIFIABLE BY DESIGN</div><h2 id="trust-title">Trust &amp; Security</h2>
            <p>Production runs on MST Mainnet. Verify the deployment independently on MSTScan.</p>
            <dl className="deployment-facts"><dt>Network</dt><dd>MST Mainnet · chain 4646</dd><dt>Contract</dt><dd><a className="mono-link" href={`https://mstscan.com/address/${mainnetDeployment.address}#code`} target="_blank" rel="noopener noreferrer">{mainnetDeployment.address} ↗</a></dd><dt>Deployment</dt><dd><a className="mono-link" href={`https://mstscan.com/tx/${mainnetDeployment.deploymentTransactionHash}`} target="_blank" rel="noopener noreferrer">{shortAddress(mainnetDeployment.deploymentTransactionHash)} ↗</a></dd><dt>Block</dt><dd className="mono">{mainnetDeployment.deploymentBlock}</dd></dl>
            <div className="trust-status"><span className="trust-check">✓</span><span><strong>Source verified on MSTScan</strong><small>The project&apos;s Mainnet deployment record is finalized; verify the contract and transaction on MSTScan.</small></span></div>
            <details className="trust-details"><summary>Security model and limitations</summary><div className="trust-detail-content"><h3 className="trust-guarantee-title">What the contract guarantees</h3><p>Escrow custody, address-level role restrictions, recorded reviewer decisions, approved-payee settlement, and eligible contributor refunds. The creator and funders cannot submit or receive payout; the reviewer cannot fund, submit, or receive payout.</p><h3>Human responsibility</h3><p>One assigned reviewer decides. The contract does not assess code quality or verify evidence. Evidence files remain off-chain; a matching digest identifies bytes but does not prove correctness or truth.</p><h3>Known limits</h3><p>Address separation is not identity verification. There is no quorum or dispute process. Task metadata is public and permanent. Refunds are individually claimed after the settlement deadline plus seven days. No independent professional security audit has been completed, and live BridgeKey signing remains unverified.</p></div></details>
            <details className="trust-details historical-details"><summary>Historical Legacy Testnet deployment</summary><div className="trust-detail-content"><p>Reference only · chain ID 91562037 · not a production network.</p><p><a className="mono-link" href="https://testnet.mstscan.com/address/0x707004013b56e36ee458966d928539ede6166338" target="_blank" rel="noopener noreferrer">Contract 0x707004013b56e36ee458966d928539ede6166338 ↗</a></p><p><a className="mono-link" href="https://testnet.mstscan.com/tx/0x132a1fd81bcc31febcd1830441706dd545075ae764636e9ddb7281ac938677c0" target="_blank" rel="noopener noreferrer">Deployment transaction ↗</a> · block 6679982</p></div></details>
          </section>
        </aside>
      </div>

      {(actionHash || actionError || createdBountyId) && <section className="card" aria-live="polite">
        <div className="section-label">TRANSACTION STATUS</div>
        {actionHash && <p>{actionName}: {isConfirming ? `Waiting for ${isLocalE2E && chainId === patchPoolLocalE2E.id ? "local Hardhat" : "MST Mainnet"} confirmation…` : receipt?.status === "success" ? "Confirmed on-chain." : receiptReady ? "Transaction reverted." : "Submitted; awaiting receipt."}</p>}
        {actionHash && (chainId === mstMainnet.id ? <p><a href={txLink(actionHash, mstMainnet.id)} target="_blank" rel="noopener noreferrer">Transaction {actionHash} ↗</a></p> : <p className="mono">Transaction {actionHash} · local only · not on MSTScan</p>)}
        {createdBountyId && <p className="success-message">Confirmed bounty ID: #{createdBountyId}. The ID was read from the BountyCreated event.</p>}
        {actionError && <p className="error-message" role="alert">{actionError}</p>}
      </section>}
      <section className="closing-cta"><div><span className="section-label">OPEN-SOURCE WORK, FUNDED</span><h2>Make the next fix count.</h2><p>Explore the marketplace or define a well-scoped software problem for contributors.</p></div><div className="hero-actions"><a className="button primary" href="#bounties">Explore bounties <span aria-hidden="true">↗</span></a><a className="button ghost" href="#create">Create a bounty</a></div></section>
      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true"><span /></span><span><strong>PATCHPOOL</strong><small>Where open-source work gets funded.</small></span></div>
        <div className="footer-links"><a href={`https://mstscan.com/address/${mainnetDeployment.address}#code`} target="_blank" rel="noopener noreferrer">Mainnet contract ↗</a><a href={`https://mstscan.com/tx/${mainnetDeployment.deploymentTransactionHash}`} target="_blank" rel="noopener noreferrer">Deployment transaction ↗</a><a href="https://github.com/ShravaniMankar664/PatchPool" target="_blank" rel="noopener noreferrer">Public repository · source upload pending</a></div>
        <div className="footer-bottom"><span>MST Mainnet · chain 4646</span><span>Live BridgeKey signing has not been verified. No bounty activity is implied.</span></div>
      </footer>
    </main>
  );
}
