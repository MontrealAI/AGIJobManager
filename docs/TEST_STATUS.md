# Test Status

## Source-specific qualification

For v1.14.0, use the published `QUALIFICATION.json`, `RELEASE_MANIFEST.json` and `SHA256SUMS.txt`, together with `VALIDATION.md` inside the COMPLETE ZIP, to identify the exact source commit, six required workflow runs and artifact hashes. Check the release asset digests before extraction. Later main-branch checks qualify their own commit and do not change the immutable release evidence. This navigation page does not claim a completed qualification run or carry forward test counts and bytecode sizes from older releases.

## Current local commands

From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm run lint
npm test
npm run size
```

`npm test` compiles the contracts and runs the recursively discovered regression suite through Hardhat 3 and Mocha. Its local chain starts automatically; Truffle and Ganache are no longer installed. The runner also executes standalone contract checks and contract-size checks. A successful contract test run does not by itself qualify the UI, static-analysis lanes, deployment recovery or mainnet fork behavior; see [Testing](TESTING.md) for those gates.

Read [dependency security](DEPENDENCY_SECURITY.md) for the current audit scope and [mainnet readiness](MAINNET_READINESS.md) for checks on the actual deployment. Older figures and environment notes remain in [the historical v0.9.0 version of this page](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.0/docs/TEST_STATUS.md).
