# Overview

AGIJobManager is an owner-operated escrow and settlement contract for employer-agent jobs with validator voting and moderator dispute resolution.

## High-level guarantees

1. Escrow solvency is tracked on-chain via locked accounting buckets.
2. Job settlement follows explicit state guards (assignment, completion request, review windows, dispute paths).
3. Treasury withdrawal is constrained to `withdrawableAGI()` and pause requirements.
4. ENS and ENSJobPages integrations are best-effort; they do not replace settlement safety checks.

## Components

- **Core contract**: [`contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- **Deployment**: [`migrations/1_deploy_contracts.js`](../migrations/1_deploy_contracts.js), [`migrations/deploy-config.js`](../migrations/deploy-config.js)
- **Operational scripts**: [`scripts/ops/validate-params.js`](../scripts/ops/validate-params.js), [`scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
- **Deployment guide**: [`DEPLOYMENT_OPERATIONS.md`](./DEPLOYMENT_OPERATIONS.md)
- **Automation inventory**: [`SCRIPTS_REFERENCE.md`](./SCRIPTS_REFERENCE.md)
- **Tests**: [`test/`](../test), [`forge-test/`](../forge-test)
- **UI (broader/full effort in development)**: [`ui/`](../ui), docs: [`ui/README.md`](./ui/README.md)
- **Standalone HTML UI artifact (versioned, additive)**: [`ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`](../ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html), runbook: [`ui/GENESIS_JOB_MAINNET_HTML_UI.md`](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)


## UI surfaces (current state)

- **Standalone HTML UI artifact (v21):** a versioned, single-file mainnet-focused interface for direct browser-based operations/review.
- **Broader/full UI:** Next.js UI stack in `ui/`, still under active development.
- **Authority model:** UI surfaces are clients; AGIJobManager + ENSJobPages contracts remain authoritative.

## Roles

| Role | Enforced on-chain | Off-chain responsibility |
| --- | --- | --- |
| Owner | Configuration, pause, allowlists, treasury withdrawal constraints | Change-control discipline, incident leadership |
| Moderator | Resolve disputes with explicit resolution code | Preserve audit trail and reason strings |
| Employer | Create/fund jobs, dispute, finalize | Provide quality job metadata, timely review |
| Agent | Apply, submit completion, claim payout on win | Maintain valid identity proof and completion artifacts |
| Validator | Vote with bond | Vote quality and timely participation |
| Anyone | Trigger some liveness actions like expiry/finalization depending on state | Event monitoring and alerting |
Operator navigation: root gateway [README.md](../README.md), docs hub [README.md](./README.md), standalone UI runbook [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md), standalone artifact index [ui/STANDALONE_HTML_UIS.md](./ui/STANDALONE_HTML_UIS.md), and UI directory inventory [../ui/README.md](../ui/README.md).
