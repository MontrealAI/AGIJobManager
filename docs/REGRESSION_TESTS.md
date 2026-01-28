# Regression Tests: “Better-Only” Suite

This regression suite compares the current `AGIJobManager` contract against the original v0 implementation (deployed at `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`) to prove the current contract is strictly safer in key edge cases. The original source is copied to `contracts/legacy/AGIJobManagerOriginal.sol` for test-only comparison; **it must never be deployed**.

## What the tests cover (and why)
- **Pre-apply takeover**: Demonstrates that the original allows agents to apply before a job exists, effectively taking over a future job ID, while the current contract rejects non-existent jobs.
- **Double-complete on disputed jobs**: Shows that the original can complete a job twice (validator completion plus moderator “agent win”), while the current contract prevents re-entry and clears `disputed`.
- **Division-by-zero in dispute resolution**: Proves the original reverts when resolving an “agent win” dispute with zero validators, while the current contract safely completes and skips validator payouts.
- **Double-vote validator edge case**: Validates that the original allows a validator to both approve and disapprove a job, while the current contract blocks a second vote.
- **Employer-win dispute still completing**: Highlights that the original can refund the employer yet still allow later completion (with extra funds), while the current contract closes the job on employer win.
- **Unchecked ERC-20 transfer on refunds**: Shows that the original can silently fail to refund on `cancelJob`, while the current contract reverts on a failed transfer.

## How to run locally
```bash
npm install
npm run build
npm test
```

If any of the regression tests fail, they indicate the current contract is no longer strictly safer in those scenarios and should be reviewed immediately.
