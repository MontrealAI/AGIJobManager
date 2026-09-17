#!/usr/bin/env python3
"""Fail closed when the source or Slither results differ from the reviewed set."""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "scripts/security/slither-reviewed-findings.json"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(output_dir):
    baseline = json.loads(BASELINE.read_text())
    if baseline.get("schema") != 1 or baseline.get("slither_version") != "0.10.4":
        raise ValueError("Unrecognized review schema or analyzer version")
    if set(baseline.get("reports", {})) != {"slither-extended.json", "slither-reentrancy.json"}:
        raise ValueError("Both the complete medium/high and full reentrancy reports are required")
    sources = {
        str(path.relative_to(ROOT))
        for path in (ROOT / "contracts").rglob("*.sol")
        if path.relative_to(ROOT).parts[1] not in {"test", "legacy"}
    }
    sources.update({
        "foundry.toml", "package-lock.json", "scripts/security/slither-extended.config.json",
        "scripts/security/slither-reentrancy.config.json",
    })
    if sources != set(baseline["source_sha256"]):
        raise ValueError("The production source/configuration file set changed; repeat the review")
    changed = [name for name in sorted(sources) if sha256(ROOT / name) != baseline["source_sha256"][name]]
    if changed:
        raise ValueError("Reviewed source changed: " + ", ".join(changed))
    total = 0
    for name, expected in baseline["reports"].items():
        report = json.loads((output_dir / name).read_text())
        if report.get("success") is not True or report.get("error"):
            raise ValueError(f"{name}: analyzer did not complete successfully")
        findings = report.get("results", {}).get("detectors")
        if not isinstance(findings, list):
            raise ValueError(f"{name}: missing detector findings")
        actual = {}
        for finding in findings:
            finding_id = finding["id"]
            if finding_id in actual:
                raise ValueError(f"{name}: duplicate finding {finding_id}")
            actual[finding_id] = {key: finding[key] for key in ("check", "impact", "confidence")}
        reviewed = {}
        for finding in expected:
            if not finding.get("rationale") or not finding.get("evidence"):
                raise ValueError(f"{name}: finding lacks review rationale/evidence")
            if finding["id"] in reviewed:
                raise ValueError(f"{name}: duplicate reviewed finding")
            reviewed[finding["id"]] = {key: finding[key] for key in ("check", "impact", "confidence")}
        if actual != reviewed:
            added = sorted(set(actual) - set(reviewed))
            removed = sorted(set(reviewed) - set(actual))
            changed = sorted(key for key in set(actual) & set(reviewed) if actual[key] != reviewed[key])
            raise ValueError(f"{name}: review required; new={added}, removed={removed}, changed={changed}")
        total += len(findings)
        print(f"{name}: {len(findings)} findings match the individually reviewed baseline")
    print(f"Extended static-analysis review verified ({total} report entries; source hashes unchanged)")


if __name__ == "__main__":
    try:
        verify(Path(sys.argv[1]) if len(sys.argv) == 2 else ROOT / "build/security")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"Extended Slither review FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
