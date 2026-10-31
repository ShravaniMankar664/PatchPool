# Security Model and Limitations

## What the deployed contract enforces

- Creator must fund a bounty at creation; task JSON must match its Keccak-256 hash and stay within 16 KiB.
- Additional contributions are accepted only while the bounty is open and before the submission deadline.
- Creator/contributors cannot submit or receive the bounty payout. Reviewer cannot fund, submit, or receive payout. A submitter or chosen payee cannot later fund that bounty.
- Only the assigned reviewer can decide; approval stores one submission ID and closes further decisions through the state change.
- Reward release is permissionless after approval, sends to the approved submission's immutable payee, sets state before external transfer, and is protected by `ReentrancyGuard`.
- Expired refunds are pull-based, per-contributor, only while Open/Refunding, after the settlement deadline plus seven days. Approved rewards cannot be refunded.
- Solidity 0.8 checked arithmetic applies. Failed native transfers revert the full operation, preserving state so an approved payout can be retried.

## Audit findings and limits

- **No independent professional security audit has been performed.** The source was reviewed in this engineering pass, and the test suite covers critical lifecycle, role, deadline, retry, replay, and reentrancy cases. Tests do not prove absence of vulnerabilities.
- **Human judgment:** one reviewer determines code quality; no quorum, arbitration, or dispute flow exists.
- **Address-only roles:** one person may control several addresses. No real-world identity or independence is proved.
- **Evidence:** files remain off-chain. A SHA-256 digest and browser comparison show byte equality only; they do not prove the evidence is truthful, relevant, or that tests passed.
- **Public metadata:** task JSON is permanent public event data; never include secrets, personal details, or confidential code.
- **Frontend signing:** BridgeKey is selected using connector name/ID metadata, which is self-reported and not cryptographic wallet authentication. No real BridgeKey connection or signature has been checked.
- **Network:** production Wagmi is Mainnet-only (4646), Testnet write gate is false, and the shared submission boundary checks connection, BridgeKey identity, Mainnet chain, and the write gate. Local Hardhat writes are enabled only for non-production E2E mode.
- **RPC proxy:** same-origin proxy allowlists bounded read-only RPC methods and rejects signing/broadcast/admin methods. It has no application authentication or hosting-layer rate limit in this repository.
- **Dependency advisory review:** A fresh `npm audit --omit=dev` on 30 October 2026 reported 30 production-tree package findings (18 high, 12 moderate, zero critical). Findings include PostCSS and optional wallet-connector dependencies. npm's broad graph fixes point to Next.js 16.4.3 and Wagmi 3.7.9 (major migrations); individual PostCSS, Lodash, WebSocket and connector leaves also have patch paths that need compatibility testing. No dependency changes were made. The full development tree was not refreshed; detailed versions, paths, advisory IDs, and a remediation proposal are in `docs/SECURITY_AND_LIMITATIONS.md`.
- **Live testing:** no bounty has been created or funded. Local Hardhat/Playwright transactions are not MST Mainnet activity.

## Release posture

The deployment record and runtime hash are verified against read-only MST Mainnet RPC. The current local code passes automated build/test checks, but the source is being published on a separate review branch, no hosted UI is confirmed, and BridgeKey has not had a live session. Do not describe the complete MVP as publicly released or fully wallet-verified until those items are resolved.
