# v1.0.2 — Clear deployment, safer setup

This patch makes the supported Hardhat deployment path easier to prepare, check and operate. Production contracts, payout rules and the deployment-specific ENS naming policy remain unchanged.

## What changed

- **One setup command:** `npm --prefix hardhat run setup` creates missing private environment, deployment-profile and NFT-policy files. Existing files and symlinks are preserved. New files use private permissions on POSIX.
- **Check before connecting:** `check:config:mainnet` and `check:config:sepolia` validate the reviewed profile offline using the same constructor, native-USDC and owner rules as deployment. No RPC or signing key is needed.
- **Predictable environment:** Hardhat always loads `hardhat/.env`; shell variables take precedence. Read-only planning is explicit in the new example, and broadcasts use `DRY_RUN=0` after review.
- **Complete operator reference:** every deployment environment variable, path rule, command, ownership handoff, NFT readiness requirement and recovery route is documented. Documentation CI checks environment-reference coverage.
- **Current guides and downloads:** maintained guides now point to v1.0.2. Retired Truffle settings were removed from the root environment example, and the static distribution was regenerated.

## Upgrade notes

Compare existing private configuration with the new examples: setup never overwrites it. If Hardhat settings were stored only in the root `.env`, move them to `hardhat/.env` or the shell. A custom deployment `.cjs` file is executable JavaScript and must be reviewed before loading.

The NFT example retains the required/empty starting policy. Choose a usable policy and configure it on chain before readiness; setup does not waive eligibility. Manager ownership requires acceptance; ENSJobPages ownership transfers in one step. Optional ENS root creation and manager wiring remain explicit owner actions.

Fresh ENS jobs keep the v1.0.1 format:

```text
job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth
```

`manager40` is the complete lowercase manager address without `0x`. Existing-manager helper replacement preserves its namespace and historical labels.

## Verification and compatibility

Local validation passed 532 contract regressions, 106 deployment/preflight/setup checks, 178 UI tests, 10 actual deployment cases, 23 mainnet cutover scenarios and 35 standalone console checks. Publication additionally requires all five workflows and every required job for the frozen source, reproducible packaging, an immutable source tag and verified asset checksums. See `VALIDATION.md` and `SOURCE_CI.json`.

Verified v0.9.6-compatible managers retain the same ABI and executable bytecode. This software patch does not require their redeployment. Dependency versions/resolutions, historical on-chain records and prior published release assets are preserved. Existing static-analysis findings remain explicitly reviewed; this is not an independent audit.

Download `AGIJobManager-v1.0.2-COMPLETE.zip` for the complete source, console, guides and qualification evidence. Verify `SHA256SUMS.txt`, then read `START_HERE.md`. The standalone `agijobmanager-usdc.html` is also provided.

No live manager, owner or recipient configuration is supplied, and publication performs no on-chain transaction. Complete the actual instance's launch checklist before paid intake.
