# PatchPool

**Fix Bugs. Earn Rewards. Trust the Process.**

Technical tagline: **Fund the Fix. Lock the Commit. Release the Reward.**

PatchPool connects funded software-fix bounties to an identified code submission, an evidence digest, a reviewer decision, and contract-governed settlement. It is deployed and source-verified on MST Mainnet, but has not received an independent security audit; live BridgeKey signing and bounty transactions remain unverified. Treat it as a buildathon MVP, not an audited financial product.

## Problem and solution

Open-source maintainers, developers, organizations, and Web3 projects coordinate bug reports, code review, and reward payments across disconnected tools. PatchPool lets multiple sponsors fund one bounty, records task terms and submission commitments, restricts review to the assigned reviewer, and records payout or eligible refunds on-chain.

A task board can record a task, but does not itself hold the reward or enforce the configured authorization and settlement conditions. PatchPool makes those conditions inspectable and enforceable by the contract. It does not prove code correctness: a human reviewer still evaluates the commit and evidence.

## Startup hypothesis

The initial customer hypothesis is maintainers, developer communities, and organizations that need a bounty to remain escrowed until a named reviewer accepts a specific code submission. A possible business model to validate is a small fee on successfully settled bounties, with optional organization reporting or workflow features. These are future hypotheses, not current revenue, customer commitments, or implemented billing. PatchPool's distinction is the programmable link between funding, the reviewed submission identity, and its payout recipient; it does not claim other bounty platforms lack all escrow or review features.

## What the contract guarantees / What it does not

**It guarantees:** contract escrow, address-level role separation, recorded reviewer decisions, payout to the approved submission's recorded payee, and refunds only when each contributor is eligible under the contract's expiry rules. The bounty creator and every funder cannot submit work or receive its payout; the assigned reviewer cannot fund, submit, or receive a payout. Submission participants also cannot later fund that bounty.

**It does not:** judge code quality, run tests, verify off-chain evidence, or ensure reviewer impartiality. Evidence files stay off-chain. A matching digest can identify unchanged bytes; it cannot prove code correctness or truthful evidence. One reviewer makes the decision; there is no quorum or dispute system. Refunds are neither automatic nor immediate: contributors claim individually after the settlement deadline plus the seven-day grace period.

These rules separate wallet addresses, not real-world identities: one person can control multiple addresses. They do not provide identity verification or prevent coordination across wallets.

## Current implementation and status

