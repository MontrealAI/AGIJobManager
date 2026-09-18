# v1.0.1 — Distinct ENS identities for every deployment

New managers can restart job numbering at zero. v1.0.1 gives each fresh USDC manager a distinct ENS namespace automatically, so its jobs cannot accidentally use an earlier deployment's names through the supported deployment flow.

## New naming behavior

```text
job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth
```

`manager40` means the complete lowercase manager address without `0x`. The script uses the actual RPC chain ID and sets the `job-` prefix explicitly. No truncated address, software-version label or manually incremented deployment counter is used. A normal application can display **AGI Job #0** while retaining the full ENS name and `(chainId, managerAddress, jobId)` identity.

- **Fresh mode:** derives the namespace, rejects existing jobs/helpers, occupied roots, resolver remnants and mismatched name/node/prefix overrides. The dry run displays the complete name before any transaction.
- **Same-manager replacement:** explicitly select `ENS_DEPLOYMENT_MODE=replacement`. The active helper's manager back-reference, registry, root and prefix are checked; its namespace is preserved. Historical per-job snapshots still require inventory and any necessary exact-label migration.
- **Verified configuration:** root, node, prefix and manager readback must match before configuration locks or ownership handoff. Deployment journals retain the namespace and example job name.
- **Historical preservation:** Genesis, Prime and Employer Burn references are documented. Their contracts, jobs, records and names are not migrated or overwritten by this release.

These safeguards are enforced by the supported deployment tooling. Production contracts are unchanged and retain their owner-managed settings. Direct manual administration must follow the same naming and preservation policy. A dry run checks availability but does not reserve a name.

## Also included since v1.0.0

This edition packages the reviewed wallet/deployment/completion-context console fixes, mobile layout improvements, combined free ENS name plus identity-NFT onboarding, participant guidance and the 24-scenario historical Genesis job simulation already present on main. Prior v1.0.0 assets remain unchanged.

## Compatibility and validation

Production Solidity source, ABI, settlement rules, compiler settings and dependency versions are unchanged. Verified compatible v0.9.6, v0.9.7 and v1.0.x managers keep their original jobs and namespaces; updating the console does not require redeployment. Fresh helper setup deliberately requires zero posted jobs and no existing helper. Existing managers without a helper need a separately reviewed historical-page plan.

Local checks passed **532 contract/console regressions, 100 deployment/readiness/verification tests, 178 UI tests and 35 standalone-console checks**. Solidity compilation reported zero warnings/errors. The manager runtime remains **24,359 bytes**. The new EVM regression creates job zero under two manager-specific roots while preserving five historical ENS label forms.

Publication requires all five workflows and every required job to pass for frozen source `becf9a30a59b9a6f26df06c7517047353bc91465`: contract CI, UI CI, Docs Integrity, Security Verification and Mainnet USDC Fork Qualification. The release records those runs and verifies their actual checkout markers. Static-analysis review retains the existing findings; this patch does not claim an external audit or zero findings. Version-only evidence fingerprints were refreshed without changing historical observations or findings dispositions, then subjected to the same gates.

## Downloads and operation

Download the standalone console or complete ZIP together with `SHA256SUMS.txt`. The ZIP contains frozen source, operating documentation, qualification evidence and the content manifest. The console requires internet access, an Ethereum wallet and a verified compatible manager; no live USDC manager is supplied.

Start with the [ENS naming guide](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.1/docs/ENS_DEPLOYMENT_NAMESPACES.md), [participant guide](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.1/docs/START_HERE.md) or [launch checklist](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.1/docs/LAUNCH_CHECKLIST.md).

**Software publication only. No Ethereum mainnet transaction, ENS registration, contract deployment or production activation is performed by publishing this release.** Existing buyer-protection limits and the requirement to qualify an actual deployed instance remain in force.
