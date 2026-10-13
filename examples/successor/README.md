# SUCCESSOR Ω public fixtures

All content is synthetic, nonpersonal and MIT licensed. These files grant no authority and contain no settlement evidence.

| File | Expected outcome |
| --- | --- |
| `analyst.json` | Competent every-row aggregate; repeated identical IDs create a measured deduplication opportunity |
| `website.json` | Usable static website; improvement adds section links |
| `custom.json` | Valid draft; execution blocked |
| `tie.csv` | Exact total 0.3; deduplication resolves no gap, so incumbent remains |
| `duplicate-conflict.csv` | Every-row baseline total 3; deduplication rejects contradictory ID a; failure retained |
| `malformed.csv` | Rejected because the value exceeds six decimals |
| `ambiguous.json` | Rejected because a key repeats |

Use the `.json` mission examples with `npm run successor -- run examples/successor/analyst.json build/my-run.json`. Paste CSVs into the Builder's analyst input. `core.test.mjs` also corrupts real result bytes and demonstrates that the separate checker rejects the regression. These are tests of bounded implementations, not proof of independent qualification or general intelligence.
