# ENS admission and deployment hardening

ENS-derived membership now requires a readable, nonzero registry owner. Wrapped membership also requires the registry to identify the configured NameWrapper and a live wrapped owner. This closes stale-wrapper and unowned-name admission paths. Explicit allowlists and Merkle exceptions remain intentional authority routes. A live owner's resolver alias can remain valid after transfer; clear unwanted aliases operationally. Regression tests exercise these distinctions.

This changes linked ENS library bytecode, while retaining the public manager ABI. Existing immutable managers are not upgraded and existing liabilities do not migrate. Deploy and independently review a new instance only after separate authorization. The prior release's source, runtime evidence and deployment records are preserved rather than relabeled as candidate qualification.

Deployment dependency reads now bind to one canonical block hash and fail closed when canonical hash reads are unsupported. Readiness requires all five exact reserves, valid addresses, two fee wallets, boolean pause flags and solvent zero initial liabilities, including deferred claims. A deployment cannot report paused success if the intended owner has already opened intake during verification.

Public employer intake, payout economics, governance and default settings are unchanged. There is no aggregate escrow cap or private employer invitation gate. The per-job default remains 88,888,888 USDC; the proposed 100-USDC pilot setting has not been applied.

The release retains reproducible packaging, exact-source workflow gates, offline reconstruction, checksums and source-bound attestations. Passing automated checks is not a flawless-contract guarantee or an independent security audit. See the candidate's [engineering scope and evidence](../../qualification/ENS_MEMBERSHIP_REVOCATION.md).
