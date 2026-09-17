# v0.9.3 — Clear deployment, preserved ENS membership

v0.9.3 makes the Hardhat deployment and operating guides consistent with the USDC manager, preserves Agent and AGI Club ENS identity rules, and extends the real-mainnet fork rehearsal to participant membership.

## What changed

- Require a reviewed deployment configuration. The example is never selected automatically; owners and recipients are explicit, and historical Merkle exceptions are no longer enabled by default. Configuration summaries label each membership root and exception route.
- Harden ENS helper deployment: explicit owner, mandatory verification for broadcasts, accepted manager ownership, paused intake, and network-specific ENS configuration.
- Test canonical and alpha Agent/Club membership against real ENS contracts on the pinned local fork, including rejected and revoked identities. Preserve legacy allowlist and Merkle authorization as explicit owner-managed exceptions.
- Correct the operator sequence, non-overwriting setup, dry runs, two-step manager ownership, separate ENS helper ownership, dedicated job roots, recovery, and pre-activation checks.
- Route newcomers to the versioned USDC console and a verified new manager address. Clarify membership credentials, optional job pages, and the original manager's separate jobs and funds.

## Compatibility

Production Solidity is unchanged from v0.9.2, including the ENS resolver correction first published there. Agents use `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Club validators use `club.agi.eth` or `alpha.club.agi.eth`. The contract retains owner-managed allowlist and Merkle exceptions. Agents also need a configured NFT eligibility credential. Optional ENS job pages do not replace membership checks.

The default successful-job allocation remains **8% validators / 30% first wallet / 10% second wallet / 52% agent**, with separate bonds and posting-time validator terms.

This is a software release. It does not deploy contracts, activate production, transfer ownership, or migrate funds. Existing jobs remain on the legacy manager at `0xB3AAeb69b630f0299791679c063d68d6687481d1`. A fresh USDC manager starts with intake paused and uses its own ENS job namespace.

## Qualification and limits

Publication requires five successful workflows for the exact frozen source: contracts, UI, documentation, security, and actual-USDC/ENS forks. The publisher verifies the source marker in every required job's actual log. See [validation](https://github.com/MontrealAI/AGIJobManager/blob/main/docs/releases/v0.9.3/VALIDATION.md) and the [cutover evidence](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.3/docs/qualification/USDC_CUTOVER.md).

The fork uses local signer impersonation and test participants. It qualifies contract behavior against pinned ENS/USDC state; it does not prove production key access, current member ownership, the intended NFT configuration, or a live deployment. Actual recipients, signing paths, deployment verification, operating rehearsal and instance checks remain required before activation.

Static analysis retains 116 individually reviewed observations: 0 high, 7 medium, 36 low, 71 informational and 2 optimization. This is internal review and automated qualification, not an independent audit or a claim of flawlessness. ENS hooks remain best-effort; check actual records and events. The manager has 167 bytes of runtime headroom under the qualified compiler profile.

## Downloads

- **AGIJobManager-v0.9.3-COMPLETE.zip** — frozen source, USDC console, guides and release evidence.
- **agijobmanager-usdc.html** — standalone USDC console.
- **RELEASE_MANIFEST.json** — source identity and per-file SHA-256 inventory.
- **SHA256SUMS.txt** — asset checksums.

The archive must reproduce byte-for-byte. Uploaded asset sizes and SHA-256 digests are verified; earlier tags and releases are preserved.
