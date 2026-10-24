# Start here — v1.20.2 Alpha v1.41 Discovery compatibility

Review [release notes](RELEASE_NOTES.md) and the [validation boundary](VALIDATION.md). This edition pins Alpha v1.41.0 at `031bdb5d055c8bad896daa076baea2b5e17b242c` and the anonymously verified public [Jobs rc.21](https://github.com/MontrealAI/AGIJobsv0/releases/tag/discovery-v2.1.0-rc.21) at `bc4abbd5c28f3672275b13300e40ea26c820b8ee`. Manager is qualified only by its matching final-source `QUALIFICATION.json`, public asset verification and installed acceptance; source preparation alone is insufficient. The accepted v1.20.1 release remains the historical software recovery checkpoint.

A qualified `AGIJobManager-v1.20.2-COMPLETE.zip` owns `source/`, `discovery-alpha/`, `discovery-browser/` and `RELEASE_MANIFEST.json`. Authenticate every public asset, its qualification and managed attestation before using extracted code. Use the existing guarded archive extractor and verifier; do not execute an unchecked ZIP or infer trust from a receipt wrapper.

## Continue the installed mission

Use qualified Node 22.23.2 or 24.21.0. Set `INSTALL` to the absolute clean extraction directory, `JOBS_WORKSPACE_AFTER` to the saved workspace produced by the actual public Jobs rc.21 installed command, and `ORIGINAL_USDC_REQUEST` to an absent absolute file under an existing directory. The retained original mission is `capability-fc911b7d-e209-4bed-b8c2-2682f3f879bd`, campaign `bfd0a7bc21ad197a64fc5e6b590c9aa0cc1d4ee02eebbc4af44275ea9179a3f3`. Its Jobs continuation has the original event prefix plus one `bc4` Jobs receipt. A previous Manager preparation receipt is not the final Manager source.

Resolve the original USDC export through the existing offline browser-capsule validator. `browser-native-requests.json.requests['manager-usdc']` is a file/SHA/currency descriptor. Its historical filename `fleet-browser-request.json` does not establish current Fleet execution. This command copies its authenticated raw bytes without reconstructing the request:

```bash
python3 - "$INSTALL" "$ORIGINAL_USDC_REQUEST" <<'PY'
import hashlib, pathlib, runpy, sys
installed = pathlib.Path(sys.argv[1]).resolve()
source = installed / 'source'
sys.path.insert(0, str(source / 'scripts/release'))
policy = runpy.run_path(str(source / 'scripts/release/discovery-release-profile.py'))
validate_browser_capsule = policy['validate_browser_capsule']
strict_json = policy['strict_json']
captured = validate_browser_capsule(source, installed / 'discovery-browser', return_files=True)
prefix = 'discovery-continuation/'
files = captured['files']
exports = strict_json(files[prefix + 'browser-native-requests.json'])
descriptor = exports['requests']['manager-usdc']
raw = files[prefix + descriptor['file']]
assert descriptor['currency'] == 'USDC6'
assert hashlib.sha256(raw).hexdigest() == descriptor['sha256'] == 'c1f9e97e6bb1dd4e8504cbbbf895495fe0b0982f74ddc687d4b6bef014858426'
with pathlib.Path(sys.argv[2]).open('xb') as output:
    output.write(raw)
PY
```

Set `CAMPAIGN_DIGEST` to the retained digest above and `MANAGER_OUTPUT` to an absent absolute directory with an existing parent. The complete independently authenticated peer record is installed under `source/config/`, separately from the Alpha code capsule. Pass all eight arguments:

```bash
node "$INSTALL/source/scripts/integrations/discovery-installed-operator.mjs" \
  "$INSTALL/discovery-alpha" "$JOBS_WORKSPACE_AFTER" "$ORIGINAL_USDC_REQUEST" \
  "$CAMPAIGN_DIGEST" "$INSTALL/RELEASE_MANIFEST.json" "$MANAGER_OUTPUT" \
  "$INSTALL/source/config/discovery-jobs-rc21-counterpart-v1.json" \
  b4be96c8dd1030133b7a0c3335cb6cb8134090300000c34658712a760ac30fda
```

Retain `original-request.json`, `raw-receipt.json`, `receipt-wrapper.json`, `workspace-after.json`, `docket.json` and `docket-reopened.json`. The operation appends one Manager receipt, preserves the original prefix and tests duplicate/forged-authority rejection. Verify the reopened docket without changing its bytes:

```bash
cmp "$MANAGER_OUTPUT/docket.json" "$MANAGER_OUTPUT/docket-reopened.json"
```

Retain the original mission prefix, raw route requests and receipts, source wrappers, cost/resource records and exported docket. Reopen the same exported evidence after restart. Unknown sources, altered selections, duplicates and forged authority must refuse. The [historical rc.20 instructions](../../successor/DISCOVERY_LAB.md) continue to describe v1.20.1 under their original identities.

The receiver performs a real bounded local synthetic check. `local-checked`, `DRAFT_NOT_SUBMITTED`, `authority:none`, `externalExecution:unprovisioned` and incomplete total-cost measurement are not production activation. Manager USDC6 and Jobs AGIALPHA18 remain separate zero-cap, unsigned and unfunded drafts. Inspection requires no wallet, financial transaction, paid service or deployed-contract change. Fleet installation and successor authority decisions remain separate. See [recovery](RECOVERY_GUIDE.md) before retrying interrupted or rejected work.
