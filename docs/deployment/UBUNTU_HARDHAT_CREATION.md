# Ubuntu Terminal creation; Mac Studio Ledger governance

Owner's current mandate, 16 October 2026. Initial deployments use **Hardhat on Ubuntu from the owner's chosen deployer**. The private key is entered locally at a hidden terminal prompt. Governor is **`0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`**, secured on the Mac Studio Ledger. **No Mainnet execution is authorized by this preparation. The owner must initiate each reviewed send.**

Remix, MetaMask, Ledger signing, raw-signature export and the optional companion are not required for initial creation. Later governor configuration uses the owner's normal **Etherscan → MetaMask → Ledger** workflow. The terminal tool cannot sign governor transactions or Alpha's two governor bindings.

## Exact accepted sources and evidence

| Project | Contract source | Tree | Received qualification |
| --- | --- | --- | --- |
| Manager | `d371d95cfcc44b9133cda4bba55304f727917f18` | `93faf6e9a6875026c1eb9bc2f0f9bdada308d296` | [Run 38958922414](https://github.com/MontrealAI/AGIJobManager/actions/runs/38958922414): 96 deployment/recovery + 30 account-profile cases, 473 CLI commands, 27 positive core CREATE receipts |
| Alpha | `38064bec3423218f87c6b81760ac6768b3e7d4e5` | `4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68` | Previously received exact-source/native evidence; this terminal transport has separate disposable testing |
| Jobs | `9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5` | `720312acac83eddeeb76644e1e22f53578e91784` | [Run 38954500102](https://github.com/MontrealAI/AGIJobsv0/actions/runs/38954500102): all nine stages; 39 fresh CLI operations; 25 creations |

Downloaded Manager artifact `12071534584` SHA256: `3e8f6245e82510a3a98b4e39c4ffd023870739cdabfcd670edadc6d6953a12e6`. Jobs artifact `12072489816` SHA256: `1da8f5a17978b92bf355537076125063b064c287d71b5c3e40858a9fcc33d025`; its `qualification.json` SHA256 is `26f188a32c1bf62464c2239d3fad7ea729d1179265d24d5391ac66f23826787d`. Existing [Manager](../qualification/manager-d371-hosted-38958922414.json) and [Jobs](../qualification/jobs-9a79-hosted-38954500102.json) readbacks retain their exact acceptance limits. Hosted functional qualification, real signing and production-plan acceptance are separate.

## Public production inputs still required

The [input record](production-inputs-required.json) deliberately leaves unresolved values empty. No fixture address, nonce, budget, settlement wallet or economic value becomes a production default. Select the public deployer address before producing plans; enter its key only when the owner later runs `send` locally. Never send the key to chat.

| Input | Required binding |
| --- | --- |
| Deployer | Owner-selected checksummed address, distinct from d76; exact key/address match at the hidden prompt |
| Account profile | This terminal route accepts an **empty-code deployer only**. The previously selected marker-bearing account remains unqualified. Stop if its code is nonempty; do not clear delegation or silently choose another wallet |
| Source/build | Separate exact contract checkouts and reviewed dependencies/artifacts; PR #1590 is the tooling checkout, not a replacement contract revision |
| Runtime | Ubuntu/Linux, Node **22.23.3** and independently reviewed executable SHA256; Hardhat **3.17.0** / ethers **6.17.0** from the exact Manager dependency checkout; no browser companion installation |
| Provider | Explicit reviewed HTTPS endpoint, chain ID 1, canonical hash reads and real finalized-block behavior accepted independently |
| Allocation | Reconciled latest/pending nonce and shared actual-sender locks; explicit project order/non-overlapping allocations if the deployer is shared; fresh predicted addresses and hashes |
| Fees | Each native envelope's gas limit, maximum fee, priority fee, zero value and aggregate maximum cost; no automatic nonce, fee or gas edits |
| Dependencies | Exact token/proxy/admin and ENS/root/controller evidence, constructor settings and live recipient/operator conditions |
| Governor | d76 above, explicitly acknowledged; no deployer alias in treasury, governance, operator, allowlist or beneficiary roles |

Manager uses **USDC6** at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`; Jobs/Alpha use **$AGIALPHA18** at `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`. Keep these configurations separate.

## Build and prepare without a key

Use exact clean contract checkouts, their committed dependency locks and qualified production compiler settings. Finish installation, compatibility-source checks, compilation, source review and explorer-package generation **before key entry**. Nothing in the terminal send command compiles, installs packages, loads `.env`, imports the source Hardhat config, or passes a key to another process.

Manager's exact compiler is `0.8.37+commit.f401782d`, optimizer enabled with 40 runs, `viaIR:true`, EVM `shanghai`, metadata `bytecodeHash:none`, debug `revertStrings:strip`. Independently bind all compiler inputs/output/artifacts/ABI/links/immutables. A catalog with absolute paths must be generated and reviewed for the actual Ubuntu checkout; do not reuse the hosted catalog digest with different paths.

1. Prepare the original native plan and initialize its original session with read-only preflight and shared sender locks. Keep private config, plans, session and outputs in owner-only real directories **outside every checkout**.
2. Manager: use the pinned `scripts/qualification/prepare-core-catalog.mjs`, then `hardhat/scripts/core-session.cjs plan` and `start` with the explicit catalog path/SHA/build ID. The native CLI's `--catalog`, `--catalog-sha`, `--build-id`, `--out`, `--config` / `--plan`, `--session` and `--lock-directory` are unchanged.
3. Alpha: use the pinned `tests/contracts/scripts/mainnet-authority.js plan` and `authority-session.js start` in `external-broadcast` mode. Preserve the native cross-project nonce journal. The new route sends only indices 0–4.
4. Jobs: use the exact [native external-manual profile](https://github.com/MontrealAI/AGIJobsv0/blob/9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5/docs/deployment-external-manual.md), reviewed source manifest/config/plan, empty network accounts, and the original Hardhat staged writer. It prepares an exact operation and stops; no key is configured in Hardhat. Resume the same staged writer after each observed operation with the same config and a fresh evidence filename.

Jobs' supported loader normalizes `config/ens.json`. Hosted evidence separately records original SHA256 `cff15f5df467d8d17aee40ecf4024af9089f8a88fb9a91a8fae6500de72646a5` and normalized SHA256 `395ea0a49d70f8e6777c0d611c40546cc7dc24ab1b71eeafbb765099fed8eb61`. Normalize and review this data **before** pinning the native manifest/profile. The terminal observer permits exactly this qualification-recorded data normalization, with the exact Jobs HEAD/index; no other tracked drift is accepted. Record the actual bytes in the manifest. Never generalize this exception to scripts, Solidity, dependencies or arbitrary configuration edits.

The standalone terminal entrypoint is `scripts/ubuntu-hardhat/terminal.cjs`. It uses Hardhat's public HRE API with `accounts:[]` and an in-process ethers signer. No optional companion or wallet plugin is involved. Its config contains public paths, hashes and RPC settings only:

```json
{
  "schema": "ubuntu-hardhat-terminal-v1",
  "project": "manager",
  "checkout": "/absolute/contracts/manager-d371",
  "runtimeCheckout": "/absolute/contracts/manager-d371",
  "nodeSha256": "INDEPENDENTLY_REVIEWED_NODE_EXECUTABLE_SHA256",
  "toolSourceSha256": "INDEPENDENTLY_REVIEWED_SIX_FILE_TERMINAL_SOURCE_SHA256",
  "rpcUrl": "https://YOUR_REVIEWED_PROVIDER",
  "planFile": "/absolute/private/manager-plan.json",
  "sessionPath": "/absolute/private/manager-session",
  "catalogPath": "/absolute/private/catalog/catalog.json",
  "catalogSha256": "REVIEWED_LOCAL_CATALOG_SHA256",
  "buildId": "REVIEWED_LOCAL_BUILD_ID"
}
```

For Alpha, retain common fields, select `"project":"alpha"`, and use only `planFile` and `sessionPath` as project-specific fields. For Jobs, select `"project":"jobs"` and use only `profilePath`, `profileSha256` and `deploymentConfigPath` as project-specific fields; its session comes from the original profile. Unknown config fields are rejected. Files must be owner-only; hash the exact reviewed config bytes. Placeholders above are intentionally invalid.

`toolSourceSha256` is SHA256 of compact canonical JSON mapping the six production filenames (`hardhat.cjs`, `native.cjs`, `prompt.cjs`, `safety.cjs`, `send.cjs`, `terminal.cjs`) to their raw-file SHA256, with keys sorted and no final newline. Bind it from independent review of the published tooling; a checksum generated by unreviewed code is not source approval. The tool rechecks these pinned bytes and the Node executable after key entry. Installed dependencies and the local bootstrap still require independent review; version strings/lockfiles alone do not establish their integrity.

## Review, then owner-initiated send

Commands below show the interface. They were not run against Mainnet during preparation. Public file paths/hashes may appear in shell history; the key must never appear there.

```bash
set +x
ulimit -c 0
/absolute/node-22.23.3/bin/node /absolute/tooling/scripts/ubuntu-hardhat/terminal.cjs review \
  --config /absolute/private/terminal-config.json --config-sha REVIEWED_CONFIG_SHA256 \
  --out /absolute/private/operation-0-review.json
```

`review` performs native handoff/preflight and writes a new exact operation review. It prints the complete unsigned transaction, native plan/source/session binding, unsigned hash, predicted-bytecode data and maximum fee. Independently inspect chain, sender, recipient/null, nonce, exact data, zero value, type 2, gas, both fees and empty access list. Compare every predicted address/constructor/library with the accepted production plan. This is a public review file, not signing authorization.

Only when ready, the owner initiates this command on their Ubuntu terminal with the independently reviewed **review-file SHA256**:

```bash
/absolute/node-22.23.3/bin/node /absolute/tooling/scripts/ubuntu-hardhat/terminal.cjs send \
  --config /absolute/private/terminal-config.json --config-sha REVIEWED_CONFIG_SHA256 \
  --review /absolute/private/operation-0-review.json --initiate-mainnet REVIEWED_REVIEW_FILE_SHA256
```

The hidden prompt accepts 64 hex digits, optionally prefixed with `0x`; no characters or asterisks are echoed. Pipes/redirected input are refused. Backspace works. Enter submits the local entry; Ctrl-C/Ctrl-D cancels. Terminal echo/raw mode is restored on handled completion, cancellation and signals. A forced kill cannot run cleanup; restore a damaged terminal with `stty sane` before continuing.

The tool refuses key/mnemonic/keystore/unlocked-account environment settings, loader/debug/report flags (including `NODE_DEBUG` and `NODE_DEBUG_NATIVE`) and enabled core dumps. Malformed and oversized entry stays hidden until Enter; an invalid early character does not restore echo and expose the rest of the line. Use a normal unsupervised local terminal without shell tracing, terminal recording, heap profiling or debugger attachment. Do not use `.env`, `export`, shell `read`, command arguments, npm logging or pasted shell assignments for this key. The prompt is the sole production key input.

The key is held in-process only. Input buffers are cleared; wallet references are dropped after signing. JavaScript/ethers may make immutable internal copies, so this is **not a promise of guaranteed memory erasure**. The process is short-lived and exits after one operation. The key is never supplied to a provider, Hardhat accounts config, child process, journal or error renderer. The tool does not persist signed raw transaction bytes either.

Source/config/plan/native session, latest/pending nonce, account code, balance, block gas and fees are checked again after key entry. The derived signer must equal the chosen native-plan deployer and differ from d76. Every signed field is checked by the original native verifier before submission. No factory wrapping, type 4, delegation, nonce replacement, fee bump, token transfer, unpause or arbitrary-call command is available.

For Jobs, every receipt in the native prefix is verified before the first key prompt in each process. A second check can reuse only that in-memory proof, with identical journal head/operation bytes and fresh native validation of the last fixed canonical receipt (whose block hash binds all ancestors). Journal/source drift or a failed check discards reuse; a restarted process always verifies the whole prefix again. A file-supplied approval flag never seeds this proof.

## Receipt recovery and restart

A public hash-only attempt record is exclusively created and fsynced at `<original-native-session>.ubuntu-hardhat/<index>-<unsigned-hash>.json` **before** the sole HTTPS submission. Hardhat's read provider is restricted to read methods. Broadcast uses an isolated verified HTTPS POST with no redirects/retries, because Hardhat's HTTP provider itself retries some rate-limit responses.

Shared native actor locks and the terminal's `active-send` gate provide cooperative local exclusion; they are not on-chain nonce reservations. Keep all other native import/relay commands, wallet applications, machines and signers for this deployer idle throughout the operation. No tool can atomically reserve an EOA nonce against an independent signer.

An attempt record means submission may have occurred, even if the process stops, the endpoint returns an error, or the response hash is missing/wrong. Re-running `send` refuses before key entry. There is no automatic resend or gate deletion. Do not bypass this by changing config/output names, creating another session or using another wallet application.

Use signer-free native reconciliation; no signature export is needed:

```bash
/absolute/node-22.23.3/bin/node /absolute/tooling/scripts/ubuntu-hardhat/terminal.cjs reconcile \
  --config /absolute/private/terminal-config.json --config-sha REVIEWED_CONFIG_SHA256 \
  --out /absolute/private/operation-0-reconciled.json
```

Manager and Alpha use their original public sender/nonce recovery and exact canonical receipt/runtime/state verifier. Jobs uses native `observe`, followed by its original staged Hardhat writer to accept that receipt, validate runtime/authority and prepare the next operation. If inclusion/finality is not yet available, preserve everything and repeat **only read-only reconciliation**. A proven never-submitted attempt requires an explicit separately reviewed recovery decision; this tool offers no automatic reset. A crash-retained `active-send` directory also requires manual executor reconciliation.

After Manager's ninth reconciliation, run the original `core-session.cjs complete` with the same catalog/SHA/build ID/session and a fresh `--out` file; its native completion verifies the full prefix and releases its owned creator lock. Alpha's original session covers five creations plus two later governor bindings; preserve its actor locks until those calls have their original unsigned handoffs, native reconciliation and `finish`. These are public-transaction observations, with no governor-key import or raw-signature export. Jobs retains its original native external-session lease semantics. Before a shared deployer is used across projects, separately review and qualify the exact source-defined session/lock handoffs and nonce continuity. Separate disposable project runs do not qualify that cross-project production plan; no stale lock is automatically removed.

## Exact graph and handover

| Project | Initial operation scope | Authority required before declaring handover complete |
| --- | --- | --- |
| Manager | 8 libraries then Manager: UriUtils, TransferUtils, BondMath, ReputationMath, ENSOwnership, NftEligibility, JobSettlement, JobValidation, AGIJobManager | d76 assigned atomically; owner=d76, pendingOwner=0; creator absent from moderator/validator/agent privileges, locked balances/jobs/approvals and indirect authority; all nine exact runtimes |
| Alpha | AscensionAccess, NovaSeed, AscensionRiskOracle, AscensionJobMarket, AscensionMark | Three Ownable2Step owners=d76 and pendingOwner=0 at creation; two remaining contracts have no protocol owner; creator has no admission or graph administration. No global pause exists; fresh graph remains uncommissioned |
| Jobs | Original tax-enabled 39-operation sequence: coordinator, 10 implementations, 14 components, commitment, registration, paused finalization, 11 direct ownership handovers | Coordinator+implementation owners=d76; eight managed modules owned by SystemPause, whose owner is d76; remaining owner/governance topology and treasury roles match exact source/config; creator absent from every listed operational permission; pending owners resolved |

Manager's seven constructor arguments are ordered: `usdcTokenAddress`, `baseIpfsUrl`, `ensConfig`, `rootNodes`, `merkleRoots`, `settlementWallets`, `initialGovernor`. ENS roots are `[club, agent, alphaClub, alphaAgent]`; Merkle roots `[validator, agent]`; settlement wallets `[30% recipient, 10% recipient]`. The final argument is d76. No optional helper is silently deployed. Manager starts intake paused; NFT admission starts disabled with an empty registry.

Jobs' 11 coordinator/implementation ownership transfers use its native immediate handover/readback. Do not invent eleven Ledger accept calls. Separately inspect any actual pending ownership reported for IdentityRegistry/TaxPolicy and resolve through the governor's supported path before final acceptance. SystemPause ownership must remain the source-defined contract topology; transferring every contract directly to a wallet would be incorrect.

### Jobs' later governor steps on the Mac

The original native `awaiting-commissioning` closeout intentionally permits pending IdentityRegistry/TaxPolicy acceptance and FeePool governance/treasury configuration. Consequently its bounded certificate need not be complete immediately after 39 creator operations. This is a later governor phase, with no requirement to import d76's key or use the optional companion.

After exact source verification and fresh independent owner/pending-owner/role readback, use Etherscan → MetaMask → Ledger from d76. For the common reviewed case in which FeePool governance and treasury are both d76, the simple sequence is:

| Order | Etherscan target/method | Exact parameters | Expected readback |
| --- | --- | --- | --- |
| 1 | New IdentityRegistry: `acceptOwnership()` | None; require its pending owner is d76 first | owner=d76, pendingOwner=0 |
| 2 | New TaxPolicy: `acceptOwnership()` | None; require its pending owner is d76 first | owner=d76, pendingOwner=0 |
| 3 | New SystemPause: `executeGovernanceCall(address,bytes)` | target=new FeePool; data=`FeePool.setGovernance(d76)` | FeePool governance=d76; owner remains SystemPause |
| 4 | New SystemPause: `executeGovernanceCall(address,bytes)` | target=new FeePool; data=`FeePool.setTreasuryAllowlist(d76,true)` | FeePool treasuryAllowlist(d76)=true |
| 5 | New SystemPause: `executeGovernanceCall(address,bytes)` | target=new FeePool; data=`FeePool.setTreasury(d76)` | FeePool treasury=d76; owner remains SystemPause |

The FeePool setters are forwarded through SystemPause because it owns FeePool. These are five separate, zero-ETH, owner-approved governor transactions, conditional on actual pending state. They do not unpause, fund, admit participants or alter economic parameters. If the reviewed treasury/governance roles differ, use those exact approved addresses; if StakeManager treasury differs from its initial d76 value, its allowlist/treasury changes likewise go through SystemPause in a separately reviewed sequence. Never choose or infer a treasury merely from this example.

For d76 specifically, the following **inner calldata only** was encoded/decoded against the exact 9a79 FeePool artifact ABI. The actual outer transaction still targets the **new SystemPause** and must wrap the inner data with the **new FeePool** address using `executeGovernanceCall`; this is not a standalone transaction or approval.

```text
setGovernance(d76):
0xab033ea9000000000000000000000000d76ad27a1bcf8652e7e46be603fa742fd1c10a99
setTreasuryAllowlist(d76,true):
0x2d4610da000000000000000000000000d76ad27a1bcf8652e7e46be603fa742fd1c10a990000000000000000000000000000000000000000000000000000000000000001
setTreasury(d76):
0xf0f44260000000000000000000000000d76ad27a1bcf8652e7e46be603fa742fd1c10a99
```

Compare full outer calldata, sender, chain, target, zero value, nonce, gas and both fees before each Ledger approval. After each, reconcile the exact finalized receipt and state; never retry an uncertain wallet submission. All deployer-wallet permission probes must remain false. Even a later fully matching bounded certificate does not establish complete indirect/external authority or explorer acceptance.

After receipt reconciliation, exact source verification must cover **every actual component**, including libraries, implementation contracts and coordinator. Bind Standard JSON/compiler/settings/constructor bytes/library addresses/immutables and compare all runtime bytes at a canonical finalized block. Independently observe exact explorer acceptance; a submitted verification request, matching address, green UI badge or deployment report alone is insufficient. Preserve the packages for the Mac governor's independent review.

Then read back the **complete setup interval and authority inventory**: owner/pending owner, governance/default-admin/upgrade/proxy powers or their absence, moderator/pauser/operator/registrar/rewarder/acknowledger/allowlist mappings, treasury/fee recipients, approvals, ENS parents/wrapped owners/fuses/operators, token controllers, aliases and any indirect deployer-controlled actor. Reconcile every setup transaction/event against the approved plan. Exercise deployer-denied administrative calls in the disposable rehearsal, and require equivalent source/state evidence for production. Never infer zero residual system privileges solely from `owner()`.

The original bounded Jobs audit and companion authority reports deliberately retain `authorityComplete:false`. Their checks remain useful; this route does not flip those flags or treat a bounded report as complete indirect/external authority acceptance. Production handover stays incomplete until the full inventory and setup history are reviewed with no residual deployer privileges. No funding, participant admission or activation follows automatically.

On the Mac, Alpha's separately reviewed governor calls are `AscensionRiskOracle.bindMarketplace(new AscensionJobMarket)` then `AscensionJobMarket.bindMark(new AscensionMark)`. Use Etherscan/MetaMask/Ledger to inspect and manually approve only these exact calls after source/authority verification. See [Mac governor handover](MAC_MANUAL_LEDGER_CREATION.md).

## Reproduction

Run the standalone terminal tests under Node 22.23.3 with `UBUNTU_TEST_MANAGER_ROOT` pointing at the exact installed Manager dependency checkout:

```bash
node --test scripts/ubuntu-hardhat/test/*.test.cjs
node scripts/ubuntu-hardhat/test/rehearsal.cjs --disposable-only \
  /absolute/manager-d371 /absolute/alpha-380 /absolute/jobs-9a79 /absolute/new-test-output
```

The rehearsal creates its own unforked Osaka EVM, mock dependencies, random disposable deployers and a test TLS CA. It never connects to an existing chain, requests a real key or signs as d76. It labels synthetic finality/canonical-read adaptation and keeps explorer/production/complete external-authority acceptance separate. Results are recorded in [terminal-route acceptance](../qualification/ubuntu-hardhat-terminal-acceptance.json).
