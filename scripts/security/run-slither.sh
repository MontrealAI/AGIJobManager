#!/usr/bin/env bash
set -euo pipefail

# Keep the historical npm command, but use the same source-bound review gate.
# Detector-family exclusions must not create a misleading zero-findings scan.
exec bash "$(dirname "$0")/run-slither-extended.sh"
