# Latest reported Manager deployment — 17 October 2026

**Manager deployed and verified; moderator enabled. Intake remains paused and identity configuration unlocked.**

This dated record projects owner-reported execution, explorer results and readback. It is not a fresh RPC observation, a complete receipt archive, an independent audit or approval to open paid intake. Later transactions can change the state. The [machine-readable record](../../config/mainnet/manager-8815-2026-10-17.json) separates the reviewed plan, reported per-contract completion and finalized-state claims. Full creation receipts and their block numbers/hashes are not reproduced or inferred.

## Deployed source and reported completion

- Manager: [`0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8`](https://etherscan.io/address/0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8#code), Ethereum mainnet, chain 1.
- Source: [`8815ed3181778664595f951befd672afbd7a9352`](https://github.com/MontrealAI/AGIJobManager/commit/8815ed3181778664595f951befd672afbd7a9352).
- Source tree: `913e49d65263bc53026916f7fc3b4cbfb93549f8`.
- Reviewed plan SHA256: `2c63e5b3969a7081b8d65a08eb42d12207df5df204752c3a62b2dfab57a0abf8`.
- All nine creations were reported completed and finalized: eight linked libraries and the Manager. The JSON retains every name, address, actual creation transaction hash and reported runtime hash from the owner's deployment and verification output.
- Explorer verification was reported complete with **six Exact Matches and three retained Similar Matches**. This is not an all-Exact claim. BondMath, ReputationMath and ENSOwnership retained Similar Match, with no new submission and no evaluated published-bundle comparison for those three rows. The other six, including the Manager, reported Exact Match.

## Nine reported finalized creations

| Contract | Address / code | Creation transaction | Reported explorer status |
| --- | --- | --- | --- |
| UriUtils | [0x816a085Db48779fbE1A7611AE864eCE74dD62f4a](https://etherscan.io/address/0x816a085Db48779fbE1A7611AE864eCE74dD62f4a#code) | [0x063780ef7e605564a1bffbd120f99edbc28c07ec4706d5aee31fdb842e9a79e0](https://etherscan.io/tx/0x063780ef7e605564a1bffbd120f99edbc28c07ec4706d5aee31fdb842e9a79e0) | EXACT_MATCH |
| TransferUtils | [0xB5C83eE1433aFCb559d012b0277AE8ab094c021F](https://etherscan.io/address/0xB5C83eE1433aFCb559d012b0277AE8ab094c021F#code) | [0x2c979d6e9e31317d0cfb8d84bede21879145a92a75464613130e7b7b2fda7691](https://etherscan.io/tx/0x2c979d6e9e31317d0cfb8d84bede21879145a92a75464613130e7b7b2fda7691) | EXACT_MATCH |
| BondMath | [0xfD59B2ee58856dF350F091Bf1d1422B35951d4aF](https://etherscan.io/address/0xfD59B2ee58856dF350F091Bf1d1422B35951d4aF#code) | [0x645c5b290a267b43cf37225d48e75a0482e6e0516436afb3ba9c7dd3a2b6e873](https://etherscan.io/tx/0x645c5b290a267b43cf37225d48e75a0482e6e0516436afb3ba9c7dd3a2b6e873) | SIMILAR_MATCH_SKIPPED |
| ReputationMath | [0xbf760eFB15D25B6B4ca308857489b3396eFADEAf](https://etherscan.io/address/0xbf760eFB15D25B6B4ca308857489b3396eFADEAf#code) | [0xa2b5561e3138281edef877b82995e8e9be5aed84a2018c3a69939455813ef05a](https://etherscan.io/tx/0xa2b5561e3138281edef877b82995e8e9be5aed84a2018c3a69939455813ef05a) | SIMILAR_MATCH_SKIPPED |
| ENSOwnership | [0x56E1F8f8f1Bb507A464E8E9e706F2693D48f8348](https://etherscan.io/address/0x56E1F8f8f1Bb507A464E8E9e706F2693D48f8348#code) | [0xe0415ef1b92ca7ea11ca1abe449a4ec080fca2e4bd398a50d51c8f3c45ff00bf](https://etherscan.io/tx/0xe0415ef1b92ca7ea11ca1abe449a4ec080fca2e4bd398a50d51c8f3c45ff00bf) | SIMILAR_MATCH_SKIPPED |
| NftEligibility | [0x77C18dd2f4957eE0D173192875Ee5AB4e56c110c](https://etherscan.io/address/0x77C18dd2f4957eE0D173192875Ee5AB4e56c110c#code) | [0x9d34c19cdad622fe2ccf0e9a85f1fc25d2f79a738f3b9c299da9c523db1f81e6](https://etherscan.io/tx/0x9d34c19cdad622fe2ccf0e9a85f1fc25d2f79a738f3b9c299da9c523db1f81e6) | EXACT_MATCH |
| JobSettlement | [0x96AC505A6299d4ABd57c083d845729AeEe8A0212](https://etherscan.io/address/0x96AC505A6299d4ABd57c083d845729AeEe8A0212#code) | [0x160218f807f660cfc7a0b1d1d0a7d822f14b0ebf5c02fcf2d74e8b2fcaf3d7db](https://etherscan.io/tx/0x160218f807f660cfc7a0b1d1d0a7d822f14b0ebf5c02fcf2d74e8b2fcaf3d7db) | EXACT_MATCH |
| JobValidation | [0x284F792Eb91D2BDAa00989D98eBF70dffAFe692B](https://etherscan.io/address/0x284F792Eb91D2BDAa00989D98eBF70dffAFe692B#code) | [0x6ca75ae403205b54e305792ec0a6810bbeed6830c43dae48b3dcc14aedf05a98](https://etherscan.io/tx/0x6ca75ae403205b54e305792ec0a6810bbeed6830c43dae48b3dcc14aedf05a98) | EXACT_MATCH |
| AGIJobManager | [0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8](https://etherscan.io/address/0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8#code) | [0xb2644e070fb3973189990ea3e65f2be2862bf42e1c2546b47facef36c98b6446](https://etherscan.io/tx/0xb2644e070fb3973189990ea3e65f2be2862bf42e1c2546b47facef36c98b6446) | EXACT_MATCH |

## Authority and configuration

The reported finalized authority snapshot is block **26,214,525**, hash `0xcf2dd7ad97c9499d813206a1c87bc492ae78b3ac0eb6ad4ce30bd3b5bb87cde1`.

| Field | Reported value |
| --- | --- |
| Governor / owner | `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99` |
| Pending owner | Zero address |
| Moderator | `0xA204b14eD9bc09501e3A47CDde379279FcD5D743`, enabled |
| Intake | Paused |
| Identity configuration | Unlocked |
| NFT admission | Exact collection count `0`; agent NFT requirement `false` |
| Settlement token | Native USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

The [moderator grant](https://etherscan.io/tx/0x9bbf5f74e9bfd2d01128d5edf7ffb8617a478b231bf5662c2258a12c4489acca) was reported finalized with 91 confirmations. The owner-supplied snapshot also reports direct checks and retained-state matching passed, native USDC operational/not paused, the manager/governor/moderator not blacklisted, and all listed constructor fields matching. These remain dated reported checks, not an independent fresh readiness assessment. Collection count and agent NFT admission do not establish the separate NFT URI mode.

## Preservation and next use

The [10 October instance](MAINNET_USDC_2026-10-10.md), its helper, jobs, claims, original source and [record](../../config/mainnet/agi-jobs-usdc.json) remain separate and unchanged. Its ENS wiring must not be copied to this new manager by inference. This record establishes no new helper attachment or ENS namespace authorization.

Keep the actual deployment session, nine receipts, saved artifacts, constructor/linking data and explorer responses with the operator. Before an operational decision, use those records to obtain a fresh instance-specific authority, financial and policy readback. Do not rerun creation, grant, locking or activation transactions merely to refresh documentation.

The runtime defaults in `config/usdc-deployment.json` remain deliberately blank. This documentation does not select transaction targets, migrate jobs, modify old contracts, lock identity or unpause intake. A v1.19.0 software wrapper has a separate source identity and still needs its own final-source qualification and publication. **Live paid-work qualification and intake activation remain unestablished.**
