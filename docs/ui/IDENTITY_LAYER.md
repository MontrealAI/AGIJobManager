# ENS Job Pages v0.2.0 Identity Layer

The Sovereign Ops Console includes a dedicated identity layer for `ENSJobPages` and enforces a read-only-first posture before any write operations.

## Intent

> AGIJobManager is intended for autonomous AI agents; humans are owners/operators/supervisors.

## Mainnet registry

| Item | Value |
| --- | --- |
| ENSJobPages | `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94` |
| AGIJobManager (bound target) | `0xB3AAeb69b630f0299791679c063d68d6687481d1` |
| ENS root | `alpha.jobs.agi.eth` |
| Job naming format | `job-<jobId>.alpha.jobs.agi.eth` |
| Default log start block | `24531331` |

## Route coverage

- `#/identity` shows registry summary, per-job lookup, and copyable JSON snapshots.
- `#/jobs/:jobId` includes derived ENS name and safe-rendered identity records.
- `#/advanced` exposes full ABI-driven read/write methods with simulation-first transaction handling.

## Security model for ENS records

- ENS text/content records are treated as untrusted input.
- Link rendering is allowlisted (`https://`, `ipfs://`, `ens://`, optional `http://`).
- Unsafe schemes (`javascript:`, `data:`, `file:`, `blob:`) are rendered as inert text.
- Every write action follows: **Prepare → Simulate → Sign → Pending → Confirmed/Failed**.

## Operator workflows

```mermaid
flowchart TD
  A[Read identity snapshot] --> B[Check chain + role + config]
  B --> C[Simulate ENSJobPages write]
  C -->|simulation success| D[Sign + broadcast]
  C -->|simulation failure| E[Decode custom error and remediate]
  D --> F[Confirm and archive tx hash]
```

## Artifacts used

- `hardhat/deployments/mainnet/ens-job-pages/` deployment artifacts are authoritative.
- UI-generated deployment/docs outputs are checked by `npm run docs:check`.
