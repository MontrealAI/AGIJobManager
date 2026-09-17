# v0.9.4 validation

Frozen application commit: `fbe6eb73f8d02c15190fb4c3ca5892eb18004024`.

Application tree: `82b63b386f1f6aae6bddf420e9eb66e1742f2569`.

## Exact-source gates

Publication requires every job in the five source workflows to pass. Each job checks out the frozen commit, verifies `git rev-parse HEAD`, and emits an anchored source marker. The publisher downloads all eight required job logs and requires exactly one matching marker plus the successful checkout assertion step. It also checks repository, workflow, source, complete job sets and tree identity. Missing or expired evidence blocks publication.

| Gate | Source run | Coverage |
| --- | --- | --- |
| Documentation | [35280559705](https://github.com/MontrealAI/AGIJobManager/actions/runs/35280559705) | Generated references, ENS docs, links and repository checks |
| Contract CI | [35280559730](https://github.com/MontrealAI/AGIJobManager/actions/runs/35280559730) | Four regression shards, strict lint/build, bytecode limits and console/local-EVM smoke |
| UI CI | [35280559759](https://github.com/MontrealAI/AGIJobManager/actions/runs/35280559759) | Full dependency audit, lint/types, unit/property/browser/accessibility/header checks and deterministic artifacts |
| Native USDC and ENS forks | [35280559780](https://github.com/MontrealAI/AGIJobManager/actions/runs/35280559780) | 8 native-USDC cases and 20 source-bound cutover/membership/NFT scenarios |
| Security verification | [35280559754](https://github.com/MontrealAI/AGIJobManager/actions/runs/35280559754) | Full root/deployment audits, deployment/readiness cases, compiler compatibility, Foundry and Slither review |

## Release-specific review

The manager defaults to `agentNftRequired = true`. `createJob` saves that boolean before assignment and the token transfer; `applyForJob` consults the saved requirement. Only the accepted owner may change the future default. The setter remains operational after identity locking and does not modify existing jobs. The per-job getter rejects missing/deleted jobs and remains readable after completion.

Both NFT registry mutation wrappers require the accepted owner and zero escrow, agent, validator and dispute-bond reserves. Existing bounded ERC-165 and balance checks move into the linked `NftEligibility` library with the same limits, registry size and score semantics. The review checks the compiler's direct-library mutation guard and manager wrapper authorization. All existing public ABI entries remain; only three functions and one event are added.

ENS admission and its explicit additional-list/Merkle exceptions, blacklists, pauses, capacity and bond checks remain independent. Settlement code is unchanged. Tests transfer the credential away before settlement and verify identical USDC shares and bond returns in both modes. Collection upgrades, transfers or external failures remain outside the manager's ability to freeze policy. An older required unassigned job can be cancelled by its employer and reposted under reviewed terms; assigned jobs retain their settlement exits.

Hardhat verifies all six libraries, exact linked runtime identity and the initial required default. It records deployment evidence while intake remains paused and proposes the ownership handover. Readiness now requires a reviewed boolean and complete collection registry, including disabled entries. It checks enabled collection code and binds observations and configuration hashes to the same block as ownership, identity, USDC and reserves. Missing, malformed, incomplete or mismatched policy fails without producing a readiness report. Required mode with no enabled collection fails readiness.

The console reads the posting default and per-job requirement separately, blocks malformed/unknown policy reads, checks NFT eligibility only when the job requires it, and includes the default in posting-term drift checks before submission and after token approval. Transaction ordering after submission can still change the default observed when a new posting is mined; the mined per-job getter is authoritative. Owner UI, local-only configuration tooling and operator documentation explain the future-job scope and protected registry.

## Measured coverage

| Area | Passing coverage |
| --- | --- |
| Contract and console regressions | 434 cases across four shards, including 9 policy regressions and 6 console policy cases |
| Deployment | 93 preflight/readiness/verifier cases and 10 actual deployment/size cases |
| Actual-mainnet local forks | 8 original USDC cases and 20 cutover scenarios, including both NFT modes with real ENS membership |
| Foundry | 37 unit/fuzz/invariant tests; 256 fuzz samples per fuzz case, four 64 × 64 stateful invariants and one directed lifecycle invariant |
| UI | 178 unit cases, 6 property cases, 9 browser flows, 4 accessibility cases, 2 header cases and 35 primary-console checks |
| Release gates | 27 source-evidence/asset-upload tests, duplicate deterministic packages and uploaded asset digest checks |

The new settlement fuzz case varies job cost, validator reward rate and the order of the two NFT modes. It verifies fixed posting terms, payment shares and cleared reserves after credentials are transferred away. Existing invariant coverage includes 16,384 stateful calls. UI property cases are included in the unit suite and also run separately in CI.

Local lint, strict compiler, documentation, dependency audit, regression, deployment, fork, Foundry and deterministic artifact checks passed. The local browser download was unavailable; the exact-source GitHub workflows supply the required browser, accessibility, header and local-EVM UI smoke evidence using their installed browsers. These browser gates must pass before publication.

The cutover suite pins Ethereum block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`. It verifies the actual legacy manager, native USDC implementation and real ENS dependencies. A separate original USDC suite pins block 25,997,388. Every transaction occurs on an isolated local fork; public-network execution is rejected.

Membership fixtures exercise primary and alpha Agent/Club roots, wrapped ownership, resolver address claims, approvals, revocation, wrong-root/unrelated rejection and preserved owner/Merkle exceptions. The additional NFT scenario records required and optional jobs across owner default changes, protects the registry, rejects unrelated participants, removes the credential before finalization and reconciles both USDC payouts. The new dedicated local jobs root is `usdc-v094.alpha.jobs.agi.eth`. Local impersonation and a mock NFT credential do not establish control of real signers or qualify an intended production collection.

The committed report at `source/docs/qualification/mainnet-cutover.json` binds 69 contract, test, configuration and dependency inputs to SHA-256 hashes. CI reruns the suite and compares the complete report byte-for-byte. It compares all 12 allocated legacy job IDs, original-token balances/allowances, reserves, ownership, ENS wiring/records and six completion NFTs through new-system lifecycles. A separate scenario exercises the original-asset exit of legacy job 11 without changing the new manager. This is an explicit inventory comparison, not a formal proof of arbitrary storage.

## Static analysis and deployment limits

The required audits include root, Hardhat and UI dependencies, including development dependencies, at every advisory severity. Results describe the qualification date. Dependency versions are unchanged in this release; lockfile version fields advance to 0.9.4.

The all-detector inventory retains **114 distinct findings: 0 high, 7 medium, 36 low, 71 informational and 0 optimization**. The overlapping reports contain 7 extended, 30 reentrancy and 114 complete-inventory entries. Every current observation matches the prior reviewed observation after source-line normalization and exact NFT-library relocation. Two array-length caching observations are no longer reported for storage-reference library parameters; the loops still read their length directly. No vulnerability is claimed fixed by that detector change. Review mappings, unchanged severities, source hashes and local raw-scan hashes are recorded in `source/docs/qualification/nft-policy-static-review.json`; CI enforces `source/scripts/security/slither-reviewed-findings.json`. Raw report bytes may differ with workspace paths; source hashes and finding identities form the reproducible gate. Existing dispositions remain available in the historical security documents.

The qualified Solidity 0.8.37 profile uses via IR, optimizer 40 runs, Shanghai, no metadata bytecode hash and stripped revert strings. The manager runtime is **24,130 bytes**, with **446 bytes** of EIP-170 headroom. `NftEligibility` runtime is 1,302 bytes; `ENSJobPages` remains 15,344 bytes. Actual deployment tests enforce runtime, initcode and gas limits with constructor inputs. Compilation has zero Solidity compiler warnings. The internal source/static review is not an independent security audit.

ENS hooks remain best-effort. The exercised short metadata does not prove maximum permitted specification/completion URIs fit the bounded 500,000-gas hook budget. Operators must verify actual events, records and terminal delegation revocation. The ENS correction first published in v0.9.2 is retained.

## Release integrity and activation boundary

The packager binds the frozen commit/tree, exact file delta since v0.9.3, evidence digests and historical records preserved against v0.9.3 publication commit `6eccf1741b1f3f71ed85f3a214b59faf66cfca44`. It verifies ancestry and protected paths, inventories every payload with SHA-256 and builds identical archives twice.

The publisher uploads using the known draft release ID with bounded timeouts/retries. Ambiguous responses are reconciled by exact asset name, size and digest; mismatches are never overwritten. All four uploaded assets are checked before publication. Existing tags and published releases are never replaced. Publication preparation may change only this release's documents, release tooling and its workflow; the qualified application remains frozen.

This release requires a fresh manager; existing managers cannot acquire this behavior through a toggle or proxy upgrade. Keep old jobs on their original managers, assets, helpers and namespaces. The release performs no public deployment, activation, repointing or migration. Actual owners/recipients, signing access, intended collection policy, operational rehearsal, source verification, live readiness and independent review appropriate to exposure remain production activation requirements. The pinned fork proves local contract behavior rather than present-day signer control or current chain state.

## Reproduce the release assets

Use a full Git checkout at the commit of the successful **USDC Release v0.9.4** publication workflow. That commit adds release metadata and tooling after the application is frozen. The application tag and extracted ZIP alone do not contain the Git history needed by the packager.

Run `python3 scripts/release/package-release.py --out /tmp/v094-rebuild-a`, then run it with `--out /tmp/v094-rebuild-b` and compare using `diff -r /tmp/v094-rebuild-a /tmp/v094-rebuild-b`. Both output directories must be new and empty. Compare the resulting checksums with the published assets. Packaging is local and sends no publication or blockchain transactions.
