"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useBlock, useChainId, usePublicClient, useReadContracts } from "wagmi";
import { keccak256, parseAbiItem, stringToHex } from "viem";
import { usePatchPool } from "@/hooks/usePatchPool";
import { mstMainnet, patchPoolLocalE2E } from "@/lib/chains";
import { isBridgeKeyConnector } from "@/lib/walletIdentity";

const BOUNTY_PAGE_SIZE = 20;
const SUBMISSION_PAGE_SIZE = 10;
const EVENT_PAGE_SIZE = BigInt(2_000);
const metadataEvent = parseAbiItem("event BountyMetadata(uint256 indexed bountyId, bytes32 indexed taskHash, string taskMetadataJson)");

export type WorkspaceTask = { title: string; description: string };
export type WorkspaceBounty = {
  id: bigint;
  sponsor: `0x${string}`;
  reviewer: `0x${string}`;
  reward: bigint;
  submissionDeadline: bigint;
  settlementDeadline: bigint;
  taskHash: `0x${string}`;
  status: number;
  approvedSubmissionId: bigint;
  submissionCount: bigint;
  myContribution: bigint;
};
export type WorkspaceSubmission = {
  bountyId: bigint;
  id: bigint;
  submitter: `0x${string}`;
  payee: `0x${string}`;
  commitHash: `0x${string}`;
  commitIsSha256: boolean;
  evidenceHash: `0x${string}`;
  submittedAt: bigint;
  rejected: boolean;
};
type ReadResult = { status: string; result?: unknown };
type ReadList = { data?: ReadResult[]; isLoading?: boolean; isError?: boolean; error?: Error; refetch: () => unknown };

function tupleValue<T>(value: unknown, name: string, index: number): T {
  if (value && typeof value === "object" && name in value) return (value as Record<string, unknown>)[name] as T;
  return (Array.isArray(value) ? value[index] : undefined) as T;
}

function parseTaskMetadata(raw: string, expectedHash: `0x${string}`): WorkspaceTask | undefined {
  if (keccak256(stringToHex(raw)).toLowerCase() !== expectedHash.toLowerCase()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("title" in parsed) || !("description" in parsed)) return undefined;
    const value = parsed as { title: unknown; description: unknown };
    return typeof value.title === "string" && typeof value.description === "string"
      ? { title: value.title, description: value.description }
      : undefined;
  } catch {
    return undefined;
  }
}

