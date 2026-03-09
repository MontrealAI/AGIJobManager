# Standalone HTML UI artifacts (`ui/*.html`)

This page indexes the versioned standalone HTML UI artifacts in this repository.

These files are **additive** to the broader Next.js UI effort in `ui/`; they are not a replacement for deployment/operator runbooks or the full UI roadmap.

## Canonical routing

- **Primary operator runbook for the documented mainnet artifact (`v21`):** [GENESIS_JOB_MAINNET_HTML_UI.md](./GENESIS_JOB_MAINNET_HTML_UI.md)
- **Broader/full UI docs hub (Next.js):** [README.md](./README.md)
- **Deployment/operator authority (Hardhat):** [../../hardhat/README.md](../../hardhat/README.md)
- **ENS replacement/cutover flow:** [../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)

## Artifact inventory

| File | Purpose | Network assumptions | Audience | Status |
| --- | --- | --- | --- | --- |
| `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` | Standalone, versioned browser interface artifact with live AGIJobManager/ENSJobPages reads and action-capable controls. | Mainnet-focused (`chainId 1`) with embedded contract constants. | Operators, reviewers, demos/audits needing a single-file client. | **Canonical standalone artifact for this repo runbook.** |
| `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v13.html` ... `v20.html` | Earlier standalone snapshots kept for comparison and reproducibility. | Mainnet-oriented snapshots. | Auditors/reviewers comparing behavior across versions. | Historical snapshots (non-canonical by default). |
| `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v22.html`, `v23.html` | Later snapshots adjacent to `v21`, useful for side-by-side review. | Mainnet-oriented snapshots. | UI maintainers/reviewers validating iteration deltas. | Additive snapshots (non-canonical by default). |
| `ui/dist-ipfs/agijobmanager.html` | Generated single-file output from the Next.js/IPFS build pipeline. | Depends on build-time environment/config. | Release operators and distribution maintainers. | Generated artifact. |

## Operator-safe expectations

- Standalone HTML pages are **client interfaces**, not deployment authority.
- Contract/network/address verification is still required before signing any write transaction.
- If UI guidance and deployment docs differ, follow deployment runbooks and on-chain behavior.

## Quick open guidance

For the canonical `v21` artifact:

1. Open the runbook: [GENESIS_JOB_MAINNET_HTML_UI.md](./GENESIS_JOB_MAINNET_HTML_UI.md).
2. Prefer local HTTP serving for browser compatibility:
   ```bash
   cd ui
   python3 -m http.server 8000
   ```
3. Open: `http://127.0.0.1:8000/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`.
