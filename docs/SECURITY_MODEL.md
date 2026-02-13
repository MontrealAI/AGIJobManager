# Security Model

## Threat model

| Vector | Impact | Mitigation | Residual risk | Operator responsibility |
| --- | --- | --- | --- | --- |
| Privileged key compromise | Parameter abuse / fund governance risk | Owner opsec, multisig, pause controls | High if key custody weak | Strong key management and rotation |
| Validator collusion | Biased vote outcomes | Bonding, thresholds, disputes | Medium | Curate validator set and monitor vote patterns |
| ENS integration failure | Eligibility false negatives / metadata failure | Best-effort design, fallback allowlists | Low-Medium | Maintain additional allowlists and comms |
| Griefing/dispute spam | Operational overload | Dispute bond, moderator workflows | Medium | Enforce runbook + escalation windows |
| Contract bug | Financial loss or liveness degradation | Tests, invariants, staged rollout | Non-zero | Conservative rollout and rapid response |

## Operator controls

- `pause`: emergency broad stop.
- `settlementPaused`: settlement-specific stop.
- Blacklists: actor-level containment.
- `lockIdentityConfiguration`: permanently freeze identity wiring.

> **Non-goal / limitation**
> The protocol does not remove trust in operators/moderators; it formalizes and constrains it.