export function useRoleWorkspaceData() {
  const { address, chainId: walletChainId, connector, isConnected } = useAccount();
  const configuredChainId = useChainId();
  const chainId = walletChainId ?? configuredChainId;
  const localE2E = process.env.NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E === "true" && process.env.NODE_ENV !== "production";
  const localNetwork = localE2E && chainId === patchPoolLocalE2E.id;
  const supportedNetwork = chainId === mstMainnet.id || localNetwork;
  const clientChainId = localNetwork ? patchPoolLocalE2E.id : mstMainnet.id;
  const { address: contractAddress, abi, bountyCount, loadingBountyCount, bountyCountError, isDeployed, deploymentBlock, writesEnabled } = usePatchPool();
  const authorizedWallet = localNetwork ? connector?.id === "injected" : isBridgeKeyConnector(connector);
  const publicClient = usePublicClient({ chainId: clientChainId });
  const { data: block } = useBlock({ chainId: clientChainId, watch: true, query: { enabled: supportedNetwork && isDeployed } });
  const [page, setPage] = useState(0);
  const [tasks, setTasks] = useState<Record<string, WorkspaceTask>>({});
  const [metadataState, setMetadataState] = useState<"idle" | "loading" | "ready" | "partial" | "error">("idle");
  const [metadataError, setMetadataError] = useState("");

  const bountyIds = useMemo(() => {
    if (bountyCount === undefined || bountyCount <= BigInt(0)) return [];
    const end = bountyCount - BigInt(page * BOUNTY_PAGE_SIZE);
    if (end <= BigInt(0)) return [];
    const count = end > BigInt(BOUNTY_PAGE_SIZE) ? BOUNTY_PAGE_SIZE : Number(end);
    return Array.from({ length: count }, (_, index) => end - BigInt(index));
  }, [bountyCount, page]);
  const pageCount = bountyCount === undefined ? 0 : Math.ceil(Number(bountyCount) / BOUNTY_PAGE_SIZE);
  const loadPage = useCallback((target: number) => setPage(Math.max(0, Math.min(target, Math.max(0, pageCount - 1)))), [pageCount]);
  const loadOlder = useCallback(() => setPage((current) => Math.min(current + 1, Math.max(0, pageCount - 1))), [pageCount]);

  const bountyReads = useReadContracts({
    contracts: bountyIds.flatMap((id) => [
      { address: contractAddress!, abi: abi as never, functionName: "getBounty", args: [id] },
      { address: contractAddress!, abi: abi as never, functionName: "submissionCounts", args: [id] },
      { address: contractAddress!, abi: abi as never, functionName: "contributions", args: [id, address ?? "0x0000000000000000000000000000000000000000"] },
    ]) as never,
    query: { enabled: Boolean(supportedNetwork && isDeployed && contractAddress && abi && bountyIds.length), refetchInterval: 15_000 },
  }) as unknown as ReadList;

  const bounties = useMemo(() => {
    const reads = bountyReads.data ?? [];
    return bountyIds.flatMap((id, index) => {
      const bountyRead = reads[index * 3];
      const countRead = reads[index * 3 + 1];
      const contributionRead = reads[index * 3 + 2];
      if (bountyRead?.status !== "success" || countRead?.status !== "success" || contributionRead?.status !== "success") return [];
      const raw = bountyRead.result;
      return [{
        id,
        sponsor: tupleValue(raw, "sponsor", 0),
        reviewer: tupleValue(raw, "reviewer", 1),
        reward: tupleValue(raw, "reward", 2),
        submissionDeadline: tupleValue(raw, "submissionDeadline", 3),
        settlementDeadline: tupleValue(raw, "settlementDeadline", 4),
        taskHash: tupleValue(raw, "taskHash", 5),
        status: Number(tupleValue(raw, "status", 6)),
        approvedSubmissionId: tupleValue(raw, "approvedSubmissionId", 7),
        submissionCount: countRead.result as bigint,
        myContribution: contributionRead.result as bigint,
      } satisfies WorkspaceBounty];
    });
  }, [bountyIds, bountyReads.data]);
  const expectedMetadataKey = bounties.map((bounty) => `${bounty.id.toString()}:${bounty.taskHash}`).join("|");
  const expectedMetadata = useMemo(() => new Map(bounties.map((bounty) => [bounty.id.toString(), bounty.taskHash])), [expectedMetadataKey]);

  const submissionQueries = useMemo(() => bounties.flatMap((bounty) => {
    const count = bounty.submissionCount > BigInt(SUBMISSION_PAGE_SIZE) ? SUBMISSION_PAGE_SIZE : Number(bounty.submissionCount);
    const ids = Array.from({ length: count }, (_, index) => bounty.submissionCount - BigInt(index));
    if (bounty.approvedSubmissionId > BigInt(0) && !ids.includes(bounty.approvedSubmissionId)) ids.push(bounty.approvedSubmissionId);
    return ids.map((id) => ({ bountyId: bounty.id, id }));
  }), [bounties]);

  const submissionReads = useReadContracts({
    contracts: submissionQueries.map(({ bountyId, id }) => ({
      address: contractAddress!, abi: abi as never, functionName: "getSubmission", args: [bountyId, id],
    })) as never,
    query: { enabled: Boolean(supportedNetwork && isDeployed && contractAddress && abi && submissionQueries.length), refetchInterval: 15_000 },
  }) as unknown as ReadList;

  const submissions = useMemo(() => (submissionReads.data ?? []).flatMap((read, index) => {
    if (read.status !== "success") return [];
    const query = submissionQueries[index];
    const raw = read.result;
    return [{
      bountyId: query.bountyId,
      id: query.id,
      submitter: tupleValue(raw, "submitter", 0),
      payee: tupleValue(raw, "payee", 1),
      commitHash: tupleValue(raw, "commitHash", 2),
      commitIsSha256: tupleValue(raw, "commitIsSha256", 3),
      evidenceHash: tupleValue(raw, "evidenceHash", 4),
      submittedAt: tupleValue(raw, "submittedAt", 5),
      rejected: tupleValue(raw, "rejected", 6),
    } satisfies WorkspaceSubmission];
  }), [submissionReads.data, submissionQueries]);

  useEffect(() => {
    let cancelled = false;
    if (!supportedNetwork || !publicClient || !contractAddress || !deploymentBlock || bountyIds.length === 0) {
      setTasks({});
      setMetadataState("idle");
      return () => { cancelled = true; };
    }
    const expected = expectedMetadata;
    setTasks({});
    setMetadataState("loading");
    setMetadataError("");
    void (async () => {
      const firstBlock = BigInt(deploymentBlock);
      let cursor = await publicClient.getBlockNumber({ cacheTime: 0 });
      let pages = 0;
      let reachedDeployment = false;
      let found: Record<string, WorkspaceTask> = {};
      while (cursor >= firstBlock && pages < 20 && Object.keys(found).length < expected.size) {
        const start = cursor - firstBlock >= EVENT_PAGE_SIZE - BigInt(1) ? cursor - EVENT_PAGE_SIZE + BigInt(1) : firstBlock;
        const logs = await publicClient.getLogs({ address: contractAddress, event: metadataEvent, fromBlock: start, toBlock: cursor });
        for (const log of logs) {
          const id = log.args.bountyId?.toString();
          const taskHash = id ? expected.get(id) : undefined;
          const raw = log.args.taskMetadataJson;
          if (!id || !taskHash || typeof raw !== "string") continue;
          const task = parseTaskMetadata(raw, taskHash);
          if (task) found[id] = task;
        }
        if (start === firstBlock) { reachedDeployment = true; break; }
        cursor = start - BigInt(1);
        pages += 1;
      }
      if (!cancelled) {
        setTasks(found);
        setMetadataState(Object.keys(found).length === expected.size || reachedDeployment ? "ready" : "partial");
      }
    })().catch((error: unknown) => {
      if (!cancelled) {
        setMetadataError(error instanceof Error ? error.message : "Task metadata could not be read from this network.");
        setMetadataState("error");
      }
    });
    return () => { cancelled = true; };
  }, [supportedNetwork, publicClient, contractAddress, deploymentBlock, bountyIds, expectedMetadata]);

  const missingBountyReads = Boolean(bountyReads.data && bountyReads.data.some((read) => read.status !== "success"));
  const missingSubmissionReads = Boolean(submissionReads.data && submissionReads.data.some((read) => read.status !== "success"));
  const loading = loadingBountyCount || (bountyIds.length > 0 && bountyReads.isLoading) || (submissionQueries.length > 0 && submissionReads.isLoading);
  const refresh = useCallback(async () => {
    const results = await Promise.all([bountyReads.refetch(), submissionReads.refetch()]);
    const failed = results.find((result) => Boolean(result && typeof result === "object" && "isError" in result && result.isError));
    if (failed && typeof failed === "object" && "error" in failed && failed.error instanceof Error) throw failed.error;
  }, [bountyReads.refetch, submissionReads.refetch]);

  return {
    address,
    isConnected,
    authorizedWallet,
    writesEnabled,
    contractAddress,
    abi,
    chainId,
    localE2E,
    supportedNetwork,
    isDeployed,
    bountyCount,
    bountyCountError,
    blockTime: block?.timestamp,
    bounties,
    submissions,
    tasks,
    loading,
    readError: bountyCountError ?? (bountyReads.isError ? bountyReads.error : undefined) ?? (submissionReads.isError ? submissionReads.error : undefined),
    hasPartialReads: missingBountyReads || missingSubmissionReads || bounties.length < bountyIds.length,
    metadataState,
    metadataError,
    page,
    pageCount,
    canLoadOlder: page + 1 < pageCount,
    loadOlder,
    loadPage,
    retry: () => { void refresh(); },
    refresh,
    publicClient,
    submissionPageSize: SUBMISSION_PAGE_SIZE,
  };
}
