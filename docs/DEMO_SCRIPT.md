# PatchPool Demo Script (2–3 minutes)

## Live version — only after verified deployment

Prerequisites: verified MST Mainnet PatchPool deployment, a live BridgeKey wallet/signing check, and distinct sponsor, contributor/payee, and reviewer wallets. Use a fourth wallet as the second sponsor. The deployment is verified; no bounty activity is claimed as completed. Create genuine low-value bounty activity only after separate approval.

Production network: MST Mainnet, chain ID `4646`. The Legacy Testnet record is historical only. Do not conduct the live demo until the user explicitly approves genuine low-value bounty activity.

**0:00–0:20 — Problem and value**  
“A software bounty can be funded in one place, reviewed in another, and paid manually elsewhere. PatchPool links escrow to the exact submission a reviewer evaluates.”

**0:20–0:55 — Sponsor and shared funding**  
Show Mainnet chain ID 4646. Sponsor one funds a real, low-value bounty and the confirmed receipt proves escrow custody. Sponsor two contributes to that same bounty; show the second confirmed receipt and the updated aggregate pool. Keep task text public-safe.

**0:45–1:15 — Developer**  
Use a separate contributor/payee wallet. Submit the actual Git commit/object ID, digest of real evidence, and recorded payee. Explain that the digest commits to bytes but proves neither test execution nor code quality. In the reviewer interface, check an original evidence file (match) and a changed copy (mismatch); files stay local.

**1:15–1:45 — Reviewer**  
Switch to the assigned reviewer and approve the exact submission. State the enforced address rules: the creator and funders cannot submit or receive payout; the reviewer cannot fund, submit, or receive payout. Prove rejected role conflicts and unauthorized review with local tests or read-only simulation; never broadcast a reverted Mainnet transaction just for the demo. Explain that separate addresses do not prove separate identities.

**1:45–2:15 — Settlement**  
Release the approved reward and show its confirmed receipt, Paid status, and that the recorded contributor/payee received the full aggregate pool. Show eligible refunds only on a separate genuinely expired bounty after the actual settlement deadline plus seven-day grace period. If seven days cannot elapse before submission, state clearly that the refund is locally tested and not live-demonstrated.

**2:15–2:40 — Guarantees and limits**  
“What the contract guarantees / What it does not: the Mainnet contract holds escrow, enforces address roles, records decisions, and settles eligible payouts or refunds. It cannot judge code quality or verify off-chain evidence; one human reviewer decides. Refunds require each contributor to claim after the seven-day grace period.”

## Honest local fallback (about 3 minutes)

**0:00–0:25 — Problem and product.** Explain how PatchPool links a specific funded software fix, evidence digest, named reviewer, and settlement rule.

**0:25–1:00 — Source-defined lifecycle.** Walk through the sponsor, developer, reviewer, and payee steps in the verified app and contract. Clearly distinguish the verified deployment from any bounty actions not yet demonstrated live.

**1:00–1:35 — Evidence integrity.** Explain the browser-local SHA-256 comparison: a matching digest binds selected bytes to the recorded digest; a mismatch detects changed bytes; neither establishes truth or code quality. The selected file is not uploaded.

**1:35–2:10 — Shared-funding differentiator.** If a genuine Mainnet bounty has been created with approval, show the second wallet contribution, aggregate, payout, and any eligible refund with MSTScan receipts. Otherwise, show the local contract workflow and label it local Hardhat behavior; the Mainnet deployment is verified, but no live bounty workflow is claimed.

**2:10–3:00 — Technical status.** Show the actual contract tests and verified Mainnet deployment record. State that local Hardhat is not MST, BridgeKey has not been connected, and the Playwright lifecycle passed only against the local Hardhat chain. Label any local transaction records **LOCAL — NOT MST**.

The local Playwright lifecycle passes on a disposable local chain and checks deployed bytecode against the artifact before browser actions. It covers creation, shared contribution, submission, authorized review, payee-bound payout, and expiry refunds. This does not establish live BridgeKey signing or demonstrate a Mainnet bounty flow.

## Recording checklist

- Capture the wallet account and chain selector without exposing wallet secrets.
- Show real pending and confirmed states; retain actual receipts for any claimed chain activity.
- Keep transaction hash and explorer evidence readable.
- Do not show fabricated users, activity, evidence, deployment addresses, or balances.
- Keep the final video between 2 and 3 minutes and test viewer access before linking it.
