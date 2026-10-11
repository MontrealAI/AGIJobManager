#!/usr/bin/env bash
set -eu
if [ -n "${NODE_OPTIONS:-}" ] || [ -n "${NODE_PATH:-}" ]; then
  echo 'STOP: NODE_PRELOAD_SETTINGS_REQUIRE_REVIEW. Start a clean shell without NODE_OPTIONS or NODE_PATH; npm itself may already have loaded them.' >&2
  exit 2
fi
if [ -n "${PRIVATE_KEY:-}" ] || [ -n "${DEPLOY_CONFIRM_MAINNET:-}" ]; then
  echo 'STOP: SIGNING_ENVIRONMENT_REFUSED. Use a separate read-only shell.' >&2
  exit 2
fi
command_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$command_dir/cli.cjs" "$@"
