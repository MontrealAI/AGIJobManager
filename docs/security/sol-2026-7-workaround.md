# SOL-2026-7: separate compiler-profile remediation candidate

## Status and scope

This candidate retains Solidity 0.8.37+commit.f401782d, Shanghai, viaIR, optimizer runs 40, and unchanged Solidity sources. It disables only LoadResolver (L) and EqualStoreEliminator (E) in the exact upstream default Yul optimizer sequence. The cleanup sequence remains fDnTOcmuO. This disables the affected passes under the pinned profile; it does not establish absence of every compiler defect.

This is a separate build and qualification candidate. It must never replace artifacts, source identity, constructor data, libraries, nonces or signed transactions in an existing campaign. Preserve the c174b055 campaign and its evidence. Any later deployment requires its own reviewed source, catalog, plan, addresses, fees and authority checks.

## Primary evidence

- [Official bug inventory](https://github.com/argotorg/solidity/blob/00d5ee65698ccc9eeeeb6b1c29f9fe694c869139/docs/bugs.json): introduced 0.8.19, fixed 0.8.38, Yul optimizer condition, low severity.
- [Upstream fix and semantic regression fixtures](https://github.com/argotorg/solidity/commit/00d5ee65698ccc9eeeeb6b1c29f9fe694c869139), merged October 14, 2026.
- [Exact 0.8.37 default sequence](https://github.com/argotorg/solidity/blob/v0.8.37/libsolidity/interface/OptimiserSettings.h).
- [Pass abbreviations and implicit steps](https://github.com/argotorg/solidity/blob/v0.8.37/libyul/optimiser/Suite.cpp).

As observed October 17, the official compiler binary inventory, npm registry and GitHub latest release still identify 0.8.37. Version 0.8.38 is marked unreleased. The bug inventory links a future-dated October 22 advisory; its wording must not be used to invent a release date. A nightly or locally patched compiler is not approved for production by this candidate.

## Evidence obtained

The three upstream semantic fixtures are retained verbatim under hardhat/test/fixtures/SOL-2026-7, from the linked fix commit. Their original upstream licensing remains applicable.

Under the default 0.8.37 profile, both memory fixtures return 67 where the reference result is 7. The storage fixture returns 43690 rather than 48059 and leaves 101 rather than 501. The candidate produces the specified results. Tests run both profiles on a disposable local EVM and require each default control to differ from its reference and every candidate result to match.

The isolated build compiled 62 Solidity files and exported 91 artifacts without compiler warnings. This is not proof that an existing deployed contract exhibits the bug. Differences between optimizer outputs alone are not a demonstrated exploit.

Local qualification passed 792 contract cases, 961 native cases, 24 chain-1 core/operator/governance cases, and all 37 Forge unit/fuzz/invariant cases. Official Foundry v1.7.1 compiled 119 files with solc 0.8.37. Actual CI-profile configuration, emitted Standard JSON input and compiled metadata were checked against the exact workaround. Foundry requires camelCase yulDetails/optimizerSteps here; the snake_case spelling silently drops those settings and is covered by a rejecting regression. Hosted, static-analysis and fresh fork qualification remain pending.

Runtime sizes (bytes), original c174 / candidate:

- UriUtils: 1899 / 1885
- TransferUtils: 872 / 872 (bytes differ despite equal size)
- BondMath: 681 / 681
- ReputationMath: 411 / 411
- ENSOwnership: 2624 / 2624
- NftEligibility: 1302 / 1302
- JobSettlement: 3381 / 3386
- JobValidation: 1699 / 1698
- AGIJobManager: 24412 / 24477

The candidate Manager has only 99 bytes of EIP-170 headroom. Local EVM deployment used 6,002,143 gas with ordinary constructor metadata and 6,366,573 with maximum permitted metadata. These measurements do not replace fresh deployment preflight or authorization.

## Required qualification before use

- Pin and enforce the exact optimizer profile across build and deployment entrypoints.
- Align Foundry configuration; do not count default-optimizer Forge results as candidate evidence.
- Review the explicit finite source/compiler-policy transition without rewriting historical acceptance.
- Run contract, native, invariant/fuzz, deployment/recovery and explorer-input tests on the resulting exact source.
- Rebuild and inspect all artifacts, library links, bytecode sizes, constructor arguments and verification inputs.
- Preserve the version warning disposition. Explorer heuristics may continue to warn about 0.8.37 even when the affected passes are disabled.
- Keep operational readiness, owner authorization and paid-operation qualification separate.

No new Mainnet deployment, activation, funding, or governor signing is performed by these tests.

