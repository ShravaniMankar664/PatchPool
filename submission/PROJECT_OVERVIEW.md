# PatchPool — Project Overview

**Buildathon:** MST Blockchain Buildathon #2 · Round 2 MVP Build Sprint  
**Status:** Mainnet-deployed MVP; no bounty workflow has yet been run on Mainnet.

## Team and links

- **Project:** PatchPool
- **Team lead:** Shravani Mankar
- **Team member recorded in the project brief:** Vedika Ukirde
- **Team lead email:** `[TEAM LEAD TO COMPLETE IN PRIVATE FORM]`
- **Team lead phone:** `[TEAM LEAD TO COMPLETE IN PRIVATE FORM]`
- **Source repository:** https://github.com/ShravaniMankar664/PatchPool
- **Live application:** `[NO PUBLIC FRONTEND URL CONFIRMED]`
- **Demo video:** `[NOT RECORDED — add an accessible viewer link after recording]`
- **Pitch presentation:** `PRESENTATION.pdf` in this folder

The GitHub repository is public. The implementation is prepared on `publish/patchpool-source` for review; `main` remains unchanged until the pull request is reviewed and merged. No public frontend URL is configured or confirmed.

## Project description

PatchPool is an on-chain escrow and review workflow for software-fix bounties. A creator funds a task and assigns one reviewer. Other sponsors can contribute to the same pool. A developer submits a Git commit ID, an evidence-file SHA-256 digest, and a payout address. The assigned reviewer approves or rejects a submission; an approved reward can be released to its recorded payee, while eligible contributors may claim their own refund after expiry. The contract records the lifecycle and enforces address-level role and settlement rules. Human review remains responsible for judging the quality of the fix.

## Problem statement

Software-fix bounties commonly split task terms, code revisions, review decisions, and payment across different tools. That makes it harder for participants to inspect which revision was reviewed, who was authorized to decide, and where the reward went. PatchPool addresses this narrow coordination and settlement problem; it does not replace GitHub or perform code review.

## Proposed solution

Use an MST Mainnet smart contract as escrow and lifecycle state machine. The contract commits to task metadata, accepts contributions until the submission deadline, records the submitted Git object ID and evidence digest, restricts review to the assigned reviewer, binds approval to one submission, and enforces payout/refund eligibility. The frontend reads the registered contract and prepares wallet-confirmed transactions.

## Target users

- Open-source maintainers with well-scoped software fixes.
- Developer communities and Web3 teams funding external contributors.
- Sponsors who want a named reviewer and visible escrow/settlement rules.
- Independent developers submitting work against a public bounty.

These are intended user groups, not verified customers or claimed adoption.

## Implemented features

- Creator-funded bounty creation with task title and description committed by Keccak-256; task text is public and permanent in a contract event.
- Multiple sponsors can contribute to one bounty before the submission deadline.
- Commit IDs support SHA-1 and SHA-256 Git object formats, with duplicate-submission protection.
- Submitter provides a SHA-256 evidence digest and payout address; a reviewer can compare a local evidence file to that digest without uploading it.
- One assigned reviewer can approve or reject; approval binds to a specific submission.
- Permissionless reward release pays the approved submission's stored payee.
- Each contributor can claim their own eligible refund after the settlement deadline plus seven days.
- UI network and wallet gates, transaction receipt handling, bounty reads, bounded RPC proxy, and local Hardhat browser E2E mode.

## Why blockchain

A conventional task board can document work and decisions. The contract additionally holds native MSTC escrow, applies authorization and state-transition rules, binds approval to a recorded submission/payee, prevents a second settlement, and exposes public events. This offers independently inspectable execution. It does not establish that the work is correct or that evidence is truthful.

## Network and contract

- **Production network:** MST Mainnet
- **Chain ID:** `4646` (`0x1226`)
- **Contract:** [`0x707004013b56e36eE458966d928539ede6166338`](https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338#code)
- **Deployment transaction:** [`0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec)
- **Deployment block:** `21783933`
- **Recorded runtime Keccak-256:** `0x3fd747f5a8d30110c3c75bf33d039dca659b07cd6b064b52cb861f25b5419aaf`
- **Wallet requirement in production UI:** BridgeKey-identified injected wallet, on chain `4646`, normal wallet confirmation for every transaction.
- **Write gates:** Mainnet enabled; Legacy Testnet disabled. Production Wagmi chain list includes Mainnet only.

Read-only RPC verification on 30 October 2026 returned chain ID `0x1226`, successful receipt at block `21783933`, the expected contract address, and runtime code whose Keccak-256 matches the deployment record. A read-only `bountyCount()` call returned zero; no Mainnet bounty is being claimed. The Legacy Testnet record at chain `91562037` is historical and separate; the address text matches but the transaction, block, bytecode, and chain differ.

## Technology

Solidity `0.8.20`, OpenZeppelin `ReentrancyGuard`, Hardhat, ethers, Chai, TypeScript, Next.js `15.5.28`, React `18`, Wagmi `2.19.5`, Viem, TanStack Query, and Playwright/Chromium.

## Verification boundaries

The recorded current-source results include 62 contract tests, four RPC proxy guard tests, and five local browser E2E scenarios. A fresh E2E run on 30 October 2026 passed all five scenarios on disposable Hardhat. These test local source behavior; they do not verify BridgeKey signing or a Mainnet bounty lifecycle. No bounty has been created or funded through PatchPool. There has been no independent professional smart-contract audit.
