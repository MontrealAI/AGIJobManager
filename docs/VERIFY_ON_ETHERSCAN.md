# Verify AGIJobManager on Etherscan (Reproducible)

Etherscan Read/Write UX depends on correct source verification.

## 1) Identify the compiler profile used for deployment

This repo has two compiler profiles:

- **Truffle profile** (deployment/tests in `package.json`):
  - `solc 0.8.23`
  - optimizer enabled, runs `50`
  - `viaIR: true`
  - metadata bytecode hash `none`
  - EVM `london`
- **Foundry profile** (`foundry.toml`):
  - `solc 0.8.19`
  - optimizer enabled, runs `50`

For normal repo deployments (`truffle migrate`), verify with the **Truffle profile**.

## 2) Install and compile exactly as CI/deployment expects

```bash
npm install
npm run build
```

Artifacts are produced in `build/contracts/`.

## 3) Linked library requirements

AGIJobManager uses external libraries:

- `UriUtils`
- `TransferUtils`
- `BondMath`
- `ReputationMath`
- `ENSOwnership`

Verification must include exact deployed addresses for each linked library.

## 4) Verification paths

## A) Truffle plugin path (preferred for this repo)

`truffle-config.js` includes `truffle-plugin-verify` and etherscan API settings.

Example mainnet command:

```bash
ETHERSCAN_API_KEY=... \
PRIVATE_KEYS=0x... \
MAINNET_RPC_URL=https://... \
npx truffle run verify AGIJobManager --network mainnet
```

If constructor args are required explicitly, use plugin options for constructor params according to deployment values.

## B) Standard JSON/manual verification

If plugin path fails, use Solidity Standard JSON Input generated from the exact build and submit manually in Etherscan’s “Standard-Json-Input” mode, including library mappings.

---

## 5) Common verification failures and fixes

- **Wrong compiler version**
  - Symptom: bytecode mismatch.
  - Fix: use `0.8.23` for Truffle deployments.

- **Optimizer runs mismatch**
  - Symptom: partial bytecode mismatch.
  - Fix: optimizer enabled + runs `50`.

- **viaIR mismatch**
  - Symptom: major bytecode mismatch even with same solc.
  - Fix: ensure `viaIR: true` matches deployment.

- **Metadata hash mismatch**
  - Symptom: tail-bytecode mismatch.
  - Fix: compile with `metadata.bytecodeHash = none`.

- **Wrong library addresses**
  - Symptom: unresolved link references or mismatch.
  - Fix: supply exact library name/address pairs from deployment.

- **Wrong constructor arguments**
  - Symptom: creation bytecode mismatch.
  - Fix: ABI-encode constructor args exactly as deployed.

- **Wrong EVM version**
  - Symptom: mismatch despite same solc.
  - Fix: set EVM to `london` (repo default unless overridden at deploy).

---

## 6) Post-verification sanity check

On Etherscan contract page:

1. `Read Contract` tab should show named functions and outputs.
2. `Write Contract` tab should expose typed parameter forms.
3. Custom errors/events should decode properly in tx details.

If tabs still look raw/minimal, verification likely used mismatched metadata/settings.
