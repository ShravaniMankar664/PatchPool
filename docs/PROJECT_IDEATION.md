# PatchPool — Project Ideation Brief

**Prepared:** 28 October 2026  
**Status (updated 30 October 2026):** The verified MST Mainnet (4646) PatchPool deployment is finalized in the active registry. A live BridgeKey signing session and bounty workflow remain unverified. The Legacy Testnet deployment remains historical only.

This is a project-prepared brief based on the publicly listed Round 1 fields. No original pitch deck or official ideation document template was present in the repository, so this file does not claim to reproduce one.

## Project title

**PatchPool — Fix Bugs. Earn Rewards. Trust the Process.**

Technical tagline: **Fund the Fix. Lock the Commit. Release the Reward.**

## Problem statement

Software-fix bounties often involve separate records for the task, escrow, code revision, review decision, evidence, and payment. A sponsor or maintainer may need to establish which work was funded, which exact submission was reviewed, and which recipient should receive the reward. Developers also benefit from clear acceptance and payout conditions before doing the work.

PatchPool addresses this coordination and settlement problem for individual software-fix bounties. It does not claim that every existing bounty platform lacks escrow, review, or audit features.

## Proposed solution

PatchPool escrows a bounty in a Solidity contract, records a commitment to readable task details, accepts a Git object ID, SHA-256 evidence digest, and payout address, then lets one assigned human reviewer approve or reject a submission. Approval is tied to a stored submission ID; anyone can trigger payment to that submission's recorded payee. A sponsor can reclaim funds only from an eligible still-open bounty after the configured expiry window.

The chain enforces the configured roles and payment state transitions. It does not determine whether code is correct or whether an evidence file tells the truth.

## Target users and use cases

- Open-source maintainers funding a bounded bug fix.
- Developers who want the funded reward and acceptance reviewer identified in advance.
- Organizations sponsoring a specific software improvement.
- Web3 projects coordinating engineering work across external contributors.

These are intended audiences, not current customers or partnerships.

## Technical approach

The contract stores the sponsor, assigned reviewer, reward, deadlines, task hash, submission identifiers, Git commit identity, evidence digest, payee, review result, and settlement state. Small readable task records are published in a `BountyMetadata` event, capped at 16 KiB, and bound to the task hash over their exact UTF-8 JSON bytes. This makes the record discoverable to every client that can read the event history. Event data is permanent and public; sponsors must not include secrets, personal data, or confidential code. Evidence files remain off-chain. A SHA-256 digest identifies evidence bytes; it does not attest that tests ran or validate their quality.

The verified Mainnet contract supports one creator plus additional contributors for one bounty. The creator's initial deposit and each later contribution are recorded per wallet; the aggregate reward is paid to the approved submission's payee, while eligible expiry refunds are pull-claimed by each contributor. The MVP still uses one reviewer; reviewer quorum, disputes, per-submission CI attestations, and evidence hosting are deferred. Human review remains an explicit part of the system.

## Technology stack

- Solidity 0.8.20, OpenZeppelin ReentrancyGuard, Hardhat, ethers, Chai, and Solhint.
- Next.js 15.5.28, React 18, TypeScript, Wagmi 2.19.5, Viem, and TanStack Query.
- Legacy MST Testnet configuration is present (chain ID `91562037`); direct read-only RPC calls returned that chain ID, block 6,677,595, and 1 gwei gas price. The supplied public address showed 60 tMSTC; no BridgeKey account was connected. The explorer warns of shutdown after 31 January 2027.

## Expected impact and feasibility

The prototype demonstrates a focused way to make bounty escrow and settlement conditions independently inspectable. Its startup hypothesis is that maintainer groups and organizations may value a common record linking funded terms, reviewed work, and payout. A possible future business model is a fee on successfully settled bounties or paid organization workflow features; neither is implemented or validated.

## Current evidence and limitations

- On 29 October 2026, the local Hardhat suite passed 54 tests, including shared-funding accounting, individual refunds, metadata binding, and reentrant payout/refund tests. This is local source evidence, not MST deployment evidence.
- The recorded pre-deployment checks on 30 October 2026 include 62 contract tests, four RPC proxy tests, deployment/frontend TypeScript checks, lint, production build, and five local Playwright E2E scenarios. A fresh local Playwright run on 30 October passed all five scenarios. The Mainnet deployment is verified and finalized. Solhint previously reported 50 warnings and frontend compilation reports optional MetaMask AsyncStorage and `pino-pretty` imports. BridgeKey signing still needs a live check.
- The Playwright runner deployed and bytecode-checked the local contract, started the frontend, and completed the lifecycle in Chromium using disposable local accounts. These browser assertions are local-only; they do not verify a public deployment or BridgeKey interaction.
- The MST Mainnet PatchPool deployment is verified and finalized. No live wallet interaction, BridgeKey test, public hosted application, video, or external submission is verified. The source is prepared on `publish/patchpool-source` for review; the existing README-only `main` branch remains unchanged until merge.
- The Legacy Testnet explorer directs migration to Coral and announces shutdown after 31 January 2027. Coral RPC, chain ID, explorer, token symbol, faucet compatibility, and source-verification procedure remain unconfirmed in available authoritative material.

## Roadmap

1. Check BridgeKey connection, account, chain switching, signing, and receipt handling in a live browser.
2. With separate approval, demonstrate a genuine low-value flow using distinct sponsor, contributor/payee, and reviewer wallets.
3. Keep multiple reviewers, staking, and reputation as future work unless separately implemented and tested.

