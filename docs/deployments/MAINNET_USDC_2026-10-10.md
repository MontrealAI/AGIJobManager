# Ethereum mainnet USDC instance — 10 October 2026

For the already commissioned instance, start with the [supported inspection and recovery workflow](../OPERATIONS/COMMISSIONING.md). It reports current observations separately from the completed historical milestone; no deployment is needed when connection checks pass.

**ENS deployed, verified, authorized, attached and connection-checked. Production activation: HOLD.**

This is a dated projection of operator-supplied evidence, not a live RPC result or a production certification. The connected-state snapshot is block **26,165,026**, hash `0x6d9d1af91485b6e1567cea4f905087051b3beb921024e90b4573b5361d814fa3`. Later transactions may change the state. The [machine-readable public record](../../config/mainnet/agi-jobs-usdc.json) retains the observation scope, evidence digests and unresolved activation gates. Original operator records remain unchanged and are not uploaded wholesale.

## Configuration at the recorded block

| Component | Value |
| --- | --- |
| Chain | Ethereum mainnet, `1` |
| Existing manager | `0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7` |
| ENSJobPages helper | `0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC` |
| Manager/helper administrator | `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` |
| Deployer, not current administrator | `0x6c8B8897Fb6b08B4070387233B89b3E9A94eD00E` |
| Shared ENS root owner | `0xd57243B80FBc5CFB2560E5a644651FEcd7Dc2512` |
| Root / label prefix | `usdc.jobs.agi.eth` / `job-` |
| Root namehash | `0x22a145a61e88901e934c12ecdf9cd0601884940492d9c8dbb60cb3abc0bab455` |
| First-job preview | `job-0.usdc.jobs.agi.eth`, not precreated |
| Intake / settlement | Intake paused; settlement not paused |
| Next job ID | `0` |
| Identity / helper configuration locks | Both `false` |
| Helper ENS token-URI flag | `false`; the manager's separate private flag was not read |

Both pointers agree: `manager.ensJobPages()` identifies the helper and `helper.jobManager()` identifies the manager. The manager uses native six-decimal USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.

**En français :** ce relevé confirme l’intégration ENS au bloc indiqué, pas l’ouverture des travaux payants. La préparation d’une demande reste distincte du financement. Ne redéployez pas les contrats et ne répétez pas les approbations pour mettre à jour la documentation.

## Completed stages and their boundaries

| Stage | Recorded evidence | What it does not establish |
| --- | --- | --- |
| Core readiness | Earlier block 26,161,848: limited financial, identity and complete optional-NFT checks | A fresh post-attachment financial/policy snapshot |
| ENS rehearsal | v1.5; fork of block 26,163,162 on chain 31337; exact compiler replay; 18 selected checks; 386 upstream reads; zero rejected requests | Real participant qualification, complete voting/dispute coverage or public-chain execution |
| Helper deployment | Four confirmed transactions; reported exact Etherscan verification; final readback at block 26,164,106 | Root approval or manager attachment, which happened later |
| Authorization and attachment | Two separately signed owner transactions | An intake-opening decision |
| Connected state | Ten checks at block 26,165,026, including receipts/events, runtime, pointers, custody and preview | Full financial/NFT/participant readiness or an independent security audit |
| Activation review | Completed source/evidence review: `HOLD_INTAKE_ACTIVATION`, five open closeout groups | Authorization to sign an unpause or a claim that the draft pilot limits are applied |

The rehearsal's simulated helper address happens to equal the later mainnet helper address. Address equality is not deployment proof: the actual chain-1 creation receipt below supplies that evidence. Fork transactions are not included in this mainnet transaction list.

## Six actual mainnet transactions

