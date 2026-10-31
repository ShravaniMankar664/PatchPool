# Judge Q&A

Answers reflect the current source, test evidence, and read-only Mainnet check on 30 October 2026. Do not imply a live bounty flow.

### Why blockchain instead of a normal database?

A database can record a task and decision. The PatchPool contract additionally escrows funds, enforces the assigned reviewer and lifecycle transitions, binds an approved decision to a stored submission and payee, prevents payout/refund double use, and emits inspectable events. The trade-off is public permanent data, transaction friction, and dependence on human review. The corrected contract is deployed and source-verified on MST Mainnet; its application lifecycle has only been tested locally so far.

### How is PatchPool different from existing bounty platforms?

It focuses on tying a public hash-committed task record to a specific Git revision, evidence digest, assigned reviewer decision, and the payee that receives contract settlement. Existing products already support bounty workflows and, in some cases, escrow, multiple contributors, and reviewer approvals; PatchPool does not claim to be first or uniquely trustless. Its product hypothesis needs sponsor and contributor validation.

### Does the digest prove the code is correct?

No. Keccak-256 verifies that the task JSON matches its commitment. The evidence SHA-256 digest lets a reviewer compare supplied bytes with a recorded digest. Neither proves the code works, that tests ran, or that evidence is truthful.

### What if the reviewer is dishonest or disappears?

The MVP uses one assigned reviewer, so bias, collusion, and inactivity are real limitations. A reviewer can reject work without appeal. If no submission is approved, eligible contributors can claim their own contributions after the settlement deadline plus seven days. An approved reward cannot be reclaimed as a refund; the payee can retry release if a transfer fails. The system does not auto-approve work or provide arbitration.

### Can a sponsor change acceptance criteria after funding?

There is no contract method to edit the committed task hash, reviewer, deadlines, or funding rules. The current task record is emitted at creation and the contract checks its exact JSON bytes against the hash. A future change would require a new bounty; existing funded terms are not silently rewritten.

### What happens if shared funding is insufficient?

The current contract has no activation threshold or funding cap. A bounty is open and can accept contributions through its submission deadline; the recorded aggregate is the payable reward if a submission is approved. Do not describe minimum pool thresholds or maximum caps as features.

### What if multiple developers submit similar work?

Each bounty stores separate submissions and disallows duplicate commit identities of the same Git hash type. The assigned reviewer chooses a specific submission ID to approve. Similar but distinct commits can still be submitted; there is no reservation or first-come guarantee.

### How is the code reviewed?

Outside PatchPool, by the assigned human reviewer against the task record and supplied source/evidence. PatchPool records the source identifier, evidence digest, reviewer decision, and settlement outcome; it does not fetch repositories, run tests, or assess code quality.

### Who is this for and how might it earn revenue?

Potential users include open-source maintainers, Web3 teams, startups, agencies, developer communities, and individual sponsors. A settlement fee or paid organization workflows are hypotheses only. There are no validated customers, interviews, revenue, or active users claimed.

### Is the project live? Has it been audited?

The PatchPool deployment is verified and finalized on MST Mainnet (chain 4646), but no bounty transaction has been made through the app. Mainnet writes are enabled in the frontend and require an identified BridgeKey provider and normal wallet confirmation. The contract has local automated tests, but there has been no independent professional security audit. The last recorded npm audit (29 October 2026) reported production dependency findings; the audit service could not be refreshed on 30 October because npm's endpoint was unavailable. Details and dates are in `SECURITY_AND_LIMITATIONS.md`.