- Solidity `PatchPool` contract with a creator's initial escrow contribution, additional per-wallet contributions to that same bounty, submissions, a single assigned reviewer, approved-submission tracking, aggregate release, and individual expired-contribution refunds.
- Next.js/React TypeScript frontend with Wagmi/Viem, BridgeKey-gated wallet connection, MST network configuration, public bounty reads, lifecycle forms, and transaction receipt states. Production writes require BridgeKey and MST Mainnet chain `4646`.
- Git commit IDs are normalized and stored on-chain exactly: SHA-1 IDs are zero-padded into `bytes32`, while SHA-256 IDs use all 32 bytes; a type flag keeps the formats distinct for duplicate detection. Evidence digests are submitted as 32-byte SHA-256 values. These identify data but do not prove correctness.
- Reviewers can select an evidence file in the browser and compare its SHA-256 digest to the submitted on-chain digest. The file is not uploaded; a match only confirms byte integrity. Shared funding is implemented in the current contract source: contribution amounts are tracked per wallet, summed into the reward, and refundable individually after expiry.
- Readable task title and description are published as a `BountyMetadata` event with a 16 KiB UTF-8 limit. The contract requires the exact JSON bytes to match the bounty's Keccak-256 task hash; clients can discover the description from chain logs and verify the commitment. Event data is public and permanent: do not include secrets, personal information, or confidential code. Older deployments do not emit this event.
- The contract source prohibits sponsor refunds once a bounty leaves `Open`. The historical Legacy Testnet deployment predates that fix and remains read-only. The corrected deployment is verified on MST Mainnet and registered separately.
- MST Mainnet (chain ID `4646`) is the only production network. The verified deployment is `0x707004013b56e36eE458966d928539ede6166338` at block `21783933`, transaction [`0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec) ([contract on MSTScan](https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338)). The preserved Legacy Testnet record (chain ID `91562037`, contract `0x707004013b56e36ee458966d928539ede6166338`, transaction `0x132a1fd81bcc31febcd1830441706dd545075ae764636e9ddb7281ac938677c0`, block `6679982`) remains historical and is not offered as a production network. The same address text exists in both records; each belongs to its own chain.
- Development-only local Hardhat mode covers the full lifecycle with disposable accounts. The latest Playwright run passed five scenarios: lifecycle, wallet-free browsing, marketplace RPC failure/retry, guarded deployment tooling, and desktop/mobile layout checks. This is local EVM evidence only, not MST activity, and local E2E is not enabled in production.
- Reviewer quorum, evidence file hosting, per-submission GitHub test attestations, dispute handling, and indexing are not implemented. Shared-funding behavior is included in the verified Mainnet contract and covered by local contract tests; a live bounty flow remains to be demonstrated. A local repository CI workflow is configured, but no hosted CI run exists until the repository is published.
- On 30 October 2026, the current-source contract suite passed 62 tests, including strict address-level role separation, shared contribution accounting, and adversarial reentrancy attempts on payout and refunds. The local Playwright lifecycle and responsive checks passed on local Hardhat only. The production build succeeds with optional MetaMask async-storage and `pino-pretty` module warnings from Wagmi's connector barrel; see `docs/SECURITY_AND_LIMITATIONS.md` for scope and disposition.
- Read-only deployment verification and RPC observations are recorded in [Deployment Status](docs/DEPLOYMENT_STATUS.md); current local test evidence and security limits are in [Security and Limitations](docs/SECURITY_AND_LIMITATIONS.md). Browser E2E checks use only a disposable local Hardhat chain and do not verify BridgeKey signing or MST transactions.
- `npm run typecheck:deployment` checks the deployment pipeline. The optional whole-contracts TypeScript check still reports `BaseContract` missing dynamically loaded methods in the existing Hardhat test files; this is a Hardhat/TypeChain typing limitation, while the actual Hardhat test runner executes the tests successfully.

## Buildathon submission materials

The copy-ready overview, Google Form answers, Unstop draft, local demo script, presentation, and final submission checklist are in [`submission/`](submission/). The source is prepared on the public `publish/patchpool-source` review branch; `main` remains unchanged until the pull request is reviewed and merged. No hosted frontend or demo video URL is confirmed. Do not present local E2E output as Mainnet activity.

## Architecture and stack

- Solidity 0.8.20, OpenZeppelin ReentrancyGuard, Hardhat, ethers, and Chai tests.
- Next.js 15.5.28, React 18, TypeScript, Wagmi 2.19.5, Viem, and TanStack Query.
- MST Mainnet: production target chain ID `4646`, RPC `https://mariorpc.mstblockchain.com`, currency `MSTC`, explorer `https://mstscan.com`. The active registry contains the verified deployment at block `21783933`.
- MST Legacy Testnet (`91562037`) appears only as a historical deployment record with its original address, transaction, and block. Coral Testnet and all other test networks are not production options.
- The browser uses a bounded same-origin JSON-RPC proxy that forwards only allowlisted read methods. Bounty reads paginate 20 records at a time, submission reads cap at the latest 10 per bounty, and event scans page through 2,000-block ranges. Production wallet selection requires a provider identified as BridgeKey; the local E2E test connector is available only in non-production local mode. BridgeKey connection/signing has not been verified.
- The project-prepared ideation brief, based on the publicly listed idea-submission fields, is in [docs/PROJECT_IDEATION.md](docs/PROJECT_IDEATION.md). It is not an organizer-provided template.
- Product scope and submission requirements are summarized in the [buildathon submission draft](docs/BUILDATHON_SUBMISSION.md) and [submission package](docs/SUBMISSION_PACKAGE.md). No customer validation or traction is claimed.
- Implementation-grounded answers to common judge questions are in [docs/JUDGE_QA.md](docs/JUDGE_QA.md).

## Local setup and checks

Use Node.js 18.18 or newer and npm. Install dependencies from the repository root with `npm install`, then start the frontend with `npm run --workspace frontend dev` (http://localhost:3000). Contract tests use the local Hardhat network and do not require wallet credentials.

```sh
npm run --workspace contracts test
npm run --workspace contracts compile
node packages/frontend/e2e/rpcProxyGuard.test.cjs
npm run test:e2e
npm run typecheck:deployment
npx tsc --noEmit -p packages/frontend/tsconfig.json
npm run lint
npm run --workspace frontend build
```

`npm run typecheck:deployment` checks deployment scripts; use the direct TypeScript command above for the frontend. There is no whole-contract test type-check script because Hardhat's dynamically typed contract methods fail ordinary `tsc`. `npm run lint` runs frontend ESLint and Solhint; existing Solhint warnings may be reported.

`npm run test:e2e` starts a disposable local Hardhat chain, deploys the compiled contract, injects a test-only EIP-1193 provider into headless Chromium, and checks funding, submission, review, payment, eligible refunds, evidence-digest comparison, wallet-free browsing, RPC failure/retry handling, guarded deployment tooling, and responsive keyboard behavior. The latest run passed all five browser scenarios; desktop/mobile screenshots are saved under `/tmp`. The run never targets MST and does not enable local mode in production builds.

The JSON-RPC proxy guard tests can run without a browser: `node packages/frontend/e2e/rpcProxyGuard.test.cjs` (4 passing). On 29 October 2026, the full-tree audit reported 74 findings (24 high, 31 moderate, 19 low, no critical). A fresh production-tree `npm audit --omit=dev` on 30 October reported 30 (18 high, 12 moderate, no critical); the full tree was not refreshed. PostCSS and wallet connector advisories remain, and npm recommends major-version upgrades for the listed fixes. See [security limitations](docs/SECURITY_AND_LIMITATIONS.md); no dependency changes were made. The current root lint exits successfully with 50 Solhint warnings and no errors.

## Contract lifecycle and security assumptions

1. Bounty creator funds a bounty with native MSTC, selects a reviewer, and commits to task metadata with Keccak-256. The creator is recorded as a contributor.
2. Developer submits the exact Git object ID (SHA-1 or SHA-256), SHA-256 evidence digest, and payee address before the submission deadline.
3. Only the assigned reviewer can approve or reject a submission through the settlement deadline. The reviewer cannot fund or submit for the bounty. Creators and contributors cannot submit or be named as the payout recipient. Approval records one submission ID and closes submissions.
4. Anyone can call reward release after approval; it does not expire. Funds go to the payee recorded in the approved submission.
5. Each contributor can claim only their own refund after the settlement deadline plus seven days. Approved and paid bounties cannot be refunded; a partially refunded pool remains `Refunding` until all contribution claims are complete.

The contract uses checks-effects-interactions and a reentrancy guard around transfers. The contract does not edit or validate code, fetch evidence, or ensure a reviewer is impartial. The reviewer can reject submissions without an appeal mechanism. A bounty may have multiple contributors but still has one assigned reviewer. A failed payout or refund transfer reverts the state change, allowing a later retry.

## Deployment procedure

Mainnet deployment requires a separately authorized signer and normal wallet confirmation. Never place wallet credentials in a repository file or chat. Network-specific pending records, verification, and explicit finalization remain separate; finalization never enables frontend writes.

The guarded verification/finalization sequence checks each pending deployment's chain ID, receipt, deployed runtime bytecode, and source/artifact identity before updating that network's active ABI/address entries. The current Mainnet deployment is verified and finalized; only the Mainnet frontend write gate is enabled. Legacy Testnet writes remain disabled. Finalization itself does not change frontend write gates.

Mainnet source verification uses the installed Hardhat Blockscout task against chain `4646` at `https://mstscan.com/api` (browser: `https://mstscan.com`); it does not require `MSTSCAN_API_KEY`. The optional key in `.env.local` is only for the preserved Legacy Testnet Etherscan-compatible verification route.

The verified Mainnet deployment is finalized. No bounty has been created or funded through this project flow. BridgeKey signing still needs a live check; each bounty action requires a separate wallet transaction approval.

## Mainnet demo procedure (only after verified deployment)

Prerequisites: the verified PatchPool Mainnet deployment, a live BridgeKey wallet/signing check, and distinct sponsor, contributor/payee, and reviewer wallets. Use a fourth wallet for the second sponsor. No bounty flow is claimed as completed; create genuine low-value activity only with separate approval.

1. On MST Mainnet (chain `4646`), sponsor one creates a genuine low-value bounty. Show the confirmed transaction and escrow balance.
2. Sponsor two funds the same bounty. Show its confirmed receipt and the increased aggregate escrow.
3. The contributor submits the real Git object ID, SHA-256 evidence digest, and intended payee. Show local evidence-file digest match and changed-file mismatch; files remain off-chain.
4. The reviewer examines the exact submission and decides. Demonstrate unauthorized review rejection with a test or read-only simulation; do not broadcast a reverted transaction.
5. Release the approved bounty and show the confirmed payee and Mainnet explorer receipt. Demonstrate contributor refunds only on a genuinely expired bounty after settlement deadline plus seven days. If that period cannot elapse, say so plainly and use local tests as engineering evidence only.

Mainnet transaction controls require the identified BridgeKey provider and chain `4646`; each write requires normal wallet confirmation. The live bounty flow remains to be demonstrated. Never show fabricated activity as a transaction.

### Timed recording script (2:40)

- **0:00–0:20:** “Software bounties often separate the task, reviewed commit, and payment across tools. PatchPool escrows the reward first and records what the reviewer approved.”
- **0:20–0:50:** Show MST Mainnet chain 4646, then create and fund a real low-value bounty only after deployment verification and explicit user approval. Add the second sponsor contribution and show both confirmed receipts.
- **0:50–1:20:** Switch to the developer account. Submit the actual Git object ID, a SHA-256 digest computed from real test evidence, and the separate payee address. Show the confirmed submission record.
- **1:20–1:50:** Switch to the assigned reviewer. Inspect the stored Git ID, evidence digest, and payee; prove unauthorized review rejection with tests/simulation, then show the assigned reviewer's confirmed decision.
- **1:50–2:15:** Switch to the payee or release caller. Release the reward; show the `Paid` state, recipient, transaction hash, and MSTScan receipt.
- **2:15–2:40:** “The contract guarantees escrow, role permissions, recorded decisions, eligible payout, and refunds under its rules. It cannot judge code quality or verify off-chain evidence.” Explain that one reviewer decides and refunds require each contributor to claim after seven days.

Do not record or claim this live flow until it has actually been completed with the distinct Mainnet wallets. If seven days cannot elapse for a refund example, disclose that the live refund was not demonstrated. Do not present local output as Mainnet activity.

## Pitch alignment and roadmap

| Pitch promise | Current state |
| --- | --- |
| Individual bounty funding and escrow | Implemented in contract; covered by tests; no live verification claimed |
| Multi-sponsor shared funding | Implemented in the verified Mainnet contract; a live bounty demonstration is still pending |
| Exact commit identity | Exact normalized Git object ID is stored with hash-type encoding; covered by tests |
| SHA-256 evidence commitment | `bytes32` digest is accepted; frontend can hash a local evidence file without uploading it; contract tests validate format-independent bytes32 handling |
| Human review | Single assigned reviewer is enforced on-chain and tested locally |
| Configurable reviewer quorum | Not implemented; roadmap |
| Stale-approval protection | Approval binds to stored submission ID; bounty closes on approval; test coverage verifies selected ID |
| Conditional reward settlement | Implemented in source; payout/replay tests present; live verification pending |
| Eligible refunds | Corrected source requires `Open`; regression tests added; old deployment remains unsafe |
| Off-chain automated validation | Not implemented; reviewer performs validation outside PatchPool |
| GitHub/CI workflow | A local GitHub Actions workflow is configured for tests, compile, type-check, lint, and build; no hosted run exists until publication |
| Auditable lifecycle events | Contract emits creation, submission, review, payout, and refund events; reads are on-chain |

## Buildathon deliverables status

- Verification: 62 contract tests, five local browser E2E scenarios, four RPC proxy guard tests, deployment/frontend TypeScript checks, lint, and production build passed in this execution. Local Hardhat/Playwright results are not Mainnet activity evidence. The verified Mainnet deployment is finalized; BridgeKey signing and the live bounty flow remain unverified.
- Source repository: [ShravaniMankar664/PatchPool](https://github.com/ShravaniMankar664/PatchPool) is public; the implementation is available on `publish/patchpool-source` for review, while `main` remains unchanged pending pull-request review.
- Demo video: not recorded.
- Project description and stack: documented above.
- Live DApp: unavailable.
- MST Mainnet is the only production network. Its verified deployment is recorded above. The Legacy Testnet record is historical only; no bounty workflow has yet been demonstrated.
- Unstop/WhatsApp submission: not submitted or shared.

See the [project ideation brief](docs/PROJECT_IDEATION.md), [buildathon submission](docs/BUILDATHON_SUBMISSION.md), [submission package](docs/SUBMISSION_PACKAGE.md), [demo script](docs/DEMO_SCRIPT.md), [security and limitations](docs/SECURITY_AND_LIMITATIONS.md), and [deployment status](docs/DEPLOYMENT_STATUS.md) for current evidence and remaining actions.
