# Google Form — Prepared Answers

Copy these only if the organizer confirms the form is reopened or accepts a late response. The deadline supplied by the organizers was **30 October 2026, 3:00 PM IST**; it has passed. No Google Form URL was present in the repository or supplied in the request, and the Unstop listing does not expose one. No form was submitted.

## Project and team

**Project name:** PatchPool

**Team lead name:** Shravani Mankar

**Team lead email:** `[TEAM LEAD TO COMPLETE — use the address registered for the team]`

**Team lead phone:** `[TEAM LEAD TO COMPLETE — use the number registered for the team]`

**Other team member(s):** Vedika Ukirde (listed in the existing project brief; confirm current team roster before submission).

## Brief project description

PatchPool is an on-chain escrow and review workflow for software-fix bounties. A creator funds a task and assigns one reviewer; other sponsors may contribute to the same pool. A developer submits a Git commit ID, a SHA-256 evidence digest, and a payout address. The assigned reviewer approves or rejects the submission, and the contract enforces payout or eligible contributor refunds. The application records task commitments and lifecycle events on MST Mainnet. Human review determines code quality; the contract does not validate code or off-chain evidence.

## Problem statement

Software-fix bounties often coordinate task terms, source revisions, reviewer decisions, and reward payments across separate tools. Participants can have difficulty tracing which revision was reviewed and how the funds were handled. PatchPool makes the escrow and lifecycle rules inspectable on-chain while leaving source collaboration and human review in their appropriate tools.

## Proposed solution

PatchPool uses an MST Mainnet smart contract to hold native MSTC escrow and enforce the bounty lifecycle. It binds readable task metadata to a Keccak-256 commitment, tracks per-wallet contributions, records a typed Git object ID and evidence digest, restricts decisions to one assigned reviewer, and binds approval to a submission and payout address. Anyone may trigger an approved payout; each eligible contributor claims their own refund after expiry.

## Target users / real-world use

Open-source maintainers, developer communities, Web3 teams, organizations funding defined software fixes, and independent contributors. These are intended users; no customer adoption or completed bounty activity is claimed.

## Key features implemented

- Initial creator escrow and additional shared funding.
- Task metadata commitment and public event discovery.
- SHA-1/SHA-256 Git ID support and duplicate prevention.
- Evidence digest and local file comparison (no file upload).
- Single-reviewer approval/rejection bound to one submission.
- Payee-bound aggregate payout and pull-based contributor refunds.
- BridgeKey-gated production UI with chain 4646 enforcement and receipt display.

## Blockchain and network

Blockchain is used for escrow custody, enforceable address permissions and settlement rules, and independently inspectable events. Production network: **MST Mainnet, chain ID 4646**. Contract: `0x707004013b56e36eE458966d928539ede6166338`. Deployment transaction: `0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`. Deployment block: `21783933`. Explorer: https://mstscan.com/address/0x707004013b56e36eE458966d928539ede6166338#code

## Technology stack

Solidity 0.8.20, OpenZeppelin, Hardhat, ethers, Chai, Next.js, React, TypeScript, Wagmi, Viem, TanStack Query, and Playwright.

## Links and deliverables

- Repository: https://github.com/ShravaniMankar664/PatchPool — public source is available on the `publish/patchpool-source` review branch; `main` remains unchanged pending pull-request review.
- Live application: `[NO PUBLIC FRONTEND URL CONFIRMED]`
- Demo video: `[NOT RECORDED — add an accessible viewer link]`
- Presentation: `PRESENTATION.pdf` in this submission folder.

## Limitations / honest status

The Mainnet contract is verified and finalized. The live BridgeKey connection/signing and a real bounty lifecycle have not been checked. No bounty has been created or funded through PatchPool. The repository contains a local E2E run only. The contract uses one human reviewer, does not establish real-world identity, does not judge code quality, and does not verify evidence truth. There has been no independent contract audit.
