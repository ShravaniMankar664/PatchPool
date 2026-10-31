# PatchPool Demo Script — 2:45 Local MVP Walkthrough

## Recording status

Not recorded. Use the local E2E environment to show the full lifecycle. Label every local transaction and address **LOCAL — NOT MST**. The Mainnet contract deployment can be shown separately as verified infrastructure, with no bounty transactions implied. Do not connect or sign with a real wallet during this recording.

## Script and screen actions

### 0:00–0:25 — Problem and product

“Software-fix bounties can split the task, reviewed revision, decision, and payment across different tools. PatchPool links a funded task to a specific code submission and a reviewer decision, with escrow settlement rules enforced by a smart contract.”

Show the application landing page. State the intended users: maintainers, developer communities, teams funding fixes, and independent developers.

### 0:25–0:55 — Network and architecture

Show the deployment details on MSTScan: MST Mainnet, chain 4646, the verified PatchPool contract, and its deployment receipt. Say clearly: “This confirms the contract deployment only. We have not completed a live BridgeKey signing check or a bounty transaction.”

Switch to the automated local demo and point out **LOCAL E2E · NOT MST**. No transaction from this section is Mainnet activity.

### 0:55–1:25 — Create and share funding (local)

Use the local test wallets to create a bounty with public-safe task text, assigned reviewer, deadlines, and initial escrow. Add a second sponsor contribution. Show the local receipts and aggregate amount. Explain that task metadata is public and permanent on the selected chain.

### 1:25–1:55 — Submit work and evidence (local)

Switch to the local contributor. Submit a real sample Git object ID, evidence digest, and separate payout address. Select the matching evidence file, then a changed copy, to show match/mismatch. Say: “The file stays in the browser. The digest can detect changed bytes; it does not prove the evidence is true or that the fix is correct.”

### 1:55–2:20 — Review and settlement (local)

Switch to the assigned reviewer, approve the selected submission, and release to the stored payee. Point to the Paid state and receipt. Mention that contract tests also cover rejection and contributor refunds after the settlement deadline plus seven days; do not imply those occurred on Mainnet.

### 2:20–2:45 — Security model and close

“The contract prevents creators and contributors from submitting or receiving payout, and prevents the reviewer from funding, submitting, or receiving payout. These are address-level rules, not identity checks. One human reviewer decides; there is no quorum or dispute process. The contract enforces escrow and settlement, not code quality.”

Close with the verified Mainnet address and disclose: no live bounty has been created or funded.

## Recording checklist

- Keep runtime between 2 and 3 minutes.
- Use the local E2E server and test-only wallets only for lifecycle actions.
- Keep **LOCAL — NOT MST** visible for local transactions.
- Show the Mainnet deployment explorer in a separate, clearly labeled segment.
- Do not expose seed phrases, private keys, wallet passwords, tokens, or personal information.
- Use non-sensitive sample task metadata because chain events are public.
- Show only actual local receipts or the actual deployment receipt; never fabricate UI records.
- Check video/audio quality and set the Google Drive/video permission to view for anyone with the link.
- Record actual view permissions and URL in the final checklist after upload; no upload is authorized in this task.
