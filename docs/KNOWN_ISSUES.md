# Known limitations and issue reporting — v0.9.0

This page records current operational limits. Exact test results and dependency counts belong to the release evidence and [dependency report](DEPENDENCY_SECURITY.md), rather than historical local logs.

## Deployment and authority

- No live USDC manager, production recipients or owner acceptance is supplied by this software release. Use [mainnet readiness](MAINNET_READINESS.md) and the [Hardhat guide](../hardhat/README.md).
- The contract is non-upgradeable. Owner settings have explicit guards; a code change requires a new deployment. Owner/moderator judgment, signer security and participant availability remain operational dependencies.
- The release is internally tested and reviewed, not independently audited or certified free of vulnerabilities.

## Transfer and lifecycle availability

- USDC's issuer can pause the token or block an address. A failed settlement reverts atomically; there is no bypass or rerouting of existing escrow through wallet rotation.
- Pausing does not stop block timestamps. Review and dispute deadlines keep advancing. Read the [incident guide](OPERATIONS/INCIDENT_RESPONSE.md) before selecting pause controls or reopening intake.
- With no validator votes, completion after the review window favors the agent. This is not proof of work quality. Thresholds, moderators and validator participation must be deliberately configured.
- A failed or unresponsive RPC is not evidence that a submitted transaction failed. Reconcile its hash and receipt before retrying.

## Tooling

- The legacy root Truffle/Ganache test dependency tree retains high/critical advisories and deprecation warnings. It is restricted to disposable local tests; public-network signing is disabled. Use the supported Hardhat path and never expose production keys to the legacy tools.
- Ganache may report that its optional native uWebSockets binary is unavailable on the pinned Node version and fall back to its JavaScript implementation. This warning is not a skipped test; CI must still finish every required test successfully.
- Extended Slither reports are retained with individual rationale and source bindings. A successful reviewed-baseline gate does not mean the scanner returned no findings.
- Native-USDC fork qualification depends on archive RPC availability at the pinned block. An unavailable RPC fails the gate rather than silently skipping it.

## Report a reproducible problem

Follow [SECURITY.md](../SECURITY.md) for private vulnerability reporting. For an ordinary bug, include the release/source commit, chain ID, manager address, relevant transaction hash, expected versus actual outcome and sanitized reproduction steps. Never include keys, seed phrases, access tokens or private participant data. Attach the redacted deployment journal or readiness report when relevant.
