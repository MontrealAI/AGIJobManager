#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.foundry/bin:$HOME/.local/bin:$PATH"

if ! command -v slither >/dev/null 2>&1; then
  echo "slither not found (install with: pipx install slither-analyzer)" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
tmp_json="$tmp_dir/slither.json"
trap 'rm -rf "$tmp_dir"' EXIT

slither . --config-file slither.config.json --json "$tmp_json"

python - <<'PY' "$tmp_json"
import json,sys
path=sys.argv[1]
with open(path,'r',encoding='utf-8') as f:
    data=json.load(f)
results=data.get('results',{}).get('detectors',[])
violations=[r for r in results if str(r.get('impact','')).lower() in {'medium','high'}]
if violations:
    print(f"Found {len(violations)} medium/high Slither findings:")
    for r in violations:
        print(f"- [{r.get('impact')}] {r.get('check')}: {r.get('description','').splitlines()[0]}")
    sys.exit(1)
print('No medium/high Slither findings.')
PY
