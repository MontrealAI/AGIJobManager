# Mainnet ENS record and activation-guidance update

## Scope

This source update integrates a curated historical deployment/connection record, the unchanged operator-tested read-only checker, offline record validation, and the separate activation HOLD. It does not change Solidity, linked libraries, compiler configuration, lockfiles, payment rules, deployer behavior, chain state or the existing release tag/assets. The generic deployment/console configuration still has blank manager/helper/owner/recipient fields.

Baseline inspected: `47abe97bfc7fbd502482e92e71ba558a9668ccab`. Original manager and helper Git blobs are recorded in `config/mainnet/agi-jobs-usdc.json`. Raw operator journals and internal transcripts are not committed; only selected public fields and SHA-256 references are published. The successful ENS milestone is not reset to unproven, and the five activation gates are not promoted to approved.

## New source-update validation

Executed locally with Node **22.16.0**, without installing dependencies or using an RPC:

```bash
node --test hardhat/test/ens-usdc-connection.test.cjs hardhat/test/mainnet-evidence.test.cjs
node scripts/commissioning/mainnet-evidence.cjs
```

**94 tests passed; zero failures, skips or cancelled tests.** This consists of 44 connection-checker tests and 50 record, CLI, preservation and documentation/default regressions. These are not a claim that the full repository suite or the repository-pinned Node 22.23.2 run has completed in this editing environment. The existing Security Verification workflow runs `npm run test:preflight` from `hardhat/`, which discovers both added `.test.cjs` files; its results must be checked on the exact PR head.

The connection positive tests use synthetic ABI/hash fixtures and mocked RPC responses. They test receipt/calldata/event mismatches, runtime/configuration drift, custody/expiry/approval changes, canonical-block rechecks, restricted RPC methods, credential-redacted failures and private report writes. The added record tests use the curated projection of actual supplied evidence, then mutate fields to ensure inconsistent records, invented participants/caps, promoted activation, altered transaction histories and raw/private payloads are rejected. They do not verify mainnet independently.

The connection checker is byte-identical to the operator-run packet:

```text
ee05e43469e62e9de35ce07f96909e17f4f086eaa2f1781930912eaecdeecdc2
```

Only its repository filename and the test import paths change. The private report name and schema remain compatible. No signer or mainnet-write interface is introduced.

## Preserved operator evidence, not newly rerun here

- v1.5 operator rehearsal: exact compiler replay and 18 selected local-fork lifecycle/permission checks; transport completed with zero rejections. Local minting, impersonation and an agent allowlist were fixtures.
- Actual helper deployment: four confirmed mainnet transactions and reported exact explorer verification.
- Actual connection: two later owner transactions and ten connected-state checks at block 26,165,026; zero public transactions sent by that checker.
- Production-activation review: completed evidence/source review with decision HOLD and five open closeout groups.

See [instance record](../deployments/MAINNET_USDC_2026-10-10.md), [activation review](../OPERATIONS/PRODUCTION_ACTIVATION.md) and [public JSON](../../config/mainnet/agi-jobs-usdc.json) for exact addresses, hashes and limits. Historical packaged-test counts are not added together and presented as a single independent audit. Frozen release qualification and new source-update CI remain separate.

## Maintenance

Edit the README template and regenerate its output together. Keep the dated historical record immutable in meaning; a later live state or activation decision needs a new versioned record with its own evidence. A passing offline validator only establishes internal consistency and always retains the HOLD flags. Neither docs nor CI enforce a new on-chain admission control.
