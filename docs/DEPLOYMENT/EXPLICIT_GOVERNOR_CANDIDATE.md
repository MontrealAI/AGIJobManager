# Unreleased explicit-governor deployment candidate

Base: released v1.18.0, commit `6484d09afbba64d7de24cd18ae4dbd246caffd17`, tree `fb8d1443f705731cfa5dfc89b065b4ca1bcf2ab0`. This document describes a local candidate, not a release, deployment, independent security review or activation clearance.

## Intended identities

For the requested deployment, the explicitly selected final governor is `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`. Its being described as Ledger-controlled is an operator signing requirement, not something source code or an ENS address read proves. The creator is separately selected in each reviewed profile. Creator and governor may intentionally be the same address; no equality requirement exists.

The two historical October USDC fee recipients remain separate inputs: 30% recipient `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`, 10% recipient `0xA204b14eD9bc09501e3A47CDde379279FcD5D743`. Governor selection does not change either fee recipient, treasury treatment, custody or numeric policy. Owner handles creator balances outside this tooling.

Previous deployments must not be touched: no migration, pause, ownership/configuration change, withdrawal, settlement or permission-changing transaction may target them. No existing contracts, approvals, delegates, balances or obligations are migrated. In particular, preserve the B3AA legacy manager's job 11 escrow and bonds and both old systems' exit paths. Old job 11 is historical context, not a task to settle or a prerequisite for an independent new deployment. Shared ENS/dependency changes require separate explicit approval and must not revoke or change old application permissions. Historical observed administrator a9eD is not relabeled as the new governor.

## Constructor and ABI changes

Append `initialGovernor` to the existing Manager six arguments, ENS helper five arguments and metadata router two arguments. It must be a nonzero address. Each constructor uses the existing internal ownership transition before external initialization. After the atomic creation transaction, owner is exactly that governor. Manager pendingOwner is zero. Subsequent Manager ownership transfers retain Ownable2Step; helper and router retain ordinary Ownable transfers.

OpenZeppelin 4.9.6's base constructor still emits zero-to-creator `OwnershipTransferred`, followed by the creator-to-governor transition inside the same creation transaction. This is not an externally usable runtime administrative window. Dependencies were not upgraded or patched to hide the event.

Manager's existing `useEnsJobTokenURI` boolean becomes public. This supplies the exact view getter required by the optional metadata-router deployment script. It does not add storage, modify setter authorization or change tokenURI behavior. Old deployed Managers are non-upgradeable and still lack that getter; read failure must never be interpreted as false.

Compiler remains solc 0.8.37+commit.f401782d, optimizer 40, viaIR, Shanghai, metadata bytecodeHash none, stripped revert strings. Measured Manager runtime: 24,412 bytes, 164 bytes below EIP-170. Helper 15,344; router 4,212. All existing storage slots/types/offsets are identical. Manager URI mode remains slot 42 offset 20. ABI calls are additive, but all three creation ABIs are breaking changes.

## Phase separation and durable records

1. Review exact source/compiler input, independent creator and governor, fee recipients, membership roots, numeric policy, transaction mode and costs. New core schema is `agi-manager-deployment-v2`, ownership initialization `explicit-constructor`. `constructorArgs.initialGovernor` must equal `finalOwner`; reviewed buildDigest binds full compiler input plus exact compiler long version.
2. Creator only creates eight libraries and Manager, or the explicitly selected optional helper/router. Manager starts intake-paused, NFT admission off, metadata unattached and URI mode off. Helper/router start with no manager binding. Creation never invokes owner setters, root transfers, wallet-wide approvals, locking or intake activation.
3. A shared, operator-selected `DEPLOYMENT_LOCK_DIRECTORY` protects one `(chainId,creator)` at a time across local workflows. The lock is exclusive; failures retain it. A pre-send durable intent binds nonce, chain, creator, CREATE address, zero value and creation calldata. No automatic retry follows ambiguous submission. A local lock cannot prevent unrelated signing on another machine; operators must prevent it.
4. Exact mined receipt, runtime/link/immutable checks and explorer verification remain mandatory. Original journals/compiler inputs are retained. Keyless re-verification never signs or redeploys. Hashless creation recovery scans bounded canonical blocks for the exact sender/nonce/creation intent. Missing or ambiguous evidence blocks recovery.
5. The governor separately reviews and signs configuration. Optional scripts emit exact governor call plans without sending them. Helper setJobManager/prefix and optional lock are governor actions. Metadata attachment and tokenURI enabling are separate Manager governor actions after verified setup. ENS root creation, custody, token approvals, operator approvals, resolver delegates and fuses remain separate approvals.
6. Read-only technical readiness is not activation permission. Direct authority closeout must be source-bound and pinned to one canonical block; it fails on mismatched owner, pending owner, creator exceptions, fee changes, component code, manager bindings or reviewed metadata settings. It reports incomplete external authority and setup-history coverage honestly. Only the governor can separately choose activation after remaining gates are resolved.

