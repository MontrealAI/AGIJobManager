# Deployment records

Use the record for the exact instance you intend to inspect. These dated records are not live status feeds or transaction defaults.

| Record | Instance and scope |
| --- | --- |
| [Latest reported Manager — 17 October 2026](MAINNET_MANAGER_2026-10-17.md) | Manager `0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8`; nine reported finalized creations and an authority snapshot at block 26,214,525. Six Exact Matches and three retained Similar Matches. No ENS-helper attachment is established by this record. |
| [Historical Manager and ENS helper — 10 October 2026](MAINNET_USDC_2026-10-10.md) | Manager `0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7` and its separate helper/namespace. Historical inspection commands apply only to this instance. |
| [Generic deployment configuration](../../config/usdc-deployment.json) | Blank Manager/helper/owner fields intentionally select no transaction target. They are not the latest deployment record. |

The legacy `mainnet.json` remains a historical schema artifact; its empty `agiJobManager` field does not supersede the records above. Preserve original source, compiler inputs, receipts, journals, liabilities and recovery routes for every instance. New software or a newer record does not migrate older jobs or authority.
