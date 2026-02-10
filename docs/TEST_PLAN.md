# Risk-Based Test Plan

## Inventory snapshot (HEAD)

### Toolchain and execution

- Solidity contracts are compiled with Truffle (`solc 0.8.23`, optimizer on, `viaIR: false`).
- Local deterministic chain is the in-process Ganache provider bound to the `test` network in `truffle-config.js`.
- CI order: install → playwright install → lint → build → bytecode size → full test → UI smoke.

### Existing suite baseline

At baseline, the repository already includes broad suites for lifecycle, disputes, economics, ENS hooks, invariants, and UI ABI checks.

Baseline result captured at HEAD:

- `npm test` => **241 passing**.
- Bytecode check reports `AGIJobManager runtime bytecode size: 24574 bytes` (within 24,576-byte EIP-170 limit).

## Additions in this update

1. **Utility transfer semantics hardening**
   - Added explicit `TransferUtils` behavior checks for:
     - standard ERC20 success
     - no-return ERC20 compatibility
     - false-return failure path
     - fee-on-transfer under-delivery rejection (`safeTransferFromExact`)
2. **URI validation behavior hardening**
   - Added direct `UriUtils` unit checks for whitespace rejection and base-IPFS application behavior.

## Coverage matrix

| Feature / risk | Tests | Contracts |
| --- | --- | --- |
| Job lifecycle and settlement | `test/AGIJobManager.full.test.js`, `test/AGIJobManager.comprehensive.test.js`, `test/happyPath.test.js`, `test/livenessTimeouts.test.js` | `contracts/AGIJobManager.sol` |
| Escrow, solvency, no-double-release | `test/escrowAccounting.test.js`, `test/invariants.solvency.test.js`, `test/completionSettlementInvariant.test.js` | `contracts/AGIJobManager.sol` |
| Permissions, pause, operator controls | `test/adminOps.test.js`, `test/securityRegression.test.js`, `test/economicSafety.test.js` | `contracts/AGIJobManager.sol` |
| ENS hook resilience and tokenURI fallback | `test/ensJobPagesHooks.test.js`, `test/ensJobPagesHelper.test.js` | `contracts/ens/ENSJobPages.sol`, `contracts/AGIJobManager.sol` |
| Utility math and ENS ownership | `test/invariants.libs.test.js` | `contracts/utils/BondMath.sol`, `contracts/utils/ReputationMath.sol`, `contracts/utils/ENSOwnership.sol` |
| URI + transfer wrappers (new explicit unit tests) | `test/utils.uri-transfer.test.js` | `contracts/utils/UriUtils.sol`, `contracts/utils/TransferUtils.sol` |

## Regression policy

- If you change payout, bond, or settlement logic in `AGIJobManager.sol`, update:
  - `test/escrowAccounting.test.js`
  - `test/invariants.solvency.test.js`
  - relevant dispute/liveness suites
- If you change ENS hook behavior in either manager or helper, update:
  - `test/ensJobPagesHooks.test.js`
  - `test/ensJobPagesHelper.test.js`
- If you change utility-library semantics (`contracts/utils/*`), update or add direct unit tests under:
  - `test/invariants.libs.test.js`
  - `test/utils.uri-transfer.test.js`
