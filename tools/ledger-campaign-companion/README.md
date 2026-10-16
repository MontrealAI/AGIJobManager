# Manual Ledger campaign companion — 0.2.0-candidate.2

This review candidate adds a local English/French campaign dashboard, an isolated USB Ledger signing frame, durable private recovery, bounded adapters for the existing Manager and Alpha coordinators, and exact-source verification automation. The owner must approve every exact transaction on the physical Ledger. Starting this package grants no Mainnet permission. Each real transaction requires the owner's explicit review and manual physical signature; funding, governance, ENS changes and activation are separate decisions. Disposable local-chain acceptance is identified separately.

**Mainnet deployment requires a separate decision for each exact contract set.** This package is a review candidate, with physical Ledger/macOS and live explorer acceptance still pending. Real-browser tests with synthetic devices, native disposable-chain acceptance and deterministic tests establish distinct scopes. Earlier passing runs do not qualify this changed source. Jobs external signing is being implemented by the native owner team and remains refused here until its exact interface and acceptance evidence are supplied.

## Primary configuration path: existing Ledger wallet + Etherscan

Initial contract creation is separate. For supported configuration calls, use the owner's existing Ledger-backed wallet with Etherscan after every deployed component has exact source/runtime verification. The custom companion is **optional**, and is not a prerequisite for wallet-supported calls. No new signing application, key import, delegation, blanket approval or automatic signature is required by this path. The standalone wallet-config utility is optional: it automates independent checks but does not mediate or replace the wallet, and equivalent independent exact Mac evidence may be supplied instead.

The bounded configuration review must show the exact new target, method, arguments, complete calldata, value, designated governor, source/plan and expected state before the owner opens the explorer write interface. The owner checks Ethereum Mainnet and the governor account, compares the reviewed exact call and manually approves each transaction on the physical Ledger. Record its transaction hash, then independently reconcile exact transaction bytes, canonical receipt and post-state. A successful explorer submission is separate from this acceptance. Unknown outcomes stop; they never permit automatic resend or replacement.

The supported Alpha configuration consists of the two exact native bindings only. Creation proofs and explicit approved policy must identify their new targets and arguments. Unsupported Manager/Alpha administration requires a separate exact reviewed policy and implementation; economic settings, treasuries and ENS eligibility are not invented by the workflow. Wallet-generated transactions are independent evidence. Do not claim they were imported into, or completed, a native seven-operation session without exact native acceptance of that interface.

| New receipt-proven target | Exact method | Argument from the same new graph | Required resulting getter |
|---|---|---|---|
| `AscensionRiskOracle` | `bindMarketplace(address)` | New `AscensionJobMarket` | `marketplace()` equals that market |
| `AscensionJobMarket` | `bindMark(address)` | New `AscensionMark` | `mark()` equals that MARK |

Both are one-time, governor-only bindings. Contract-side checks also require consistent access/oracle/job dependencies; independent Mac readback must prove those links before approval; the optional utility automates that check. Do not substitute historical addresses or change parameters to bypass a failed check.

For the optional standalone utility, `trust/prepare-wallet-review.mjs` creates the local five-contract build-policy proposal directly from the independently reviewed wallet input and native plan. It performs no RPC, uses no signing session/bridge/actor locks and does not require a seven-operation campaign. The supplied compiler/Node pins and exact Alpha source are checked locally; its generated policy and integrity digest remain unapproved until independently reviewed. Five unit cases and actual Linux offline compilation of the five native Alpha contracts with their 55-source closure passed; the production Mac CLI and physical wallet remain separate acceptance. See the wallet runbook for the exact command.

See `START_HERE_EN_FR.txt` for the short bilingual operator flow and `verification/WALLET_CONFIGURATION_EN_FR.md` for the exact bounded `export`, `submit-source`, `verify` and `reconcile` commands and review schema. Each appended owner transaction hash requires a freshly reviewed complete input digest; the local build binding stays stable. Preserve the same private explorer journal across fresh report directories. The optional companion's preparation, signing and recovery details follow below.

## Exact source dependencies

