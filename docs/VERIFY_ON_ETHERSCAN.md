# Verify AGIJobManager on Etherscan

This guide captures repository-accurate compile settings and linked-library verification workflow.

## 1) Toolchain and settings

Primary build path is Truffle (`npm run build` -> `truffle compile`).

From `truffle-config.js`:
- Solidity compiler: `0.8.23`
- Optimizer: enabled
- Optimizer runs: `50`
- EVM version: `london`
- `viaIR`: `true`
- metadata bytecode hash: `none`
- revert strings: `strip`

Foundry profile also exists for security verification/testing (`foundry.toml`), but deployment verification should match the production compile artifact used for deployment.

## 2) Pre-verification checklist

1. Compile fresh:
```bash
npm run build
```
2. Confirm deployed bytecode matches local artifact network + constructor args.
3. Confirm external library addresses used at deployment.
4. Extract `linkReferences` from `build/contracts/AGIJobManager.json` and pre-fill library mappings before opening Etherscan.

## 3) Linked library verification

If AGIJobManager links external libraries, Etherscan must receive exact library name -> address mappings used during deployment.

Typical process:
1. Verify library contracts first.
2. Verify AGIJobManager with:
   - exact source commit,
   - exact compiler version/settings,
   - exact constructor args,
   - exact linked library map.

Mismatch in any of these causes verification failure.


Inspect links from compiler output in the artifact (do not read from `metadata`; and `bytecode` itself is only a hex string):
```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const refs=(a.compilerOutput&&a.compilerOutput.evm&&a.compilerOutput.evm.bytecode&&a.compilerOutput.evm.bytecode.linkReferences)||a.linkReferences||{}; console.log(JSON.stringify(refs,null,2));"
```

If you use Truffle plugin verify, pass linked libraries exactly as deployed (example shape):
```bash
truffle run verify AGIJobManager@0xYourManager --network mainnet --forceConstructorArgs string:$(cat ctor-args.txt)
```

## 4) ENS compatibility checks (must hold)

Keep ABI/signatures unchanged:
- `handleHook(uint8,uint256)` selector `0x1f76f7a2`, calldata `0x44`
- `jobEnsURI(uint256)` selector `0x751809b4`, calldata `0x24`

Run:
```bash
npm test
npm run forge:test
```

## 5) Common mismatch causes

- wrong compiler patch version,
- wrong optimizer runs / optimizer disabled,
- wrong EVM version,
- wrong constructor arg encoding,
- wrong linked library addresses,
- source changed after deployment,
- metadata hash differences due to non-matching build inputs.

## 6) Troubleshooting flow

1. Re-run `npm run build` from clean tree.
2. Compare artifact compiler settings with Etherscan form values.
3. Re-check constructor args encoding.
4. Re-check library names and addresses.
5. If still failing, redeploy from reproducible script and record all build/deploy inputs in release notes.