| Action | Block | Transaction |
| --- | ---: | --- |
| Deploy helper | 26,164,090 | [0x8a1f7365…cb03d26](https://etherscan.io/tx/0x8a1f7365dca44e6a4259f1df5dece65459e094c77cc9f031f89287aa5cb03d26) |
| Set helper's manager | 26,164,095 | [0x581d3382…fe182ee](https://etherscan.io/tx/0x581d3382fa062016d7a16babe9134a6f78e3a7d1b40c104a0ce4b2f71fe182ee) |
| Set `job-` prefix | 26,164,101 | [0x57e9a172…d462f55](https://etherscan.io/tx/0x57e9a172a024765ed5fb0c8bb1a65df58de3bb5d7aa1cbd0faf2c0424d462f55) |
| Transfer helper administration | 26,164,104 | [0x6378b640…bec793](https://etherscan.io/tx/0x6378b640f04e39f5091ee6cfed8c51233cf31b70bb363a124fac834c51bec793) |
| NameWrapper operator approval | 26,164,361 | [0x3f154072…e82a224](https://etherscan.io/tx/0x3f154072b5c6ec87452e8f36911be6e7b3e1168c6752eafb06d8fe413e82a224) |
| Manager attaches helper | 26,164,391 | [0x6b520363…b6a21f1](https://etherscan.io/tx/0x6b520363b39c0cd54b1aa99ec6037e2561e18baee76c7274d308880b4b6a21f1) |

Their recorded fees total **0.000442028263280778 ETH**. This excludes the earlier manager deployment, ENS-root creation/transfer and all other transactions. Historical fees are not future estimates. The deployment record's original `NOT_APPROVED_NOT_ATTACHED` status describes its earlier snapshot; the two later receipts supplement it rather than rewriting it.

## Build and provenance

The helper source is `contracts/ens/ENSJobPages.sol`, Git blob `b07166f6bec3115bc3e5d4c47cec36861d26f847`, at reviewed ref `47abe97bfc7fbd502482e92e71ba558a9668ccab`. Recorded compiler: `0.8.37+commit.f401782d`, optimizer 40 runs, via-IR, Shanghai, stripped revert strings, no metadata bytecode hash. Runtime: **15,344 bytes**.

| Evidence | SHA-256 or runtime hash |
| --- | --- |
| Helper runtime (Keccak-256) | `0x6e557d25a905d945c5cf1123715b98ec8522e5fda0678e0ecf0a7b7ec3f5299e` |
| Manager runtime (Keccak-256) | `0x346ae8bb4bc480db5f8ed9e53a878162d859cae2345eaba8408929f70f23ea5a` |
| Saved compiler input | `34ba5d0665454490fdb8f04a81a1e590d5abc8685b0e23eca0bcc751611f5292` |
| Saved helper artifact | `e873b89e1e8ec1e107d56dbe2e41b2ae4f11d5364625a5cc0d3a136fd4655e82` |
| Original connection report | `44460af43f9ce7d2775338278cec39e8bb36d5adea648c3ef9e5574930801507` |
| Original deployment report | `6579eb93128ff7a14b96f3fda77ed6fb272a91b8e1c8a686556708c712c9019b` |
| Original v1.5 rehearsal bundle | `afd84087b0ed2effdf6e3120fff2673f46077ef85fe96b7cfaaf6a7fdb588e4b` |
| Original activation decision | `955eae572a8d7b7a283d662215d9d41fbc8a52403c20f54aa62889e368f61082` |

Hashes bind retained evidence; they do not independently prove that an RPC or operator report was truthful. No original private host paths, environment files, signed transaction payloads, identity documents or privileged advice are included in the public projection.

## Custody, permissions and recovery

The existing `usdc.jobs.agi.eth` root remains in the shared wallet alongside `alpha.jobs.agi.eth`. The helper is a NameWrapper operator, not the root-token owner. `setApprovalForAll` is **wallet-wide**, including later wrapped names received by that wallet; the helper's configured root is not root-specific permission at the wrapper layer. Only the three named legacy operators and the new helper were checked. Full operator-history discovery and control review remain open; do not revoke historical approvals indiscriminately.

Do not transfer this emancipated root into the unchanged helper as a shortcut: no ordinary root transfer-out method was identified in that helper. The parent is not a recovery route while `PARENT_CANNOT_CONTROL` remains effective. Revoking root-operator approval stops new-name creation but does not automatically revoke existing child resolver delegates. Preserve existing records and rehearse specific recovery actions.

Monitor both the underlying `agi.eth` registration expiry (recorded **17 May 2033, 15:17:44 UTC**) and wrapped root expiry (**15 August 2033, 15:17:44 UTC**). The latter is not the normal registration-renewal date. These dates are historical observations, not a promise of future ownership.

See [ENS operator permissions](https://docs.ens.domains/wrapper/contracts/), [expiry](https://docs.ens.domains/wrapper/expiry/), [the unchanged helper](../../contracts/ens/ENSJobPages.sol), and [incident response](../OPERATIONS/INCIDENT_RESPONSE.md).

## Read-only commands

From a **separate updated source checkout**, offline inspection needs only Node and sends no network requests:

```bash
node scripts/commissioning/mainnet-evidence.cjs
```

`recordConsistent: true` means this dated public record is internally consistent. The output still reports `HOLD_INTAKE_ACTIVATION`; it cannot authorize unpausing.

The operator-tested connection checker is now available directly in the repository:

```bash
node hardhat/scripts/check-ens-usdc-connection.cjs --repo "$HOME/AGIJobManager-deploy-A"
```

The explicit `--repo` points to the existing operator checkout only to resolve its installed **Hardhat-subproject ethers/dotenv** and read `MAINNET_RPC_URL` (shell first, otherwise `hardhat/.env`). It does not start Hardhat, install dependencies, compile, create a signer or alter the checkout. No private key is required; do not share `.env`. It writes a new private `CONNECTION_REVIEW.json` beneath the operator's home directory, preserving earlier journals.

This checker deliberately targets **this instance and this pre-activation configuration**. It expects intake paused, zero jobs, unchanged locks and reviewed custody. After a legitimate activation or policy change it may stop for review; it is not a generic uptime monitor. Do not edit the historical record or undo legitimate activity to force a pass. Scope is receipts and ENS connection, not five-reserve, issuer, NFT-registry or participant qualification.

Run the included offline regressions without RPC:

```bash
node --test hardhat/test/ens-usdc-connection.test.cjs hardhat/test/mainnet-evidence.test.cjs
```

The same tests are picked up by the existing `npm --prefix hardhat run test:preflight` job. See [source-update validation](../qualification/MAINNET_UPDATE_2026-10-10.md).

## Do not restart completed deployment work

Do not use the generic vacant-root deployer for this instance, recreate the root, repeat approvals, replace the manager, or repoint the historical alpha helper. Neither the README update nor a GitHub release changes chain state. Preserve the successful operator checkout and its saved compiler input/artifacts; do not pull, reinstall or rebuild that checkout merely to adopt this documentation.

The [five activation closeout groups](../OPERATIONS/PRODUCTION_ACTIVATION.md) remain separate. No additional ENS transaction or live test job is requested by this update.
