# Mainnet Manual Verification Procedure — Approval Gated

**Status:** Prepared only. No wallet was connected, no signature requested, and no Mainnet bounty transaction was sent. Every transaction below requires the owner's explicit approval immediately before the wallet confirmation.

## Preflight (read-only / no signature)

1. Open the reviewed production frontend URL once one is published. Confirm the app identifies MST Mainnet, chain `4646`; do not proceed if the URL or chain is different.
2. Open the verified contract in MSTScan and compare the address with `0x707004013b56e36eE458966d928539ede6166338`. Confirm the recorded deployment receipt and block `21783933`.
3. Connect BridgeKey only after the owner approves a real-wallet check. Confirm the wallet-reported address and chain `4646`. Check a public contract read and disconnect/reconnect once. Do not sign a message or transaction unless separately approved.
4. Use distinct wallet addresses for creator, any contributors, reviewer, submitter, and payee. A person can control multiple addresses; this is address separation only.
5. Agree on public-safe task terms, evidence, Git commit ID, amount, deadlines, reviewer, and payee. Never publish secrets, personal data, or confidential code in task metadata.
6. Check the relevant RPC reads, chain ID, expected contract address, balance, deadlines, and transaction value. Stop on an RPC or account mismatch.

## Transaction sequence and approval points

### 1. Create and initially fund

- Creator reviews the public task JSON/hash, reviewer address, submission deadline, settlement deadline, and initial MSTC value.
- **Approval point:** owner explicitly authorizes this specific creation transaction and amount; creator confirms in BridgeKey.
- Verify the receipt status, transaction hash, `BountyCreated` and `BountyMetadata` events, bounty fields, initial contribution, and contract balance.

### 2. Add shared funding (optional)

- Each contributor checks bounty ID, open state, deadline, amount, and role eligibility.
- **Approval point:** owner explicitly authorizes each contribution transaction and amount; contributor confirms in BridgeKey.
- Verify receipt, `BountyFunded` event, aggregate reward, per-wallet contribution, and escrow balance.

### 3. Submit a genuine fix

- Contributor checks the actual repository revision and calculates SHA-256 from the real evidence file. Verify the payee is nonzero and is not the reviewer, creator, or any contributor.
- **Approval point:** owner explicitly authorizes the submission transaction; contributor confirms in BridgeKey.
- Verify receipt, stored Git hash/type, evidence digest, submitter, payee, and submission ID. Do not upload the evidence file unless a separately reviewed product feature is added; current UI does not upload files.

### 4. Reviewer decision

- Reviewer inspects the actual code and evidence off-chain, then verifies the exact submission ID and decision in the UI.
- **Approval point:** owner explicitly authorizes the reviewer decision transaction; assigned reviewer confirms in BridgeKey.
- Verify receipt, `SubmissionReviewed` event, reviewer, submission ID, and resulting bounty state. Rejection leaves the bounty open for another submission before the relevant deadline; approval binds the bounty to that submission.

### 5. Release approved reward

- Confirm that the bounty is approved and the stored payee is correct. Release is permissionless but pays the immutable payee.
- **Approval point:** owner explicitly authorizes the release transaction; the caller confirms in BridgeKey.
- Verify receipt, `RewardReleased` event, `Paid` state, amount, and recipient balance.

### 6. Eligible contributor refunds (separate expired bounty only)

- Refunds apply only when the bounty remains unapproved and is past the settlement deadline plus seven days. Do not change Mainnet time or fabricate expiry.
- Each contributor verifies their refundable amount and claims individually.
- **Approval point:** owner explicitly authorizes each refund transaction; that contributor confirms in BridgeKey.
- Verify each receipt, `ContributionRefunded` event, remaining refundable balance, and final `Refunded` state when the last eligible claim completes.

## Stop conditions and evidence

Stop if the wallet/provider identity, account, chain, contract address, call data, recipient, amount, deadline, RPC result, or receipt differs from the reviewed expectation. Never broadcast a deliberately reverting transaction for a demo. Retain actual transaction hashes and receipts; label local Hardhat output as **LOCAL — NOT MST**. Do not claim a completed step until its on-chain receipt and state have been checked.
