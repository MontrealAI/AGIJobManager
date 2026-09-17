# AGI Jobs concept one-pager — historical narrative

> Source: `presentations/AGI_Eth_Institutional_v0.pptx` (AGI.Eth Namespace + AGI Jobs v0)

This historical concept narrative is not a description of all implemented contract features. Alpha-work telemetry, emissions/burn policy, commit–reveal validation, one-click node deployment and institutional measurements below are conceptual. Current v0.9.3 operations use native Circle USDC, direct approval/disapproval votes and the [Hardhat deployment guide](../hardhat/README.md). The contract cannot change USDC supply or burn/emission policy.

## Institutional brief: identity → proof → settlement → governance

AGI Jobs is framed as a **metrology + settlement** system. It binds identity to verifiable work, proves outcomes, and settles value with minimal governance overhead.

## α‑Work Units (α‑WU)

- **Canonical, hardware‑normalized measure of verified work**, policy‑parameterized per domain.
- Computed from signed metering telemetry × difficulty tier × quality score.
- Failing acceptance/SLO yields **0 credit**.

## $USDC utility (token‑only)

- **Stake**: bond participation, Sybil resistance, and slashable accountability.
- **Settle**: jobs paid via escrow; release after validation; fee routing + optional burn.
- **Coordinate**: epoch accounting (α‑WU), routing signals, governance parameters.
- **Token coupling (thermostat)**: supply and incentives tethered to validated α‑WU.

Signals: validated α‑WU/epoch · dispute rate · SLO drift · burn/emission ratios.

Actuators: fee splits · burn fraction · tier multipliers · quorum/slashing parameters.

> Utility token only: required for protocol operation; **no equity, profit rights, or claims on an entity**.

## AGI Alpha Nodes (synthetic AI labor infrastructure)

**What is an AGI ALPHA Node?**
- Containerized runtime that is **ENS‑identified**, staked, and authorized to execute/validate AGI Jobs.
- Binds identity to `<name>.alpha.node.agi.eth` for trustless discovery.
- Produces measurable work that can be settled on‑chain (proofs + receipts).

**Roles (clear accountability)**
- **Worker**: executes deterministically; publishes artifacts; claims settlement after validation.
- **Validator**: commit–reveal attestations; scores SLO + output quality; slashable for dishonesty.
- **Sentinel**: monitors health/drift; triggers local pause + escalation; preserves audit posture.

**Operator UX (institutional posture)**
- One‑click/container‑first deployment with boot‑time safety checks (ENS, stake, contracts).
- Signed telemetry + tamper‑evident audit trails; dashboards (Prometheus/Grafana).
- Fail‑closed controls: circuit breakers, local pause, incident playbooks, key custody.

## Universal deployability (agents + businesses)

**Principle: one name, infinite deployability**
- Register a canonical L1 ENS handle (e.g., `defi.agi.eth`) as the point of contact.
- Store L2/cross‑chain addresses and metadata in ENS records for frictionless interaction.
- Keep multi‑chain complexity and fractional token relationships “behind” one human‑readable identity.

**Practical pattern (best practice)**
- Use ENS text records (ENSIP‑5) for endpoints, capabilities, and provenance pointers.
- Use wildcards (ENSIP‑10) + CCIP‑Read (EIP‑3668) for high‑churn records at scale.
- Normalize names (ENSIP‑15) before hashing/lookup to reduce spoofing and ambiguity.

**Engineering posture**
- Pre‑alpha stacks must stay **policy‑bounded** (pause, allowlists, rate limits).
- Prefer reproducible builds + pinned deps; export audit packs by default.
- Treat the env registry as the “source of truth” for official recognition.

## Current deployment path

The earlier Green Path and one-click commands in this concept narrative are retired and are not release qualification. Use the [Hardhat guide](../hardhat/README.md), [owner runbook](OWNER_RUNBOOK.md) and [cutover qualification](qualification/USDC_CUTOVER.md). Review explicit recipients, owner and membership roots; run the read-only plan, obtain the actual operational rehearsal, deploy with intake paused, verify source/runtime, accept ownership and complete live readiness before activation. Passing a dashboard or publishing a release does not deploy a contract or certify production operations.

## Adoption playbook

**Start with proofs; scale autonomy only as verification stays ahead**

1. **Pilot**: pick one workflow, define acceptance tests, run private nodes, export audit packs.
2. **Harden**: add validator quorum, enable policy brakes, increase replay coverage, establish key custody + rotation.
3. **Scale**: route more workloads, publish α‑WU indices, and enable broader external NFT trading as governance confidence increases.
