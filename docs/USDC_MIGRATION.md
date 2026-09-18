# v1.0.0: USDC-only settlement

Every payout, escrow, agent bond, validator bond, dispute bond, reward, refund and treasury withdrawal in v1.0.0 uses native Circle USDC with **six decimals**. One USDC is `1000000` base units; `0.000001` USDC is one base unit. No bridge, conversion, wrapped alternative or configurable settlement token is supported.

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
- Legacy snapshot deployment migrations are retired. Use a fresh Hardhat configuration and the v1.0.0 ABI.

## Economic defaults

| Parameter | USDC | Base units |
| --- | --- | --- |
| Maximum job payout | 88,888,888 | 88888888000000 |
| Agent minimum bond | 1 | 1000000 |
| Agent maximum bond | 88,888,888 | 88888888000000 |
| Validator minimum bond | 10 | 10000000 |
| Validator maximum bond | 88,888,888 | 88888888000000 |
| Dispute minimum / maximum | 1 / 200 | 1000000 / 200000000 |

Agent bond rate remains 500 bps with duration adjustment; validator bond rate remains 1500 bps; dispute rate remains 50 bps. Bond calculations are capped at payout, with integer flooring. The default validator budget remains 8%; v1.0.0 preserves the v0.6.0 successful-job distribution: validators, 30% wallet, 10% wallet, then the agent remainder. See [the payout specification](USDC_PAYOUT_SPLIT.md). Time periods and ENS authorization remain in place; the NFT requirement is now selected by the owner for future jobs and fixed for each job at posting. These are nominal USDC defaults, not an exchange-rate conversion of old balances.

## Deployment and cutover

Read the [USDC cutover qualification and preservation plan](qualification/USDC_CUTOVER.md). The existing mainnet manager has live legacy obligations. Leave its manager, ENS helper, namespace, approvals and original-asset exits available. If optional ENS job pages are enabled, a fresh USDC manager needs a separate ENS helper and namespace because job IDs restart at zero. v1.0.0 retains the ENS resolver compatibility correction introduced in v0.9.2 and extends deployment and participant-membership qualification. The earlier frozen v0.9.1 assets do not contain that correction.

**This release publishes software. It does not deploy or upgrade a live contract.** v1.0.0 retains the v0.9.6 ABI and executable bytecode; a verified v0.9.6 instance remains compatible. Incompatible older USDC or original-asset managers need a fresh deployment to gain current features. Preserve their jobs, balances, allowances, ownership, interfaces and ENS namespaces. `config/usdc-deployment.json` remains `deployment-required` with no live manager configured. Earlier deployment receipts describe their original instances and must be independently checked before reuse.

v0.6.0 introduced the payout split; v0.7.0 added guarded wallet rotation and two-step ownership; v0.8.0 added paused construction. v0.9.1 hardened decoding, settlement ordering and owner limits; v0.9.2 corrected ENS resolver delegation; v0.9.4 introduced the posting-time NFT policy. v0.9.5 added the current buyer protection and reserved payment claims; v0.9.6 added exact job bond reads and the validator-default event. v1.0.0 corrects operating guidance and console roles without changing those contract rules.

1. Inventory existing jobs and preserve their original contracts, assets, interfaces and ENS wiring. Close or settle them only through their original lifecycle; old obligations may remain alongside the new manager. Do not import escrow, job IDs or approvals into the USDC manager.
2. Install pinned dependencies at the root and in `hardhat/`. Copy `hardhat/deploy.config.example.cjs` to the configured local deployment file and review owner, ENS, roots and allowlists. Supply both distinct `settlementWallets` addresses (30% first, 10% second).
3. Compile and rehearse on Sepolia with test USDC. Review all monetary limits in six-decimal units. Use the existing Hardhat dry-run and mainnet confirmation gates for an independently authorized deployment.
4. Verify the new source, linked libraries, constructor arguments, chain, owner, `usdcToken()`, `wallet30()`, `wallet10()` and `decimals()`. Wire ENS to the new manager and verify hooks before locking configuration.
5. Confirm the deployment receipt shows paused intake. If `acceptanceRequired` is true, the proposed owner must call `acceptOwnership()` and verify the actual owner. Configure operations before unpausing intake. See [owner controls](OWNER_CONTROLS.md).
6. Record the real receipt; update `config/usdc-deployment.json` and regenerate the deployment registry. Configure each UI with the verified new manager. The release's default interfaces keep writes blocked until a USDC manager is configured and its chain/token checks pass.
7. Approve only the USDC amount needed to the new manager, then rehearse a small complete lifecycle. Never approve a legacy manager through the USDC UI.

The UI's chain/token checks do not replace source/bytecode verification. ETH is still required for Ethereum gas. ENS and ERC-721 credentials remain identity and completion evidence; they are not settlement currencies. Generic rescue functions recover accidentally sent assets and do not introduce alternative job-payment currencies.

## USDC operational behavior

USDC's issuer can pause transfers or block addresses. Incoming funding remains exact and atomic. Failed outgoing transfers become protected claims for their original recipients; other eligible payments and terminal accounting can complete. Retry `claimUSDC(recipient)` after the restriction resolves, and verify both pending claims and actual balances. The regression suite models these failures and exact micro-USDC refunds. This release does not claim an independent security audit or immunity from issuer controls.

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