## New namespace proposal, not custody authorization

The inherited fresh naming algorithm proposes `usdc-1-<new-manager-address-without-0x>.alpha.jobs.agi.eth`, with pages `job-<id>` below it. The immediate parent is explicitly `alpha.jobs.agi.eth`; the retained readback identifies its wrapped holder as `0xd57243B80FBc5CFB2560E5a644651FEcd7Dc2512`. The intended child token holder in that optional design would be the **new** ENSJobPages helper, whose administrator would be the explicit governor `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`. These are separate authority roles. No actual new address or approved custody transaction exists in this offline candidate.

The constructor records a name/node only; it creates no ENS root or approval. Before any namespace operation, separately approve the exact new manager/helper addresses, name/node, registry/wrapper/resolver, immediate parent, child holder, expiry and fuses. The inherited fuses-zero choice retains immediate-parent authority and therefore the unresolved Prime/Burn operator-controller paths. Choosing a different parent or fuse policy requires a separately reviewed plan, never a silent change to an old root or approval. Until that choice and its effective authority are resolved, optional ENS closeout remains blocked; constructor governance alone is not complete indirect-authority clearance.

## Complete authority matrix

| Surface | Required expectation / evidence | What creation changes |
| --- | --- | --- |
| Manager owner | Explicit governor; runtime and constructor bound to receipt | Atomic owner assignment |
| Manager pendingOwner | Zero initially and at final closeout | No pending proposal |
| Helper administrator | Explicit governor; later ordinary Ownable transfer rules | Atomic owner assignment; manager binding initially zero |
| Router administrator | Explicit governor; later ordinary Ownable transfer rules | Atomic owner assignment; manager binding initially zero |
| Manager metadata pointer/mode | Reviewed helper/router address or zero; exact mode readback | Initially zero/false; no attachment |
| Moderators | Enumerated reviewed inventory plus complete setup provenance; creator false for creation closeout | No grants |
| Additional agent/validator exemptions | Enumerated reviewed inventory; creator false; separate Merkle/ENS routes reviewed | No grants |
| Blacklists | Independent operational policy; never inferred from owner choice | No grants/exemptions |
| Merkle admission | Reviewed roots and list provenance; not privileged admin | Existing constructor inputs unchanged |
| ENS registry roots and token custody | Live owners, wrapper binding, exact root labels and existing custody reviewed | No ownership transfer |
| NameWrapper token approvals | ownerOf/getApproved/getData and expiry/fuse evidence for each relevant root | No approval |
| Wallet-wide NameWrapper operators | Complete relevant operator inventory and current approvals; indirect controller review | No approval or revocation |
| ENS registry operators/resolver delegates | Relevant owner/operator paths and live record authority reviewed | No approval or revocation |
| Parent/root controllers | Parent custody, fuses/expiry, recovery powers and Genesis/Prime/Employer Burn implementation/controller authority | No control removed merely by deploying |
| Public participant/lifecycle paths | Existing employer/agent/validator rights under current eligibility and job state | Unchanged |
| Fee recipients / treasury | Explicit independent inputs and existing reserved-claims rules | No implicit rotation |
| Generic non-USDC rescue | Existing owner-only arbitrary external-call surface; all governor setup calls require review | Creator cannot invoke after creation |
| Linked libraries | Exact deployed source/runtime/link bindings; no owner/admin role | No privileged role |

The direct role maps are not enumerable and some setters have no events. Checking the creator and known addresses is not proof of a complete later governance inventory. Complete setup calldata/receipts, internal-call coverage and reviewed inventory provenance are required. Likewise, helper-held child custody does not eliminate parent control when fuses permit it. Do not claim indirect authority cleared while Prime/Burn/root controllers or operator/delegate histories remain unverified.

## Read-only closeout

Use the exact candidate build and original new-schema receipt, with an explicitly reviewed `manager-direct-authority-review-v1` JSON file containing manager, governor, creator, buildDigest, roleSubjects and metadata. Run the `hardhat/scripts/finalize-authority.js` entrypoint through the normal network runtime with `DEPLOYMENT_RECEIPT`, `AUTHORITY_REVIEW` and a new `AUTHORITY_REPORT` path.

