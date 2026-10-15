# Read-only native-USDC implementation check

This companion closes only the implementation-identity part of activation group A2. It does not replace financial, issuer pause/blocklist, mutable-policy, participant or signer checks. It never creates a signer, loads `.env`, compiles, broadcasts, edits an existing deployment receipt or produces approval.

## Supported proxy and source evidence

The supported route is Ethereum chain 1's native Circle USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Other chains and proxy types are rejected until separately qualified. Circle's official [FiatTokenProxy](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/FiatTokenProxy.sol) inherits its upgradeability implementation. Circle's [UpgradeabilityProxy source](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/upgradeability/UpgradeabilityProxy.sol) defines storage slot `0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`, the Keccak-256 of `org.zeppelinos.proxy.implementation`. This is not the EIP-1967 implementation slot. Both official source pages were inspected on 2026-10-15. The known native-USDC fork fixture uses the same slot; it is corroborating evidence, not the authority for the layout.

Before approving a binding, compare the canonical token proxy's verified deployed source/runtime to this supported layout and preserve that source reference and evidence privately. A matching supplied hash authenticates bytes against that supplied expectation; the tool cannot prove the human reviewed the right source or that future issuer upgrades are safe. Unknown runtime hashes must be reviewed, never copied into an approval file merely to make the command pass. Direct explorer access was unavailable during preparation of this helper; no fresh on-chain proxy or implementation identity is asserted here.

## Reviewed binding is an input, not an output

Prepare a private JSON file with exactly these fields (placeholders below are deliberately invalid):

```json
{
  "schema": "reviewed-usdc-implementation-v1",
  "chainId": 1,
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "proxyType": "circle-fiat-token-zeppelinos-v1",
  "proxyCodeHash": "REVIEWED_PROXY_RUNTIME_KECCAK256",
  "implementation": "REVIEWED_IMPLEMENTATION_ADDRESS",
  "implementationCodeHash": "REVIEWED_IMPLEMENTATION_RUNTIME_KECCAK256"
}
```

Record the owner/operator's review of these expected values separately. An observed candidate binding from any RPC, fixture, model or preparatory tool is **not** an owner-reviewed binding. This command deliberately does not generate or update a binding, and a file's `reviewed` schema name is not evidence of approval. Do not copy the historical fork implementation into it without current review.

## Run without a signing key

In a separately prepared matching release checkout, using its installed dependencies:

```bash
READINESS_USDC_CONFIG=/private/reviewed-usdc-implementation.json \
USDC_IMPLEMENTATION_REPORT=/private/new-usdc-implementation-report.json \
node hardhat/scripts/check-usdc-implementation.cjs
```

Supply `MAINNET_RPC_URL` privately in the environment. No private key or explorer API key is needed. Output uses exclusive creation and refuses to overwrite an existing file. The input binding bytes' SHA-256 is recorded. Errors are deliberately generic at the CLI to avoid exposing credentials embedded in provider URLs; no failed check writes a qualifying new report.

For A2's coherent-block review, select the same number and hash as the separately obtained financial/policy/readiness report:

```bash
USDC_SNAPSHOT_BLOCK_NUMBER=REVIEWED_DECIMAL_BLOCK_NUMBER \
USDC_SNAPSHOT_BLOCK_HASH=REVIEWED_BLOCK_HASH \
READINESS_USDC_CONFIG=/private/reviewed-usdc-implementation.json \
USDC_IMPLEMENTATION_REPORT=/private/new-same-block-usdc-report.json \
node hardhat/scripts/check-usdc-implementation.cjs
```

Both snapshot fields must be valid when either is supplied. Without them, the tool selects latest, reports its number/hash, and must not be described as coherent with another report from a different block. Every code/storage read uses EIP-1898 `requireCanonical:true`. No number-only state-read fallback exists. The command rechecks the block and chain before report creation; later chain/issuer changes still require a new review.

The check rejects wrong chain/token/proxy type, unexpected proxy runtime, malformed/zero/different implementation storage, empty/changed implementation code, unavailable canonical RPC and changed snapshot. It checks both proxy and implementation hashes against the supplied expectations. It does not silently approve an issuer upgrade.

## Qualification boundary

This new companion is a local candidate addition, not part of the already qualified v1.17.0 source. Run focused tests with `node --test hardhat/test/usdc-implementation.test.cjs`, then normal source-CI/release qualification before operational reliance. Focused tests use fabricated code/addresses solely to prove rejection and hash-binding behavior. They are not observed mainnet values. Existing deploy, recovery and readiness commands remain unchanged; this report is additional evidence and cannot by itself authorize activation.
