# ENS job names — v1.0.3

Every new USDC manager gets a distinct namespace automatically. Users see **AGI Job #0**; its full ENS name also identifies the deployment.

```text
job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth
```

`manager40` is the full lowercase manager address without `0x`. No address bytes are shortened. The root depends on the actual RPC chain and manager, never on a software version or a manually incremented counter. Applications identify a job by `(chainId, managerAddress, jobId)` and obtain its ENS name from the configured helper.

For the **hypothetical** manager `0x1111111111111111111111111111111111111111` on Ethereum mainnet:

```text
job-0.usdc-1-1111111111111111111111111111111111111111.alpha.jobs.agi.eth
job-1.usdc-1-1111111111111111111111111111111111111111.alpha.jobs.agi.eth
```

These examples do not claim deployed contracts or registered names. A release tag does not create an ENS name. The ASCII names are validated using ENS normalization; the mainnet deployment label is 47 characters and the helper adds `job-` to the decimal job ID.

## Fresh manager: automatic naming

1. Deploy and verify the USDC manager; complete ownership acceptance and keep intake paused.
2. Set `JOB_MANAGER` and `NEW_OWNER` (or `FINAL_OWNER`) in the reviewed Hardhat configuration. Leave `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE` and `JOB_LABEL_PREFIX` empty so the script derives them. Use `ENS_DEPLOYMENT_MODE=fresh` (the default).
3. Run `DRY_RUN=1 npm run deploy:ens-job-pages:mainnet` from `hardhat/`. The read-only plan prints the complete root, node, prefix and example job name. Without a key, supply `DEPLOYER_ADDRESS`.
4. Review the plan and deploy using the existing [deployment procedure](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md). The helper deployment sets `job-`, reads it back before locks or ownership handoff, and records the namespace in its journal. Keep `LOCK_CONFIG=0` until the complete lifecycle is checked.
5. The ENS parent owner creates the exact dedicated child root for this helper. For the wrapped route, the helper must own that root's NameWrapper token; do not transfer `alpha.jobs.agi.eth` or grant blanket access to historical names.
6. Wire the new manager to its new helper. Verify actual name creation, resolver writes, actor permissions and terminal revocation. A successful settlement alone does not prove the best-effort ENS hooks worked.

The script stops before broadcasting when the manager already has a helper or any posted jobs, the derived root has an owner or resolver state, an override differs from the derived name/prefix/node, or the RPC/network and USDC checks fail. An occupied root requires reconciliation of history and prior journals; the tool does not overwrite it or choose a random replacement.

Availability is observed during planning, not reserved by the read. Recheck actual ownership before the parent-owner transaction and wiring. Automatic deployment tooling enforces this policy; the unchanged helper contract still exposes owner-managed settings until locked. Direct manual calls must follow the same policy. Do not change a live helper's root or repoint it to another manager: only labels, not the root or manager association, are snapshotted per job.

## Same manager: preserve names

A console or software update does not require an ENS change. To replace a helper for the **same** manager, set `ENS_DEPLOYMENT_MODE=replacement`. The script reads the active helper through `manager.ensJobPages()` and preserves its exact root and prefix. It checks the helper's manager back-reference, registry, root namehash and root ownership. Optional root/prefix/node inputs are assertions, not renaming instructions.

Copying the default prefix is not a migration of existing per-job snapshots. Before cutover, inventory every existing name and resolve any required exact-label migration using the [replacement runbook](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md#8-legacy-migration-for-old-wrapped-job-pages). Keep historical per-job labels even if they differ from the helper's current default. Recover incomplete deployments from their journal; do not rerun a failed broadcast command blindly. Managers with posted jobs and no active helper need a separately reviewed historical-page plan; fresh mode deliberately refuses them.

## Historical Ethereum mainnet inventory

The following addresses were supplied as historical deployment references. This inventory does not assert current ownership, permissions, funding, verification status or USDC compatibility. Preserve their jobs, names, records and contract associations. None is a default new USDC manager.

| Deployment | Component | Address |
| --- | --- | --- |
| Genesis | AGIJobManager | `0xB3AAeb69b630f0299791679c063d68d6687481d1` |
| Genesis | ENSJobPages | `0x06188E77C1C38d392b16d9D9fB24673363ce1da0` |
| Prime | AGIJobDiscoveryPrime | `0xd5EF1dde7Ac60488f697ff2A7967a52172A78F29` |
| Prime | AGIJobManagerPrime | `0xF8fc6572098DDcAc4560E17cA4A683DF30ea993e` |
| Prime | Completion NFT | `0xFfCC54dA2Caf1158e57611005965BB648E950737` |
| Prime | ENSJobPages | `0x703011EF1C6E4277587eFe150e6cd74cA18F0069` |
| Employer Burn | AGIJobManager | `0xBF6699c1F24BEBBFaBb515583e88a055BF2F9eC2` |
| Employer Burn | ENSJobPages | `0xFC1EE3B7DCD3B8643295CaC3150aA630c31190E5` |

Historical labels observed in the supplied ENS screenshot include `0`, `job-0`, `agijob0`, `agijob-0` and `aijob0` directly below `alpha.jobs.agi.eth`. Do not infer a label's manager from its spelling alone. Record its actual contract association when inventorying old jobs.

## Verification scope

Deployment preflight regressions cover distinct managers (including identical address beginnings/endings), distinct chains, normalized case, occupied names, rejected overrides, existing jobs, same-manager replacement, foreign helper rejection and failed prefix transactions/readback. A local EVM regression creates job zero under two deployment roots while preserving the owners, resolvers and metadata of all five historical label forms.

The earlier mainnet-fork fixture under `usdc-v095.alpha.jobs.agi.eth` is retained as historical qualification evidence; it is not the v1.0.3 fresh-deployment naming default. Production contract source, ABI and settlement rules are unchanged. No live ENS transaction is performed by software publication.
