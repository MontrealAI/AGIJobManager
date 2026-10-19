# Retained Manager ENS configuration evidence — 19 October 2026

The owner-supplied closeout records four finalized configuration transactions
and 27 passing state comparisons for Manager
`0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8` and helper
`0xBaC826CF5f169EA168A23173F3DbBdA7Ed953400`. The closeout status remains
**`REVIEW_REQUIRED`**: its original fee ceiling was exceeded. Separate explorer
evidence remains **`SOURCE_REVIEW_REQUIRED`**, with
`exactSourceInputMatch: false`. These records are not an all-pass readiness,
source-verification or activation decision.

This additive note preserves the [17 October deployment record](MAINNET_MANAGER_2026-10-17.md)
and the [10 October historical instance](MAINNET_USDC_2026-10-10.md) unchanged.
It records retained observations; it performs no fresh network or chain check,
selects no transaction target and authorizes no signing, funding, ENS change,
role change, configuration locking or activation.

## Snapshot and time boundary

| Field | Retained evidence |
| --- | --- |
| Configuration snapshot block | `26,227,598` (`0x190338e`) |
| Configuration snapshot hash | `0x280b9d8f09ce5b7dc47783d00e8b036e2b4fbe94c241d589a48b8a25184a0cc7` |
| Configuration snapshot block timestamp | **Unavailable in the supplied report** |
| Configuration check time | **Unavailable**: the supplied closeout has no timestamp or `checkedAt` field |
| Retained-report upload time | `2026-10-19T16:01:16.275715Z`; this is an upload time, not the chain observation or block time |
| Separate explorer report `checkedAt` | `2026-10-19T00:06:03.071Z`; applies only to that earlier explorer check |

The block/hash anchor identifies the configuration snapshot. Neither the upload
date nor the explorer check time supplies its missing observation time. No
statement here asserts that the reported settings remain current.

## Reported configuration

All 27 entries in the retained closeout's `checks` array have `pass: true`.
The byte-exact report below retains each expected/observed comparison.

| Boundary | Reported value at the configuration snapshot |
| --- | --- |
| Manager | `0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8` |
| Manager governor; pending owner | `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`; zero address |
| Manager ENS helper | `0xBaC826CF5f169EA168A23173F3DbBdA7Ed953400` |
| Manager intake; USDC balance; next job | Paused; `0`; `0` |
| Manager identity configuration | Unlocked (`lockIdentityConfig: false`) |
| Helper owner | `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` |
| Helper Manager binding | `0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8` |
| Helper root and label prefix | `usdc.jobs.agi.eth`; `job-v2-` |
| Helper configuration; ENS token URI option | Unlocked (`configLocked: false`); `useEnsJobTokenURI: false` |
| Selected historical helper | Its reported owner, original Manager binding, `job-` prefix, root and operator grant remained as expected |
| New helper grant | `newHelper.operatorGrant: true` |
| Root registry owner; wrapped-name holder | `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`; `0xd57243B80FBc5CFB2560E5a644651FEcd7Dc2512` |

The checker covers the specific new and historical helper grants. It does not
enumerate every other operator or establish that a reported owner/grant is an
independently approved governance arrangement. Runtime-hash comparisons are
retained separately from explorer source acceptance.

## Recorded transaction order and fee exception

The closeout records `managerAttachedLast: true` and this operation sequence:

| Operation | Function | Recorded transaction | Block |
| --- | --- | --- | --- |
| 1 | Helper `setJobManager(address)` | [0xdfa1b4b9668ddfb5c1e805a6d2da2128822560edd5d27e797985f41083562bbc](https://etherscan.io/tx/0xdfa1b4b9668ddfb5c1e805a6d2da2128822560edd5d27e797985f41083562bbc) | `26,226,990` |
| 2 | Helper `setJobLabelPrefix(string)` | [0x99397edab4a44eee2103eec477bd0fc22bbda00ebfe78562d7aa1ea05f486fd7](https://etherscan.io/tx/0x99397edab4a44eee2103eec477bd0fc22bbda00ebfe78562d7aa1ea05f486fd7) | `26,226,999` |
| 3 | Name Wrapper `setApprovalForAll(address,bool)` | [0x8589bb74cab9782412897e0f0e130527dd54ed6831bf202b976466590ffeb7b1](https://etherscan.io/tx/0x8589bb74cab9782412897e0f0e130527dd54ed6831bf202b976466590ffeb7b1) | `26,227,524` |
| 4 | Manager `setEnsJobPages(address)` | [0xdd9a3edf982defb02ee439cc3e01f23730fd757639eaceb85b1f35181ca053ea](https://etherscan.io/tx/0xdd9a3edf982defb02ee439cc3e01f23730fd757639eaceb85b1f35181ca053ea) | `26,227,535` |

| Cost field | Retained value |
| --- | --- |
| Actual total gas cost | `419899663026234` wei = **`0.000419899663026234 ETH`** |
| Original approved ceiling | `40000000000000` wei = **`0.00004 ETH`** |
| `withinApprovedMaximum` | **`false`** |
| Sum of recorded transaction maximum costs | `665925860091511` wei = `0.000665925860091511 ETH`; this is not the actual-spend field |

The actual cost equals the sum of the four recorded `actualGasCostWei` values.
Passing state comparisons do not erase this historical fee exception. The
closeout checker reports `publicTransactionsBroadcast: 0`; that describes the
checker itself, not the four earlier configuration transactions it inspected.
It reports `activationAuthorized: false` and
`sourceExplorerAcceptance: "NOT_CHECKED_BY_THIS_SCRIPT"`.

## Separate explorer source evidence

The earlier [explorer record](evidence/ens-configuration-retained-2026-10-19/ens-explorer-verification-original.json)
concerns this helper on chain ID `1`, checked at
`2026-10-19T00:06:03.071Z`. Its status is **`SOURCE_REVIEW_REQUIRED`**.

| Explorer listing field | Retained result |
| --- | --- |
| `contractNameMatches` | `true` |
| `contractFileMatches` | `true` |
| `compilerVersionMatches` | `true` |
| `constructorArgumentsMatch` | `true` |
| `exactSourceInputMatch` | **`false`** |
| `exactAbiMatch` | `true` |
| `directExactListing` | `true` |

The compiler identity is `v0.8.37+commit.f401782d`; the contract name is
`project/contracts/ens/ENSJobPages.sol:ENSJobPages`. The listed positive flags
do not override the reported exact-source-input mismatch. No later explorer
clearance is supplied by these two reports. Source verification and the
configuration snapshot remain separate evidence.

## Byte-exact retained reports

| File | SHA-256 |
| --- | --- |
| [Configuration closeout](evidence/ens-configuration-retained-2026-10-19/ens-configuration-closeout-original.json) | `10b252325897fe1b9c2134623d02ca8e139e850b7b72f91951ccc29f2b70a840` |
| [Explorer verification](evidence/ens-configuration-retained-2026-10-19/ens-explorer-verification-original.json) | `385a2dc667897a1576bdb7957a0b09fcdd728ff4069ed71a43796bebeb550471` |

The copies retain their original bytes, including statuses, failed fee flag and
source-mismatch result. Any later separately authorized observation belongs in
a new dated record. Preserve the Ubuntu Hardhat route with local hidden
ephemeral deployer-key entry and Ledger governance on Mac Studio; nothing in
this note changes the deployed systems or their authority.
