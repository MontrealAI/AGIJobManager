# v1.0.3 — NFT eligibility starts disabled

Fresh AGIJobManager deployments now start with **NFT admission disabled** (`agentNftRequired() == false`) and an empty collection registry. Authorized agents can apply without an eligibility NFT unless the accepted owner enables the requirement for future jobs.

## What changed

- **Contract default:** the construction-time initializer changes from `true` to `false`. Intake still starts paused.
- **Deployment verification:** Hardhat checks the disabled policy at the deployment block, records it in the receipt and fails if the initial state differs.
- **Matching setup:** both NFT-policy examples, the deployment registry and generated UI configuration use the disabled default. Setup preserves existing reviewed files.
- **Clear owner guidance:** documentation and the console explain the new default, owner opt-in and how to read the policy of existing jobs.
- **Regression coverage:** a fresh manager completes a job without any registered collection or eligibility NFT and still mints its completion receipt. Required-mode fixtures explicitly enable the gate and retain their negative admission tests.

## Using the policy

To retain the fresh default, keep the reviewed readiness policy as:

```json
{
  "agentNftRequired": false,
  "agiTypes": []
}
```

To require NFTs, the accepted owner registers reviewed ERC-721 collections, calls `setAgentNftRequired(true)` before posting the affected jobs and updates the complete readiness policy to match. Required mode with no enabled collection still fails readiness. Collection changes still require zero live job escrow and bonds.

Each job keeps the policy recorded when it was posted. ENS or explicit exception authorization, blacklists, bonds, capacity limits, pauses, USDC payouts and employer completion NFTs are preserved.

## Existing deployments

Publication does not change an existing manager's settings or job policies. On a compatible older manager, its accepted owner can call `setAgentNftRequired(false)` to disable NFT admission for future postings; earlier required jobs remain required. The console reads live state and never infers a job's requirement from its software version.

The ABI and deployed runtime match v1.0.2, while **creation bytecode changes** to initialize the new default. Runtime remains 24,359 bytes. Library code, payout rules and dependency resolutions are unchanged. Preserve original deployment receipts and jobs; there is no proxy upgrade or escrow migration.

Fresh ENS jobs retain the v1.0.1 namespace:

```text
job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth
```

`manager40` is the complete lowercase manager address without `0x`. Same-manager helper replacement preserves its namespace and historical labels.

## Verification and downloads

Local validation passed 533 contract/console regressions, 106 deployment/preflight/readiness checks, 10 actual deployment cases, 178 UI tests, 23 cutover scenarios, 8 native-USDC fork cases, 24 historical Genesis scenarios and 35 standalone console checks. Publication requires all five exact-source CI workflows, including Foundry, Slither, dependency audits and browser tests, followed by reproducible packaging and asset checksum verification. Existing static-analysis findings retain their reviewed dispositions; this is not an independent audit.

Download `AGIJobManager-v1.0.3-COMPLETE.zip` for the complete source, console, guides and evidence, or `agijobmanager-usdc.html` for the standalone console. Verify `SHA256SUMS.txt`, then read `START_HERE.md`. `VALIDATION.md`, `SOURCE_CI.json` and `RELEASE_MANIFEST.json` identify the qualified source and packaged contents.

This is a software release. It supplies no live manager, owner or recipient configuration and performs no on-chain transaction. Complete the actual instance's launch checklist before opening paid intake.
