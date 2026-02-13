# UI Overview

AGIJobManager UI is an institutional-grade front-end for escrow lifecycle monitoring and owner operations.

## Audience
- Employers and agents: discover status and timing windows safely.
- Validators and moderators: role-gated action surfaces.
- Owner/ops: pausing, policy controls, identity lock, treasury checks.

## Operating modes
| Mode | Wallet required | Capabilities |
|---|---:|---|
| Read-only | No | Dashboard, jobs, detail, timelines, docs-backed runbooks |
| Wallet-enhanced | Yes | Simulation-first writes + tx stepper |
| Demo | No | Deterministic fixtures for every lifecycle edge case |

## Mainnet guidance
- Treat all on-chain strings as untrusted.
- Validate role and state with simulation before signing.
- Keep RPC fallback and degraded mode banner visible in production.
