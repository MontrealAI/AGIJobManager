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

## Merge repair and regression coverage

PR **#1567** is the accessible pull request for this branch. Its initial exact-head run `38098083421` failed in `ui/scripts/sync-deployments.mjs --check`; automated review also identified the stale generated deployment guide. The previously reported PR number #1593 and script-catalogue diagnosis were not the confirmed repository state.

The repair restores `config/usdc-deployment.json` to the exact base-branch blob `2ca13f8f451f5170d6b23208f570132e887b9e64`. The original note accurately says that no live manager is configured **by default**. Dated commissioning evidence belongs in the separate `config/mainnet/agi-jobs-usdc.json` record and its linked README/runbooks, not in the runtime default. Regenerating both deployment consumers from the restored registry reproduces their existing committed blobs exactly:

| Consumer | Git blob |
| --- | --- |
| `ui/src/generated/deployments.ts` | `5a030689130036b6d00b57f10220a5557385f52a` |
| `docs/ui/DEPLOYMENT_MAINNET.md` | `c0ef6cdceafe1b10e4cf073af171bc6819233d8b` |

No UI bundle rebuild or changed runtime default is needed for this evidence-only integration. The real generators and their existing checks are retained, not disabled. Eight added regressions execute both generators, reproduce a note-only synchronization failure, verify recovery in a disposable fixture, check environment-reference coverage and exercise the actual connection CLI with inherited Node startup overrides.

The unchanged connection checker also reads `NODE_OPTIONS` and `NODE_PATH` to reject inherited startup overrides. Both are now documented as reserved, empty controls in the example and configuration reference, satisfying the existing environment-documentation check without weakening it. The documentation explicitly explains that an empty `.env` entry cannot clear a shell value or undo preloaded code. No operator's private `.env` or deployment checkout is modified.

Local repair validation, Node **22.16.0**:

```bash
node --test hardhat/test/ens-usdc-connection.test.cjs hardhat/test/mainnet-evidence.test.cjs hardhat/test/commissioning-docs.test.cjs
node scripts/commissioning/mainnet-evidence.cjs
```

**102 tests passed; zero failures, skips or cancelled tests.** The original 94 cases are retained. Both deployment consumers were regenerated locally and matched the remote Git blob identities above. Full repository qualification under pinned Node 22.23.2 must be taken from the final PR-head workflow runs and the merge discussion; this local result alone does not establish that qualification. Mainnet activation remains HOLD throughout.
