# USDC cutover qualification

## Verdict and scope

The USDC settlement code passes the targeted technical qualification below. The corrected ENS helper passes a complete lifecycle against the actual Ethereum mainnet NameWrapper and PublicResolver on an isolated fork. **Live production activation remains unqualified until the final recipients, actual signing setup, deployment receipts and instance checks are completed.**

This is an internal source review and executable rehearsal, not an independent security audit. Every transaction in the rehearsal is local. Circle-role and owner impersonation proves contract authorization behavior; it does not prove access to a production key or governance signer.

**v0.9.5 changes settlement and review, with eight fixed linked libraries.** It preserves the per-job NFT policy, Agent/Club ENS membership, separate job-page namespace and existing-job inventory. The new rehearsal covers protected payment claims, full buyer escrow refunds, no-vote escalation, neutral timeout, pause-aware clocks and duplicate controller rejection.

## Existing mainnet system

The legacy manager was deployed on February 23, 2026; v0.2.0 activated the ENS identity layer and v0.3.0 replaced its ENS helper. The project has an existing mainnet history. These records are not a deployment of the newer USDC manager.

The rehearsal pins finalized Ethereum block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`. Recheck current state immediately before an actual cutover.

| Item | Observed at the pinned block |
| --- | --- |
| Legacy manager | `0xB3AAeb69b630f0299791679c063d68d6687481d1` |
| Legacy ENS helper | `0x06188E77C1C38d392b16d9D9fB24673363ce1da0` |
| Manager and helper owner | `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` |
| Wrapped `alpha.jobs.agi.eth` root owner | `0xd57243B80FBc5CFB2560E5a644651FEcd7Dc2512` |
| Original settlement asset | `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`, 18 decimals |
| Allocated job IDs | 0–11; four deleted IDs, seven completed jobs and one unsettled job |
| Unsettled job | 11; 10,000 original tokens in escrow |
| Agent-bond reserve | 2,802.4 original tokens |
| Validator/dispute-bond reserves | Zero |
| Legacy intake / settlement | Both unpaused |

The manager owner and wrapped-root owner are different EOAs. A manager ownership handover does not grant control over the ENS parent. The full [machine-readable evidence](mainnet-cutover.json) includes every allocated job ID, existing job state, metadata, ENS name/owner/resolver/text, original-token balances and allowances, and source hashes.

## Findings and corrections

### ENS resolver API mismatch — corrected in v0.9.2, retained in v0.9.5

The v0.9.1 helper called `setAuthorisation(bytes32,address,bool)`. The deployed NameWrapper-aware resolver at `0xF29100983E058B709F3D539b0c765937B804AC15` uses `approve(bytes32,address,bool)` and `isApprovedFor(address,bytes32,address)`.

The first real-ENS CREATE rehearsal emitted `ENSHookBestEffortFailure` with `SET_AUTH` even though the job and ENS name were created. This is a functional delegation failure; the run did not demonstrate escrow loss. The mock had implemented the unsupported selector, hiding the incompatibility.

The helper now calls `approve`. The regression checks actual employer/agent delegation, authorized text writes, rejection of an outsider, completion text, terminal revocation and rejection of writes after settlement. It also requires successful ENS hook events without skipped/best-effort failures for the qualified lifecycle. The real-ENS fixture uses short metadata: accepted maximum-size specification/completion URIs (2,048/1,024 bytes) can exceed the bounded 500,000-gas ENS hook budget. This rehearsal does not prove every valid metadata size will mirror successfully. Check actual ENS events and records, investigate failed metadata writes and validate the intended metadata size before launch; core settlement remains authoritative. See the [upstream resolver interface](https://github.com/ensdomains/ens-contracts/blob/master/contracts/resolvers/PublicResolver.sol).

### Legacy ENS namespace reuse — blocked in the deployment script

A fresh manager restarts numeric job IDs at zero. Reusing the legacy root and prefix would collide with existing job names. A successful job transaction alone would not establish successful ENS creation because hooks are best-effort.

`JOBS_ROOT_NAME` is now explicit, and the mainnet ENS deployment script rejects the reserved legacy root `alpha.jobs.agi.eth`. The rehearsal creates the distinct wrapped root `usdc-v095.alpha.jobs.agi.eth` through the observed parent owner’s authorization. ENS Registry reports NameWrapper as its owner; NameWrapper `ownerOf(root)` and `getData(root)[0]` report the new helper as owner of the wrapped token. Token approval is zero and the parent owner has not granted the new helper operator approval. This is ownership of a dedicated wrapped token, not direct Registry ownership. This name is a tested proposal, not an existing production deployment. No new blanket operator approval is granted over the legacy owner's wrapped names. The new root has fuses `0` and inherits expiry `2007731864`; the rehearsal does not remove parent-owner control or establish an immutable namespace. Review that retained authority and expiry before a production choice.

### Participant membership — exercised against real ENS

Ordinary AGI Agents use `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators use `club.agi.eth` or `alpha.club.agi.eth`. Seven additional scenarios exercise both primary and alpha role roots against the actual Registry, NameWrapper and PublicResolver. They admit wrapped owners and resolver-address members; reject unrelated/wrong-role claims; reject revoked resolver records and transferred-away ownership; test token/operator approvals and their revocation; and preserve explicit owner allowlist and Merkle exceptions. Existing assignments are not retroactively erased when membership is transferred.

