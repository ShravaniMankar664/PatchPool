# PatchPool — Buildathon Submission Draft

**Tagline:** Fix Bugs. Earn Rewards. Trust the Process.  
**Technical tagline:** Fund the Fix. Lock the Commit. Release the Reward.

## Project overview

Software-fix bounties often separate the funded promise, code revision, review decision, and payment across different tools. PatchPool connects those steps in a contract-governed workflow for open-source maintainers, independent developers, startups, and organizations funding specific fixes.

A sponsor escrows a reward and assigns a reviewer. A developer registers a Git object ID, SHA-256 evidence digest, and intended payee. The assigned reviewer decides on that recorded submission. The contract enforces the permitted reward release or eligible open-bounty refund and emits lifecycle events. Blockchain is useful here because escrow custody, authorization, settlement conditions, and resulting state can be checked independently. It does not prove code correctness or that evidence is truthful; human review remains necessary.

## What the contract guarantees / What it does not

It guarantees escrow, address-level role separation, recorded decisions, eligible payouts, and refunds subject to the actual deadlines. The creator and all funders cannot submit work or receive payout; the reviewer cannot fund, submit, or receive payout. It does not judge code quality or verify off-chain evidence. Evidence files remain off-chain; digest match/mismatch checks identify byte equality only. One reviewer decides, with no quorum or dispute process. Wallet rules cannot prove that addresses belong to distinct people. Refunds require an individual claim after the settlement deadline plus the seven-day grace period; they are not automatic or immediate.

## Team

- Team lead: Shravani Mankar
- Team member: Vedika Ukirde
- Enter the supplied email and phone in the organizer's private form fields; they are intentionally omitted from this repository document.

## Implemented scope and stack

The verified Mainnet contract implements bounty creation with an initial sponsor contribution, additional per-wallet contributions to the same bounty, aggregate reward accounting, one assigned reviewer, submission commitments, approval/rejection, payout to the recorded payee, eligible individual contributor refunds, and lifecycle events. Reviewer quorum, disputes, automated CI attestations, and public evidence storage are not implemented.

Stack: Solidity 0.8.20, Hardhat, TypeScript, Next.js 15.5.28, React 18, Wagmi 2.19.5, Viem, and the MST SDK package already present in the frontend. BridgeKey is the project's configured production wallet requirement; no live BridgeKey connection or signing has been verified.

## Verification status

- On 30 October 2026, the contract suite passed 62 tests covering creator, co-sponsor, reviewer, and submission-participant restrictions, along with lifecycle and reentrancy cases. Local Hardhat and browser results are engineering evidence only, not MST deployment evidence.
- Evidence integrity UI: a reviewer can hash a supplied evidence file locally and compare it with the submission's on-chain digest; the UI reports a match or mismatch. This detects changed bytes only.
- The verified Mainnet contract supports multiple contributors to one bounty, per-wallet contribution records, aggregate payout, and individual pull refunds after expiry. The frontend surfaces the pool total and connected wallet's contribution. A live bounty workflow has not yet been demonstrated.
- MST Mainnet (chain ID 4646) is the only production target. The verified PatchPool deployment is finalized in the active registry at [`0x707004013b56e36eE458966d928539ede6166338`](https://mstscan.com/address/0x707004013b56eE458966d928539ede6166338), block `21783933`, transaction [`0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec`](https://mstscan.com/tx/0xf1737317b461a21a72784232e7987adf95728e018566f030b3eb36b4623a59ec). The Legacy Testnet deployment details remain preserved as historical records only.
- Public GitHub repository exists at [ShravaniMankar664/PatchPool](https://github.com/ShravaniMankar664/PatchPool), while the implementation is prepared on `publish/patchpool-source` for pull-request review; the README-only `main` branch remains unchanged until merge. No production DApp URL is available.
- Browser E2E: Chromium completed the local create, contribute, submit, review, payee-bound payout, expiry, and refund assertions. This does not verify BridgeKey, MST RPC, or a public transaction.
- Not recorded/submitted: no demo video, Google Form receipt, or Unstop receipt exists.

Use `README.md`, `QUICKSTART.md`, `docs/SECURITY_AND_LIMITATIONS.md`, and `docs/DEPLOYMENT_STATUS.md` for setup and evidence boundaries. Add only verified URLs, addresses, and transaction hashes to the final form. Complete both the Google Form and Unstop submission as required by the organizer instructions; confirm links open for judges before submitting.

## Final delivery checklist

- [ ] Confirm organizer form opens and submit the project description, team details, stack, and truthful implementation status.
- [ ] Review the `publish/patchpool-source` pull request and merge only after approval; preserve the existing `main` history.
- [ ] Deploy the frontend only after verified contract configuration and explicit hosting approval; add the reachable URL.
- [ ] Add only verified chain IDs, contract addresses, deployment transaction hashes, and explorer links.
- [ ] Record the 2–3 minute demo, verify viewer permissions, and add the video URL.
- [ ] Submit the same accurate project details, links, and video through Unstop.
- [ ] Confirm both submission receipts and any organizer-requested WhatsApp sharing; do not mark complete before confirmation.

## Presentation outline

1. Problem: software-fix work, approval, and payment can be disconnected.
2. Solution: shared escrow linked to a specific submission and named reviewer.
3. Why MST Mainnet contract: it holds funds, enforces roles and settlement rules, and makes decisions/payments inspectable.
4. **What the contract guarantees / What it does not:** it enforces escrow, address-level roles, and settlement rules; it cannot judge code or verify off-chain evidence, and the single reviewer makes a human judgment.
5. Evidence: Mainnet source verification and deployment record are available at MSTScan; show bounty lifecycle receipts only after a genuine flow is completed.
