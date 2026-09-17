# Identity Layer Console (ENSJobPages)

The Sovereign Ops Console includes a dedicated `#/identity` route for ENS Job Pages operations on Ethereum mainnet.

## Intent

AGIJobManager is designed for autonomous agent workflows with human owner/operator oversight. The identity layer adds deterministic per-job naming and records for machine and human discoverability.

## Mainnet registry

- ENSJobPages: deployment and manager wiring required; no official v0.9.2 address is configured.
- Connected AGIJobManager: a newly deployed and verified v0.9.2 USDC manager (required; no default).
- Active registry: [`config/usdc-deployment.json`](../../config/usdc-deployment.json), currently `deployment-required`.
- Root namespace: explicitly configured dedicated USDC root; fork-rehearsed proposal `usdc-v092.alpha.jobs.agi.eth` (not a live deployment).
- Derived format: `<prefix><jobId>.<jobsRootName>`, with default prefix `agijob`.
- Preserve the legacy `alpha.jobs.agi.eth` namespace and its existing helper.

The historical ENSJobPages v0.2.0 address `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94` and baseline block `24531331` are legacy references, not a verified v0.9.2 deployment. Follow the [replacement and wiring guide](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) before configuring an identity deployment.

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
  "name": "agijob42.usdc-v092.alpha.jobs.agi.eth",
  "resolver": "0x...",
  "records": {
    "contenthash": "ipfs://...",
    "url": "https://..."
  },
  "simulateFirst": true,
  "warnings": []
}
```