The new review targets are Manager PR #1586 `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` and Alpha PR #4827 `38064bec3423218f87c6b81760ac6768b3e7d4e5`. They require their own acceptance before a compatibility entry can be promoted. `COORDINATOR_COMPATIBILITY.json` is the revision inventory; inspect its exact acceptance state and linked evidence. The following entries preserve the earlier accepted interface baseline.

The production launcher blocks **all supported Manager revisions**, including legacy `eb6f725e…` and candidate `c2f72180…`, because their native verifier reverses the agent/club ENS-root expectations. Legacy adapters and evidence remain available for recovery and fixtures, not as a production fallback. A disposable zero-root engine fixture may qualify transport/recovery, but cannot authorize a live launch or certify distinct nonzero roots. The owner must fix and freeze the native revision, then repeat exact acceptance; no equal/zero-root policy workaround is inferred.

| Adapter | Supported source | Native import | Supported operations |
|---|---|---|---|
| Manager | MontrealAI/AGIJobManager, commit `eb6f725e0b40ac81e50a374304e54a5ff6859fcf`, tree `73347842e4a81767ef14686a607b7aceb4f5d70c` (PR #1587 correction on #1586) | Private JSON `{raw}` | Nine core CREATEs |
| Alpha | MontrealAI/AGI-Alpha-Agent-v0, commit `d69cdd3ddc0f36933d07f0f64abfe15e742bf68c` | Private raw transaction text | Five CREATEs and two existing governor bindings |
| Jobs | MontrealAI/AGIJobsv0, merged candidate `fed83bc183753e871621fc1cb3aa8510bd38f642` | Unsupported | Read-only inventory and refusal |

Unknown revisions and packet schemas fail closed. Manager #1586's uncorrected `3c974ad3cb1d828e5c89464fd8424d8ae853d9dd` is an inspected candidate, not this adapter's supported operational source. Owner changes require a new frozen revision and qualification. Previous constructor evidence cannot certify new source.

The historical Alpha `d69cdd3…` interface has no native `expiresAfterBlock` policy. Inspect the selected exact revision before relying on any later native expiry correction. The companion additionally enforces the independently reviewed wall-clock expiry before presentation/import/relay and retains late signatures for recovery. Neither local nor native off-chain expiry cancels signed Ethereum bytes.

## Trusted Mac preparation

The Mac Studio is authoritative for source validation, reproducible compilation, the complete native plan, unsigned transaction bytes, native sessions, shared nonce locks, capabilities and attempt records. Ubuntu Terminal/Hardhat is an optional experimental preparation station. An Ubuntu-provided artifact, source hash or verdict is only a proposal. Obtain the exact source and compiler independently on the Mac and reproduce the pinned Standard JSON build there.

`trust/local-build.mjs` uses an explicitly reviewed local compiler and a fixed C API driver; it compares ABI, creation/runtime bytecode, links and immutable references with the exact native artifacts. The separately reviewed local trust policy pins source/build/plan/campaign and tool identities. The launcher requires `--trust-policy` and `--reviewed-trust-policy-sha256`, then validates the local build before opening the dashboard. It does not trust a self-authenticating hash written by an untrusted preparation environment. Runtime must match the receipt-bound deployed code, including only legitimate compiler-declared immutable substitutions. A successful build establishes byte identity; contract qualification and approval remain separate.

To generate a review proposal on the Mac, create a fresh owner-only directory (0700) and run:

```sh
node trust/prepare-review.mjs --campaign /absolute/private/reviewed-campaign.json --reviewed-campaign-sha256 EXACT_REVIEWED_CAMPAIGN_DIGEST --compiler /absolute/reviewed/soljson-v0.8.37.js --compiler-sha256 EXACT_REVIEWED_COMPILER_DIGEST --node /absolute/reviewed/node --node-sha256 EXACT_REVIEWED_NODE_DIGEST --out /absolute/private/fresh-review/mac-trust-policy.json
```

This recompiles and binds the native plan, then writes an **unapproved review proposal** and prints an integrity digest. The owner must independently review that exact policy before supplying its reviewed digest at launch. A printed digest is not approval. Existing outputs are never overwritten: preserve each failed attempt and use a fresh private review directory. No compiler, account or fee policy is selected automatically.

Select the deployer before preparing the campaign. A different deployer requires regeneration and review of the full native plan, every affected nonce/predicted address, constructor and governed binding, and a new immutable campaign. This package does not edit an existing plan in place. Existing signing markers, signed capabilities, imports or submissions must first be reconciled read-only. Do not clear locks or erase attempt records to make a changed campaign proceed.

The optional Mac-only creator-selection helper generates a **new unapproved proposal**, preserving the prior campaign and fixed economic/ENS/governor policy:

```sh
node trust/prepare-campaign.mjs --campaign /absolute/private/reviewed-template.json --reviewed-campaign-sha256 EXACT_REVIEWED_TEMPLATE_DIGEST --creator SELECTED_DEPLOYER --prior-state /absolute/private/original-campaign-state --output-directory /absolute/private/new-empty-review-directory
```

The output directory must be a fresh ordinary 0700 directory. Native nonce/preflight checks and temporary shared actor locks must succeed; existing signing/submission evidence requires reconciliation. Prior relay/explorer authorization is not transferred. Cross-project journals stop for an explicit handoff. Seven unit cases and actual Linux disposable HTTPS native-planner/preflight acceptance passed for Manager (nine replanned creations) and Alpha (seven reviewed operations). These do not qualify the real Mac CLI, physical device or Mainnet provider. The Mac acceptance remains separate. Independently review the new plan/campaign and generate a fresh local trust policy before any optional companion launch.

## Install and review

```sh
npm ci --ignore-scripts --no-audit --no-fund
COMPANION_REQUIRE_COMPILER=1 COMPANION_TEST_SOLJSON=/absolute/reviewed/soljson-v0.8.37.js node scripts/browser-regression-check.mjs
npm run build
node scripts/browser-check-production.mjs
node bridge/start.mjs --help
```

Replace the compiler path with the independently verified official soljson 0.8.37 file used by the trust policy. Required compiler acceptance must set `COMPANION_REQUIRE_COMPILER=1`; runs without that compiler can skip its tests and cannot qualify the Mac trust path. No compiler download or trust decision is inferred from a local filename.

The isolated browser toolchain is pinned in `scripts/browser-toolchain/package-lock.json`. See `scripts/browser-README.md` for the supported sandbox-enabled run. Synthetic devices are bundled only into separate test output and excluded from production.

A launch requires private, independently reviewed campaign and Mac trust-policy JSON files with separately supplied canonical SHA-256 digests, an external private state directory, exact coordinator checkout/build/plan/session, reviewed Node/compiler identities and shared actor-lock directory registration. The campaign binds source/build, every exact unsigned envelope and policy digest, actors, route, fees, dependencies, expiry and post-state. There is no default account path, creator, fee ceiling, treasury or economics. The production governor is pinned to `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`; the creator must differ. A checksum establishes integrity, not approval.

See `START_HERE_EN_FR.txt` and `PHYSICAL_ACCEPTANCE_EN_FR.md`. No approved production campaign or live endpoint configuration is supplied.

## Signing and recovery

Dashboard and signer use separate numeric `127.0.0.1` origins. The dashboard contacts only its authenticated bounded bridge. The signing frame denies network connections and accepts only the exact parent/window/MessageChannel handshake. Parent credentials never enter the frame. There is no generic RPC, shell command, wallet proxy or second broadcast path.

The bridge obtains genuine coordinator durable intent and actor locks and persists a signing-request marker before returning an envelope. It checks every field and signature against independent review. The child retains a complete private recovery capability until durable import acknowledgement. Late signatures are retained with `DO_NOT_RELAY`. Refresh, uncertain device outcomes, lost responses, disconnects and source/chain changes stop automatic advancement; they do not request another signature or fee bump.

The first connection or actor change requires on-device address verification. A verified USB session may be reused only for the same actor and explicitly selected path; the address is rechecked for every transaction, and every transaction still requires physical approval. Bluetooth is excluded. Constructors/calldata are labeled host interpretation. Arbitrary CREATE initcode is not claimed to be clear-signed on-device. The unmodified pinned Ledger context remains behind denied network access; refusal/blind-signing behavior needs physical acceptance. Do not weaken CSP or substitute a permissive SDK context.

Relay defaults to off. A later authorized launch must explicitly add `--relay` and enable the immutable exact per-step coordinator acknowledgement policy. This candidate requires an additional relay click for each signed transaction. It invokes only the existing coordinator's one-shot relay after durably recording its own attempt. Lost responses require canonical known-hash observation, never resubmission. Bounded monitoring revalidates prior canonical results before preparing the next approved operation. The next signature always requires manual Ledger approval.

Manual import downloads follow the exact campaign adapter: Manager uses JSON `{raw}`; Alpha uses raw transaction text. Unknown adapter formats disable the import download; full private recovery stays available. Read-only recovery can restore only the original native acknowledgement for the same privately retained signed hash: the historical Manager eb6f interface uses `retrieve-handoff`, while Alpha d69 uses fresh `status` plus its preserved raw file. Later exact revisions require their own acceptance of those commands. Expiry, source inspection failure, native command/attempt gates and the bridge attempt marker prohibit restoration or relay. An unavailable acknowledgement is shown as recovery-required, never synthesized. Recovery does not sign, reimport or relay; any first relay still requires its explicit exact per-step click.

Explicit dead bridge-owner recovery can retire only this companion's private owner record after verifying campaign, host/boot/PID identity and conclusively dead PID. It never removes native actor locks. Unknown identity or a live/ambiguous owner stops recovery. Read-only canonical recovery remains required before another operation.

## Configuration and explorer verification

Only the exact accepted native operations are supported: Manager's nine CREATEs; Alpha's five CREATEs plus `bindMarketplace(address)` and `bindMark(address)`. There is no arbitrary-call escape hatch. Configuration must bind receipt-proven new targets to explicit approved arguments. ENS changes, funding, unpausing and other administration remain unsupported.

At completion the automation requests the genuine coordinator's export and independently rechecks canonical creation proofs. Manager's native export is predicted-only; preserve it and combine separate reverified receipts, never relabel it. Offline exact Standard JSON source packages work without a key.

Explorer submission additionally requires explicit campaign/plan-bound service authorization and a locally supplied `ETHERSCAN_API_KEY`. Never paste a key into chat, campaign, browser, log or attachment. The server uses only the fixed Etherscan V2 endpoint, persists a one-attempt marker before submission, polls with bounded read-only retries, and compares exact source/compiler/settings/libraries/constructor data. Similar matches fail. Unknown outcomes never trigger another POST. Explorer success does not establish final authority or activation. See `verification/README.md` and `verification/AUTHORITY_SCOPE_EN_FR.md`. The authority report covers ownership/pending ownership, roles, upgrade/configuration powers and external dependency permissions, while distinguishing source expectations from live observations. Manager core creation remains a separate commissioning boundary. Alpha has no global pause switch; its initial uncommissioned state must be described through actual bindings, configuration and permissions, never as globally paused. ENS eligibility and the USDC / $AGIALPHA economics remain unchanged.

## Evidence and dependencies

The versioned report/manifests distinguish deterministic/server checks, actual coordinator subprocess tests on disposable EVMs, real-browser synthetic-device tests, live explorer acceptance and physical Ledger acceptance. A fixture cannot establish real Mainnet provider finality. No signed raw transaction, private capability, key, APDU log or session belongs in public evidence.

Exact original SDK pins are preserved: context 2.7.0, DMK 1.11.0, Ethereum signer 1.18.2, WebHID 1.2.4, ethers 6.17.0, rxjs 7.8.2, esbuild 0.25.4 and existing ws/uuid overrides. `DEPENDENCIES.json`, `THIRD_PARTY.md`, `third-party-licenses/` and bundled legal notices retain attribution. `SDK_CONTEXT_POLICY_EN_FR.md` records inspected context/logging behavior.

The original standalone envelope page remains available through `npm start`; its minimal `{raw}` export is not the current Alpha import format. Use the campaign adapter. Historical 0.1.0 evidence certifies only its original source.
