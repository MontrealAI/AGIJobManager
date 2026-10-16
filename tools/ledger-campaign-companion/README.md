# Manual Ledger campaign companion — 0.2.0-candidate.1

This review candidate adds a local English/French campaign dashboard, an isolated USB Ledger signing frame, durable private recovery, bounded adapters for the existing Manager and Alpha coordinators, and exact-source verification automation. The owner must approve every exact transaction on the physical Ledger. This assignment authorizes implementation and disposable acceptance tests; it does not authorize a real signature, broadcast, funding, governance action, ENS change or activation.

**NO-GO for a real Mainnet campaign.** Physical Ledger acceptance is pending. Local browser execution is blocked by the available Chromium installation/sandbox environment; the separate pinned hosted-browser workflow must supply real browser evidence. Disposable coordinator and deterministic tests are separate evidence scopes. Live explorer service acceptance is pending. Jobs has no compatible external-signing coordinator and is explicitly refused.

## Exact source interfaces

| Adapter | Supported source | Native import | Supported operations |
|---|---|---|---|
| Manager | MontrealAI/AGIJobManager, commit `eb6f725e0b40ac81e50a374304e54a5ff6859fcf`, tree `73347842e4a81767ef14686a607b7aceb4f5d70c` (PR #1587 correction on #1586) | Private JSON `{raw}` | Nine core CREATEs |
| Alpha | MontrealAI/AGI-Alpha-Agent-v0, commit `d69cdd3ddc0f36933d07f0f64abfe15e742bf68c` | Private raw transaction text | Five CREATEs and two existing governor bindings |
| Jobs | MontrealAI/AGIJobs, merged candidate `fed83bc183753e871621fc1cb3aa8510bd38f642` | Unsupported | Read-only inventory and refusal |

Unknown revisions and packet schemas fail closed. Manager #1586's uncorrected `3c974ad3cb1d828e5c89464fd8424d8ae853d9dd` is an inspected candidate, not this adapter's supported operational source. Owner changes require a new frozen revision and qualification. Previous constructor evidence cannot certify new source.

Current Alpha has no native `expiresAfterBlock` policy. This companion enforces the independently reviewed wall-clock expiry before presentation/import/relay and retains late signatures for recovery. Local expiry cannot cancel Ethereum signed bytes. Native block expiry remains a coordinator limitation.

## Install and review

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/browser-regression-check.mjs
npm run build
node scripts/browser-check-production.mjs
node bridge/start.mjs --help
```

The isolated browser toolchain is pinned in `scripts/browser-toolchain/package-lock.json`. See `scripts/browser-README.md` for the supported sandbox-enabled run. Synthetic devices are bundled only into separate test output and excluded from production.

A launch requires a private, independently reviewed campaign JSON and separately supplied canonical SHA-256 digest, external private state directory, exact coordinator checkout/build/plan/session, reviewed Node executable identity and shared actor-lock directory registration. The campaign binds source/build, every exact unsigned envelope and policy digest, actors, route, fees, dependencies, expiry and post-state. There is no default account path, creator, fee ceiling, treasury or economics. The production governor is pinned to `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`; the creator must differ. A checksum establishes integrity, not approval.

See `START_HERE_EN_FR.txt` and `PHYSICAL_ACCEPTANCE_EN_FR.md`. No approved production campaign or live endpoint configuration is supplied.

## Signing and recovery

Dashboard and signer use separate numeric `127.0.0.1` origins. The dashboard contacts only its authenticated bounded bridge. The signing frame denies network connections and accepts only the exact parent/window/MessageChannel handshake. Parent credentials never enter the frame. There is no generic RPC, shell command, wallet proxy or second broadcast path.

The bridge obtains genuine coordinator durable intent and actor locks and persists a signing-request marker before returning an envelope. It checks every field and signature against independent review. The child retains a complete private recovery capability until durable import acknowledgement. Late signatures are retained with `DO_NOT_RELAY`. Refresh, uncertain device outcomes, lost responses, disconnects and source/chain changes stop automatic advancement; they do not request another signature or fee bump.

The first connection or actor change requires on-device address verification. A verified USB session may be reused only for the same actor and explicitly selected path; the address is rechecked for every transaction, and every transaction still requires physical approval. Bluetooth is excluded. Constructors/calldata are labeled host interpretation. Arbitrary CREATE initcode is not claimed to be clear-signed on-device. The unmodified pinned Ledger context remains behind denied network access; refusal/blind-signing behavior needs physical acceptance. Do not weaken CSP or substitute a permissive SDK context.

Relay defaults to off. A later authorized launch must explicitly add `--relay` and enable the immutable exact per-step coordinator acknowledgement policy. This candidate requires an additional relay click for each signed transaction. It invokes only the existing coordinator's one-shot relay after durably recording its own attempt. Lost responses require canonical known-hash observation, never resubmission. Bounded monitoring revalidates prior canonical results before preparing the next approved operation. The next signature always requires manual Ledger approval.

Explicit dead bridge-owner recovery can retire only this companion's private owner record after verifying campaign, host/boot/PID identity and conclusively dead PID. It never removes native actor locks. Unknown identity or a live/ambiguous owner stops recovery. Read-only canonical recovery remains required before another operation.

## Configuration and explorer verification

Only native operations are supported: Manager's nine CREATEs; Alpha's five CREATEs plus `bindMarketplace(address)` and `bindMark(address)`. There is no arbitrary-call escape hatch. Configuration must bind receipt-proven new targets to explicit approved arguments. ENS changes, funding, unpausing and other administration remain unsupported.

At completion the automation requests the genuine coordinator's export and independently rechecks canonical creation proofs. Manager's native export is predicted-only; preserve it and combine separate reverified receipts, never relabel it. Offline exact Standard JSON source packages work without a key.

Explorer submission additionally requires explicit campaign/plan-bound service authorization and a locally supplied `ETHERSCAN_API_KEY`. Never paste a key into chat, campaign, browser, log or attachment. The server uses only the fixed Etherscan V2 endpoint, persists a one-attempt marker before submission, polls with bounded read-only retries, and compares exact source/compiler/settings/libraries/constructor data. Similar matches fail. Unknown outcomes never trigger another POST. Explorer success does not establish final authority or activation. See `verification/README.md`.

## Evidence and dependencies

The versioned report/manifests distinguish deterministic/server checks, actual coordinator subprocess tests on disposable EVMs, real-browser synthetic-device tests, live explorer acceptance and physical Ledger acceptance. A fixture cannot establish real Mainnet provider finality. No signed raw transaction, private capability, key, APDU log or session belongs in public evidence.

Exact original SDK pins are preserved: context 2.7.0, DMK 1.11.0, Ethereum signer 1.18.2, WebHID 1.2.4, ethers 6.17.0, rxjs 7.8.2, esbuild 0.25.4 and existing ws/uuid overrides. `DEPENDENCIES.json`, `THIRD_PARTY.md`, `third-party-licenses/` and bundled legal notices retain attribution. `SDK_CONTEXT_POLICY_EN_FR.md` records inspected context/logging behavior.

The original standalone envelope page remains available through `npm start`; its minimal `{raw}` export is not the current Alpha import format. Use the campaign adapter. Historical 0.1.0 evidence certifies only its original source.