This command emits `DIRECT_CHECKS_PASSED_CLOSEOUT_BLOCKED`, `finalized:false`, `activationAuthorized:false` and exit 3 when direct checks pass but required comprehensive setup/ENS/operator/signing/activation reviews remain. Any direct mismatch exits 1 without a successful report. It deliberately does not turn a narrow source-bound check into a certificate of complete governance or an independent audit.

## Historical evidence and remaining gates

Six-argument Manager receipts use their original six-argument artifact/build and authentic two-step handover state. New receipts cannot be interpreted against those old artifacts, and old receipts cannot be reinterpreted with seven arguments. Optional legacy schemas similarly require original artifact/compiler input. Archived releases, contract records, October a9eD/CFA readback, B3AA original-token paths and retained evidence are unchanged.

Current direct EOA transport qualification does not itself establish hardware signer support, delegate implementation safety, a real-account fork rehearsal, complete transaction budget/fee caps or signing access. Any delegated-EOA mode needs separate exact-envelope/delegation evidence; ordinary EOA safety checks must not be relaxed to admit the historical 6c8 account. No authorization-list/type4/delegate change is part of creation.

Before release: repeat all source-bound release/package/UI/docs/ABI/security/Foundry gates, obtain the required review disposition, bind a fresh release identity and approved constructor/build manifests, and retain the old checkpoints. Previous green v1.18.0 CI and release attestations do not qualify this candidate. Provider-backed fork execution requires separate authorization. No Sepolia rehearsal or independent audit is implied by local tests.

### Bounded retained ENS evidence, 16 October 2026

A separate read-only assessment at finalized Ethereum block 26,205,115 (`0xfeaf6215261f9ea5c65d2b7845139d781b806379fc877c2163e88983ff348a44`) found the historical creator's tested direct wrapper, registry and resolver-delegate routes negative. The existing jobs/alpha/usdc roots have fuses 327681, including PARENT_CANNOT_CONTROL: ownership of jobs alone does not imply a power to seize alpha. A newly created fuses-zero child under alpha would still retain relevant parent-wallet/approved-helper authority. d572 continues to approve current/Genesis/Prime/Burn helpers wallet-wide, while the exact Prime/Burn controller provenance remains unresolved. This bounded historical observation does not certify a future namespace, grant permission to change old state, or remove the new setup's comprehensive external-authority gate.


### Downstream release, UI and verifier compatibility

- Current `docs/ui/abi/AGIJobManager.json` is regenerated from this candidate. Runtime functions/events/errors remain compatible, with the single new URI-mode view getter. Browser transaction UX and deterministic packaged UI still need their own fresh release gates; a passed ABI check alone does not qualify them.
- New compilation exports must regenerate `hardhat/artifacts`, exact compiler input/build info and `build/contracts`; these generated outputs are review evidence, not replacements for historical deployment artifacts. The Manager constructor now has seven arguments, ENS helper six, and router three. Explorer encoding is ABI-derived; core/optional recovery selects the correct schema and original artifact rather than silently converting historical constructor records.
- New deployment profiles, constructor manifests, journals, source digests, linked runtime hashes and verification target manifests must be produced for the new addresses. `config/mainnet/agi-jobs-usdc.json`, `hardhat/deployments/mainnet/*`, the October commissioning inspector, retained qualification snapshots and all `docs/releases/*` describe historical instances and remain unchanged. Do not overwrite them with new governor or runtime values.
- `config/next-deployment-contract-changes.json` currently inventories only the inherited ENS correction and mock. The existing `scripts/release/check-v114-boundaries.py` therefore cannot qualify the added Manager/helper/router changes. A separately reviewed new exact-source inventory and fresh release identity must precede packaging; package/lock version labels, `config/usdc-deployment.json`, companion release labels, current release guides and qualification records must then agree. No existing release is resealed by this patch.
- `config/successor-builder-source.json` remains pinned to Builder commit `ab516fbd32fd7cf1a9620fd630947fee1455fca2`, tree `b011643b56115c5baa39ca796cbf0a944c152eda`, version 1.17.2. Its explicit Builder source closure contains none of the changed contracts/deployment files. No Builder repin or historical project rewrite is justified by the creation ABI change. A future wrapper release must retain and independently rebuild that selected Builder context under the existing package rules.
