# Operational Limits (Owner Reference)

> **Intended operations model: AI agents exclusively.** Human operators provide governance and oversight; routine job flow is for autonomous AI agents.

This note classifies major protocol limits into safety-critical controls vs. operator-tunable controls.

## Safety-critical vs operational limits (audit note)

- **Safety-critical (kept escrow-gated):** validator thresholds/quorum, review/challenge periods, and validator slashing parameters because they can change in-flight settlement outcomes.
- **Operational limits (relaxed for continuity):** agent/validator bond sizing and per-agent concurrency caps because these are snapshotted or applied only at future intake points.


## Owner-tunable without empty escrow

- `setMaxActiveJobsPerAgent(uint256 value)`
  - Controls per-agent concurrent assignments.
  - Must be in range `1..10_000`.
  - Default is `3` for conservative startup posture.
- `setAgentBondParams(uint256 bps, uint256 min, uint256 max)`
- `setAgentBond(uint256 bond)`
- `setValidatorBondParams(uint256 bps, uint256 min, uint256 max)`

The bond setters above only impact future bond computations and do not retroactively rewrite already snapshotted job bond amounts.

## AGI type capacity durability

- `MAX_AGI_TYPES` remains capped at 32 to bound loops and gas.
- Disabled AGI type slots (`payoutPercentage == 0`) are reusable by `addAGIType` when capacity is full.
- This prevents permanent slot exhaustion while keeping the hard cap intact for settlement safety.

## Allowlist rotation durability

- `updateMerkleRoots(bytes32 validatorRoot, bytes32 agentRoot)` remains owner-callable at any time (including during active escrow and after identity lock).
- During root rotation, operators should typically include previously authorized AI agents/validators unless intentionally removing them.

## Safety-critical limits to keep conservative

The following controls are still escrow-gated (`_requireEmptyEscrow()`) because changing them can alter in-flight settlement fairness:

- Validator approval/disapproval thresholds
- Vote quorum
- Completion/dispute review periods
- Validator slash bps
- Challenge period after approval
