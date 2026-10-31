import fs from "fs";
import path from "path";
import { assertDeploymentCanBeActivated, assertPendingSlotAvailable } from "./deploymentSafety";
import { assertDeploymentNetworkConfigured } from "../../../shared/src/networks";

export type ContractDeployment = {
  address: string;
  abi: unknown;
  constructorArguments: unknown[];
  deploymentTransactionHash: string;
  deploymentBlock: number;
  deploymentBytecodeHash: string;
};

export type PendingDeployment = {
  network: "testnet" | "mainnet";
  chainId: number;
  status: "pending_verification" | "verification_failed" | "verified" | "finalized";
  recordedAt: string;
  deployerAddress?: string;
  verifiedAt?: string;
  verifiedContracts?: string[];
  verificationError?: string;
  patchPoolSourceSha256: string;
  contracts: Record<string, ContractDeployment>;
};

type PendingDeployments = Record<string, PendingDeployment[]>;
type ActiveDeployments = Record<string, Record<string, ContractDeployment>>;

const DEPLOYMENTS_JSON = path.join(__dirname, "..", "..", "deployments.json");
const PENDING_DEPLOYMENTS_JSON = path.join(__dirname, "..", "..", "pending-deployments.json");
const SHARED_CONTRACTS_TS = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "shared",
  "src",
  "contracts.ts"
);

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporaryPath, filePath);
}

export function getPendingDeployments(): PendingDeployments {
  return readJson<PendingDeployments>(PENDING_DEPLOYMENTS_JSON, {});
}

export function getLatestPendingDeployment(network: "testnet" | "mainnet"): PendingDeployment | undefined {
  const records = getPendingDeployments()[network] ?? [];
  return records[records.length - 1];
}

export function assertNoUnresolvedDeployment(network: "testnet" | "mainnet"): void {
  const latest = getLatestPendingDeployment(network);
  if (latest && latest.status !== "finalized") {
    throw new Error(
      `A ${network} deployment is already ${latest.status} (${latest.contracts.PatchPool?.deploymentTransactionHash ?? "transaction unavailable"}). Resolve or finalize it before deploying again.`
    );
  }
  const writablePath = fs.existsSync(PENDING_DEPLOYMENTS_JSON)
    ? PENDING_DEPLOYMENTS_JSON
    : path.dirname(PENDING_DEPLOYMENTS_JSON);
  fs.accessSync(writablePath, fs.constants.W_OK);
}

export function recordPendingDeployment(record: PendingDeployment): void {
  if (record.network !== "testnet" && record.network !== "mainnet") {
    throw new Error("Only explicit MST Testnet or Mainnet deployments can be recorded.");
  }
  assertDeploymentNetworkConfigured(record.network);
  if (!record.contracts.PatchPool) throw new Error("Pending deployment must contain PatchPool.");

  const all = getPendingDeployments();
  const list = all[record.network] ?? [];
  assertPendingSlotAvailable(record.network, list[list.length - 1]);

  all[record.network] = [...list, record];
  writeJsonAtomically(PENDING_DEPLOYMENTS_JSON, all);
}

export function updatePendingDeployment(
  network: "testnet" | "mainnet",
  transactionHash: string,
  update: (record: PendingDeployment) => PendingDeployment
): PendingDeployment {
  const all = getPendingDeployments();
  const list = all[network] ?? [];
  const index = list.findIndex(
    (record) => record.contracts.PatchPool?.deploymentTransactionHash.toLowerCase() === transactionHash.toLowerCase()
  );
  if (index < 0) throw new Error(`No pending ${network} deployment matches transaction ${transactionHash}.`);

  const updated = update(list[index]);
  all[network] = list.map((record, itemIndex) => (itemIndex === index ? updated : record));
  writeJsonAtomically(PENDING_DEPLOYMENTS_JSON, all);
  return updated;
}

export function getActiveDeployments(): ActiveDeployments {
  return readJson<ActiveDeployments>(DEPLOYMENTS_JSON, {});
}

export function writeVerifiedDeploymentToRegistry(record: PendingDeployment): void {
  const all = getActiveDeployments();
  assertDeploymentCanBeActivated(
    record,
    record.network,
    record.chainId,
    all[record.network]?.PatchPool
  );
  all[record.network] = { ...(all[record.network] ?? {}), ...record.contracts };
  writeJsonAtomically(DEPLOYMENTS_JSON, all);

  const temporaryPath = `${SHARED_CONTRACTS_TS}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    `// Auto-generated only by the explicit finalize step after MSTScan verification.\n// Do not edit by hand.\n\nexport const deployments = ${JSON.stringify(all, null, 2)} as const;\n\nexport type NetworkName = keyof typeof deployments;\n`,
    { flag: "wx" }
  );
  fs.renameSync(temporaryPath, SHARED_CONTRACTS_TS);
}
