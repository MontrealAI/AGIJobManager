# Utility Libraries

## UriUtils
- `requireValidUri(string)` rejects empty URI and whitespace characters.
- `applyBaseIpfs(string uri, string baseIpfsUrl)` prepends base only when `uri` has no scheme (`://`).

Assumption: job and completion URIs are URI-like strings without spaces/newlines.

## TransferUtils
- `safeTransfer` handles optional ERC-20 return values.
- `safeTransferFromExact` verifies recipient balance delta equals exact transfer amount.

Safety implications:
- Protects against ERC-20s that silently under-transfer.
- Reverts on malformed/non-standard returns.

## BondMath
- `computeValidatorBond(payout,bps,min,max)`
- `computeAgentBond(payout,duration,bps,min,max,durationLimit)`

Safety/assumptions:
- Both cap bond at `payout`.
- Agent bond can include duration-based additive term.
- Uses unchecked arithmetic where guarded by expected ranges.

## ReputationMath
- `computeReputationPoints(...)` is payout- and time-sensitive.
- Returns `0` when `repEligible=false`.
- Uses `Math.log2(1 + payout/1e15)` + bounded time bonus.

## ENSOwnership
- `verifyENSOwnership(ens,nameWrapper,claimant,subdomain,rootNode)` ORs:
  1. NameWrapper `ownerOf(uint256(subnode))`
  2. ENS resolver `addr(subnode)`

Safety model:
- Ownership checks are view-only and tolerant to external call failures via `try/catch`.
- False negatives are possible if external ENS contracts are misconfigured; false positives are constrained by external ownership resolution.
