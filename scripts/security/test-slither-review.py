#!/usr/bin/env python3
"""Exercise the release gate with malformed or tampered analyzer evidence."""

import contextlib
import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("review", Path(__file__).with_name("verify-slither-review.py"))
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)


class ReviewGateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="slither-gate-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.out = self.root / "reports"
        self.out.mkdir()
        names = ["contracts/Manager.sol", "foundry.toml", "package-lock.json", "scripts/security/slither-extended.config.json", "scripts/security/slither-reentrancy.config.json"]
        for name in names:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("isolated gate test fixture\n")
        self.finding = {"id": "a" * 64, "check": "reentrancy-no-eth", "impact": "Medium", "confidence": "Medium"}
        self.baseline = {
            "schema": 1, "slither_version": "0.11.6",
            "source_sha256": {name: hashlib.sha256((self.root / name).read_bytes()).hexdigest() for name in names},
            "reports": {name: [dict(self.finding, rationale="Fixture rationale", evidence="Fixture evidence")] for name in ["slither-extended.json", "slither-reentrancy.json"]},
        }
        REVIEW.ROOT = self.root
        REVIEW.BASELINE = self.root / "baseline.json"
        self.write_baseline()
        for name in self.baseline["reports"]:
            (self.out / name).write_text(json.dumps({"success": True, "error": None, "results": {"detectors": [self.finding]}}))

    def write_baseline(self):
        REVIEW.BASELINE.write_text(json.dumps(self.baseline))

    def verify(self):
        with contextlib.redirect_stdout(io.StringIO()):
            REVIEW.verify(self.out)

    def rejects(self):
        with self.assertRaises((ValueError, KeyError, OSError, TypeError)):
            self.verify()

    def test_accepts_exact_reviewed_evidence(self):
        self.verify()

    def test_rejects_report_shape_errors(self):
        path = self.out / "slither-extended.json"
        valid = path.read_text()
        for payload in [[], None, {"success": False}, {"success": 1}, {"success": True, "error": "failed"}, {"success": True, "error": []}, {"success": True, "results": []}, {"success": True, "results": {"detectors": None}}]:
            with self.subTest(payload=payload):
                path.write_text(json.dumps(payload))
                self.rejects()
                path.write_text(valid)

    def test_rejects_ambiguous_json_and_nonstandard_numbers(self):
        path = self.out / "slither-extended.json"
        valid = path.read_text()
        for payload in [valid.replace('"success": true', '"success": false, "success": true'), valid.replace('"error": null', '"error": "failed", "error": null'), valid.replace('"error": null', '"error": NaN')]:
            with self.subTest(payload=payload):
                path.write_text(payload)
                self.rejects()
                path.write_text(valid)

    def test_rejects_changed_findings(self):
        path = self.out / "slither-extended.json"
        report = json.loads(path.read_text())
        cases = [[], [self.finding, self.finding], [dict(self.finding, id="b" * 64)], [dict(self.finding, impact="Low")], [dict(self.finding, confidence="High")], [dict(self.finding, id=None)], [None]]
        for findings in cases:
            with self.subTest(findings=findings):
                report["results"]["detectors"] = findings
                path.write_text(json.dumps(report))
                self.rejects()

    def test_rejects_source_and_dependency_drift(self):
        for name in ["contracts/Manager.sol", "package-lock.json", "foundry.toml"]:
            with self.subTest(name=name):
                path = self.root / name
                original = path.read_text()
                path.write_text(original + "changed")
                self.rejects()
                path.write_text(original)

    def test_rejects_added_production_source(self):
        (self.root / "contracts/latest.sol").write_text("new production source")
        self.rejects()

    def test_rejects_unreviewed_baseline_structure(self):
        for key, value in [("schema", True), ("slither_version", "0.10.4"), ("reports", {})]:
            with self.subTest(key=key):
                original = self.baseline[key]
                self.baseline[key] = value
                self.write_baseline()
                self.rejects()
                self.baseline[key] = original
        self.write_baseline()

    def test_rejects_nontext_review_rationale(self):
        self.baseline["reports"]["slither-extended.json"][0]["rationale"] = ["not a documented rationale"]
        self.write_baseline()
        self.rejects()

    def test_rejects_missing_report(self):
        (self.out / "slither-reentrancy.json").unlink()
        self.rejects()


if __name__ == "__main__":
    unittest.main()
