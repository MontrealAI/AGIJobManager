# Validation — v1.13.0

Frozen application commit: `5c491335a2d9069facad6d65781efefc5baee670`.
Source tree: `43910ac44ed1655f07b83281aee459875f8b28e4`.

## Executed public checks

- Twelve targeted reviewer reservation and pilot outcome tests passed; shard 3 ran 194 tests including these new cases. Shard 0 also passed locally. All 16 simulation accounting regressions passed.
- Root/Hardhat dependency installation, compiler (62 Solidity files, zero warnings/errors), ABI export, bytecode size (24,359 bytes), Solidity lint and documentation freshness passed locally.
- The 35 release gate regressions and 35 standalone-console mocked function checks passed. Documentation checked 186 current guides, 202 alignment guides and 18 deployment commands.
- Five exact-source CI workflows and their eight required jobs are recorded in SOURCE_CI.json after successful completion. The publication workflow rechecks source checkout markers and release checksums before publication.

The study's separate review reran 30 study/engine tests, verified canonical output and settlement parity and reproduced three principal scenarios. This release uses the verified canonical counts as a **synthetic** reference; it does not rerun the full 320-run campaign or claim a new simulation improvement.

## Operational boundary

No Solidity, payout or review-policy change and no private companion update. The new reviewer planner uses declared timestamps and availability and does not coordinate real fleet journals, allowances, human queues, collateral or chain state. The pilot report checks declared aggregate counts without authenticating evidence. Independent review judgments, paid job outcomes, real Mac/OpenClaw/Astra usage, Work allowances and costs, live recovery and external security assurance remain to be measured.

`authorization: NONE` is emitted by both tools. A passing synthetic target cannot open intake or qualify a real fleet. The manual console and public contract do not enforce private pre-funding policies.
