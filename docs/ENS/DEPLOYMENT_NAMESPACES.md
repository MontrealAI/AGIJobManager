# A separate ENS namespace for every new AGI Jobs manager

**Current repository deployment policy, 18 September 2026.** Fresh USDC managers use:

```text
job-<jobId>.usdc-<chainId>-<full-manager-address-without-0x>.alpha.jobs.agi.eth
```

The address is all 40 lowercase hexadecimal characters. Ethereum mainnet uses chain ID `1`. The deployment script derives the name from the actual manager address; operators do not invent a prefix or maintain a deployment counter. This is a repository convention, not a requirement of ENS itself. Use the [current source](../V1_RELEASE_SCOPE.md#published-download-versus-current-source); the frozen v1.0.0 downloads predate this tooling change.

For a **fictional** manager `0x1111111111111111111111111111111111111111`, the first two mainnet jobs would be:

```text
job-0.usdc-1-1111111111111111111111111111111111111111.alpha.jobs.agi.eth
job-1.usdc-1-1111111111111111111111111111111111111111.alpha.jobs.agi.eth
```

The long component identifies the deployment; `job-0` is the short job label. A different manager address or chain ID produces a different namespace even when numbering restarts at zero. Releasing new software does not rename a manager. Replacing a helper for the same manager is a separate preservation workflow.

## Why changing only the prefix is insufficient

Prefixes such as `job-`, `agijob`, `agijob-` and `aijob` have already been used under the shared parent. An arbitrary new spelling can be reused accidentally on the next deployment. A release name such as `usdc-v1` also fails to distinguish two deployments of the same release.

The full chain/manager identity removes that operator naming ambiguity. The new helper controls only its dedicated child root, rather than gaining authority over historical jobs under the shared parent. On mainnet the hierarchy is:

| Component | Role |
| --- | --- |
| `alpha.jobs.agi.eth` | Existing parent; preserve its historical jobs and helper permissions |
| `usdc-1-<40-character-manager-address>` | New dedicated child root, derived for that USDC manager |
| `job-0`, `job-1`, … | Job labels created inside that dedicated root |

A name is a metadata location. The authoritative job identity remains **chain ID + manager address + job ID**. Clients should call the associated helper's `jobEnsName(jobId)`; do not reconstruct historical names from a current prefix or confuse a completion NFT with an ENS record.

## Existing mainnet names to preserve

Read-only calls at finalized Ethereum block **26,005,171**, hash `0x44210b0443babc74985fc4adaf8e69679803c0a8ca5ff759d7ef9054ff8ee149`, returned:

| Deployment | Helper's current prefix | Helper's effective name for Job 0 | Root |
| --- | --- | --- | --- |
| Genesis | `agijob` | `job-0.alpha.jobs.agi.eth` | `alpha.jobs.agi.eth` |
| Prime | `agijob-` | `agijob-0.alpha.jobs.agi.eth` | `alpha.jobs.agi.eth` |
| Employer Burn | `aijob` | `aijob0.alpha.jobs.agi.eth` | `alpha.jobs.agi.eth` |

Sources: the [Genesis helper](https://etherscan.io/address/0x06188E77C1C38d392b16d9D9fB24673363ce1da0#readContract), [Prime helper](https://etherscan.io/address/0x703011EF1C6E4277587eFe150e6cd74cA18F0069#readContract), [Employer Burn helper](https://etherscan.io/address/0xFC1EE3B7DCD3B8643295CaC3150aA630c31190E5#readContract), and the checked-in [read-only observation](../qualification/ens-namespace-inventory.json). Prefixes are configuration at that block, not a rule for every historical label. Genesis Job 0 demonstrates the difference: its saved `job-0` name survives a later default-prefix change.

| System | Contract role | Address |
| --- | --- | --- |
| Genesis | Direct lifecycle manager | `0xB3AAeb69b630f0299791679c063d68d6687481d1` |
| Genesis | ENS helper | `0x06188E77C1C38d392b16d9D9fB24673363ce1da0` |
| Prime | Candidate discovery | `0xd5EF1dde7Ac60488f697ff2A7967a52172A78F29` |
| Prime | Settlement manager | `0xF8fc6572098DDcAc4560E17cA4A683DF30ea993e` |
| Prime | Completion NFT | `0xFfCC54dA2Caf1158e57611005965BB648E950737` |
| Prime | ENS helper | `0x703011EF1C6E4277587eFe150e6cd74cA18F0069` |
| Employer Burn | Manager | `0xBF6699c1F24BEBBFaBb515583e88a055BF2F9eC2` |
| Employer Burn | ENS helper | `0xFC1EE3B7DCD3B8643295CaC3150aA630c31190E5` |

This catalog preserves the supplied deployment references. The observation verifies the three helpers' manager bindings and naming getters; it does not independently qualify the Prime discovery/NFT contracts or change any deployment. The new tool does not target these historical contracts for migration. Preserve other existing names, including bare-number names shown in the [ENS subname inventory](https://app.ens.domains/alpha.jobs.agi.eth?tab=subnames), without guessing their issuing manager from spelling alone.

## Fresh deployment: what the operator does

1. Deploy and verify the intended USDC manager using the [Hardhat guide](../../hardhat/README.md). Complete its ownership handover and keep intake paused. Fresh ENS setup requires no existing helper and no allocated job IDs.
2. Set `JOB_MANAGER` and the explicit final helper owner. Use `ENS_DEPLOYMENT_MODE=fresh` (the default). Mainnet defaults `JOBS_PARENT_NAME` to `alpha.jobs.agi.eth`; Sepolia requires its own reviewed parent and ENS contracts.
3. Run the keyless read-only plan with `DRY_RUN=1` and `DEPLOYER_ADDRESS`. It prints the derived root, its namehash, `job-` prefix and first-job preview. Optional `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE` and `JOB_LABEL_PREFIX` are assertions: incorrect or historical values cause failure.
4. Review the actual manager, parent authority and namespace. The tool rejects an owned root, residual resolver/TTL records, an unowned parent, an already configured helper, or any allocated job IDs. It repeats the namespace checks immediately before deploying. A read is an observation, not a name reservation.
5. Deploy the helper with verification enabled and `LOCK_CONFIG=0`. The script sets its manager and `job-` prefix, verifies its code, transfers helper ownership and records the namespace in the deployment journal. A failed command may already have deployed a helper; reconcile its journal rather than redeploying blindly.
6. Recheck the child root is still unused before creating it. The **ENS parent controller** creates the exact derived `rootLabel` through NameWrapper `setSubnodeOwner`, assigning the new helper ownership of that child token. Check fuses and expiry against the parent. Do not transfer the shared `alpha.jobs.agi.eth` parent or grant the new helper blanket authority over old names.
7. Verify `ENS.owner(newRootNode) == NameWrapper` and `NameWrapper.ownerOf(uint256(newRootNode)) == newHelper`. Then the new manager's accepted owner sets its ENS helper pointer. Manager ownership alone does not grant ENS parent authority.
8. Rehearse creation, employer/agent writes, outsider rejection and terminal revocation. Check actual names, ENS records and hook events, then consider configuration locks and open intake under the launch plan.

The mainnet fork exercises this naming scheme with the real NameWrapper/PublicResolver at its separate [qualification block](../qualification/USDC_CUTOVER.md). The fork's synthetic manager address and child names are examples, not live deployments or names to copy. Existing parent fuses, expiry and controller authority still apply; a dedicated namespace does not remove parent-owner powers.

## Replacing a helper for the same manager

Use `ENS_DEPLOYMENT_MODE=replacement` and set `REPLACES_ENS_JOB_PAGES` to that manager's current helper. The preflight checks both directions of the manager/helper binding and the ENS registry, and preserves the existing root and default prefix. It rejects a different manager, root or prefix. Leave `JOBS_PARENT_NAME` unset in this mode.

Read and record every existing job's **exact** label from the old helper before changing any pointer. Prefix defaults are not enough. Follow the [same-manager replacement runbook](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) to establish authority and import supported historical labels. Importing old Genesis, Prime or Employer Burn pages into a fresh USDC manager is not a replacement.

The deployment tool enforces these checks; directly deploying or calling a helper can bypass the tool. The Solidity constructor still defaults to `agijob`, and unlocked owners can change root/manager/prefix configuration. Label snapshots preserve the label, not an immutable global root. Review configuration locks only after the real lifecycle succeeds, and monitor those privileged settings.

## Verification and limits

Deployment preflight tests cover namespace uniqueness, root/record collisions, a root claimed during planning, invalid overrides, reused manager state and cross-manager replacement attempts. The fork creates and operates `job-0` under the derived root while preserving the original Genesis inventory. The separate inventory records the three supplied helpers without modifying them. Run:

```bash
npm --prefix hardhat run test:preflight
CUTOVER_REPORT=../build/qualification/mainnet-cutover.json npm --prefix hardhat run test:cutover
```

The fork requires read access to its configured Ethereum RPC and writes only to an isolated local chain. Passing these checks does not reserve a live name, transfer ENS authority or activate a mainnet instance.
