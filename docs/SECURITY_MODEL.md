# Security Model

## Threat model

| Vector | Impact | Mitigation | Residual risk | Operator responsibility |
| --- | --- | --- | --- | --- |
| Privileged key compromise | Full admin misuse | Hardware wallets, multisig, pause controls | High if governance weak | Strict key management and signer separation |
| Validator collusion | Biased outcomes | Bonds, disapproval paths, dispute escalation | Medium | Monitor vote patterns and rotate allowlist |
| ENS integration failures | Eligibility false negatives | Best-effort checks + explicit allowlists | Medium | Maintain fallback allowlist operations |
| Metadata abuse (`jobSpecURI`) | Off-chain confusion/phishing | URI validation helpers and policy | Medium | Enforce URI hygiene and content review |
| Gas griefing / liveness stress | Delayed settlement | Time windows + stale dispute resolution | Medium | Alert on aging jobs/disputes |
| Owner parameter misconfiguration | Insolvency/liveness degradation | Validation scripts + staged rollout | Medium-High | Change-control checklist |

## Controls

- `pause` for broad emergency containment.
- `settlementPaused` for controlled lane restriction.
- `blacklistAgent`/`blacklistValidator` for targeted actor isolation.
- `lockIdentityConfiguration` to freeze ENS/token wiring permanently.

## Explicit limitations

- Not a trustless court; moderators and owner are privileged.
- ENS hooks/tokenURI are convenience integrations.
- Off-chain metadata availability and quality are out-of-contract guarantees.
