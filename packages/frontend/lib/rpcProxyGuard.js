const MAX_RPC_BODY_BYTES = 256 * 1024;
const MAX_RPC_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_RPC_BATCH_ITEMS = 20;

const READ_ONLY_RPC_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_estimateGas",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);

function validateRpcPayload(body) {
  if (Buffer.byteLength(body, "utf8") > MAX_RPC_BODY_BYTES) {
    throw new Error("JSON-RPC request body is too large.");
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }

  const requests = Array.isArray(payload) ? payload : [payload];
  if (requests.length === 0 || requests.length > MAX_RPC_BATCH_ITEMS) {
    throw new Error(`JSON-RPC batches must contain between 1 and ${MAX_RPC_BATCH_ITEMS} requests.`);
  }

  for (const request of requests) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error("Each JSON-RPC request must be an object.");
    }
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      throw new Error("Each request must use JSON-RPC 2.0 and include a method.");
    }
    if (!READ_ONLY_RPC_METHODS.has(request.method)) {
      throw new Error(`JSON-RPC method is not available through this read-only proxy: ${request.method}`);
    }
    if (!Object.prototype.hasOwnProperty.call(request, "id") ||
        !(request.id === null || typeof request.id === "string" || typeof request.id === "number")) {
      throw new Error("Each JSON-RPC request must include a scalar id.");
    }
    if (request.params !== undefined && !Array.isArray(request.params)) {
      throw new Error("JSON-RPC params must be a positional array.");
    }
  }

  return payload;
}

async function readBoundedStream(stream, maxBytes, errorMessage) {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(errorMessage);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readBoundedRequestBody(request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RPC_BODY_BYTES) {
    throw new Error("JSON-RPC request body is too large.");
  }
  return readBoundedStream(request.body, MAX_RPC_BODY_BYTES, "JSON-RPC request body is too large.");
}

async function readBoundedResponseBody(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RPC_RESPONSE_BYTES) {
    throw new Error("MST RPC response is too large.");
  }
  return readBoundedStream(response.body, MAX_RPC_RESPONSE_BYTES, "MST RPC response is too large.");
}

module.exports = {
  MAX_RPC_BODY_BYTES,
  MAX_RPC_RESPONSE_BYTES,
  MAX_RPC_BATCH_ITEMS,
  readBoundedRequestBody,
  readBoundedResponseBody,
  validateRpcPayload,
};
