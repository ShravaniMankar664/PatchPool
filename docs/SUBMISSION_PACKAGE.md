# PatchPool Buildathon submission package

## Project description

**PatchPool — Fix Bugs. Earn Rewards. Trust the Process.**  
Technical tagline: **Fund the Fix. Lock the Commit. Release the Reward.**

Open-source maintainers, software teams, and sponsors can have difficulty linking a funded software fix to the exact code revision reviewed and the payment made for it. PatchPool records an escrowed bounty, a normalized Git commit ID, a SHA-256 evidence digest, a human review decision, and the approved payee in one contract-governed lifecycle. The contract can hold the reward and enforce the configured reviewer, payout, and refund rules; reviewers still determine whether the work is correct. A digest supports integrity checking but does not prove that tests ran or that evidence is truthful.

The verified Mainnet contract contains shared multi-contributor bounties, per-wallet contribution records, public hash-bound task metadata, submissions, a single assigned reviewer, approval/rejection, aggregate settlement to the approved submission's payee, individual eligible refunds, and lifecycle events. The creator and each funder cannot submit or receive a payout; the reviewer cannot fund, submit, or receive a payout. These are address-level rules and do not establish distinct real-world identities. Reviewer quorum, disputes, per-submission CI attestations, and evidence hosting are not implemented. The current-source contract suite passed 62 tests; frontend build, typecheck, lint, RPC proxy checks, and local browser lifecycle/responsive checks have been run. A live Mainnet bounty workflow has not yet been demonstrated.

### Startup hypothesis

Initial users could be open-source maintainers, developer communities, and organizations that need a reward to remain escrowed until a named reviewer accepts a specific code submission. A possible business model to validate is a small fee on successfully settled bounties, with optional paid organization features such as private project workspaces or policy reporting. These are hypotheses, not current revenue, customer commitments, or implemented billing features. PatchPool's differentiation is the programmable link between a funded reward, the reviewed submission identity, and the settlement recipient; it does not claim ordinary bounty platforms lack all escrow or review features.

## Technology stack

- Solidity `0.8.20`, OpenZeppelin `ReentrancyGuard`, Hardhat, ethers, Chai, Solhint.
- Next.js 15.5.28, React 18, TypeScript, Wagmi 2.19.5, Viem, TanStack Query.
- MST Mainnet (4646) is the sole production target. The verified PatchPool deployment is finalized in the active registry; no live bounty activity is claimed. The preserved Legacy Testnet deployment is historical only.
- `@mstblockchain/mst-sdk` 1.0.0 is installed, but its burner-wallet playground is not the PatchPool lifecycle path. `@mstblockchain/mst-vibe-kit` is not installed.

## Feature and evidence matrix

| Feature | Classification | Evidence / remaining check |
| --- | --- | --- |
| Individual escrow, bounty creation, deadlines, reviewer permissions, approval binding, payout, eligible refund | Implemented in current source and deployed Mainnet artifact; locally tested | 62 contract tests passed on 30 October 2026; deployment receipt, chain, address, and runtime hash were confirmed with read-only Mainnet RPC. No bounty transaction has been made. |
| Multi-contributor funding and individual expiry refunds | Implemented in the verified Mainnet contract/UI source and locally contract-tested | Aggregate reward and per-wallet accounting are tested; live browser behavior has not yet been verified. |
| Frontend create/contribute/submit/review/release/refund flow, hash validation, metadata hash check, transaction receipt UI | Implemented; lifecycle demonstrated on a local chain | Frontend TypeScript, lint, and production build pass; the full Playwright lifecycle passes against disposable local Hardhat accounts. Mainnet writes are enabled behind BridgeKey, chain 4646, and the shared write-gate checks; Legacy Testnet writes remain disabled. |
| Evidence digest comparison | Implemented and exercised in the local browser test | A selected local file is SHA-256 hashed and compared with the recorded submission digest; files are not uploaded. This verifies byte equality only. |
| Local browser lifecycle E2E | Passed on 29 October 2026 | Playwright/Chromium completed the create, shared contribution, submit, review, payout, and eligible refund flow on local Hardhat. It is not MST evidence. |
| Public browsing without a wallet | Passed on 29 October 2026 against the local E2E deployment | A fresh page read the local bounty and metadata, made RPC `eth_call` reads, and issued no signing or transaction RPC methods. The Mainnet contract is registered; live Mainnet bounty reads have not been browser-tested. |
| Legacy Testnet read-only verification | Partially verified | Direct read-only RPC returned chain ID 91562037, block 6,677,595, gas price 1 gwei, and 60 tMSTC at the supplied public address. Creation-bytecode estimate was 1,734,228 gas; this does not authenticate BridgeKey or verify a signer. |
| BridgeKey browser signing | Unverified | Requires a live Mainnet connection, account/balance check, and normal wallet confirmation. |
| Reviewer quorum, disputes, automated evidence attestations | Planned | Not implemented in contract/frontend. |

## What the contract guarantees / What it does not

The contract guarantees escrow custody, address-level role permissions, recorded decisions, payouts to the recorded payee, and contributor refunds only when contract timing and eligibility rules allow them. The creator and funders cannot submit or receive bounty payout; the reviewer cannot fund, submit, or receive payout. It cannot judge code quality or verify off-chain evidence. Evidence files stay off-chain; matching digests identify bytes but do not establish correctness or truth. Different addresses do not prove different people. One reviewer makes a human judgment, with no quorum or dispute system. Refund claims are individual and become eligible after the settlement deadline plus seven days.

