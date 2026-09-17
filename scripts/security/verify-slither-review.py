#!/usr/bin/env python3
"""Fail closed when the source or Slither results differ from the reviewed set."""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "scripts/security/slither-reviewed-findings.json"
SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def load_object(path):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"{path.name}: duplicate JSON key {key!r}")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError(f"{path.name}: non-JSON numeric value {value}")

    value = json.loads(path.read_text(), object_pairs_hook=unique_object, parse_constant=invalid_constant)
    if not isinstance(value, dict):
        raise ValueError(f"{path.name}: expected a JSON object")
    return value


def finding_identity(finding):
    if not isinstance(finding, dict):
        raise ValueError("A detector finding must be a JSON object")
    finding_id = finding.get("id")
    if not isinstance(finding_id, str) or not SHA256.fullmatch(finding_id):
        raise ValueError("A finding must have a 64-character hexadecimal identifier")
    check = finding.get("check")
    if not isinstance(check, str) or not re.fullmatch(r"[a-z0-9-]+", check):
        raise ValueError(f"{finding_id}: invalid detector name")
    if finding.get("impact") not in {"High", "Medium", "Low", "Informational", "Optimization"}:
        raise ValueError(f"{finding_id}: invalid impact")
    if finding.get("confidence") not in {"High", "Medium", "Low"}:
        raise ValueError(f"{finding_id}: invalid confidence")
    return finding_id, {key: finding[key] for key in ("check", "impact", "confidence")}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(output_dir):
    baseline = load_object(BASELINE)
    if type(baseline.get("schema")) is not int or baseline["schema"] != 1 or baseline.get("slither_version") != "0.11.6":
        raise ValueError("Unrecognized review schema or analyzer version")
    if not isinstance(baseline.get("reports"), dict) or set(baseline["reports"]) != {"slither-extended.json", "slither-reentrancy.json", "slither-all.json"}:
        raise ValueError("The complete medium/high, full reentrancy and all-detector reports are required")
    sources = {
        str(path.relative_to(ROOT))
        for path in (ROOT / "contracts").rglob("*.sol")
        if path.relative_to(ROOT).parts[1] not in {"test", "legacy"}
    }
    sources.update({
        "foundry.toml", "package-lock.json", "scripts/security/slither-extended.config.json",
        "scripts/security/slither-reentrancy.config.json", "scripts/security/slither-all.config.json",
        "slither.config.json", "scripts/security/patch-openzeppelin-compiler.cjs",
        "scripts/security/openzeppelin-compiler-patches.json",
        "scripts/security/run-slither.sh", "scripts/security/run-slither-extended.sh",
    })
    if not isinstance(baseline.get("source_sha256"), dict) or sources != set(baseline["source_sha256"]):
        raise ValueError("The production source/configuration file set changed; repeat the review")
    changed = [name for name in sorted(sources) if sha256(ROOT / name) != baseline["source_sha256"][name]]
    if changed:
        raise ValueError("Reviewed source changed: " + ", ".join(changed))
    total = 0
    for name, expected in baseline["reports"].items():
        if not isinstance(expected, list):
            raise ValueError(f"{name}: reviewed findings must be a JSON array")
        report = load_object(output_dir / name)
        if report.get("success") is not True or report.get("error") not in (None, ""):
            raise ValueError(f"{name}: analyzer did not complete successfully")
        if not isinstance(report.get("results"), dict):
            raise ValueError(f"{name}: missing results object")
        findings = report["results"].get("detectors")
        if not isinstance(findings, list):
            raise ValueError(f"{name}: missing detector findings")
        actual = {}
        for finding in findings:
            finding_id, identity = finding_identity(finding)
            if finding_id in actual:
                raise ValueError(f"{name}: duplicate finding {finding_id}")
            actual[finding_id] = identity
        reviewed = {}
        for finding in expected:
            finding_id, identity = finding_identity(finding)
            if any(not isinstance(finding.get(key), str) or not finding[key].strip() for key in ("rationale", "evidence")):
                raise ValueError(f"{name}: finding lacks review rationale/evidence")
            if finding_id in reviewed:
                raise ValueError(f"{name}: duplicate reviewed finding")
            reviewed[finding_id] = identity
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
