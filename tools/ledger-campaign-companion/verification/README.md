# Exact source verification automation / Vérification exacte des sources

This server-only module prepares exact offline Etherscan packages and automates an explicitly authorized source-verification service around the genuine coordinators. It cannot sign or broadcast a chain transaction. No real Etherscan request or account/credential setup was performed during this implementation.

`explorer.mjs` follows these primary API references, checked October 16, 2026:

- [Verify Solidity Source Code](https://docs.etherscan.io/api-reference/endpoint/verifysourcecode)
- [Check Source Code Verification Status](https://docs.etherscan.io/api-reference/endpoint/checkverifystatus)
- [Get Contract Source Code](https://docs.etherscan.io/api-reference/endpoint/getsourcecode)

The endpoint is fixed to `https://api.etherscan.io/v2/api`, Ethereum Mainnet chain 1. Submission uses `codeformat=solidity-standard-json-input`, a qualified `path.sol:Contract` name, the full released `v0.x.y+commit.hash` compiler version, and the current `constructorArguments` parameter. No endpoint override, RPC proxy, chain submission or arbitrary command is accepted.

## Offline task

`prepareVerificationTask(task)` validates and freezes this exact schema:

```js
{
  schema: 'manual-ledger-verification-task-v1',
  chainId: 1,
  address, qualifiedName, compilerVersion,
  standardInput, standardInputSha256,
  constructorArguments, libraries, licenseType,
  creation: {
    transactionHash, blockHash, blockNumber,
    canonical: true, finalized: true, runtimeVerified: true
  }
}
```

The Standard JSON hash is SHA256 of recursively sorted-key canonical JSON. All source content is present; source URLs are refused. Library maps may be nested Solc maps or flat fully qualified maps; they must match the complete Standard JSON link map. Constructor bytes normalize to even-length unprefixed lowercase hex. License choice is explicit. Receipt booleans are required input annotations, **not independently trusted proof**.

The returned offline package contains no API key and makes no network request. `packageSha256` and `taskId` bind the complete normalized task, including receipt block identity. The module adds no dependency or SDK pin change.

## Trusted server integration

`createExplorerVerifier({apiKey, authorizeService, validateCanonical, readState, transition, fetch, sleep, clock, limits})` exposes `prepare(task)`, `verify(task)` and `recover(task)`. `recover` only reads the service; it never submits source.

Every network stage and retry requires fresh trusted `validateCanonical(task)` proof matching the exact address, creation transaction, block hash and block number, with `chainId:1`, `canonical:true`, `finalized:true`, `runtimeVerified:true`, and `newTarget:true`. The callback must use the actual coordinator, not repeat task assertions. It is checked again after rate-limit waits. The automation hook re-observes and re-exports through the genuine coordinator, comparing exact task identity; changed canonical receipts or source/config stop progression.

Before source submission, `authorizeService` must explicitly authorize this service and task. Before the single POST, the module awaits `transition` with an attempted marker and reads it back through `readState`. The bridge's existing serialized, locked, fsynced private journal owns durability and compare-and-swap. The module does not create a competing disk journal.

Journal state has `schema:'manual-ledger-explorer-state-v1'`, `taskId`, `state`, immutable `submissionAttempted`, ISO `updatedAt`, and optional bounded `guid`/fixed `reason`. Transition receives `{taskId,expectedPreviousDigest}`, where the digest is SHA256 of canonical previous state, or null for a new task. A lost POST response or timeout retains the attempted marker and requires read/status recovery; no code path automatically repeats a POST. A saved GUID permits bounded status GETs. HTTP or API rate limits permit bounded read retries only.

The API key is injected into the server factory from secure operator setup. It is used only by the service request and is absent from tasks, packages, journal state, returned reports and error strings. Do not enable fetch/request logging around the key-bearing request URL. The browser has no service credential or service submission endpoint.

## Campaign hook

`createVerificationAutomation({apiKey,serviceAuthorization,...})` returns the engine's `afterVerified` hook. It waits until all nine Manager operations or all seven Alpha operations are canonically verified, then exports nine or five exact tasks respectively. Other routes remain unsupported. The native offline exports are preserved in the private directory.

Source service use requires both the immutable campaign and trusted server configuration to contain the **same exact** object:

```js
{
  service: 'etherscan-v2',
  submitSource: true,
  campaignId,
  planSha256
}
```

The campaign field is `campaign.verification.serviceAuthorization`; the license choice is `campaign.coordinator.licenseType`. A secret alone cannot authorize source publication. No environment boolean is treated as approval. Without service authorization the result is an offline export. Explicit authorization without secure setup yields a truthful blocker. This assignment authorizes implementation and synthetic tests; it does not authorize a live service submission.

The hook consumes private `readVerificationState` and `transitionVerificationState` callbacks from the engine. It does not expose these through HTTP. Root server launch wiring owns secure environment loading and the existing campaign/device controls.

## Acceptance and limits

The service is queried for existing source before any POST. An already verified exact record is idempotent. Final acceptance requires canonical full Standard JSON source/settings identity, library map, exact compiler, constructor bytes, and qualified name/file identity. `SimilarMatch` must be present and empty. `Pass - Verified`, a similar match, or an incomplete response cannot establish acceptance. Unknown response formats fail closed; textual legacy library formats not supported by the strict parser remain blocked for review.

Default bounds are three GET attempts, four GUID status polls, a ten-second timeout, at least 600 ms between requests, a 16 MiB task/input ceiling and 24 MiB response ceiling. Retry/backoff limits are finite, responses are streamed under the byte cap, redirects are refused and errors use fixed codes. An ambiguous POST is never retried. Strict live API response compatibility, genuine coordinator-to-service behavior and provider acceptance remain unperformed until separately authorized and tested.

Canonical proof checks deliberately re-export private native packages at each eventual service stage. This favors fresh identity evidence and can create multiple private export directories during polling. They remain outside the public source/evidence package and contain no signed capability.

All returned verification reports retain `authorityComplete:false`, `activationReady:false`, and `productionApproved:false`. Source verification cannot approve comprehensive authority, funding, admission, unpause or activation.

## Additive current-candidate runtime and authority evidence

The older compatibility profiles and their evidence remain separate. For the new exact Manager `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` and Alpha `38064bec3423218f87c6b81760ac6768b3e7d4e5` profiles, verification automation first selects the concrete source-bound adapter using `forCampaign()`. These profiles require one `manual-ledger-runtime-evidence-v1` record per creation in the additive `runtimeEvidence` export; the existing task v1 schema is unchanged.

The native subprocess independently validates the trusted local source/build and approved plan, reads runtime at a canonical pinned block, and supplies the exact compiler output hash, runtime template, deployed link locations, linked libraries, compiler immutable locations and explicit expected immutable values. `runtime.mjs` replaces only these declared values and the narrowly recognized Manager library self-address guard. It rejects unknown bytes, conflicting overlaps, absent values, wrong lengths and mismatching code. No immutable range is masked. Each fresh export must retain the same compiler output hash, instantiated runtime hash and substitution identity before explorer reads or submission.

`authority.mjs` provides the exact source-bound component/power inventory and a bounded canonical read-only core report. It does not claim comprehensive authority from core ownership and graph observations. The complete matrix, external permission requirements, Alpha's uncommissioned state and EN/FR interpretation are in [AUTHORITY_SCOPE_EN_FR.md](AUTHORITY_SCOPE_EN_FR.md). The collector requires trusted Mac `read(query)` and `checkCanonical(snapshot)` functions, not an Ubuntu JSON verdict. It observes the snapshot before and after the bounded reads and reports each missing/mismatched field explicitly. Jobs remains unsupported until exact source and external-signing acceptance exist.

Run the synthetic tests with the pinned project runtime:

```sh
node --test test/explorer.test.mjs test/verification-automation.test.mjs test/runtime.test.mjs test/authority.test.mjs
```

Les paquets exacts sont préparés hors ligne. Toute publication de sources par Etherscan exige une autorisation explicite liée à la campagne et au plan ainsi qu'une configuration sécurisée côté serveur. Chaque étape revérifie les créations et reçus canoniques par les véritables coordinateurs. Une réponse perdue ne déclenche jamais une seconde soumission automatique. Un statut « vérifié » ou une correspondance similaire ne suffit pas : l'ensemble exact des sources, paramètres, bibliothèques, constructeur et identité du compilateur doit correspondre. L'autorité complète et l'activation restent fausses. Les essais Etherscan réels et l'acceptation physique Ledger n'ont pas été effectués.
