# Launch checklist — v1.0.3

Use this checklist for the actual instance before opening paid intake. The release contains tested software; it supplies no production manager, owner, payment recipients, reviewer service or independent audit. Every item below starts unconfirmed. Record the evidence beside each completed item in your deployment record.

v1.0.3 retains the v0.9.6 manager ABI and deployed runtime bytecode; construction changes to initialize NFT admission as disabled. Existing instance settings are unchanged. A verified v0.9.6 manager can use this console without redeployment. First deployments and moves from incompatible older versions require the current manager and eight libraries; existing jobs stay on their original contracts.

## 1. Decide who controls and operates the instance

| Decision | Evidence to record |
| --- | --- |
| Final manager owner and signing arrangement | Reviewed public address, proof of signer control, recovery procedure and proposed-owner acceptance rehearsal |
| 30% and 10% recipients | Two distinct reviewed public addresses and confirmation that the intended recipients control them |
| Deployer and infrastructure | Deployer address, gas budget, working RPC and explorer verification setup; retain credentials only in the operator's secure environment |
| Agent/Club membership | Verified four role roots, intended admission routes, actual participant wallets and every approved allowlist/Merkle exception |
| NFT policy | Explicit required/optional choice and the complete reviewed collection registry, including disabled entries |
| Review and arbitration | Independent reviewers, admitted moderators, response times, evidence process and owner backstop signer |
| Economics and limits | Agreed job scope, review effort and gas budget, shared reviewer reward, agent net earnings, bonds, timers and initial exposure limit |
| Optional ENS job pages | Enable or omit; if enabled, verified parent authority, deployment-specific jobs root and helper owner; [fresh/replacement naming policy](ENS_DEPLOYMENT_NAMESPACES.md) |

**NFT admission starts disabled:** a fresh v1.0.3 manager has no registered collections and does not require an eligibility NFT. Keep the reviewed readiness policy `false`/empty to retain that state. To opt in before posting jobs, register reviewed collections and call `setAgentNftRequired(true)`. Every job retains the policy recorded when posted. Optional NFTs do not waive ENS/exception authorization or bonds. See [NFT setup](NFT_POLICY.md), including the [free alpha-agent identity route](NFT_POLICY.md#enable-the-free-alpha-agent-identity-route) and its expiry limitations.

## 2. Collect evidence before mainnet deployment

- [ ] Verify the immutable release tag, checksums, exact compiler profile and all required source-CI results.
- [ ] Review the accepted static-analysis findings and obtain independent security/operational review before substantial exposure. Release tests do not complete that external review.
- [ ] Record observed buyer, agent, reviewer and operator sessions using [the acceptance protocol](V1_ACCEPTANCE.md). Do not substitute internal browser automation for user-study evidence.
- [ ] Complete the Sepolia journey with the intended signing arrangement: post, apply, submit, vote, accept/finalize, cancel/expire, dispute and refund. Rehearse ownership acceptance and pause recovery. Historical fork impersonation does not prove control of real signers.
- [ ] Preserve the existing-manager job and ENS inventory. No new deployment imports its jobs, token approvals, escrow or payment claims.
- [ ] With reviewed addresses and current mainnet reads, run `DRY_RUN=1 npm run deploy:mainnet` from `hardhat/`. Use `DEPLOYER_ADDRESS` for a keyless plan. Recheck USDC availability, code, linked artifacts and recipients; budget gas separately because the manager dry run is not a total cost estimate. The dry run sends no transactions.

Use the [Hardhat guide](../hardhat/README.md) for the complete setup and separately authorized broadcast procedure. The release and this checklist do not authorize a public-chain transaction.

## 3. Verify the deployed instance while intake remains paused

- [ ] Preserve the incremental deployment journal and exact compiler input. Verify all **nine manager/library contracts** on the explorer and compare their linked runtime code to the qualified artifacts. Optional ENS contracts are additional.
- [ ] If a command fails, reconcile recorded transactions before retrying. Where all nine manager/library deployments completed, the documented read-only recovery can retry verification; it does not accept ownership or launch the manager.
- [ ] Complete `acceptOwnership()` through the intended owner. Verify `owner()` and zero `pendingOwner()`; a proposal alone does not remove deployer authority.
- [ ] Configure and verify moderators, eligibility, NFT policy, bonds, limits and review periods. Keep intake paused and settlement enabled. Configure optional ENS job pages and confirm successful hooks before considering an irreversible identity lock.
- [ ] Run the readiness checker with the deployment receipt and complete `READINESS_NFT_CONFIG`. Save the passing report's block/hash. Initial activation requires zero escrow, bonds and pending claims.
- [ ] Independently check the items outside that checker: individual eligibility, private metadata gateway, mutable operating policies, signer security, reviewer/moderator availability, monitoring and incident response. Recheck any state changed after the report.
- [ ] Publish the reviewed deployment registry and configure the console with the verified manager. A canonical USDC getter alone does not authenticate a deployment.

## 4. Open intake with a limited first job

- [ ] The accepted owner opens intake after reviewing the evidence above.
- [ ] Complete a deliberately small job and reconcile actual USDC transfers, separate bonds and all five reserve counters before increasing exposure.
- [ ] Monitor missed submissions, reviews/disputes, pause duration, recipient/identity changes and pending claims. Keep a funded signer available for necessary transactions; deadlines alone do not execute refunds or settlement.

The default successful-job split is 8% shared reviewer budget, 30% and 10% wallet fees, and the agent remainder. Verify that the resulting earnings cover the actual work and review costs. Buyers can recover full escrow on a buyer-win outcome, but quality still needs independent assessment; neutral timeout may leave honest work unpaid. See [economics](game-theory.md) and [buyer outcomes](BUYER_PROTECTION.md).

## During operation: three different reserve checks

| Action | Required reserve treatment |
| --- | --- |
| First activation | All five counters are zero: escrow, agent bonds, validator bonds, dispute bonds and pending claims |
| Rotate payment wallets or change NFT collections | Live job escrow and all three bond counters must be zero; wallet rotation also requires paused intake. Pending claims can remain and keep their original beneficiaries |
| Withdraw surplus | Protect the sum of all five counters. Owner authority, paused intake and enabled settlement are also required |

Settlement pauses stop lifecycle clocks, extend their calendar deadlines and block claim retries. Intake-only pauses leave those clocks and settlement available. Use the [incident runbook](OPERATIONS/INCIDENT_RESPONSE.md) to recover settlement before reopening intake.