## Why blockchain is used

A normal task board can record a task and a reviewer decision. PatchPool's contract can additionally hold escrowed funds, enforce the assigned review role and permitted state transitions, bind the approval to a stored submission/payee, prevent duplicate settlement, and expose settlement events for independent inspection. It cannot judge code correctness, guarantee evidence truthfulness, or replace the reviewer.

## Submission deliverable checklist

| Deliverable | Status |
| --- | --- |
| Working local prototype | Source and local tests/build are available; full real-wallet lifecycle is not yet demonstrated. |
| Public source repository | Source is prepared on `publish/patchpool-source` for review; `main` remains unchanged until a pull request is reviewed and merged. |
| Two-to-three-minute demo video | Not recorded or uploaded. |
| Brief description and technology stack | Prepared above and in README. |
| Hosted application link | No public frontend URL has been confirmed; this is separate from the verified on-chain deployment. |
| Required network address and transaction evidence | MST Mainnet chain `4646`: verified contract [`0x707004013b56e36eE458966d928539ede6166338`](https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338), deployment transaction [`0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec), block `21783933`. |
| MSTScan verification | Verified and finalized in the active Mainnet registry. |
| Historical Legacy Testnet record | Preserved at chain 91562037, contract `0x707004013b56e36ee458966d928539ede6166338`, transaction `0x132a1fd81bcc31febcd1830441706dd545075ae764636e9ddb7281ac938677c0`, block 6679982. |
| Coral Testnet | Not a production option and not configured for PatchPool. |
| Official Project Ideation format | No organizer template was present in the repository. A locally prepared brief based on the published idea-submission fields is in [PROJECT_IDEATION.md](PROJECT_IDEATION.md); verify with the organizer if a different final template is required. |
| Unstop submission and organizer communication | Not submitted/sent. |

## Demo recording plan (2:40 target)

Record this only after a real browser session and required deployment(s) are verified. Use different sponsor, developer, reviewer, and payee accounts. Do not put a private key or seed phrase on screen.

| Time | Recording action |
| --- | --- |
| 0:00–0:20 | Explain the fragmented bounty-funding/review/payment problem and identify the user roles. |
| 0:20–0:50 | Show the connected wallet and actual target network; sponsor creates a task, reviewer, deadlines, and escrow reward. Show the confirmed receipt and explorer link. |
| 0:50–1:20 | Developer submits the exact Git object ID, SHA-256 evidence digest, and distinct payee. Explain what each commitment does and does not prove. |
| 1:20–1:50 | Reviewer inspects the submission and approves or rejects it from the reviewer account. Show the confirmed review event. |
| 1:50–2:15 | Release the approved reward and show the recipient, contract status, receipt, and explorer evidence. Use a separate expired Open bounty for a refund only if an actual eligible refund has been tested. |
| 2:15–2:40 | Explain the contract's escrow/permission/settlement guarantees, show locally tested multi-contributor accounting if the browser E2E runs, and state the human review and deployment boundaries. |

If a wallet or RPC is unavailable, record the local test run and source-defined flow as **local-only**. Do not substitute screenshots, hardcoded activity, or fabricated hashes for a live transaction.

### Local-only fallback recording

If network confirmation or browser dependencies remain unavailable, record a clearly labeled local prototype walkthrough: state that the deployment is not on MST; show the source-defined lifecycle and test output only; explain the intended separate sponsor, developer, reviewer, and payee roles; and end with the explicit Testnet/BridgeKey blockers. Do not present the prepared browser test as passed, and do not show local Hardhat hashes as MSTScan evidence. This fallback is not a substitute for a required live-chain demonstration if organizers require one.

## Publication and organizer checklist

The public Unstop listing rechecked on 30 October 2026 describes MVP/source/demo/description/stack deliverables and a live deployment link “if available,” but does not list the Round 2 timestamp or Google Form. The organizer-provided Unstop deadline is 31 October 2026 at 11:00 AM IST. The organizer-provided Google Form deadline was 30 October 2026 at 3:00 PM IST and has passed. No form URL was supplied or discovered and no submission was made. Check with organizers whether late form submission is accepted, and confirm team-specific Unstop status in the team account.

- [ ] Restore the selected Legacy Testnet RPC and verify chain ID, BridgeKey account, balance, and deployment cost.
- [x] Verify deployment receipt, contract bytecode, source, and Mainnet chain ID; finalize the verified Mainnet registry record.
- [ ] Check BridgeKey connection, account, chain switching, signing, and receipt handling in a real browser.
- [ ] Demonstrate the distinct-role lifecycle using genuine records after wallet transaction approval.
- [ ] Verify BridgeKey's actual connection, chain switching, signing, rejection, and receipt handling in a real browser; do not claim support before this test.
- [ ] Run a pre-publication secret/history scan. `.env.local` stays private and excluded.
- [ ] Obtain explicit approval before pushing a public repository; then verify the public URL.
- [ ] Obtain explicit approval before hosting the frontend; then verify the live URL and deployment registry.
- [ ] Record and make the 2–3 minute video accessible; verify its link.
- [ ] Submit the consistent title, description, stack, repository URL, video URL, live app URL if available, and actual verified chain evidence on Unstop.
- [ ] Share with the organizer/WhatsApp group only after explicit authorization; verify the destination and sent result.

Do not claim the submission is complete until required links and submission receipt actually exist.
