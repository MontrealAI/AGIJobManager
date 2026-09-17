# Security Model

## Threat model

| Vector | Impact | Mitigation | Residual risk | Operator responsibility |
| --- | --- | --- | --- | --- |
| Privileged key compromise | Full admin misuse | Hardware wallets, multisig, pause controls | High if governance weak | Strict key management and signer separation |
| Validator collusion | Biased outcomes | Bonds, disapproval paths, dispute escalation | Medium | Monitor vote patterns and rotate allowlist |
| ENS integration failures | Eligibility false negatives | Best-effort checks + explicit allowlists | Medium | Maintain fallback allowlist operations |
| Metadata abuse (`jobSpecURI`) | Off-chain confusion/phishing | URI validation helpers and policy | Medium | Enforce URI hygiene and content review |
| Gas griefing / liveness stress | Delayed settlement | Time windows + stale dispute resolution | Medium | Alert on aging jobs/disputes |
| Owner parameter misconfiguration | Unexpected eligibility, incentives or delayed settlement | On-chain bounds, snapshots, zero-reserve guards and instance preflight | Depends on operator configuration | Simulate and read back each change; review which posted jobs it can affect |
| USDC issuer restriction | Settlement or refunds temporarily unavailable | Atomic rollback preserves accounting; retry only after the cause is resolved | Issuer pause/blocklist authority is external | Monitor token state and all recipients; do not promise an on-chain bypass |
| Wallet/RPC or review-context change | A different account, chain or operation could be submitted | Pinned review context, live checks, simulation and receipt-status validation | State may still change before transaction inclusion | Re-review changed terms; reconcile transaction hash and final state |

## Controls

- `pause()` / `pauseIntake()` stops creation and assignment; existing completion, voting, settlement and refund paths remain available.
- `setSettlementPaused(true)` stops the settlement lane and also blocks creation/assignment. Reads remain available. `pauseAll()` sets both flags for an active exploit requiring broader containment.
- `blacklistAgent` / `blacklistValidator` blocks future guarded eligibility actions; it is not a confiscation or general settlement freeze.
- `lockIdentityConfiguration()` irreversibly freezes the guarded ENS address/root/pointer configuration. It is not an incident repair. Validate configuration first; USDC is already immutable independently of this lock.

## Explicit limitations

- Not a trustless court; moderators and owner are privileged.
- Validator authorization applies to wallet addresses. An employer or agent may vote if also validator-authorized; distinct wallets or ENS names do not prove independent people. Eligibility governance must account for conflicts of interest and collusion.
- ENS hooks/tokenURI are convenience integrations.
- Off-chain metadata availability and quality are out-of-contract guarantees.
- No-vote finalization after the review window favors the agent without independently validating the work. Validators must actively participate; time elapsing does not execute transactions.
- The two fixed-share recipients cannot be rotated while any escrow or bond is reserved. A blocked outstanding-job recipient cannot be bypassed through this owner control.
- Automated qualification and reviewed static findings are not an independent audit or an assurance that every adversarial scenario has been exhausted. Follow [mainnet readiness](MAINNET_READINESS.md) and [incident response](OPERATIONS/INCIDENT_RESPONSE.md).
