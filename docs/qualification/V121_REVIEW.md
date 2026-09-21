# v1.2.1 settlement-report review

This review tested whether the v1.2.0 read-only reporting tool could give operators stronger evidence before relying on a snapshot. It did not change contract logic, sign transactions or assess private Agent/Node applications.

## Findings and corrections

| Observation in v1.2.0 | Correction in v1.2.1 | Regression evidence |
| --- | --- | --- |
| State calls used a block number; checking the height's hash only at the beginning/end did not bind each intermediate call to that hash | Every `eth_getCode` and `eth_call` uses one EIP-1898 canonical block-hash selector; unsupported/noncanonical reads fail without fallback | New selector regression failed against v1.2.0, then passed after the fix; unsupported hash reads are rejected |
| Any six-decimal token could appear under USDC-labelled human output; verification was left to the operator | Ethereum chain 1 requires native Circle USDC; other chains require an explicit expected token and display a neutral TOKEN unit | Same-decimal substitute regression failed against v1.2.0, then passed; mismatch and mainnet-override rejection are covered |
| A stale but internally consistent RPC could produce a current-looking report | Default maximum head age 300 seconds, maximum future skew 60 seconds, checks on both RPCs and before output; explicit reported opt-out | Boundary tests plus real local HTTP CLI rejection of stale/future primary heads and a stale verification head |

Before fixes, the focused suite had **7 passing and 2 intentionally failing tests** reproducing the first two gaps. They concern reporting assurance; they are not evidence of a payout-contract failure or loss of funds. Additional tests exercise actual CLI output/exit codes, matching and disagreeing second endpoints, redacted errors and historical-state reads. No private qualification results are counted as public release evidence.

The read semantics follow [EIP-1898](https://eips.ethereum.org/EIPS/eip-1898); the required Ethereum token address was checked against [Circle's official registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Neither reference certifies this application or a deployment.

## Operator-visible changes

The mainnet command retains its existing arguments. RPCs now need canonical block-hash support; unsupported reads terminate with exit code 1 instead of weakening consistency. Non-mainnet commands require `--expected-token`. A simulated or historical chain clock may need the explicitly reported `--max-head-age 0` override. Existing JSON amount fields remain exact integer strings; additive metadata identifies asset policy, state-reference semantics and freshness observations. See the [recovery guide](../OPERATIONS/SETTLEMENT_RECOVERY.md).

## Limits of the assessment

Passing these checks supports this bounded reporting scope. It is not an absolute quality ceiling or proof that the entire system is flawless. A dishonest RPC can fabricate observations; a confirmation depth is not finality; the host clock must be correct; selected jobs/beneficiaries are not complete history. Manager/library bytecode verification, independent security assessment, live deployment commissioning and measured operating capacity remain separate work. Zero reserves do not establish useful work, profitability or inevitable future recovery.
