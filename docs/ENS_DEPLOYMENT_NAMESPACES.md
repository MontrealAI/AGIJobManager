# ENS job names

For the already commissioned instance, start with the [supported inspection and recovery workflow](OPERATIONS/COMMISSIONING.md). It reports current observations separately from the completed historical milestone; no deployment is needed when connection checks pass.

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

The generic fresh-deployment script gives each new USDC manager a distinct namespace automatically. Users see **AGI Job #0**; its full ENS name also identifies the deployment.

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

## Recorded short-root instance: do not redeploy

The separately commissioned mainnet manager `0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7` uses helper `0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC` and **`job-<jobId>.usdc.jobs.agi.eth`**. The 10 October 2026 [connection record](deployments/MAINNET_USDC_2026-10-10.md) confirms the integration at block 26,165,026; production activation remains **HOLD**. This is not a live-state guarantee or a new default for other managers.

The contracts do not require the `alpha.jobs.agi.eth` suffix. The generic script still enforces its deterministic policy and refuses occupied roots; it has not been weakened to bypass that check. The short root was independently planned, deployed, verified and connected through the recorded operator procedure. Keep that root and historical alpha names unchanged. For this already-connected instance use the documented read-only checker, not a fresh or replacement broadcast.

Its root stays in the shared wallet. The new helper has wallet-wide NameWrapper operator authority, not ownership of the root token and not root-scoped permission. The unchanged helper has no ordinary root-token transfer-out method; review custody and recovery before any other root is transferred into it. Parent control cannot be assumed for an emancipated name. See [ENS operator permissions](https://docs.ens.domains/wrapper/contracts/) and the [activation review](OPERATIONS/PRODUCTION_ACTIVATION.md).

## Fresh manager: automatic naming

1. Deploy and verify the USDC manager; confirm the explicit constructor governor and zero pending owner, with intake paused. Current creation has no acceptance stage; historical handovers and later voluntary Manager transfers remain two-step.
2. Set `JOB_MANAGER` and `NEW_OWNER` (or `FINAL_OWNER`) in the reviewed Hardhat configuration. Leave `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE` and `JOB_LABEL_PREFIX` empty so the script derives them. Use `ENS_DEPLOYMENT_MODE=fresh` (the default).
3. Run `DRY_RUN=1 npm run deploy:ens-job-pages:mainnet` from `hardhat/`. The read-only plan prints the complete root, node, prefix and example job name. Without a key, supply `DEPLOYER_ADDRESS`.
4. Review the plan and create the helper using the [deployment procedure](DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md). Current creation assigns its governor atomically, with zero manager binding, constructor prefix `agijob` and unlocked configuration. The script records the derived namespace and a separate governor action plan. The governor separately authorizes the planned manager binding and `job-` prefix; verify both readbacks before wiring. `LOCK_CONFIG` proposes a later lock in that plan and does not execute one during creation.
5. Review root custody and recovery before creating or transferring a dedicated child. The generic documented wrapped route uses helper ownership of the root token; that is not the only authorization model supported by the contract. An existing wallet-held root requires separately reviewed operator approval and reconciliation, as in the recorded short-root instance above. Do not transfer `alpha.jobs.agi.eth`, transfer an emancipated root without a recovery plan, or grant blanket access as an unreviewed shortcut.
6. Wire the new manager to its new helper. Verify actual name creation, resolver writes, actor permissions and terminal revocation. A successful settlement alone does not prove the best-effort ENS hooks worked.

The script stops before broadcasting when the manager already has a helper or any posted jobs, the derived root has an owner or resolver state, an override differs from the derived name/prefix/node, or the RPC/network and USDC checks fail. An occupied root requires reconciliation of history and prior journals; the tool does not overwrite it or choose a random replacement.

Availability is observed during planning, not reserved by the read. Recheck actual ownership before the parent-owner transaction and wiring. Automatic deployment tooling enforces this policy; the unchanged helper contract still exposes owner-managed settings until locked. A custom namespace requires an explicit, separately reviewed plan; manual calls must not silently bypass collision, custody or recovery review. Do not change a live helper's root or repoint it to another manager: only labels, not the root or manager association, are snapshotted per job.

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
