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
- **Tests**: [`test/`](../test), [`forge-test/`](../forge-test)
- **UI**: [`ui/`](../ui)

## Roles

| Role | Enforced on-chain | Off-chain responsibility |
| --- | --- | --- |
| Owner | Configuration, pause, allowlists, treasury withdrawal constraints | Change-control discipline, incident leadership |
| Moderator | Resolve disputes with explicit resolution code | Preserve audit trail and reason strings |
| Employer | Create/fund jobs, dispute, finalize | Provide quality job metadata, timely review |
| Agent | Apply, submit completion, claim payout on win | Maintain valid identity proof and completion artifacts |
| Validator | Vote with bond | Vote quality and timely participation |
| Anyone | Trigger some liveness actions like expiry/finalization depending on state | Event monitoring and alerting |
