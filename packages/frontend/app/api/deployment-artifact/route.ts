import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contractsRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "../contracts"),
    path.resolve(process.cwd(), "packages/contracts"),
  ];
  const root = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "artifacts/contracts/PatchPool.sol/PatchPool.json")),
  );
  if (!root) throw new Error("Compile PatchPool before opening the local deployment tool.");
  return root;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "The local deployment tool is unavailable in production." }, { status: 404 });
  }
  const rawHost = request.headers.get("host") ?? "";
  const host = rawHost.startsWith("[")
    ? rawHost.slice(1, rawHost.indexOf("]")).toLowerCase()
    : rawHost.split(":")[0].toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
    return NextResponse.json({ error: "The deployment artifact is available only over localhost." }, { status: 404 });
  }

  try {
    const root = contractsRoot();
    const artifactPath = path.join(root, "artifacts/contracts/PatchPool.sol/PatchPool.json");
    const sourcePath = path.join(root, "contracts/PatchPool.sol");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
      contractName: string;
      sourceName: string;
      abi: unknown[];
      bytecode: string;
      deployedBytecode: string;
    };
    if (artifact.contractName !== "PatchPool" || artifact.sourceName !== "contracts/PatchPool.sol") {
      throw new Error("The compiled artifact is not the expected PatchPool contract.");
    }

    const pendingPath = path.join(root, "pending-deployments.json");
    const pending = fs.existsSync(pendingPath)
      ? JSON.parse(fs.readFileSync(pendingPath, "utf8")) as { testnet?: Array<{ status?: string }> }
      : {};
    const testnetRecords = pending.testnet ?? [];
    const latest = testnetRecords[testnetRecords.length - 1];

    return NextResponse.json({
      contractName: artifact.contractName,
      sourceName: artifact.sourceName,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      deployedBytecode: artifact.deployedBytecode,
      patchPoolSourceSha256: createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
      canCreatePendingRecord: !latest || latest.status === "finalized",
      latestPendingStatus: latest?.status ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the compiled PatchPool artifact." },
      { status: 503 },
    );
  }
}
