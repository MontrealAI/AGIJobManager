# Complete npm command inventory

<!-- Generated from package.json scripts by scripts/docs/current-release.mjs. -->

Use [the script guide](../SCRIPTS_REFERENCE.md) for purpose and authority and [the release guide](../RELEASE_GUIDE.md) for deployment/recovery steps. The command below always runs from the repository root. A listed command is not permission to broadcast.

## Root workspace

| Command from repository root | Exact configured implementation |
| --- | --- |
| `npm run advisor:job` | `node scripts/advisor/state_advisor.js` |
| `npm run build` | `npm --prefix hardhat run compile && node scripts/export-contract-artifacts.js` |
| `npm run check:no-binaries` | `node scripts/check-no-binaries.mjs` |
| `npm run computer:check` | `node scripts/economics/computer-work.cjs` |
| `npm run computer:report` | `node scripts/economics/capability-report.cjs` |
| `npm run deploy:agijobmanager:prod` | `npm --prefix hardhat run deploy:mainnet` |
| `npm run docs:check` | `node scripts/docs/check-docs.mjs` |
| `npm run docs:ens:check` | `node scripts/docs/check-ens-docs.mjs` |
| `npm run docs:ens:gen` | `node scripts/docs/generate-ens-reference.mjs` |
| `npm run docs:gen` | `node scripts/docs/gen-docs.mjs` |
| `npm run docs:interface` | `node scripts/generate-interface-doc.js` |
| `npm run docs:terms` | `node scripts/docs/sync-protocol-terms.mjs` |
| `npm run economics:admission` | `node scripts/economics/admission.cjs` |
| `npm run economics:benchmark` | `node scripts/economics/benchmark-qualification.mjs` |
| `npm run economics:calibrate` | `node scripts/economics/calibration.cjs` |
| `npm run economics:check` | `node scripts/economics/assess.cjs` |
| `npm run economics:example` | `node scripts/economics/admission-example.cjs` |
| `npm run economics:funding` | `node scripts/economics/admission.cjs` |
| `npm run economics:lifecycle` | `node scripts/economics/lifecycle.cjs` |
| `npm run economics:screen` | `node scripts/economics/screen.cjs` |
| `npm run etherscan:prep` | `node scripts/etherscan/prepare_inputs.js` |
| `npm run forge:build` | `forge build --deny warnings` |
| `npm run forge:invariant` | `FOUNDRY_PROFILE=ci forge test --match-path forge-test/invariant/*.t.sol` |
| `npm run forge:test` | `forge test` |
| `npm run lint` | `solhint --max-warnings 0 "contracts/**/*.sol"` |
| `npm run merkle:export` | `node scripts/merkle/export_merkle_proofs.js` |
| `npm run merkle:proof` | `node scripts/merkle/generate_merkle_proof.js` |
| `npm run postinstall` | `node scripts/security/patch-openzeppelin-compiler.cjs` |
| `npm run settlement:status` | `node scripts/ops/settlement-status.mjs` |
| `npm run simulate:genesis` | `npm --prefix hardhat run compile && node scripts/simulate-genesis-job.mjs` |
| `npm run simulate:workforce` | `python3 experiments/workforce-10000/simulate.py --replicates 20 --out build/workforce-10000` |
| `npm run size` | `node scripts/check-bytecode-size.js` |
| `npm run slither` | `./scripts/security/run-slither.sh` |
| `npm run slither:extended` | `bash scripts/security/run-slither-extended.sh` |
| `npm run test` | `npm run build && node scripts/test-contract-shard.js 0 1` |
| `npm run test:shard` | `node scripts/test-contract-shard.js` |
| `npm run test:simulation` | `python3 experiments/workforce-10000/test_simulation.py` |
| `npm run test:ui` | `node scripts/ui/run_ui_smoke_test.js` |
| `npm run test:ui:usdc` | `node scripts/ui/run_usdc_console_test.js` |
| `npm run ui:abi` | `node scripts/ui/export_abi.js` |
| `npm run ui:abi:check` | `node scripts/ui/check_ui_abi.js` |
| `npm run workforce:economics` | `node scripts/economics/project-economics.cjs` |
| `npm run workforce:plan` | `node scripts/economics/capacity-plan.cjs` |
| `npm run workforce:qualify` | `node scripts/economics/workforce.cjs` |

## hardhat workspace

