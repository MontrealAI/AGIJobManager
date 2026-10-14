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

Prepared but not executed: twelve local-EVM regression cases in `test/ensRevocation.regression.test.js`, covering removed agent and validator memberships, stale direct wrapped holders and both approval modes, zero wrapped owners, healthy aliases, controller conflicts and duplicate controllers, malformed/unavailable ownership reads, restoration and explicit exceptions. The full contract suite, Foundry suite, real-ENS fork tests, lint, static analysis and final manager size/deployment qualification still require the pinned complete dependencies. Missing dependencies blocked runtime execution during this review; syntax and subset compilation are not a full qualification pass.

Before release, run the new suite and existing ENS, namespace, controller-conflict and lifecycle tests against the final compiled artifacts, then repeat the required aggregate release gates and exact-source fork qualification.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `contracts/utils/ENSOwnership.sol` | `244bcedf9ef9da775b3a663b2dcc4a221ea70810e1543ac0f255e3f0d3acaca0` |
| `test/ensRevocation.regression.test.js` | `cceb00aefe4157015c00f68e1d419d10dcdadd1dc79bfff629be823cacd905c4` |
