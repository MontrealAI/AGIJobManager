# Known limitations and issue reporting — v0.9.5

This page records current operational limits. Exact test results and dependency counts belong to the release evidence and [dependency report](DEPENDENCY_SECURITY.md), rather than historical local logs.

## Deployment and authority

- No live USDC manager, production recipients or owner acceptance is supplied by this software release. Use [mainnet readiness](MAINNET_READINESS.md) and the [Hardhat guide](../hardhat/README.md).
- The contract is non-upgradeable. Owner settings have explicit guards; a code change requires a new deployment. Owner/moderator judgment, signer security and participant availability remain operational dependencies.
- The release is internally tested and reviewed, not independently audited or certified free of vulnerabilities.

## Transfer and lifecycle availability

- USDC's issuer can pause the token or block an address. Failed outgoing payments become protected claims; issuer restrictions still apply. Wallet rotation cannot redirect existing entitlements.
- Pausing does not stop block timestamps. Review and dispute deadlines keep advancing. Read the [incident guide](OPERATIONS/INCIDENT_RESPONSE.md) before selecting pause controls or reopening intake.
- No-vote finalization opens a dispute. Unanswered arbitration permits neutral return of escrow and original bonds after two dispute review periods. Honest work may remain unpaid when arbitration is unavailable; configure and monitor reviewer/moderator participation.
- A failed or unresponsive RPC is not evidence that a submitted transaction failed. Reconcile its hash and receipt before retrying.

## Tooling

- Truffle/Ganache and Hardhat 2 are removed from the dependency trees. The preserved regression suites use local Hardhat 3 and ethers helpers; historical Truffle commands are unsupported.
- Deliberately vulnerable historical Solidity fixtures remain under `contracts/legacy/` solely for comparative regression tests. They are excluded from production deployment. Their line-specific lint acknowledgments preserve the behavior the tests must detect.
- Extended Slither reports are retained with individual rationale and source bindings. A successful reviewed-baseline gate does not mean the scanner returned no findings.
- Native-USDC fork qualification depends on archive RPC availability at the pinned block. An unavailable RPC fails the gate rather than silently skipping it.

## Report a reproducible problem

Follow [SECURITY.md](../SECURITY.md) for private vulnerability reporting. For an ordinary bug, include the release/source commit, chain ID, manager address, relevant transaction hash, expected versus actual outcome and sanitized reproduction steps. Never include keys, seed phrases, access tokens or private participant data. Attach the redacted deployment journal or readiness report when relevant.
