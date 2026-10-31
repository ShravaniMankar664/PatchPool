const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_RPC_BATCH_ITEMS,
  MAX_RPC_BODY_BYTES,
  MAX_RPC_RESPONSE_BYTES,
  readBoundedRequestBody,
  readBoundedResponseBody,
  validateRpcPayload,
} = require("../lib/rpcProxyGuard.js");

test("accepts supported read-only methods and bounded batches", () => {
  const payload = [
    { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
    { jsonrpc: "2.0", id: "read", method: "eth_getBlockByNumber", params: ["latest", false] },
    { jsonrpc: "2.0", id: 3, method: "eth_call", params: [{ to: "0x0000000000000000000000000000000000000001", data: "0x" }, "latest"] },
    { jsonrpc: "2.0", id: 4, method: "eth_estimateGas", params: [{ from: "0x0000000000000000000000000000000000000001", data: "0x6000" }] },
  ];
  assert.deepEqual(validateRpcPayload(JSON.stringify(payload)), payload);
});

test("rejects transaction broadcast, signing, and unknown RPC methods", () => {
  for (const method of ["eth_sendTransaction", "eth_sendRawTransaction", "personal_sign", "admin_nodeInfo"]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] });
    assert.throws(() => validateRpcPayload(body), /not available through this read-only proxy/);
  }
});

test("rejects malformed requests, notifications, named params, and oversized batches", () => {
  assert.throws(() => validateRpcPayload("{"), /valid JSON/);
  assert.throws(() => validateRpcPayload(JSON.stringify({ method: "eth_chainId", id: 1 })), /JSON-RPC 2.0/);
  assert.throws(() => validateRpcPayload(JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [] })), /scalar id/);
  assert.throws(() => validateRpcPayload(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: {} })), /positional array/);
  assert.throws(() => validateRpcPayload(JSON.stringify(Array(MAX_RPC_BATCH_ITEMS + 1).fill({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }))), /batches must contain/);
  assert.throws(() => validateRpcPayload("x".repeat(MAX_RPC_BODY_BYTES + 1)), /too large/);
});

test("bounds both streamed request and upstream response bodies", async () => {
  const requestBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
  const request = new Request("https://patchpool.invalid/api/rpc/testnet", {
    method: "POST",
    body: requestBody,
    headers: { "content-type": "application/json" },
  });
  assert.equal(await readBoundedRequestBody(request), requestBody);
  const oversizedRequest = new Request("https://patchpool.invalid/api/rpc/testnet", {
    method: "POST",
    body: "x".repeat(MAX_RPC_BODY_BYTES + 1),
  });
  await assert.rejects(readBoundedRequestBody(oversizedRequest), /too large/);

  const response = new Response("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":\"0x1\"}");
  assert.match(await readBoundedResponseBody(response), /0x1/);
  const oversizedResponse = new Response("x".repeat(MAX_RPC_RESPONSE_BYTES + 1));
  await assert.rejects(readBoundedResponseBody(oversizedResponse), /too large/);
});
