# v0.7.0: USDC-only settlement

Every payout, escrow, agent bond, validator bond, dispute bond, reward, refund and treasury withdrawal in v0.7.0 uses native Circle USDC with **six decimals**. One USDC is `1000000` base units; `0.000001` USDC is one base unit. No bridge, conversion, wrapped alternative or configurable settlement token is supported.

## Supported chains

| Chain | Chain ID | Canonical USDC |
| --- | --- | --- |
| Ethereum mainnet | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Ethereum Sepolia | 11155111 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

Source: [Circle's USDC contract address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Sepolia USDC is a test asset. Local chains 1337 and 31337 permit six-decimal mocks for tests. Other chain IDs are rejected by the constructor.

## Breaking changes

- `usdcToken()` is immutable. The constructor validates token code, six decimals and the canonical address on supported public chains. There is no token-address setter.
- Treasury API: `withdrawUSDC`, `withdrawableUSDC`, `USDCWithdrawn`.
- Deployment key: `usdcTokenAddress`; environment key: `USDC_TOKEN_ADDRESS` (Next.js: `NEXT_PUBLIC_USDC_TOKEN_ADDRESS`).
- Amounts are six-decimal integer base units throughout. Never reuse legacy raw amounts, approvals, cached forms or snapshots. UI parsers reject excess precision rather than truncate it; new storage namespaces isolate old drafts.
- Standalone console: `ui/agijobmanager-usdc.html`. Old versioned consoles remain available in prior Git tags. The bridge/vault flow is retired.
- Legacy snapshot deployment migrations are retired. Use a fresh Hardhat configuration and the v0.7.0 ABI.

## Economic defaults

| Parameter | USDC | Base units |
| --- | --- | --- |
| Maximum job payout | 88,888,888 | 88888888000000 |
| Agent minimum bond | 1 | 1000000 |
| Agent maximum bond | 88,888,888 | 88888888000000 |
| Validator minimum bond | 10 | 10000000 |
| Validator maximum bond | 88,888,888 | 88888888000000 |
| Dispute minimum / maximum | 1 / 200 | 1000000 / 200000000 |

Agent bond rate remains 500 bps with duration adjustment; validator bond rate remains 1500 bps; dispute rate remains 50 bps. Bond calculations are capped at payout, with integer flooring. The default validator budget remains 8%; v0.7.0 preserves the v0.6.0 successful-job distribution: validators, 30% wallet, 10% wallet, then the agent remainder. See [the payout specification](USDC_PAYOUT_SPLIT.md). Time periods and identity eligibility rules remain in place. These are nominal USDC defaults, not an exchange-rate conversion of old balances.

## Deployment and cutover

**This release publishes software. It does not deploy or upgrade a live contract.** `config/usdc-deployment.json` records `deployment-required` and intentionally leaves manager and ENS addresses empty. Earlier receipts are historical evidence, never current v0.7.0 deployment configuration. v0.6.0 implements the payout split but lacks v0.7.0 wallet rotation and two-step ownership. Older releases have their own semantics.

1. Close or settle existing jobs on their original contracts using their original assets and interfaces. v0.7.0 cannot migrate escrow or approvals.
2. Install pinned dependencies at the root and in `hardhat/`. Copy `hardhat/deploy.config.example.js` to the configured local deployment file and review owner, ENS, roots and allowlists. Supply both distinct `settlementWallets` addresses (30% first, 10% second).
3. Compile and rehearse on Sepolia with test USDC. Review all monetary limits in six-decimal units. Use the existing Hardhat dry-run and mainnet confirmation gates for an independently authorized deployment.
4. Verify the new source, linked libraries, constructor arguments, chain, owner, `usdcToken()`, `wallet30()`, `wallet10()` and `decimals()`. Wire ENS to the new manager and verify hooks before locking configuration.
5. Confirm the deployment receipt shows paused intake. If `acceptanceRequired` is true, the proposed owner must call `acceptOwnership()` and verify the actual owner. Configure operations before unpausing intake. See [owner controls](OWNER_CONTROLS.md).
6. Record the real receipt; update `config/usdc-deployment.json` and regenerate the deployment registry. Configure each UI with the verified new manager. The release's default interfaces keep writes blocked until a USDC manager is configured and its chain/token checks pass.
6. Approve only the USDC amount needed to the new manager, then rehearse a small complete lifecycle. Never approve a legacy manager through the USDC UI.

The UI's chain/token checks do not replace source/bytecode verification. ETH is still required for Ethereum gas. ENS and ERC-721 credentials remain identity and completion evidence; they are not settlement currencies. Generic rescue functions recover accidentally sent assets and do not introduce alternative job-payment currencies.

## USDC operational behavior

USDC's issuer can pause transfers or block addresses. A failed token transfer reverts the whole job operation, preserving its escrow and accounting; operators must resolve the underlying transfer restriction before retrying. The regression suite models these failures and exact micro-USDC refunds. This release does not claim an independent security audit or immunity from issuer controls.

## Amount examples

```js
const { parseUSDC, formatUSDC } = require('../scripts/lib/usdc');
parseUSDC('123.456789'); // '123456789'
formatUSDC('1');        // '0.000001'
```

```bash
node scripts/etherscan/prepare_inputs.js --action create-job --payout 123.456789 --duration 1h
```

Use `npm ci`, `npm run build`, `npm run lint`, `npm test` and the UI/security gates before publication. See release validation evidence for the exact tested commit.
