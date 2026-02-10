# Utility Libraries

## Purpose
Reference for linked utility libraries used by `AGIJobManager`.

## Audience
Engineers and auditors.

## UriUtils
- `requireValidUri(string)` rejects empty values and whitespace/newline/tab.
- `applyBaseIpfs(uri, baseIpfsUrl)` prepends base only when URI has no `://`.
- Operational note: malformed but non-empty URIs can still pass; URI quality is off-chain responsibility.

## TransferUtils
- `safeTransfer` and `safeTransferFromExact` support optional-return ERC20s.
- Exact transfer check defends against fee-on-transfer mismatch for escrow and bonds.
- Failure mode: non-standard tokens revert via `TransferFailed`.

## BondMath
- `computeValidatorBond(payout,bps,min,max)` with min/max and payout cap.
- `computeAgentBond(...)` includes duration uplift relative to `jobDurationLimit` and caps at payout.

## ReputationMath
- Computes bounded reputation points from payout + timing.
- `repEligible=false` returns 0 points.

## ENSOwnership
- Verifies claimant ownership under a root using ENS + NameWrapper + resolver checks.
- Fail-closed semantics when external calls fail.

## References
- [`../../contracts/utils/UriUtils.sol`](../../contracts/utils/UriUtils.sol)
- [`../../contracts/utils/TransferUtils.sol`](../../contracts/utils/TransferUtils.sol)
- [`../../contracts/utils/BondMath.sol`](../../contracts/utils/BondMath.sol)
- [`../../contracts/utils/ReputationMath.sol`](../../contracts/utils/ReputationMath.sol)
- [`../../contracts/utils/ENSOwnership.sol`](../../contracts/utils/ENSOwnership.sol)
