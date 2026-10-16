# Bounded local campaign bridge / Pont local limité

This bridge adds orchestration to the retained signer preview. It does not certify Mainnet readiness or authorize physical signing, submission, funding, governance or activation. The production launcher accepts only the fixed, explicitly supported Manager/Alpha/Jobs adapter imports; Jobs currently refuses external signing.

Ce pont ajoute l'orchestration au signataire conservé. Il ne certifie pas la disponibilité Mainnet et n'autorise aucune signature physique, aucun envoi, financement, acte de gouvernance ou activation. Jobs refuse actuellement la signature externe.

## Launch boundary

Run `node bridge/start.mjs --help` for the fixed command interface. The owner/integration reviewer must first supply the actual immutable campaign, native plan, exact source checkout/build identity and every reviewed unsigned envelope. This package supplies no approved deployer, nonce, fee policy, ENS configuration or ready-to-sign campaign.

Required arguments are `--campaign`, `--reviewed-campaign-sha256`, `--actor-lock-directory` and `--state`. The campaign must be an ordinary owner-only file (0600). Its digest is SHA-256 of recursively sorted-key canonical JSON, as implemented by `sha256(campaign)` in `private-store.mjs`; it is not the raw file checksum. Calculating a digest yourself does not establish independent approval. The external digest must be the exact review result covering source, build, graph, roles, policy, operation bytes, services and fees.

The launcher requires governor `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`, a distinct creator, exact reviewed source/packet schemas and source-derived token/role metadata. The native coordinator checks actual source, plan, artifacts, durable intent, actor locks and signed bytes again. No browser request can select a command, executable, filesystem path, provider, fee or transaction bytes outside the reviewed operation.

`--actor-lock-directory` must equal the immutable coordinator setting. On first use, a private fixed OS-account configuration registry pins that exact real directory for all companion campaigns. A different directory is refused. Registration never clears native actor locks. Collision protection covers cooperating processes using the same filesystem and operator policy; it does not control other machines or wallet applications.

## Browser and API

The same Node process serves two distinct numeric `127.0.0.1` origins. The dashboard may connect only to itself; the isolated signer has `connect-src 'none'`, exact dashboard ancestry and no API routes. The parent receives a short-lived session bearer only in memory. The signer receives no bearer. Their MessageChannel checks exact origins, frame identity, random channel nonce and original unsigned/policy hashes.

All API requests are POST JSON with an exact Host and Origin, `X-Companion-Request: 1`, fixed field sets, a 400 KiB body ceiling and no compression/chunked transport. `/api/session` rotates the in-memory session. The remaining routes require its bearer: `/api/status`, `/api/prepare`, `/api/import`, `/api/observe`, `/api/relay`, `/api/report`. There are no RPC, arbitrary command, wallet or file-serving endpoints. Errors contain fixed codes, never captured command output or signed bytes.

`prepare` calls the genuine coordinator to persist intent and acquire required actor locks, then privately fsyncs a `signing-requested` marker before returning a packet. A refresh, lost response or repeated click cannot create a second signing request. Each USB request remains a manual physical action. The account path has no default; on-device full-address confirmation and recovered-signer/envelope matching remain required. Device display and largest-CREATE handling still need physical acceptance.

The full signed recovery capability is independently checked and exclusively fsynced outside source before native import or a durable response. It is never returned in public status/report. Expired capabilities remain retained with `DO_NOT_RELAY`; Ethereum signatures do not expire merely because the local policy has expired. Import failure or lost output requires observation/recovery and never triggers a retry, new signature, replacement or fee bump.

## Submission and observation

Submission is off by default. Future owner-run use requires both `--relay` and the exact reviewed manifest policy `{ "enabled": true, "acknowledgementMode": "EXACT_COORDINATOR_PER_STEP" }`, then a separate explicit dashboard action using the genuine coordinator's exact stored acknowledgement for that operation/hash. The bridge never fabricates an acknowledgement. Before the single existing coordinator relay call, it checks source/plan/expiry/dependencies and durably records its own attempted marker. A thrown call or lost response remains `RELAY_OUTCOME_UNKNOWN_NO_RETRY`; absence of a receipt never permits resubmission.

Observation uses the genuine signer-free recovery/verifier path, validates canonical prior receipts again before progression, and demotes previously verified steps when canonical evidence changes. Local journals may be reconciled, but these observation paths perform no chain submission. Source/build/account/fee/receipt drift blocks progression. Prior deployments and shared ENS dependencies remain untouched.

Explorer automation is a separate service boundary. The launcher passes only the server-side `ETHERSCAN_API_KEY` environment value and an exact optional reviewed service authorization to the fixed verification module. No credential is accepted through the browser or requested in chat. Its per-task state uses private fsynced compare-and-swap transitions; an attempted service submission marker cannot be cleared. Source export, explorer acceptance, configuration, full authority and activation retain distinct evidence states.

## Crash recovery

Normal shutdown releases only the bridge's own campaign-owner lock. A crash does not clear it automatically. The explicit `--recover-dead-bridge-owner` option additionally requires the same reviewed campaign, ordinary owner-only lock record, matching host and boot identity, matching Linux PID namespace where applicable, and a conclusively absent PID (`ESRCH`). A live PID, permission error, different host/boot or unknown context is refused. macOS uses fixed read-only platform UUID and boot-session UUID queries; their behavior remains part of owner-operated Mac acceptance.

Recovery holds an exclusive claim, preserves the retired bridge lock as audit evidence, retains every capability and native actor lock, and requires read-only native observation before further progression. Unknown macOS identity requires manual review; no identity fallback, actor-lock deletion or nonce clearance exists. Restored orphan capabilities are revalidated and indexed only as recovery evidence; they are never imported or relayed automatically.

La reprise ne retire que le verrou propre au pont après preuve locale stricte de fin du processus. Les verrous du coordinateur et les signatures restent intacts. Toute incertitude impose une observation ou une revue manuelle, sans nouvelle signature, remplacement ni nouvel envoi automatique.

## Evidence limits

Node engine/HTTP/DOM fixtures and synthetic device tests are distinct from real browser acceptance, actual coordinator subprocesses, provider qualification and physical Ledger acceptance. The status page keeps authority and activation false. Audit and Sepolia remain owner-accepted omissions, not performed tests. See the versioned evidence matrix for the exact tests actually completed.
