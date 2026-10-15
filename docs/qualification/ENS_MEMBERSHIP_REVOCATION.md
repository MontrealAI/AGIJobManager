# ENS membership revocation

Date: 2026-10-14. This is a bounded engineering review and proposed next-deployment fix, not an independent audit or a statement about a live compromise.

## Failure mechanism

The previous `contracts/utils/ENSOwnership.sol` accepted a resolver's `addr(node)` as an agent or validator credential after the NameWrapper ownership route failed, without checking whether the node still had a live owner. ENS can retain a resolver and its address record after a parent removes a node's owner. An expired emancipated wrapped name can likewise return a zero NameWrapper owner while retaining its resolver record. A matching former address therefore continued to pass resolver-based admission.

The validator credential path also substituted the registry owner or claimant when a wrapped owner was unavailable. In the stale wrapped case this could report the wrapper contract itself as the controller. Controller checks should instead use the actual live ownership route.

The direct NameWrapper route had a second stale-state case: an unwrapped parent can reassign or remove its child's registry owner without clearing the old wrapper token. Checking `ownerOf` or approvals alone then continues to recognize that old wrapper authority. NameWrapper's own `_isWrapped` predicate checks both the wrapped owner and the registry binding.

These mechanisms follow the source behavior of [ENSRegistry ownership updates](https://github.com/ensdomains/ens-contracts/blob/staging/contracts/registry/ENSRegistry.sol) and [NameWrapper owner expiration](https://github.com/ensdomains/ens-contracts/blob/staging/contracts/wrapper/NameWrapper.sol). The regression fixtures model the resulting on-chain read values; a new real-ENS fork regression has not been executed for this change.

## Changed behavior

Every direct wrapped owner, token-approval or operator-approval admission now requires `ENS.owner(node)` to equal the configured NameWrapper. Resolver-based admission additionally requires:

1. A successful, well-formed, nonzero `ENS.owner(node)` read.
2. If the registry owner is the configured NameWrapper, a successful, well-formed, nonzero `NameWrapper.ownerOf(node)` read.
3. A resolver address record matching the claimant.

The verified registry or wrapped owner is the resolver credential's controller. There is no fallback to the claimant or the wrapper when that controller is unavailable. Reads retain their fixed gas and bounded-return-data safeguards.

Live unwrapped and wrapped resolver aliases remain supported, including an address record different from its controller. Healthy direct NameWrapper owner, token-approval and operator-approval routes remain supported once the registry binding is established. Explicit owner allowlists and address Merkle proofs remain independent admission routes. Recorded job votes, escrow, bonds, settlement and recovery are unchanged by this library-level admission correction.

A transfer to a different nonzero registry owner does not erase an existing resolver alias. Such an alias remains an eligible resolver route under the supported policy, attributed to the new live controller. This patch does not infer whether that controller intended to retain the address record; operators must clear unintended aliases when transferring memberships.

## Compatibility and rollout

This changes linked library bytecode and requires a newly deployed, verified library and manager. It does not repair an immutable existing manager. The external manager and library ABI signatures are unchanged.

Custom registries without a functioning `owner(bytes32)` interface no longer support ENS-based admission. Positive wrapped fixtures now establish the registry-to-wrapper binding, and resolver fixtures establish a live owner explicitly. Production configuration should use the intended registry and wrapper together, preserve deliberate resolver aliases and recheck each membership's actual ownership state.

For an existing instance, perform read-only exposure checks against its exact linked library: compare admitted resolver aliases with registry owners and, for wrapped nodes, wrapper owners. Investigate removed or ownerless memberships with retained address records. Explicit allowlists, Merkle proofs and direct wrapped-authority routes must be evaluated separately before describing a participant as ineligible. This report has not established which live instances or participants, if any, are affected. It authorizes no transactions, root changes, blacklist updates or privilege changes.

## Verification

Executed for this patch:

- Compiled the final `ENSOwnership` and affected mock sources with exact solc `0.8.37+commit.f401782d`, optimizer runs 40, via IR, Shanghai, no metadata bytecode hash and stripped revert strings. Result: zero errors and zero warnings; `ENSOwnership` runtime is 2,624 bytes. Compilation used the committed OpenZeppelin source input with the repository's hash-checked compiler compatibility patches.
- JavaScript syntax checks for the new regression suite and changed resolver fixtures.
- `git diff --check`.
- Source audit of positive resolver fixtures in `test/`, `forge-test/` and `hardhat/test/`. The real-ENS cutover fixture already establishes and asserts live wrapped ownership.

At the initial local review, twelve local-EVM regression cases were prepared but not yet executed in `test/ensRevocation.regression.test.js`, covering removed agent and validator memberships, stale direct wrapped holders and both approval modes, zero wrapped owners, healthy aliases, controller conflicts and duplicate controllers, malformed/unavailable ownership reads, restoration and explicit exceptions. Missing local dependencies initially blocked the full runtime qualification. The later source-specific remote results below supersede that initial limitation; syntax and subset compilation alone were never treated as a full qualification pass.

Before release, run the new suite and existing ENS, namespace, controller-conflict and lifecycle tests against the final compiled artifacts, then repeat the required aggregate release gates and exact-source fork qualification.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `contracts/utils/ENSOwnership.sol` | `244bcedf9ef9da775b3a663b2dcc4a221ea70810e1543ac0f255e3f0d3acaca0` |
| `test/ensRevocation.regression.test.js` | `cceb00aefe4157015c00f68e1d419d10dcdadd1dc79bfff629be823cacd905c4` |

## Remote candidate qualification update

GitHub Actions executed source `ea5aef1a16a0ae777ce9f5147c829291668b297d`:

- [Contract CI](https://github.com/MontrealAI/AGIJobManager/actions/runs/38646186825): all four test shards passed (240 + 197 + 181 + 174 = 792 tests), including the twelve new revocation cases. Compilation, Solidity lint and size checks passed. The overall workflow failed later in the Genesis rehearsal because its mock memberships omitted the newly required registry binding; that fixture is corrected in the subsequent candidate.
- [Security workflow](https://github.com/MontrealAI/AGIJobManager/actions/runs/38646186740): all 494 deployment/preflight checks passed; Foundry stopped at formatting, before build, fuzz, invariant and Slither stages. The formatting correction does not establish those later results.
- [Native USDC and ENS fork run](https://github.com/MontrealAI/AGIJobManager/actions/runs/38646186813): both scenario commands passed. The following comparison correctly rejected the old source hashes. The actual uploaded report is retained separately as `mainnet-cutover-next-deployment.json`; original historical reports remain unchanged. Artifact ID `11932208475`, ZIP SHA-256 `2da33014eae0097bcc6b94840e5ca836ae77cdf6a48b6029ce4c8aed1dea8c51`.
- Manager deployed runtime measured 24,359 bytes, leaving 217 bytes under EIP-170. This is not permission to add features without remeasurement.

These results supersede the earlier local-only test limitations for the identified source, not for future edits. Final exact-head aggregate CI, current-source Slither review and independent audit remain required. No failed workflow is reported as a full qualification pass.

The next-deployment source inventory records exact before/after contract hashes and the changed readiness evidence input. The release boundary still rejects other contract/compiler changes, mutated historical source, unreviewed additions and dependency drift. Historical runtime replay recompiles the preserved ENS source rather than asserting the new library has the old runtime hash. This records an intentional compatibility break; it does not waive qualification.

## Full candidate execution and fresh static review

Source `b3f083734fb8c531cad950ec66ca0de2d4c5b729` passed complete [contract CI](https://github.com/MontrealAI/AGIJobManager/actions/runs/38650537467), [USDC/ENS fork qualification](https://github.com/MontrealAI/AGIJobManager/actions/runs/38650537471), [release-candidate preparation](https://github.com/MontrealAI/AGIJobManager/actions/runs/38650537450), Docs, UI and Pages workflows. The security workflow passed Foundry build, unit/fuzz tests and invariants, then ran all three Slither scans successfully. Its final review gate correctly failed because the previous review bound the old ENS source.

The actual [security artifact](https://github.com/MontrealAI/AGIJobManager/actions/runs/38650537519/artifacts/11936030719) was downloaded and its ZIP SHA-256 verified as `bd6d7c4dc5e060a68473c1879beae67bdbea18a1501ab154b639ec3dd470f7f3`. Review found all 12 medium/high and 29 reentrancy entries unchanged. The all-detector scan retains 122 findings; its only identity change is the unchanged ENS assembly helper moving from lines 158–169 to 182–193. The helper and new callers were reviewed, and the explicit rationale and scan provenance are preserved in `scripts/security/slither-reviewed-findings-v1.17.0.json`. All findings remain present; no detector was disabled. The 11 adversarial review-gate tests pass. This internal review is not an independent security audit.

The v1.17.0 release-label changes preserve dependency resolutions but change lockfile hashes. They therefore require fresh final-source scans and a newly executed fork report before release. Historical records remain unchanged, and the final aggregate workflow status must be checked separately.

Source `677f61fbea5bdc818256b8def03e41348bfd5add` executed both native-USDC and ENS cutover scenario commands successfully in [run 38656117810](https://github.com/MontrealAI/AGIJobManager/actions/runs/38656117810). The source-hash comparison then correctly failed on the four version-labeled package/lock inputs. Its actual artifact `11937414377`, ZIP SHA-256 `5bdc6409f8f020fe4d30eec1c2cf3d9c1021224c3b03de5b62dae9b504a78916`, replaces the candidate report byte for byte. All observations are unchanged; historical reports remain untouched. This is executed candidate evidence, not a claim that the overall workflow passed before the report update.
