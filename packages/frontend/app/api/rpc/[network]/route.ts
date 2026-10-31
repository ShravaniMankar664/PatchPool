import { NextRequest, NextResponse } from "next/server";
import { MST_NETWORKS } from "patchpool-shared";
import {
  readBoundedRequestBody,
  readBoundedResponseBody,
  validateRpcPayload,
} from "@/lib/rpcProxyGuard.js";

/**
 * Bounded same-origin proxy for allowlisted read-only MST JSON-RPC calls.
 *
 * The deprecated MST Legacy Testnet RPC (testnetrpc.mstblockchain.com) doesn't send
 * Access-Control-Allow-Origin headers, so a browser calling it directly via
 * fetch — which is what wagmi's public client does for every contract read
 * — gets blocked by CORS before the request even reaches it (MST Mainnet's
 * RPC does set these headers correctly; this is a testnet-only gap).
 * Wallet-signed writes are unaffected since those go through the wallet
 * extension's own provider, not a page-level fetch. Transaction broadcast,
 * signing, and administrative methods are rejected before reaching upstream.
 *
 * Routing reads through this same-origin Next.js route handler sidesteps
 * the problem: the browser only ever talks to same-origin /api/rpc/*, and
 * this server-side handler — not bound by CORS — forwards to the real RPC.
 */
const RPC_URLS: Record<string, string> = {
  testnet: MST_NETWORKS.legacyTestnet.rpcUrl,
  mainnet: MST_NETWORKS.mainnet.rpcUrl,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const target = RPC_URLS[network];
  if (!target) {
    return NextResponse.json({ error: `Unknown network "${network}"` }, { status: 400 });
  }

  let body: string;
  try {
    body = await readBoundedRequestBody(request);
    validateRpcPayload(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid JSON-RPC request." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    let data: string;
    try {
      data = await readBoundedResponseBody(upstream);
    } catch {
      return NextResponse.json({ error: "MST RPC response exceeded the proxy limit." }, { status: 502 });
    }
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    console.error("MST RPC proxy request failed:", error);

    return NextResponse.json(
      { error: timedOut ? "MST RPC request timed out. Please retry." : "Unable to reach MST RPC. Please retry." },
      { status: 504 },
    );
  }
}
