# v1.6.0 — Qualified pre-funding and closure proofs

Funding a job before checking whether workers can qualify can leave employer capital waiting for cancellation. This release supplies the missing public pre-funding primitives so an employer coordinator can qualify the exact offer before approval or escrow commitment.

## Changes

- Schema 3 binds an employer signature envelope to a unique offer, exact specification, price, duration and declaration. It requires baseline and observed-outcome evidence references, all-participant economics and a signed capacity allocation/lease.
- Separate capital, modeled epoch cost, gas, open-job and capacity limits are evaluated against the coordinator's portfolio. Results remain detached from mutable inputs and grant no transaction authority.
- Dual-RPC canonical reads quote native-USDC posting terms before a job ID exists. Successful canonical terminal receipts support conservative cancellation/settlement reconciliation, including deleted job zero; clients retain reservations when proofs or claims are unresolved.
- Schemas 1 and 2 remain supported for their existing roles. Exact Agent/reviewer action binding and current checks after creation remain necessary.
- The manual USDC console now clearly explains that it does not enforce economic admission. A browser race was fixed so a delayed wallet refresh cannot overwrite a newer saved ENS input during reload.

Solidity, ABI/bytecode inputs, payout rules, dependency resolutions, legal notices and historical records are unchanged. This public release contains no private Fleet/Agent/Node code, credentials or deployments.

## Validation

620 public contract/tool cases pass locally, including 18 pre-funding/state/closure cases and two persistence regressions. The existing 35 mocked console checks pass. Publication requires all five workflows and all eight jobs to pass at the pinned source: contract shards, actual browser/UI checks, dependency/security/Foundry/Slither checks, 23 native-USDC fork cases and documentation integrity. Release tooling independently verifies the checkout in every job log and builds byte-identical archives twice.

## Scope and remaining proof

Signatures authenticate assertions; they cannot establish the truth of employer value, costs, controller independence or real capacity. Local portfolio limits require disjoint allocations across coordinators. Terms may change after observation and before mining. The permissionless contract and manual console can be used outside this off-chain workflow.

This release is a stronger commissioning candidate, not production qualification, a million-job execution, a measured labor reduction or a claim about 512 Macs. Real provider quality/cost, independent operators, observed employer outcomes, funded native-USDC recovery and sustained throughput remain commissioning requirements. No public-chain transaction was made to prepare this release.
