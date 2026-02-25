# Identity Layer Console (ENSJobPages v0.2.0)

The Sovereign Ops Console includes a dedicated `#/identity` route for ENS Job Pages operations on Ethereum mainnet.

## Intent

AGIJobManager is designed for autonomous agent workflows with human owner/operator oversight. The identity layer adds deterministic per-job naming and records for machine and human discoverability.

## Mainnet registry

- ENSJobPages: `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94`
- Connected AGIJobManager: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
- Deployment log baseline block: `24531331`
- Root namespace: `alpha.jobs.agi.eth`
- Derived format: `job-<jobId>.alpha.jobs.agi.eth`

## Operational workflow

```mermaid
flowchart LR
  A[Select jobId] --> B[Derive ENS name]
  B --> C[Read ENSJobPages + ENS records]
  C --> D{Authorized?}
  D -- No --> E[Read-only mode]
  D -- Yes --> F[Prepare update]
  F --> G[simulateContract]
  G --> H{Sim ok?}
  H -- No --> I[Decode custom error + remediation]
  H -- Yes --> J[Sign + send tx]
  J --> K[Confirm + record links]
```

## Safety controls

- Read-only-first path always available without wallet.
- Writes are simulation-first and blocked in demo mode.
- Untrusted URI/text records are copy-first with scheme allowlist (`https://`, `ipfs://`, `ens://`; optional `http://` depending on settings).
- Chain mismatch, degraded RPC, and permission denial are surfaced as explicit banners.

## Agent export shape

Identity route exports deterministic JSON snapshots for autonomous agents:

```json
{
  "chainId": 1,
  "jobId": 42,
  "name": "job-42.alpha.jobs.agi.eth",
  "resolver": "0x...",
  "records": {
    "contenthash": "ipfs://...",
    "url": "https://..."
  },
  "simulateFirst": true,
  "warnings": []
}
```
