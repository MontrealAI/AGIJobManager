#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"

if ! command -v slither >/dev/null 2>&1; then
  echo "slither not found (install with: pipx install slither-analyzer)" >&2
  exit 1
fi

slither . --config-file slither.config.json --fail-medium
