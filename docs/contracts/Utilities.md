# Utility Libraries

## `UriUtils`
- `requireValidUri(string)`: rejects empty URIs and whitespace/newline/tab characters.
- `applyBaseIpfs(uri, baseIpfsUrl)`: prepends base IPFS URL only when URI has no `://` scheme.
- Safety assumption: callers must still ensure the URI points to expected content.

## `TransferUtils`
- `safeTransfer(token,to,amount)` and `safeTransferFromExact(token,from,to,amount)`.
- Handles ERC20 tokens with optional bool return values.
- `safeTransferFromExact` checks destination balance delta equals `amount` to detect fee-on-transfer/deflationary behavior.

## `BondMath`
- `computeValidatorBond`: payout-based bps with min/max and cap at payout.
- `computeAgentBond`: payout-based with optional duration uplift, min/max, cap at payout.
- Used to keep bond logic centralized and auditable.

## `ReputationMath`
- Computes points from payout and completion timing.
- If `repEligible=false`, returns zero.
- Caps time bonus relative to payout-derived base (`log2`).

## `ENSOwnership`
- Verifies claimant ownership by either NameWrapper `ownerOf(uint256(node))` or resolver `addr(node)`.
- Uses `try/catch` around external calls for fail-closed behavior.
- Assumes resolver implementations conform to expected `addr(bytes32)` behavior.