For ENS admission cases, additional lists and Merkle roots are disabled. Separate exception cases demonstrate their actual bypass semantics without calling them proof of ENS membership. The original membership cases retain the required-NFT default. An additional scenario toggles both modes around job posting, rejects NFT-less applications to older required jobs, admits an ENS-authorized agent to an optional job, rejects unrelated agent/validator claims, protects the collection registry and settles both jobs exactly with native USDC after the agent transfers away its NFT. It uses MockERC721, so it does not qualify a real production collection.

| Membership parent | Observed owner at the pinned block |
| --- | --- |
| `agent.agi.eth` / `alpha.agent.agi.eth` | `0x3B7205E05D015D06323B432E9813bCb3fe86adf7` |
| `club.agi.eth` | `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` |
| `alpha.club.agi.eth` | `0xc0794B670346025738EE90D470862Bf76727BCf3` |

These EOAs are locally impersonated to create eight local child-name fixtures. The existing parents use resolver `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63`; local fixture names use the actual modern PublicResolver `0xF29100983E058B709F3D539b0c765937B804AC15`. The report records code hashes, parent owners/fuses/expiry, fixture names and tested routes. This proves behavior against the pinned ENS stack, not that those member names exist on public mainnet, that operators control the parent keys, or that validators are independent.

### Legacy jobs and assets — preserved

The fresh USDC deployment and each new lifecycle leave the legacy inventory unchanged. The comparison covers all allocated jobs, original-token balances/allowances, reserves, ownership, pause state, ENS pointer, existing names and records. It is an explicit inventory comparison, not a claim that every arbitrary storage slot was formally proved invariant.

A separate fork scenario expires the actual overdue legacy job 11 on its original contract. Its employer and agent are the same address, so that address receives the 10,000-token payout refund plus the 2,802.4-token bond return. The new USDC job, balances and reserves remain unchanged. This exit was simulated locally; the live job was not expired or otherwise changed.

## Executed qualification

| Area | Evidence |
| --- | --- |
| Real-USDC settlement | Exact 8/30/10/52 payout; separate nonzero bond returns; no repeat payment |
| Precision and policy | One-micro-USDC refunds/remainders; three validators with indivisible rewards; posting-time reward-rate snapshot |
| Adversarial transfers | Issuer pause; blocked manager/validator/agent/recipients; disputed agent payment and employer refund; reserved claims and original-beneficiary retry |
| Ownership | Paused deployment; manager two-step acceptance; wrong caller rejection; deployer loses owner controls; helper ownership verified separately |
| NFT policy | Required/optional posting snapshots; unchanged ENS admission and USDC shares; registry protection while funded |
| Participant membership | All four primary/alpha roots; real wrapper ownership/approval and resolver admission; unrelated/wrong-root/revoked rejection; explicit owner/Merkle exceptions |
| ENS job pages | Real wrapper and resolver; helper-owned dedicated wrapped-root token; actual delegated writes and revocation |
| Recovery | Concurrent-job reserve isolation; treasury withdrawal protection; recipient rotation guards; emergency pause/resume |
| Legacy continuity | All recorded legacy inventory preserved during new operations; original-asset exit remains usable |

