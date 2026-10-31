# Final Submission and Release Checklist

Updated 31 October 2026. Statuses describe evidence now available; an unchecked item is not implicitly complete.

## Engineering and deployment

- [x] **VERIFIED ON-CHAIN** — MST Mainnet reports chain 4646; deployment receipt succeeded at block 21783933; address and runtime Keccak hash match the finalized registry.
- [x] **COMPLETED** — Mainnet write gate is true; Legacy Testnet gate is false; production chain configuration is Mainnet-only.
- [x] **TESTED** — 62 contract tests, 4 RPC proxy tests, 5 local Playwright E2E scenarios, typechecks, lint, production build, and diff check passed in the latest local validation.
- [x] **COMPLETED** — Approval-gated read-only preflight and Mainnet transaction verification sequence documented in `MAINNET_MANUAL_VERIFICATION.md`; no step has been executed.
- [ ] **NEEDS MANUAL APPROVAL** — Connect BridgeKey on MST Mainnet, confirm account/chain, and conduct a non-transactional read/session check. Do not sign without approval.
- [ ] **NEEDS MANUAL APPROVAL** — Any real bounty flow requires a separate explicit authorization before each wallet-confirmed transaction. No bounty exists from this project flow.
- [ ] **BLOCKED** — Independent professional smart-contract audit has not been performed.

## Source and live app

- [x] **COMPLETED** — Copy-ready README and technical setup are present locally.
- [x] **COMPLETED** — Project overview, Google Form answers, Unstop draft, demo script, security notes, and this checklist are prepared under `submission/`.
- [ ] **NEEDS MY APPROVAL** — Review local source, scan for secrets, commit/push the desired worktree changes, and ensure the GitHub repo displays the implementation. No commit/push performed.
- [ ] **NOT STARTED** — No public frontend URL is configured or confirmed. Choose hosting, review hosting secrets/settings, then deploy only with explicit approval.
- [ ] **NOT STARTED** — No demo video is recorded or uploaded. Record the local walkthrough, set view permissions, verify access, then insert its link.

## Hackathon submission

- [ ] **BLOCKED — DEADLINE/ACCESS** — Organizer-supplied Google Form deadline was 30 Oct 2026 at 3:00 PM IST. No form URL was supplied or found in the public Unstop listing during the prior review. Ask organizers whether late submission/reopening is possible and obtain the official URL if reopened.
- [ ] **NEEDS MY APPROVAL** — Verify the team-specific Unstop Round 2 submission window and shortlist eligibility in the team account. Public listing says registration closed and lists deliverables, but does not show the Round 2 timestamp.
- [ ] **NEEDS MY APPROVAL** — Submit the Unstop materials only after the source is published and an accessible demo link is available. No submission receipt exists.
- [ ] **NOT STARTED** — Verify that repository, application, video, and presentation links are accessible from a signed-out browser; record results after publication.
- [ ] **NOT CLAIMED** — Top-15 finalist status is unknown. Do not book/claim Demo Day attendance as a finalist without organizer confirmation.

## Team fields to complete privately

- Team lead email: `[complete from official team account]`
- Team lead phone: `[complete from official team account]`
- Confirm team roster, eligibility, and team-specific Unstop deadline.
- Confirm whether organizer will accept a late Google Form response or reopen it.
