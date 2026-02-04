# Bytecode size guardrails & job getters

## Why the `jobs` mapping is not public

`jobs` is intentionally **not** public to avoid Solidity generating a massive auto-getter for the full `Job` struct. That auto-getter previously triggered legacy (non-viaIR) **stack-too-deep** compilation failures. Instead, we expose compact view helpers that keep the ABI small and the stack usage within limits.

Use these getters instead:

- `getJobCore(jobId)` for core job fields (employer, assigned agent, payout, duration, assignment data, completion/dispute/expiry state, and agent payout percentage).
- `getJobValidation(jobId)` for validation-related fields (completion request state and validator counts/timestamps).
- `getJobSpecURI(jobId)` for the job specification URI.
- `getJobCompletionURI(jobId)` for the completion URI (when provided).
- `getJobValidatorCount(jobId)` / `getJobValidatorAt(jobId, index)` for validator lists.
- `getJobVote(jobId, validator)` for validator votes (0 = none, 1 = approved, 2 = disapproved).

## Runtime bytecode size limit (EIP-170)

Ethereum mainnet enforces a **24,576-byte** runtime bytecode cap (EIP‑170). We enforce a safety margin of **<= 24,575 bytes** for deployable contracts.

### How to measure locally

Compile and check the deployed bytecode size:

```bash
npx truffle compile --all
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

We also enforce this in tests (`test/bytecodeSize.test.js`) so CI fails if the limit is exceeded.

## Validator payout rule (approvers-only)

When a job completes on an **agent win**, validator rewards are paid **only to approvers**. Validators who disapproved do **not** receive payouts or reputation. If validators participated but **no approvals** were recorded, the validator reward share is redirected to the agent so escrowed funds are still fully distributed.

## Compiler settings and warning cleanup

- **Solidity version:** pinned to `0.8.23` in `truffle-config.js` (contract pragma is `^0.8.19`).
- **OpenZeppelin contracts:** kept at `@openzeppelin/contracts@4.9.6` (same major version).
- **Optimizer:** enabled with **runs = 50** to balance deploy size and runtime gas (viaIR stays off).

If you change compiler settings for a new deployment, keep the version and optimizer runs consistent for reproducible verification.

## Ops notes

- Reward pool contributions add to the contract balance and are **not escrow-locked**. While paused, the owner can withdraw them via `withdrawAGI` (subject to `lockedEscrow`).  
- `additionalAgentPayoutPercentage` is currently **not used** in payout math and remains reserved/legacy configuration.