Local validation for v0.9.5 passes **23 cutover scenarios, 8 native-USDC fork scenarios, 94 deployment/preflight/verifier cases, 471 contract/console regressions and 10 actual deployment/size cases**. The Foundry suite contains 37 unit/fuzz/invariant tests. The release validation record binds their final CI results to the exact source commit. Compilation is warning-free; manager runtime is 24,198 bytes, 378 below Ethereum's limit.

The full static scan retains **115** individually reviewed observations: **0 high, 9 medium, 36 low, 70 informational and 0 optimization**. New or relocated findings include per-voter rounding, mapping deletion and guarded ledger updates across token calls; all have source-bound dispositions and evidence. See the [v0.9.5 buyer-protection review](buyer-protection-static-review.json) and the checked Slither baseline. The earlier [NFT-policy review](nft-policy-static-review.json) is historical v0.9.4 evidence. These are internal reviews, not an independent audit or zero-finding claim.

## Reproduce without production keys

From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm run build
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm --prefix hardhat run test:mainnet-fork
CUTOVER_REPORT=../build/qualification/mainnet-cutover.json npm --prefix hardhat run test:cutover
node scripts/test-contract-shard.js 0 1
```

The fork URL is public by default; `MAINNET_FORK_RPC_URL` may select a compatible archive provider. Tests refuse a public-network runtime and assert the chain, block hash, USDC implementation/code hash and legacy manager identity. The report includes hashes of the exact contract, test, configuration and dependency inputs. The [fork workflow](../../.github/workflows/mainnet-fork.yml) reruns both suites, compares the generated evidence with the committed report, and uploads it. Test wallets, locally created ENS member names, explicit exception cases and a mock NFT fixture are used for new jobs. Production recipients, actual membership/signing access, exception policy and NFT configuration still require qualification.

## Production transition plan

1. **Keep the legacy service available.** Preserve its contract, original asset, existing ENS helper/root/approvals and a clearly labeled legacy interface. Identify jobs by `(chainId, manager address, jobId)`, never by `jobId` alone. Do not import old balances, approvals or 18-decimal amounts into the new manager. Any decision to close legacy intake is a separate owner action; preserve exits.
2. **Finalize the new configuration.** Supply the distinct 30% and 10% recipient addresses; verify control and current USDC blacklist status. Review the intended final owner, canonical/alpha ENS participant membership, any explicit additional/Merkle exceptions, NFT credentials, limits and the new ENS namespace. Historical owner addresses are reference data, not proof of current signing access.
3. **Rehearse with the actual operating setup.** Exercise the intended owner and root-owner signing paths and a complete testnet lifecycle/recovery. The local fork does not substitute for this operational exercise or independent review before significant exposure.
4. **Deploy the qualified source with intake paused.** Preserve the incremental deployment journal. Verify linked libraries, bytecode, constructor arguments and explorer source. Do not repoint the legacy manager or reuse its helper for the new manager.
5. **Wire only the new system.** Create the reviewed separate root with the root owner's authorization. Set the new helper's manager and the new manager's helper in both directions. Verify namehash, resolver, wrapper authority and helper owner. Manager ownership requires `acceptOwnership`; ENSJobPages ownership is a separate one-step transfer. Lock configuration only after the reviewed wiring is exercised.
6. **Check the actual instance.** From `hardhat/`, run `READINESS_NFT_CONFIG=./reviewed-nft-policy.json DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json npm run check:readiness` with the reviewed [NFT policy](../NFT_POLICY.md). Separately inspect ENS hook events and `isApprovedFor(newHelper,node,actor)` through a lifecycle; the readiness command does not certify resolver delegation or all operational policy settings.
7. **Activate with bounded exposure and monitoring.** After launch review, complete a small real-USDC job, reconcile every transfer/reserve and verify terminal ENS revocation before increasing exposure. Monitor both old and new managers until original obligations are closed.

Outstanding launch evidence is explicit: actual recipient addresses, demonstrated signing access for the intended manager/helper owners and required ENS parent authorities, intended operational policy/eligibility, live deployment and verification receipts, live readiness, and independent review appropriate to the funds at risk. No mainnet or Sepolia transaction was broadcast by this qualification.
