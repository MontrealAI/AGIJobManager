#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
export PATH="$HOME/.foundry/bin:$PATH"
if ! command -v slither >/dev/null 2>&1; then
  echo "Install slither-analyzer==0.10.4 before running the extended review." >&2
  exit 1
fi
if [[ "$(slither --version)" != "0.10.4" ]]; then
  echo "The reviewed findings require Slither 0.10.4; review the baseline before changing versions." >&2
  exit 1
fi

output_dir="${SLITHER_OUTPUT_DIR:-build/security}"
mkdir -p "$output_dir"
rm -f "$output_dir/slither-extended.json" "$output_dir/slither-reentrancy.json"
scan_dir="$(mktemp -d)"
trap 'rm -rf "$scan_dir"' EXIT
foundry_out="$(forge config --json | python3 -c 'import json, sys; print(json.load(sys.stdin)["out"])')"

# Findings remain in the raw reports. The strict verifier below, rather than a
# broad detector exclusion or Slither's severity exit code, decides acceptance.
slither . --config-file scripts/security/slither-extended.config.json \
  --json "$scan_dir/slither-extended.json" --fail-none
mv "$scan_dir/slither-extended.json" "$output_dir/slither-extended.json"
slither . --foundry-ignore-compile --foundry-out-directory "$foundry_out" \
  --config-file scripts/security/slither-reentrancy.config.json \
  --json "$scan_dir/slither-reentrancy.json" --fail-none
mv "$scan_dir/slither-reentrancy.json" "$output_dir/slither-reentrancy.json"
python3 scripts/security/verify-slither-review.py "$output_dir"
