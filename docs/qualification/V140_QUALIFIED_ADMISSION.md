# v1.4.0 qualification boundary

This release adds lifecycle economics, signed qualification verification and canonical dual-RPC economic observations. It preserves the v1.3.0 conditional screen and all on-chain settlement behavior.

The local public suite passes 589 tests, including 21 new lifecycle, signature, policy, aggregate budget and canonical-state cases. These check missing/expired/tampered inputs; adverse zero-weight scenarios; participant controller conflicts; fixed-point arithmetic; operator-owned thresholds; stale evidence; changed contract terms; stale/reorganized/disagreeing RPCs; unsupported canonical reads; USDC identity; and confirmation-depth bounds. Publication evidence records the final exact source and independent CI gates.

These are software tests, including simulated RPC faults and local contract fixtures. They do not measure M1 production capacity, employer demand/value, qualification accuracy, actual operator independence, live cost/slashing rates or savings in human hours. The teaching lifecycle assumptions are explicitly hypothetical. A trusted signature does not make an estimate factual. Admission success is conditional, and the public CLI cannot authorize or submit transactions.

See [the operator integration contract](../OPERATIONS/QUALIFIED_ADMISSION.md). Private Agent, Node and Fleet source and artifacts are excluded from this release. No deployment, employer job or funded transaction was created during release preparation.
