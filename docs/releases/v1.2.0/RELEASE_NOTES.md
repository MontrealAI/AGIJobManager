# v1.2.0 — Settlement visibility and recovery guidance

A closed job can still have an unpaid reserved claim. This release gives operators a read-only way to reconcile outstanding obligations and explains how to supervise recovery.

## Download and start

- **Complete package:** [AGIJobManager-v1.2.0-COMPLETE.zip](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.0/AGIJobManager-v1.2.0-COMPLETE.zip). Open `START_HERE.md` after extracting it.
- **Standalone console:** [agijobmanager-usdc.html](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.0/agijobmanager-usdc.html).
- Verify downloads with [SHA256SUMS.txt](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.0/SHA256SUMS.txt); the [manifest](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.0/RELEASE_MANIFEST.json) identifies the frozen source and every archive payload file.

## What changed

- `npm run settlement:status -- --help` introduces aggregate escrow, agent-bond, validator-bond, dispute-bond and claim reporting. It distinguishes selected beneficiary claims from claims outside that selection and reads selected job deadlines directly from the contract.
- Reads use one block, explicit chain checks, a before/after block-hash check, exact integer accounting and bounded selections. An optional second RPC must agree. The default 12-block depth is configurable and is not a finality guarantee.
- The command loads no signer and broadcasts no transaction. Human-readable and JSON output have explicit success, attention and failure exit codes; provider failures do not expose RPC URLs or response bodies.
- The recovery guide covers paused clocks, outstanding claims after job closure, fair retries, blocked beneficiaries, shared capacity and the limits of automated judgment. Seven new public test cases include actual CLI transport and failure handling.
- Versioned source, console labels, generated distribution and qualification fingerprints are synchronized to v1.2.0.

## Compatibility and scope

Every Solidity source, ABI, creation/runtime bytecode, eight fixed library links, payout rule, dependency resolution, legal notice and historical deployment/release record is preserved. Existing managers, jobs, allowances, ENS namespaces, settings and agreements remain on their original deployments. The v1.1.0 read-only deployment defaults and v1.0.5 privacy safeguards remain in place. No live manager or deployment is supplied by this software release.

Private AGI Agent, AGI Node and autonomous fleet implementations, packages, credentials and private test artifacts are **not included**. This is a public manager tooling release, not an autonomous moderator or transaction scheduler.

## Qualification and limits

Frozen application source: `12abd6c8a8066a66600991cdc865270978f5b855` (tree `54e69b5113bdafed3b19ba46daa62bf5bfcf427f`). The source PR is [#1534](https://github.com/MontrealAI/AGIJobManager/pull/1534). Publication requires all five source workflows and all eight jobs to succeed at this exact checkout, plus reproducible packaging, protected-history checks and uploaded-asset SHA-256 verification. See `VALIDATION.md` in the complete package for the executed checks and evidence links.

Zero reserved liabilities means only that the five counters are zero at the reported block. It does not prove useful work, participant profitability, unlimited throughput or recovery under every future outage. Closed jobs can retain claims; paused settlement and issuer restrictions can delay payment. The status tool reports a selected snapshot, does not enumerate every job or claimant, and does not verify deployed bytecode or token issuer. Technical qualification is not an independent security audit or live deployment approval.
