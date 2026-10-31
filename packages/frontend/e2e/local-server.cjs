const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { createServer } = require("node:net");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { ContractFactory, JsonRpcProvider, keccak256 } = require("ethers");

const root = path.resolve(__dirname, "../../..");
const contracts = path.join(root, "packages/contracts");
const frontend = path.join(root, "packages/frontend");
const hardhatBin = path.join(root, "node_modules/.bin/hardhat");
const nextBin = path.join(root, "node_modules/.bin/next");
const rpcUrl = "http://127.0.0.1:18545";
const appUrl = "http://127.0.0.1:3017";
const env = { ...process.env, PATCHPOOL_SKIP_DOTENV: "true", NEXT_TELEMETRY_DISABLED: "1" };
let nodeProcess;
let nextProcess;
let fatalError;

function run(file, args, cwd, environment = env) {
  const result = spawnSync(file, args, { cwd, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(file)} ${args.join(" ")} exited with ${result.status}`);
}

async function assertLoopbackBindingAvailable() {
  try {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => probe.close((error) => error ? reject(error) : resolve()));
    });
  } catch (error) {
    const reason = error instanceof Error ? `${error.code ?? "error"}: ${error.message}` : "unknown socket error";
    throw new Error(`Local E2E requires permission to bind a loopback TCP port, but the environment denied it (${reason}). Re-run with localhost binding permitted; do not change the RPC host or weaken the test.`);
  }
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `RPC ${method} failed`);
  return payload.result;
}

async function waitFor(check, name, child, getStartupOutput = () => "") {
  let lastError;
  for (let attempts = 0; attempts < 80; attempts += 1) {
    if (child?.spawnError) throw new Error(`${name} could not start: ${child.spawnError.message}${getStartupOutput()}`);
    if (child?.startupFailure) throw new Error(`${name} reported a fatal startup error: ${child.startupFailure}${getStartupOutput()}`);
    const exited = child && (
      (child.exitCode !== null && child.exitCode !== undefined) ||
      (child.signalCode !== null && child.signalCode !== undefined)
    );
    if (exited) {
      if (!child.closed) await new Promise((resolve) => child.once("close", resolve));
      await new Promise((resolve) => setImmediate(resolve));
      const reason = child.signalCode ? `signal ${child.signalCode}` : `code ${child.exitCode}`;
      throw new Error(`${name} exited with ${reason} before becoming ready.${getStartupOutput()}`);
    }
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  const detail = lastError instanceof Error ? ` Last readiness error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${name}.${detail}${getStartupOutput()}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3000).then(() => child.kill("SIGKILL")),
  ]);
}

async function main() {
  await assertLoopbackBindingAvailable();
  run(hardhatBin, ["compile"], contracts);

  // Redact deterministic local test keys before printing or retaining startup diagnostics.
  let nodeReady = false;
  const nodeStartupOutput = [];
  const startupDetails = () => nodeStartupOutput.length ? `\nHardhat output:\n${nodeStartupOutput.join("")}` : "";
  nodeProcess = spawn(hardhatBin, ["node", "--hostname", "127.0.0.1", "--port", "18545"], {
    cwd: contracts,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const redactLocalKeys = (data) => {
    const safeOutput = String(data).replace(/0x[a-fA-F0-9]{64}/g, "[local test key redacted]");
    process.stderr.write(safeOutput);
    const bindFailure = safeOutput.match(/listen\s+(EPERM|EACCES|EADDRINUSE|EADDRNOTAVAIL)|(?:EACCES|EADDRINUSE|EADDRNOTAVAIL|EPERM).*?(?:listen|bind)/i);
    if (bindFailure) nodeProcess.startupFailure = bindFailure[0];
    if (!nodeReady) {
      nodeStartupOutput.push(safeOutput);
      while (nodeStartupOutput.join("").length > 4000) nodeStartupOutput.shift();
    }
  };
  nodeProcess.stdout.on("data", redactLocalKeys);
  nodeProcess.stderr.on("data", redactLocalKeys);
  nodeProcess.on("error", (error) => { nodeProcess.spawnError = error; });
  await waitFor(async () => {
    const chainId = await rpc("eth_chainId");
    return chainId === "0x7a69";
  }, "the isolated Hardhat node", nodeProcess, startupDetails);
  nodeReady = true;

  const provider = new JsonRpcProvider(rpcUrl);
  const [deployerAddress] = await provider.send("eth_accounts", []);
  if (!deployerAddress) throw new Error("Hardhat did not expose a local test account");
  const artifactPath = path.join(contracts, "artifacts/contracts/PatchPool.sol/PatchPool.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, await provider.getSigner(deployerAddress));
  const contract = await factory.deploy();
  const transaction = contract.deploymentTransaction();
  if (!transaction) throw new Error("Local deployment transaction was not created");
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Local PatchPool deployment failed");
  const address = await contract.getAddress();
  const deployedCode = await provider.getCode(address);
  const artifactHash = keccak256(artifact.deployedBytecode);
  if (keccak256(deployedCode) !== artifactHash) throw new Error("Local deployed bytecode does not match the compiled artifact");
  await provider.destroy();

  const appEnv = {
    ...env,
    NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E: "true",
    NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_ADDRESS: address,
    NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_DEPLOYMENT_TX: transaction.hash,
    NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_DEPLOYMENT_BLOCK: String(receipt.blockNumber),
    NEXT_PUBLIC_PATCHPOOL_LOCAL_E2E_BYTECODE_HASH: artifactHash,
    PORT: "3017",
  };
  nextProcess = spawn(nextBin, ["dev", "--hostname", "127.0.0.1", "--port", "3017"], {
    cwd: frontend,
    env: appEnv,
    stdio: "inherit",
  });
  await waitFor(async () => {
    const response = await fetch(appUrl);
    return response.ok;
  }, "the local PatchPool frontend", nextProcess);

  run(path.join(root, "node_modules/.bin/playwright"), ["test", "--config", "e2e/playwright.config.ts"], frontend, {
    ...appEnv,
    PATCHPOOL_E2E_RPC_URL: rpcUrl,
  });
}

main()
  .catch((error) => {
    fatalError = error;
    console.error(error instanceof Error ? error.message : "Browser end-to-end run failed");
  })
  .finally(async () => {
    await stop(nextProcess);
    await stop(nodeProcess);
    if (fatalError) process.exitCode = 1;
  });
