# v1.7.0 — Funded reviewer protection and calibrated admission

The previous simulation showed that reviewers could spend time and then miss payment when a job closed before their vote. Qualification could also repeat optimistic assumptions or arrive too late. This release implements controls for those weaknesses.

## Changes

- Add `AGIReviewEscrow`, a separate, non-upgradeable native-USDC companion. Actual employers fund named, delivery-bound review assignments. Activation creates irrevocable credit; beneficiaries retain withdrawal rights after job closure. Unactivated assignments can be refunded. Existing manager contracts and payout rules remain byte-identical.
- Account for retainers as additional employer expense and capital, and count reviewer cash only when paid. Model unpaid/unavailable/refunded states separately.
- Bind current admission envelopes to exact calibration-report bytes, disjoint calibration/evaluation groups, measured margins/losses, cost/value bounds, frequency drift and nonzero stress weights. Signatures establish provenance, not truth.
- Add bounded qualification queues, expiration/rejection and a reserved recovery slot. Timed-out underlying work retains capacity until it settles. The supplied benchmark measures local synthetic envelope/report verification only.
- Add dual-RPC canonical retainer observations and safe Hardhat deployment/recovery commands with gas limits, broadcast journals, runtime/immutable checks, independent confirmation and explorer verification.
- Update package identities, generated UI, documentation and the 18-command deployment guide.

## Verified release

All five exact-source workflows and all eight required jobs passed. The contract/tool suite passed **662 cases**; separate deployment checks passed **109 preflight/recovery cases and 11 actual local-deployment cases**. The native-USDC fork suites passed **34 cases** (11 fork lifecycle/retainer cases plus 23 cutover cases). Browser/UI, documentation, dependency audits, Foundry fuzz/invariants and the reviewed Slither gate passed. New malicious-token callback tests exercise the escrow reentrancy guard. The static-analysis review is internal, not an independent audit.

Publication re-verifies every source checkout, runs release-gate and standalone-console checks, and requires two byte-identical archive builds. Asset size/digest checks must pass before the draft becomes public. Previous releases and historical deployment/legal evidence remain intact.

## Adoption and limits

This is commissioning software. An existing manager is not automatically upgraded. Review protection requires the separate companion, reviewed participant policies, independent qualification and sufficient employer capital. Retainers compensate authorized capacity; they do not guarantee work quality, useful settlement or net profit. Employers can lose a retainer after activation even if a reviewer underperforms.

No production chain deployment, physical-Mac/provider benchmark, independent security audit or new million-offer rerun is claimed. The historical simulation is a baseline, not a measurement of these new controls. Mainnet policies should rely on observed outcomes; synthetic evidence remains test/pilot evidence. Read the operations guide before enabling funded activity.
