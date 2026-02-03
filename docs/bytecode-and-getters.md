# Bytecode size guardrails & job getters

## Why the `jobs` mapping is not public

`jobs` is intentionally **not** public to avoid Solidity generating a massive auto-getter for the full `Job` struct. That auto-getter previously triggered legacy (non-viaIR) **stack-too-deep** compilation failures. Instead, we expose compact view helpers that keep the ABI small and the stack usage within limits.

Use these getters instead:

- `getJobCore(jobId)` for core job fields (employer, assigned agent, payout, duration, assignment data, completion/dispute/expiry state, and agent payout percentage).
- `getJobValidation(jobId)` for validation-related fields (completion request state and validator counts).
- `getJobStatus(jobId)` and `getJobAgentPayoutPct(jobId)` for narrower single-purpose reads.

## Runtime bytecode size limit (EIP-170)

Ethereum mainnet enforces a **24,576-byte** runtime bytecode cap (EIP‑170). We enforce a safety margin of **<= 24,575 bytes** for deployable contracts.

### How to measure locally

Compile and check the deployed bytecode size:

```bash
npx truffle compile --all
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
node -e "const a=require('./build/contracts/TestableAGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('TestableAGIJobManager deployedBytecode bytes:', b.length/2)"
```

We also enforce this in tests (`test/bytecodeSize.test.js`) so CI fails if the limit is exceeded.

## Compiler settings and warning cleanup

- **Solidity version:** pinned to `0.8.19` in `truffle-config.js` to avoid the OpenZeppelin *memory-safe-assembly* deprecation warnings emitted by newer compilers.
- **OpenZeppelin contracts:** kept at `@openzeppelin/contracts@4.9.6` (same major version).
- **Optimizer:** enabled with **runs = 50** to keep deployed bytecode under the EIP‑170 safety margin (viaIR stays off).

If you change compiler settings for a new deployment, keep the version and optimizer runs consistent for reproducible verification.
