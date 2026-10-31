# Quickstart

See [README.md](README.md) for architecture, security behavior, deployment status, demo requirements, and buildathon limitations.

## Local app

Requirements: Node.js 18.18+ and npm.

```sh
npm install
npm run --workspace frontend dev
```

Open http://localhost:3000. Contract tests use a local Hardhat network and do not need a wallet key:

```sh
npm run --workspace contracts test
npm run --workspace contracts compile
node packages/frontend/e2e/rpcProxyGuard.test.cjs
npm run test:e2e
npx tsc --noEmit -p packages/frontend/tsconfig.json
npm run lint
npm run --workspace frontend build
```

The browser E2E command compiles and deploys PatchPool to a disposable local Hardhat chain, then starts the frontend in a development-only local mode. The latest run passed five Playwright scenarios: full lifecycle, wallet-free public browsing, marketplace RPC failure and retry, the guarded local deployment tool, and desktop/mobile hierarchy, overflow, and keyboard focus. Desktop and mobile screenshots are written under `/tmp`. The tests use disposable local Hardhat accounts only; the runner redacts their keys. Local mode is labeled “NOT MST” and excluded from production.

## Deployment status and safety

MST Mainnet (chain `4646`) is the sole production target. The verified PatchPool deployment is finalized in the active registry at block `21783933`; its transaction is [0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec). Mainnet writes are enabled in the frontend and require BridgeKey plus normal wallet confirmation. The historical Legacy Testnet deployment remains recorded separately with its own chain ID.

Never put wallet credentials in `.env.local` or chat. Hardhat ignores `MST_MAINNET_PRIVATE_KEY` from dotenv files; supply it only through a hidden terminal prompt in the current shell. For a fresh read-only preflight in Bash:

```sh
read -rsp "MST Mainnet private key: " MST_MAINNET_PRIVATE_KEY
printf '\n'
export MST_MAINNET_PRIVATE_KEY
npm run --workspace contracts preflight:mainnet
unset MST_MAINNET_PRIVATE_KEY
```

The preflight is read-only and does not sign or send a transaction. Its balance and estimate are time-sensitive. A new deployment still requires separate explicit approval before broadcast. Creating or funding a bounty also requires a separate wallet transaction approval.
