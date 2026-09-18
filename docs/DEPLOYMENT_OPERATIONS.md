# Deployment and Release Operations — v0.9.6

Use [Hardhat](../hardhat/README.md) for Ethereum mainnet and Sepolia deployments. Truffle migrations are retired. Supported read-only operational commands use ethers; the legacy owner-configuration helper permits writes only on a disposable local chain. Publishing v0.9.6 does not deploy or upgrade any live contract.

The manager is non-upgradeable and starts intake paused in its constructor. It uses native Circle USDC, fixed 30% and 10% successful-job wallet shares, and a posting-time validator reward percentage. Supply and independently review both recipient wallets and the intended final owner before planning a public deployment.

## Deployment surface

| Stage | Source of truth | Primary command or action | Verification artifact |
| --- | --- | --- | --- |
| Release qualification | [Test matrix](TESTING.md), [mainnet readiness](MAINNET_READINESS.md), committed lockfiles and release CI | Run the source-specific required gates | Test/static-analysis logs and release checksums |
| Public deployment build | [Hardhat config](../hardhat/hardhat.config.js), [deployment script](../hardhat/scripts/deploy.js) | From `hardhat/`: `npm run compile` | Qualified artifacts/build input and bytecode-size checks |
| Read-only plan | Trusted `hardhat/deploy.config.cjs`, [environment example](../hardhat/.env.example) | From `hardhat/`: `DRY_RUN=1 npm run deploy:mainnet` | Reviewed chain, constructor, owner and linked-build plan |
| Authorized deployment | [Hardhat guide](../hardhat/README.md) and reviewed plan | `npm run deploy:sepolia` or separately confirmed `npm run deploy:mainnet` | Per-transaction journal, runtime hashes and exact Solidity input |
| Source verification | Saved deployment addresses and build input | Deployment workflow's explorer verification; finish any failed target explicitly | Verified source for manager and all eight libraries |
| Verification recovery | [Recovery script](../hardhat/scripts/reverify-deployment.js) and saved manager deployment journal | Keyless `reverify-deployment.js` command described below | Separate reverified receipt; original journal preserved; zero chain transactions |
| Owner configuration | [Owner controls](OWNER_CONTROLS.md), accepted final owner and approved parameters | Owner console or verified explorer | Successful transaction receipts, events and current getter values |
| Pre-activation check | [Readiness checker](../hardhat/scripts/check-readiness.js), original deployment receipt and reviewed expectations | From `hardhat/`: `npm run check:readiness` with `DEPLOYMENT_RECEIPT` and `READINESS_NFT_CONFIG` | Read-only report with block number/hash and checked state |
| Activation and handoff | [Deploy-day runbook](DEPLOY_DAY_RUNBOOK.md), owner approval and monitoring | Accepted owner calls `unpauseIntake()` | Activation receipt, reconciled canary job and operational records |

## Deterministic deployment flow

### 1. Freeze and qualify the release

