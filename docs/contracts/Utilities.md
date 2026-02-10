# Utility Libraries

## Purpose
Reference for linked utility libraries used by `AGIJobManager`.

## Audience
Auditors and developers reviewing low-level behavior.

## Preconditions / assumptions
- Utilities are linked at deployment (`migrations/2_deploy_contracts.js`).

## `UriUtils`
- `requireValidUri(string uri)` enforces non-empty URI and rejects whitespace characters (`space`, `tab`, `LF`, `CR`).
- `applyBaseIpfs(string uri, string baseIpfsUrl)` prepends base only when URI has no scheme (`://`).

**Operational note:** malformed URIs revert early in create/complete flows.

## `TransferUtils`
- `safeTransfer(token,to,amount)` handles optional-return ERC20 transfer semantics.
- `safeTransferFromExact(token,from,to,amount)` verifies exact received amount via balance delta.

**Operational note:** fee-on-transfer tokens are incompatible with `safeTransferFromExact` and will revert.

## `BondMath`
- `computeValidatorBond(...)`: payout-scaled basis-points bond with min/max clamps and payout cap.
- `computeAgentBond(...)`: payout-scaled bond with duration scaling and optional max clamp.

## `ReputationMath`
- `computeReputationPoints(...)`: combines logarithmic payout factor with bounded time bonus.
- Returns zero when `repEligible` is false.

## `ENSOwnership`
- `verifyENSOwnership(ensAddress,nameWrapperAddress,claimant,subdomain,rootNode)`
  checks wrapped owner first, then resolver `addr(node)` fallback.

## Gotchas / failure modes
- `TransferUtils` intentionally reverts on non-standard return payloads.
- `ENSOwnership` can return false if resolver is unset or resolver call reverts.
- Bond calculations cap at payout, preventing bond > escrowed payout.

## References
- [`../../contracts/utils/UriUtils.sol`](../../contracts/utils/UriUtils.sol)
- [`../../contracts/utils/TransferUtils.sol`](../../contracts/utils/TransferUtils.sol)
- [`../../contracts/utils/BondMath.sol`](../../contracts/utils/BondMath.sol)
- [`../../contracts/utils/ReputationMath.sol`](../../contracts/utils/ReputationMath.sol)
- [`../../contracts/utils/ENSOwnership.sol`](../../contracts/utils/ENSOwnership.sol)
