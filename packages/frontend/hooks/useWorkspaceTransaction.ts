"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { transactionEligibility } from "@/lib/patchpoolLifecycle";

export type WorkspaceTransactionState = {
  status: "idle" | "requesting" | "pending" | "refreshing" | "confirmed" | "confirmed-unrefreshed" | "rejected" | "failed";
  label?: string;
  hash?: `0x${string}`;
  message?: string;
};

type TransactionContext = {
  connected: boolean;
  address?: string;
  authorizedWallet: boolean;
  supportedNetwork: boolean;
  writesEnabled: boolean;
};

function walletRejected(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const item = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (item.code === 4001 || item.name === "UserRejectedRequestError") return true;
    current = item.cause;
  }
  return false;
}

export function useWorkspaceTransaction(context: TransactionContext, refresh: () => Promise<void>) {
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WorkspaceTransactionState>({ status: "idle" });
  const [hash, setHash] = useState<`0x${string}`>();
  const lock = useRef(false);
  const handledHash = useRef<string>();
  const contextRef = useRef(context);
  const refreshRef = useRef(refresh);
  contextRef.current = context;
  refreshRef.current = refresh;

  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!hash || !receipt.isSuccess || !receipt.data || handledHash.current === hash) return;
    handledHash.current = hash;
    if (receipt.data.status !== "success") {
      lock.current = false;
      setState({ status: "failed", label: state.label, hash, message: "The transaction was mined but reverted. No change was applied." });
      return;
    }
    setState((current) => ({ ...current, status: "refreshing", message: "Transaction confirmed. Refreshing the contract record…" }));
    void refreshRef.current().then(() => {
      lock.current = false;
      setState((current) => ({ ...current, status: "confirmed", message: "Confirmed on-chain. The workspace has refreshed its contract reads." }));
    }).catch((error: unknown) => {
      lock.current = false;
      setState((current) => ({ ...current, status: "confirmed-unrefreshed", message: `Transaction confirmed, but the latest record could not be refreshed: ${error instanceof Error ? error.message : "RPC read failed"}` }));
    });
  }, [hash, receipt.isSuccess, receipt.data, state.label]);

  useEffect(() => {
    if (!hash || !receipt.isError || !receipt.error) return;
    lock.current = false;
    setState({ status: "failed", label: state.label, hash, message: receipt.error.message });
  }, [hash, receipt.isError, receipt.error, state.label]);

  const execute = useCallback(async (label: string, request: unknown) => {
    if (lock.current) return;
    const eligibility = transactionEligibility(contextRef.current);
    if (!eligibility.eligible) {
      setState({ status: "failed", label, message: eligibility.reason });
      return;
    }
    lock.current = true;
    handledHash.current = undefined;
    setHash(undefined);
    setState({ status: "requesting", label, message: "Review the request in your wallet. No transaction is sent until you approve it." });
    try {
      const transactionHash = await writeContractAsync(request as never);
      setHash(transactionHash);
      setState({ status: "pending", label, hash: transactionHash, message: "Wallet approved the request. Waiting for on-chain confirmation…" });
    } catch (error) {
      lock.current = false;
      setState({
        status: walletRejected(error) ? "rejected" : "failed",
        label,
        message: error instanceof Error ? error.message : "The wallet could not submit this transaction.",
      });
    }
  }, [writeContractAsync]);

  const reset = useCallback(() => {
    if (lock.current) return;
    setHash(undefined);
    handledHash.current = undefined;
    setState({ status: "idle" });
  }, []);

  return { state, execute, reset, isBusy: lock.current || state.status === "requesting" || state.status === "pending" || state.status === "refreshing" };
}