Check out the immutable v0.9.6 tag and verify downloaded checksums. Use Node 22.23.2 and the committed lockfiles. From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm --prefix hardhat run compile
npm test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm --prefix hardhat run test:mainnet-fork
npm run docs:check
```

These commands cover core and deployment checks; complete the remaining required UI, invariant and static-analysis gates in [mainnet qualification](MAINNET_READINESS.md). The mainnet fork test uses local execution and pinned historical USDC state. It does not replace fresh checks on an eventual live instance.

Preserve the qualified Solidity 0.8.37 profile: optimizer 40 runs, Shanghai, `viaIR=true`, metadata bytecode hash disabled and revert strings stripped. Deployment checks enforce Ethereum runtime limits and exact linked artifact matching. Do not change the profile or disable size checks to force a deployment.

### 2. Review configuration and produce a plan

From `hardhat/`, copy the example configuration as described in its guide. Review that file as executable JavaScript from a trusted source. Supply:

- The selected network's canonical six-decimal Circle USDC address.
- Distinct, nonzero recipient addresses ordered `[wallet30, wallet10]`, different from USDC and the manager. Verify control and USDC receive capability.
- The intended final owner and a rehearsed signing/recovery arrangement.
- The metadata URL, ENS registry/wrapper, four namespace roots and two Merkle roots.
- The selected RPC, deployer address for read-only planning, and explorer configuration.

Run an explicit dry run with no production private key present:

```bash
DRY_RUN=1 npm run deploy:mainnet
```

The documented boolean form is `DRY_RUN=1`; malformed boolean flag values fail rather than being interpreted as permission to broadcast. Review the resulting plan and current issuer restrictions. The sample's historical owner and namespace settings are not confirmation of your intended deployment.

### 3. Rehearse before an authorized broadcast

Use a reviewed Sepolia profile and the intended operational signer arrangement. Rehearse ownership acceptance, agent authorization **and NFT eligibility**, posting, bonds, voting, successful settlement, cancellation, refunds, disputes and both pause controls. The [local walkthrough](QUINTESSENTIAL_USE_CASE.md) also provides a disposable mock-token fixture, but its shortened timers and local migration behavior are not public deployment defaults.

For a separately authorized mainnet deployment, follow the Hardhat guide's explicit confirmation phrase and signing instructions. The script deploys eight libraries plus the manager, checks their runtime code and preserves a journal. It does not open intake. Do not rerun a failed command until the journal's transaction hashes and chain receipts have been reconciled; failure may occur after one or more broadcasts.

### 4. Verify, accept ownership and configure

Verify the manager and all eight libraries on the explorer against the exact saved build. The deployment script stops before proposing ownership if verification fails. When all nine deployments were broadcast but verification or a later step failed, run this recovery command from `hardhat/` without a private key:

```bash
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run reverify:mainnet
```

It reconciles successful canonical receipts, recorded deployer, exact creation input and runtime, then retries explorer source verification. It writes a separate `.reverified.<block>.json` receipt on success and preserves the original journal. It sends no blockchain transactions; explorer verification still requires its configured API access. It cannot complete a partial library-only deployment or recover the separate ENSJobPages workflow. Use the recovered receipt for readiness; do not manually mark failed verification entries successful.

A pending ownership proposal leaves authority with the deployer. If the recovery report shows no proposal, the current owner must first call `transferOwnership(finalOwner)` where needed. The intended owner then calls `acceptOwnership()`; verify `owner()`, zero `pendingOwner()` and the transfer receipt. The recovery command performs neither ownership action.

While intake remains paused, configure moderators, enabled NFT types, participant authorization, limits, bonds and review policy through the accepted owner. Check every setting against the [owner controls](OWNER_CONTROLS.md). Record successful transaction receipts and actual getter values; some role setters have no role-specific event.

Keep the original deployment receipt as evidence. If deliberately reviewed identity settings differ from the initial constructor values, the v0.9.6 readiness workflow can use a separate `READINESS_CONFIG` file for expected ENS/wrapper, namespace and Merkle values. It changes checker expectations only and sends no transactions. Follow the exact schema in the [Hardhat guide](../hardhat/README.md); do not rewrite historical constructor data to make a check pass.

Prepare the [reviewed NFT policy JSON](NFT_POLICY.md) for `READINESS_NFT_CONFIG`: an explicit boolean and every collection/score, including disabled entries. The required default with an empty registry fails readiness.

### 5. Check the instance before opening intake

From `hardhat/`, with the appropriate RPC configured and no private key needed:

```bash
READINESS_NFT_CONFIG=./reviewed-nft-policy.json \
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run check:readiness
```

For Sepolia:

```bash
READINESS_NFT_CONFIG=./reviewed-nft-policy.json \
DEPLOYMENT_RECEIPT=deployments/sepolia/<saved-receipt>.json npm run check:readiness:sepolia
```

The checker validates the deployment receipt and expected configuration, matches linked runtime code, and reads owner acceptance, recipient wallets, identity settings, explicit NFT policy and complete registry, USDC issuer state, pause flags and reserve accounting at a recorded block. It rechecks the block hash before writing a successful report. Preserve the report with the original journal, exact build input, explorer verification evidence and approved configuration.

The report is a technical, point-in-time result. Participant readiness, signer security, operational policy, monitoring and independent review remain separate gates. Recheck state changed after the report. After the launch gates pass, the accepted owner may call `unpauseIntake()` and run a deliberately limited first job before increasing exposure.

## Mainnet gate criteria

| Gate | Requirement | Failure response |
| --- | --- | --- |
| Source and build | Immutable release, required CI evidence, exact compiler profile and bytecode within Ethereum limits | Stop and resolve the source/build mismatch; do not disable checks |
| Configuration | Reviewed native USDC, both recipients, final owner, identity settings and policy; dry run passes | Correct the reviewed plan and rerun the check |
| Deployment evidence | All broadcast transactions reconciled; runtime bytes match; source verification completed | Keep intake paused and resolve each saved deployment/verification target |
| Ownership | Intended owner accepted; no pending transfer; signing and recovery rehearsed | Keep intake paused until authority is confirmed |
| Participant readiness | Agents satisfy authorization and their job’s NFT policy; validators/moderators and bond funding are ready | Correct eligibility/funding and rehearse the complete journey |
| Read-only readiness | Checker succeeds against the original receipt and reviewed expected configuration | Investigate the reported mismatch; never edit evidence merely to obtain a pass |
| Recovery and monitoring | Tested pause/incident procedures and alerts for fund/accounting anomalies, disputes and stalled jobs | Delay activation until response and monitoring work |
| High-stakes operational review | Final source and actual setup receive appropriate independent review and operator sign-off | Limit exposure and complete the outstanding review |
| Documentation parity | `npm run docs:check` passes on the release source | Regenerate references and review the changes |

## Post-deploy validation checklist

- Confirm the selected chain, manager, native `usdcToken()` and exact six linked library runtimes match the deployment evidence.
- Confirm `owner()` is the intended accepted owner and `pendingOwner()` is zero.
- Confirm `wallet30()` and `wallet10()` are the reviewed recipients, and USDC restrictions do not prevent their use.
- Confirm intake is still paused and settlement enabled before initial activation; initial reserved escrow and all bonds must be zero.
- Confirm ENS/wrapper/namespaces and Merkle roots match the reviewed expectations. Inspect role/allowlist getters and agent NFT eligibility separately.
- Confirm limits, validator budget, bonds, review windows, voting thresholds and quorum match approved policy. Job payout snapshots are taken at posting.
- Save the read-only readiness report and operational review before the accepted owner opens intake.
- After the limited first job, reconcile validator rewards, fixed gross-cost 30% and 10% transfers, agent remainder and separate bond returns. Compare the manager balance with all remaining reserves; successful job costs do not become treasury revenue.

## Release rollback philosophy

- **Configuration-only defects:** stop intake where appropriate, inspect the relevant setter's guards, simulate the correction and record the resulting state. Some settings cannot change while any escrow or bonds remain.
- **Active exploit suspicion:** use `pauseAll()` first, verify both flags and preserve evidence. Read the [incident playbook](OPERATIONS/INCIDENT_RESPONSE.md) before reopening settlement or intake.
- **Identity integration instability:** contain the affected paths and review reversible controls. `lockIdentityConfiguration()` is an irreversible governance action and must not be used to repair an incident.
- **Contract-code defects:** an existing non-upgradeable manager cannot be patched by publishing a new release. Review a fresh deployment and explicit handling of old jobs; the owner cannot redirect reserved escrow through recipient rotation or rescue.
- **Release artifacts:** preserve the published tag, source and checksums. Document any superseding release; do not silently replace historical deployment evidence.
