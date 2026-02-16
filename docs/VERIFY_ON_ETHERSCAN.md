# Verify AGIJobManager on Etherscan

This repository deploys with Truffle settings. Match them exactly for successful verification.

## 1) Compiler settings (authoritative)

From `truffle-config.js`:
- Compiler: `0.8.23`
- Optimizer: enabled
- Optimizer runs: `50`
- `viaIR: true`
- `evmVersion: london` (or explicit override used during deploy)
- Metadata hash: `none`
- Revert strings: `strip`

## 2) Linked libraries

AGIJobManager links external libraries. Verification must include exact name->address mapping used at deployment:
- `UriUtils`
- `TransferUtils`
- `BondMath`
- `ReputationMath`
- `ENSOwnership`

If one address is wrong, bytecode mismatch occurs.

## 3) Verification steps

1. Open contract address on Etherscan -> Verify and Publish.
2. Choose Solidity single-file/multi-file standard input route matching your build artifacts.
3. Enter exact compiler version and optimizer settings.
4. Set `viaIR` to match deployment.
5. Provide constructor arguments exactly as encoded during deployment.
6. Provide all linked library addresses.
7. Submit and confirm ABI is visible on Read/Write tabs.

## 4) Common mismatch causes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Bytecode mismatch | Wrong compiler version/runs/viaIR/metadata hash | Use exact Truffle settings above |
| Bytecode mismatch with libraries | Missing or incorrect library address | Re-check deployment artifact link references |
| Constructor args mismatch | Wrong order or encoding | Re-encode from migration inputs |
| Runtime differs only slightly | Different solc patch or EVM setting | Use the same solc + `evmVersion` as deployment |

## 5) Sanity checks after verify

- Confirm `Read Contract` exposes expected getters.
- Confirm `Write Contract` inputs are human-readable.
- Test one read path (`getJobCore`) and one safe write on test deployment.
