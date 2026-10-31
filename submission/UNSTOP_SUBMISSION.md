# Unstop Round 2 — Submission Draft

The official Unstop event listing requires a working prototype/MVP, source-code link, a 2–3 minute demo, short description and technology stack, and a live deployment link if available. The listing currently reports registration closed. No team account submission state has been checked, and no project submission has been made.

## Project title

PatchPool — Fund the Fix. Lock the Commit. Release the Reward.

## Brief description (copy-ready)

PatchPool is an MST Mainnet escrow and review workflow for software-fix bounties. A creator funds a task and assigns a reviewer; other sponsors can add to the same pool. A developer submits a Git commit ID, SHA-256 evidence digest, and payout address. The assigned reviewer makes the human approval decision, while the smart contract enforces role restrictions, binds approval to a specific submission, and governs payout or eligible contributor refunds. The verified deployment is on MST Mainnet (chain ID 4646). Local contract and browser tests exercise the lifecycle, but live BridgeKey signing and Mainnet bounty activity have not been demonstrated. PatchPool does not judge code quality or verify off-chain evidence.

## Technology stack

Solidity 0.8.20, OpenZeppelin ReentrancyGuard, Hardhat, ethers, Chai, TypeScript, Next.js 15.5.28, React 18, Wagmi 2.19.5, Viem, TanStack Query, Playwright/Chromium.

## Source code

https://github.com/ShravaniMankar664/PatchPool

**Publication status:** The implementation is being published on `publish/patchpool-source` for pull-request review. The default `main` branch remains unchanged until review and merge. Do not describe the source as merged into `main` before that happens.

## Live deployment link

**Contract deployment (available):** https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338#code  
**Hosted application:** `[NO PUBLIC FRONTEND URL CONFIRMED]`

## Demo video

`[NOT RECORDED — record and verify viewer access before adding a link]`

## Submission status

**NOT SUBMITTED.** Submission needs the Unstop team account, the published repository contents, a recorded accessible demo, and a confirmed live app URL if one becomes available. Confirm the current account deadline and team eligibility in Unstop before attempting submission. Do not claim finalist status; no shortlist confirmation is recorded.