| Command from repository root | Exact configured implementation |
| --- | --- |
| `npm --prefix hardhat run check:config:mainnet` | `node scripts/check-config.cjs mainnet` |
| `npm --prefix hardhat run check:config:sepolia` | `node scripts/check-config.cjs sepolia` |
| `npm --prefix hardhat run check:readiness` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/check-readiness.js --network mainnet` |
| `npm --prefix hardhat run check:readiness:sepolia` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/check-readiness.js --network sepolia` |
| `npm --prefix hardhat run clean` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs clean` |
| `npm --prefix hardhat run compile` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs compile` |
| `npm --prefix hardhat run deploy:ens-job-pages:mainnet` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy-ens-job-pages.js --network mainnet` |
| `npm --prefix hardhat run deploy:ens-job-pages:sepolia` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy-ens-job-pages.js --network sepolia` |
| `npm --prefix hardhat run deploy:mainnet` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy.js --network mainnet` |
| `npm --prefix hardhat run deploy:sepolia` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy.js --network sepolia` |
| `npm --prefix hardhat run postinstall` | `node ../scripts/security/patch-openzeppelin-compiler.cjs` |
| `npm --prefix hardhat run recover:review-escrow:mainnet` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy-review-escrow.js --network mainnet` |
| `npm --prefix hardhat run recover:review-escrow:sepolia` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/deploy-review-escrow.js --network sepolia` |
| `npm --prefix hardhat run reverify:mainnet` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/reverify-deployment.js --network mainnet` |
| `npm --prefix hardhat run reverify:sepolia` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs run scripts/reverify-deployment.js --network sepolia` |
| `npm --prefix hardhat run setup` | `node scripts/setup.cjs` |
| `npm --prefix hardhat run test:cutover` | `node ../node_modules/hardhat/dist/src/cli.js test --config ../hardhat.cutover-fork.config.mjs test/mainnet-cutover.test.js` |
| `npm --prefix hardhat run test:deployment` | `node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs test test/mainnet-deployment.test.js` |
| `npm --prefix hardhat run test:mainnet-fork` | `node ../node_modules/hardhat/dist/src/cli.js test --config ../hardhat.mainnet-fork.config.mjs test/mainnet-fork.test.js` |
| `npm --prefix hardhat run test:preflight` | `node --test test/*.test.cjs` |

## ui workspace

| Command from repository root | Exact configured implementation |
| --- | --- |
| `npm --prefix ui run build` | `next build` |
| `npm --prefix ui run build:ipfs` | `npm run build && node scripts/build-ipfs.mjs` |
| `npm --prefix ui run check:no-binaries` | `node scripts/check-no-binaries.mjs` |
| `npm --prefix ui run dev` | `next dev` |
| `npm --prefix ui run docs:check` | `node scripts/docs-check.mjs && node scripts/check-no-binaries.mjs` |
| `npm --prefix ui run docs:contract` | `node scripts/generate-contract-interface.mjs` |
| `npm --prefix ui run docs:deployment` | `node scripts/sync-deployments.mjs && node scripts/generate-deployment-docs.mjs` |
| `npm --prefix ui run docs:versions` | `node scripts/generate-versions.mjs` |
| `npm --prefix ui run lint` | `eslint src --max-warnings 0` |
| `npm --prefix ui run start` | `next start` |
| `npm --prefix ui run sync:deployment` | `node scripts/sync-deployments.mjs` |
| `npm --prefix ui run sync:deployments` | `node scripts/sync-deployments.mjs` |
| `npm --prefix ui run sync:deployments:check` | `node scripts/sync-deployments.mjs --check` |
| `npm --prefix ui run test` | `vitest run` |
| `npm --prefix ui run test:a11y` | `NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run build && playwright test e2e/a11y.spec.ts` |
| `npm --prefix ui run test:e2e` | `NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run build && playwright test e2e/demo.spec.ts e2e/smoke.spec.ts` |
| `npm --prefix ui run test:fuzz` | `vitest run tests/fuzz.invariants.test.ts` |
| `npm --prefix ui run test:headers` | `NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run build && playwright test e2e/headers.spec.ts` |
| `npm --prefix ui run test:security` | `npm run build:ipfs && npm run verify:singlefile` |
| `npm --prefix ui run test:watch` | `vitest` |
| `npm --prefix ui run typecheck` | `tsc --noEmit` |
| `npm --prefix ui run verify:committed-html` | `node scripts/ensure-committed-html-fresh.mjs` |
| `npm --prefix ui run verify:deterministic` | `node scripts/verify-deterministic-build.mjs` |
| `npm --prefix ui run verify:ipfs` | `npm run verify:singlefile` |
| `npm --prefix ui run verify:singlefile` | `node scripts/verify-singlefile.mjs` |
