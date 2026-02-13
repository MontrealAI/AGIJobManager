# UI Overview

The Sovereign Ops Console targets three audiences:
1. **Read-only observers** (no wallet)
2. **Operational actors** (employer/agent/validator/moderator)
3. **Owner administrators** (pause, policy, treasury)

## Modes
| Mode | Wallet Required | Capabilities |
|---|---|---|
| Read-only | No | Dashboard, jobs, timelines, policy snapshot |
| Wallet-enhanced | Yes | Simulation-first writes, approvals, tx tracking |
| Demo | No | Deterministic fixtures + actor switching |

## Mainnet guidance
- Treat all strings and URIs as adversarial inputs.
- Validate network + role before writes.
- Use degraded-RPC indicators to avoid stale operational decisions.
