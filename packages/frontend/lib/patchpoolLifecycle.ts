export type LifecycleBounty = {
  reviewer: string;
  sponsor: string;
  status: number;
  submissionDeadline: bigint;
  settlementDeadline: bigint;
  approvedSubmissionId: bigint;
  myContribution: bigint;
};

export type LifecycleSubmission = {
  id: bigint;
  rejected: boolean;
};

export type Eligibility = { eligible: true } | { eligible: false; reason: string };

export function transactionEligibility(input: {
  connected: boolean;
  address?: string;
  authorizedWallet: boolean;
  supportedNetwork: boolean;
  writesEnabled: boolean;
}): Eligibility {
  if (!input.connected || !input.address) return { eligible: false, reason: "Connect BridgeKey before submitting a transaction." };
  if (!input.authorizedWallet) return { eligible: false, reason: "This action requires the identified BridgeKey provider." };
  if (!input.supportedNetwork) return { eligible: false, reason: "Switch to MST Mainnet (chain 4646) to transact." };
  if (!input.writesEnabled) return { eligible: false, reason: "PatchPool transactions are disabled for this network." };
  return { eligible: true };
}

export function submissionEligibility(input: {
  bounty: LifecycleBounty;
  address?: string;
  connected: boolean;
  authorizedWallet: boolean;
  supportedNetwork: boolean;
  writesEnabled: boolean;
  blockTime?: bigint;
}): Eligibility {
  const { bounty, address, connected, authorizedWallet, supportedNetwork, writesEnabled, blockTime } = input;
  if (!connected || !address) return { eligible: false, reason: "Connect the supported wallet to check submission eligibility." };
  if (!supportedNetwork) return { eligible: false, reason: "Switch to MST Mainnet (chain 4646) to submit." };
  if (address.toLowerCase() === bounty.reviewer.toLowerCase()) return { eligible: false, reason: "The assigned reviewer cannot submit work for this bounty." };
  if (bounty.myContribution > BigInt(0)) return { eligible: false, reason: "The creator and contributors cannot submit work for this bounty; use a separate wallet address." };
  if (!writesEnabled || !authorizedWallet) return { eligible: false, reason: "Submission is unavailable for this wallet or network." };
  if (!blockTime) return { eligible: false, reason: "Waiting for the selected network’s current block time." };
  if (bounty.status !== 0) return { eligible: false, reason: "This bounty is no longer open for submissions." };
  if (blockTime > bounty.submissionDeadline) return { eligible: false, reason: "The on-chain submission deadline has passed." };
  return { eligible: true };
}

export function reviewEligibility(input: {
  bounty: LifecycleBounty;
  submission: LifecycleSubmission;
  address?: string;
  connected: boolean;
  authorizedWallet: boolean;
  supportedNetwork: boolean;
  writesEnabled: boolean;
  blockTime?: bigint;
}): Eligibility {
  const { bounty, submission, address, authorizedWallet, writesEnabled, blockTime } = input;
  if (!address || address.toLowerCase() !== bounty.reviewer.toLowerCase()) return { eligible: false, reason: "Only the assigned reviewer can decide this submission." };
  const transaction = transactionEligibility(input);
  if (!transaction.eligible) return transaction;
  if (!blockTime) return { eligible: false, reason: "Waiting for the selected network’s current block time." };
  if (bounty.status !== 0) return { eligible: false, reason: "This bounty is no longer awaiting a review decision." };
  if (blockTime > bounty.settlementDeadline) return { eligible: false, reason: "The on-chain review deadline has passed." };
  if (submission.rejected) return { eligible: false, reason: "This submission has already been rejected." };
  return { eligible: true };
}

export function submissionStatus(bounty: LifecycleBounty, submission: LifecycleSubmission) {
  if (bounty.approvedSubmissionId === submission.id) return bounty.status === 2 ? "Paid" : bounty.status === 1 ? "Approved · payout pending" : "Approved";
  if (submission.rejected) return "Rejected";
  return "Awaiting review";
}
