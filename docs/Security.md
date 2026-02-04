# Security model and limitations

This document summarizes security considerations specific to the current `AGIJobManager` contract. It should be read alongside the interface reference and test suite.

## Audit status

No public audit report is included in this repository. Treat deployments as experimental until independently reviewed.

## Threat model overview

**Assets at risk**
- Escrowed ERC‑20 funds held by the contract.
- Job NFTs minted on completion.
- Reputation mappings used for access and trust signals.

**Adversaries**
- Malicious employers or agents attempting to bypass settlement conditions.
- Malicious validators attempting to skew approvals/disapprovals.
- A compromised owner or moderator key.
- Integrator misconfiguration (wrong roots, wrong token address, wrong payout parameters).

## Primary trust assumptions (centralization risks)

- **Owner powers**: can pause flows, update configuration, manage allowlists/blacklists, add AGI types, and withdraw surplus ERC‑20 via `withdrawableAGI()`.
- **Moderator powers**: resolve disputes with typed action codes via `resolveDisputeWithCode` (agent win or employer win). The legacy `resolveDispute` maps only canonical strings; non‑canonical strings keep the dispute open.
- **Validator set**: validators are allowlisted or ENS/Merkle‑gated; the contract does not enforce decentralization or slashing.

## Known limitations and assumptions

- **Root immutability after lock**: ENS root nodes and critical config can be permanently locked with `lockConfiguration`.
- **ENS dependency**: ownership checks rely on ENS registry, NameWrapper, and resolver behavior.
- **ERC‑20 compatibility**: transfers must return `true` or no data and match exact amounts; fee‑on‑transfer and rebasing tokens are not supported.
- **Validator capacity**: each job stores at most `MAX_VALIDATORS_PER_JOB` validators; thresholds must fit within this bound.
- **Time enforcement gap**: only `requestJobCompletion` enforces the job duration. Validators can still act after a deadline once completion is requested unless off‑chain policy prevents it.
- **Dispute gating**: disputes can only be opened after completion is requested; once disputed, validator voting no longer advances settlement.
- **Marketplace safety**: `purchaseNFT` is protected by `nonReentrant` and uses ERC‑721 safe transfers; contract buyers must implement `onERC721Received`.

## Operational recommendations

- **Key management**: use hardware wallets or managed key services for owner/moderator keys.
- **Monitoring**: alert on `JobDisputed`, `DisputeResolvedWithCode`, `JobCompleted`, `JobFinalized`, and `ReputationUpdated` events.
- **Parameter governance**: document and approve changes to validator thresholds, payout percentages, and merkle roots.
- **Incident response**: use `pause` to halt all state‑changing actions during incident investigation.

## Disclosure

Report security issues privately via [`SECURITY.md`](../SECURITY.md).
