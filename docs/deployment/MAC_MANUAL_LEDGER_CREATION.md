# Manager d371: exact production plan and manual Ledger creation on Mac

Preparation record, 16 October 2026. **No Mainnet transaction is approved by this document.** The owner reviews and manually approves each exact transaction.

The primary creation route to finish qualifying is **Remix → MetaMask → the owner's existing USB Ledger**. The primary configuration route remains **Etherscan → MetaMask → Ledger**. Raw-signature export and the custom companion are not prerequisites for a wallet route that preserves and independently verifies the exact transaction. No new signing application or wallet migration is required by this preparation.

## Qualification evidence now received

[Hosted run 38958922414](https://github.com/MontrealAI/AGIJobManager/actions/runs/38958922414) completed successfully. Its downloaded ZIP matched SHA-256 `3e8f6245e82510a3a98b4e39c4ffd023870739cdabfcd670edadc6d6953a12e6`; all listed member checksums matched.

| Campaign | Passed cases | CLI commands | Positive core CREATE receipts |
| --- | ---: | ---: | ---: |
| Full deployment/recovery | 96/96 | 355 | 18 |
| Marker/account profile | 30/30 | 118 | 9 |
| Total | 126/126 | 473 | 27 |

Both guarded campaign processes exited 0 without timeout. This supersedes the earlier missing/failed hosted-campaign checkpoint as a preparation blocker. The older failed run remains historical evidence.

Production source is `d371d95cfcc44b9133cda4bba55304f727917f18`, tree `93faf6e9a6875026c1eb9bc2f0f9bdada308d296`. Harness `d95372bc79a7a08baf5b7b659d4e97226e96e3b4`, tree `b0555112f0ef256e0c46ebc36ddd2807fd763647`, is separate. Do not deploy the harness or substitute PR #1590's tooling checkout for the contract checkout.

The [machine-readable readback](../qualification/manager-d371-hosted-38958922414.json) records archive, report, summary, source, build and member-inventory hashes. This is complete hosted **functional campaign** evidence. The reports retain `acceptanceComplete:false` and `nativeCLIQualified:false`; their disposable EVM and synthetic account evidence do not establish actual Mac/Ledger custody, production-provider finality, live delegate qualification, explorer acceptance or Mainnet approval. No launcher flag, acceptance field or policy gate is changed by this documentation.

## Existing support for wallet broadcast and independent recovery

The qualified full report contains the passing case `hashless-external-broadcast-recovered-by-canonical-sender-nonce`: plan, start, handoff, disposable external signing/broadcast, recover and reconcile. There is no native raw import or native relay in that case.

The d371 session accepts a verified `handed-off → finalized` transition. Its existing `recover`/`reconcile` path finds the canonical sender/nonce transaction and reconstructs the signed envelope from public RPC transaction fields. It checks the exact sender, chain, type, nonce, full initcode, gas limit, both fee fields, value and access list; receipt success, predicted contract address, finalized canonical inclusion, linked runtime and Manager initial state are also checked. It does not ask the operator to export a signature.

This establishes recovery support, not prior acceptance of the entire nine-step Remix/MetaMask/physical-Ledger route. The native raw-import/relay transport's restrictions still apply to that transport; this document does not label an arbitrary broadcasting wallet as qualified. Finish the exact Mac wallet handoff acceptance below before relying on it. Do not use the coordinator relay as a second submission path after the wallet broadcasts.

## Freeze the real production plan

The hosted configs contain disposable creators, mock ENS dependencies, test fee wallets and test gas ceilings. They are not production configuration. Repository defaults also leave the new creator/fee recipients unset. No complete production envelope or predicted new address can be honestly supplied until the following public inputs are selected and freshly observed.

| Plan field | Required value or remaining preparation |
| --- | --- |
| Contract source | Exact d371 commit/tree above; clean dedicated checkout |
| Tooling | PR #1590 tooling in a separate checkout; do not certify later tooling changes with an earlier test result |
| Compiler | `0.8.37+commit.f401782d`; optimizer enabled, 40 runs; `viaIR:true`; EVM `shanghai`; metadata `bytecodeHash:none`; debug `revertStrings:strip` |
| Build | Reproduce the exact 91-source-unit compiler closure on the trusted Mac; compare compiler input/output and all nine artifacts, ABI, links and immutables |
| Chain / envelope | Ethereum chain 1; direct type 2 CREATE; no recipient; value 0; empty access list |
| Creator | Owner-selected Ledger-controlled address, separate from the designated governor; verify the exact account/path and current account code |
| Creator policy | Prefer an owner-approved empty-code EOA for the simplest route. Retaining a marker-bearing creator requires its actual source/runtime/state-bound evidence; the 30 synthetic profile cases do not qualify the historical 6c8 delegate. No delegation change is authorized |
| Governor | `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`, acknowledged explicitly and passed as the seventh constructor argument |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals; observe actual dependency and issuer conditions |
| Metadata base URI | Owner-reviewed exact `baseIpfsUrl` string |
| ENS dependencies | Exact reviewed registry and wrapper addresses, with canonical readback of code and relevant authority |
| Membership roots | Exact original four roots, in constructor order `[clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode]`; do not reorder to match the old defective verifier |
| Merkle roots | Exact reviewed `[validatorMerkleRoot, agentMerkleRoot]`; zero is a policy choice, not a value inferred from tests |
| Fee recipients | Exact reviewed `[wallet30, wallet10]`; do not reuse disposable 0x333…/0x444… fixtures |
| Nonce / canonical pin | Fresh creator latest and pending nonce must agree; reviewed canonical block number/hash and validity interval, at most 2,048 blocks |
| Fees | Nine explicit gas limits and type-2 fee pairs, each within native bounds; explicit aggregate maximum fee budget and sufficient balance. No copied test ceilings or automatic fee changes |
| Coordination | Existing shared creator nonce-lock directory; reconcile any old signing handoff, signature, submission or nonce allocation before replacement |
| Provider | Operator-selected HTTPS read RPC supporting the exact EIP-1898/finalized/full-transaction methods; no numbered-block fallback. The manual wallet is the sole broadcaster for this route |

The hosted build digest is `e0965c57b18ace72bb9081b29976098fcc8f08b58ddd1005876d7696aeeb622d`; compiler input SHA-256 is `5cf1c87cab0fb6c0b0ad184c18d882522c51ad9da020aa41ea6ef8296fdc4f48`, output SHA-256 `725fccf4df13f8890250b6df9b085c5b4f87cf0ee5b3129c9cf55991c88a6105`. Retain and explain any reproduction difference. Catalog descriptors contain absolute local paths: regenerate and independently review the **Mac catalog hash**, rather than using a Linux catalog hash for different bytes or paths.

### Nine creations, in exact order

Let `N` be the reviewed starting creator nonce. Every address is derived from that creator and nonce, then bound into all linked initcode before the first signing request.

| Nonce | Component |
| --- | --- |
| N | UriUtils |
| N+1 | TransferUtils |
| N+2 | BondMath |
| N+3 | ReputationMath |
| N+4 | ENSOwnership |
| N+5 | NftEligibility |
| N+6 | JobSettlement |
| N+7 | JobValidation |
| N+8 | AGIJobManager |

The Manager's seven arguments are `usdcTokenAddress, baseIpfsUrl, ensConfig, rootNodes, merkleRoots, settlementWallets, initialGovernor`. The libraries have no constructor arguments. Include the complete exact per-operation envelope, initcode digest, linked addresses, predicted address, expected runtime and fee ceiling in the owner review sheet.

This core plan contains no helper/router/proxy, no configuration call and no activation. Changing creator, nonce, constructor data, links or fees requires a newly reviewed affected plan; an outstanding handoff or transaction must be reconciled first.

## Mac preparation and manual operation

MetaMask officially supports Ledger-backed contract deployment. Remix officially supports browser-extension deployment and scripts. These are supported product capabilities; actual device/browser versions and this exact transaction route remain to be recorded on the owner's Mac.

1. Independently obtain the exact contract source and compiler on the Mac. Keep the d371 checkout clean and operator state outside it. Review dependency installation and reproduce the pinned build. Do not paste keys, recovery phrases or explorer credentials into shared materials.
2. Select the existing Ledger account in MetaMask and verify its full address/path on the device. Use USB and the Ethereum app. Record macOS, browser, MetaMask, Ledger firmware and Ethereum app versions, without treating version numbers as proof of transaction acceptance.
3. Finish the production-config review table above. Generate the Mac catalog, native plan and exact source-verification package. Independently compare their hashes, constructor encodings and linked initcode. Keep `readyToBroadcast:false`.
4. Prepare Remix with the exact reviewed source/compiler settings and library addresses, or an independently reviewed standard Remix script using the exact already-linked handoff bytes. Prevent automatic extra library deployments, factory calls, batching or account-upgrade prompts. Do not rely on Remix defaults, network defaults, a visually similar ABI or a fresh unreviewed compilation.
5. Use the native `start` and one-operation `handoff` to persist the exact intent and reserve the creator nonce. Compare **every envelope field and every initcode byte** of the wallet proposal against that handoff before approving it. Check the active browser extension is MetaMask and the selected sender is the Ledger creator. A wallet fee/nonce/gas/type mutation is a mismatch; reject it and review the affected plan.
6. **Only after the owner explicitly approves this exact Mainnet transaction**, the owner manually confirms it in MetaMask and on the Ledger. The wallet sends that one transaction. No unattended execution, compile-and-run deployment hook, batch recorder or second broadcaster is used.
7. Record the wallet transaction hash and reconcile independently with native `recover` then `reconcile`. The existing CLI does not accept a new hash flag here: it discovers the exact transaction through its bounded sender/nonce scan. Compare the discovered hash to the owner's saved wallet hash. Wait for real finalized canonical inclusion; do not map finalized to latest.
8. Prepare the next handoff only after the previous exact receipt/runtime has been accepted. Repeat one transaction at a time. After all nine are finalized, `complete` performs the full linked-runtime and initial-state readback.
9. Obtain exact Etherscan source/compiler/settings/constructor/library verification for all nine actual components. Explorer upload is source publication, not a chain transaction and not proof of verification success. Verify ownership/pending ownership and the broader live authority/dependency inventory before a separate configuration review.

**Exact pre-signing inspection is the remaining wallet-route acceptance criterion.** The Ledger display may not expose the full initcode. Record how the actual Remix/MetaMask request and wallet proposal were compared to the independent Mac handoff, including nonce, gas and both fee fields. If the actual route hides or changes a field that cannot be independently checked before approval, stop and use another supported exact route; do not label a post-broadcast discovery as pre-signing verification. No raw-signature export or optional companion is imposed merely because this route's acceptance is still pending.

A rejected or disconnected approval, lost response, missing/pending receipt, replacement, reorg, mismatching transaction or changed source stops advancement. Preserve the same handoff/session and reconcile it. Missing evidence never authorizes another signature, nonce reuse, fee replacement or resend. The existing hashless scan is bounded to fewer than 2,048 elapsed blocks from handoff; reconcile promptly, and require separate read-only investigation if that bound is exceeded.

### Existing native commands for this route

The preparer supplies real absolute Mac paths and reviewed values for the variables below; these are command templates, not a complete production config. `MANAGER_READ_RPC_URL` is supplied privately on the Mac. No relay endpoint, raw-signature file, bridge or companion is required by these commands.

```bash
node "$MGR_SOURCE/scripts/qualification/prepare-core-catalog.mjs" \
  --source-root "$MGR_SOURCE" --output "$MGR_STATE/mac-catalog" \
  --expected-commit d371d95cfcc44b9133cda4bba55304f727917f18 \
  --expected-tree 93faf6e9a6875026c1eb9bc2f0f9bdada308d296 \
  --build-id "$MGR_BUILD_ID"

mgr() {
  node "$MGR_SOURCE/hardhat/scripts/core-session.cjs" "$@" \
    --catalog "$MGR_STATE/mac-catalog/catalog.json" \
    --catalog-sha "$MGR_CATALOG_SHA256" --build-id "$MGR_BUILD_ID"
}

mgr plan --config "$MGR_STATE/production-config.json" --out "$MGR_STATE/plan.json"
mgr preflight --plan "$MGR_STATE/plan.json" --out "$MGR_STATE/preflight.json"
mgr start --plan "$MGR_STATE/plan.json" --session "$MGR_STATE/session" \
  --lock-directory "$MGR_LOCKS" --out "$MGR_STATE/start.json"
mgr handoff --session "$MGR_STATE/session" --out "$MGR_STATE/handoff-0.json"
```

At this point stop for the owner's exact transaction review and manual wallet/device approval. No command above broadcasts. After the owner has approved and the wallet has sent that one transaction:

```bash
mgr recover --session "$MGR_STATE/session" --out "$MGR_STATE/recover-0.json"
mgr reconcile --session "$MGR_STATE/session" --out "$MGR_STATE/reconcile-0.json"
```

For operations 1–8 use fresh, unique output names and a new handoff only after the prior operation finalized. After all nine:

```bash
mgr complete --session "$MGR_STATE/session" --out "$MGR_STATE/complete.json"
```

All outputs/catalog/session/lock locations must satisfy the exact CLI's external-path rules. A reserved output left by an interrupted command is not a successful report; recover the same session, without repeating a signing action to obtain cleaner output. `retrieve-handoff` reads the existing intent and grants no new signing permission.

## Configuration remains the familiar separate workflow

After the actual new components are exactly verified, use their verified Etherscan Write Contract interface with MetaMask and the Ledger **governor** account. Review each new target, exact calldata/arguments/value and expected state, manually approve one transaction, save its hash, and independently check canonical receipt/state.

Manager configuration requires its own exact reviewed call list; this core creation document invents none. For the separately pinned Alpha candidate, the existing bounded calls remain `AscensionRiskOracle.bindMarketplace(new AscensionJobMarket)` and then `AscensionJobMarket.bindMark(new AscensionMark)`, after its five creations and verification. They do not belong to Manager's nine-CREATE plan. Jobs' source/adapter acceptance remains separate.

Expected Manager closeout is governor d76, zero pending owner, intake paused, no jobs/reserves, no direct creator exceptions and no ENS helper attached. Alpha's initial uncommissioned state has no global pause. USDC6 and $AGIALPHA18 remain separate. Funding, configuration, activation and historical-deployment changes each retain their own owner approval.

External audit and Sepolia remain owner-accepted omissions, not passed checks. They are not reintroduced as new prerequisites by this preparation.

## Official route references

- [MetaMask: connect a Ledger hardware wallet](https://support.metamask.io/more-web3/wallets/how-to-connect-a-trezor-or-ledger-hardware-wallet/)
- [Remix: Deploy & Run](https://remix-ide.readthedocs.io/en/latest/run.html)
- [Remix: running scripts](https://remix-ide.readthedocs.io/en/latest/running_js_scripts.html)
- [Native d371 external-signing workflow](https://github.com/MontrealAI/AGIJobManager/blob/d371d95cfcc44b9133cda4bba55304f727917f18/docs/deployment/core-external-signing.md)
- [Native d371 receipt/runtime/recovery verifier](https://github.com/MontrealAI/AGIJobManager/blob/d371d95cfcc44b9133cda4bba55304f727917f18/hardhat/scripts/core-creation-verifier.cjs)
