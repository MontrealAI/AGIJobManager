#!/usr/bin/env python3
"""Check deterministic detector ordering without requiring analyzer execution."""

import importlib.util
import itertools
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("deterministic", Path(__file__).with_name("slither-deterministic.py"))
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class DetectorOrderTests(unittest.TestCase):
    def test_every_configured_reentrancy_permutation_preserves_complete_selection(self):
        config = json.loads((ROOT / "scripts/security/slither-reentrancy.config.json").read_text())
        names = config["detectors_to_run"].split(",")
        self.assertEqual(len(names), 6)
        self.assertEqual(config["detectors_to_exclude"], [])
        high = {"reentrancy-balance", "reentrancy-eth"}
        medium = {"reentrancy-no-eth"}
        selected = [SimpleNamespace(ARGUMENT=name, IMPACT=0 if name in high else 1 if name in medium else 2) for name in names]
        expected = sorted(names, key=lambda name: (0 if name in high else 1 if name in medium else 2, name))
        for permutation in itertools.permutations(selected):
            ordered = RUNNER.ordered_detectors(permutation)
            self.assertEqual([detector.ARGUMENT for detector in ordered], expected)
            self.assertEqual({id(detector) for detector in ordered}, {id(detector) for detector in selected})
        self.assertEqual(expected[0], "reentrancy-balance")

    def test_all_detector_configurations_keep_every_detector_in_original_selection(self):
        for name in ["slither-all.config.json", "slither-extended.config.json"]:
            config = json.loads((ROOT / "scripts/security" / name).read_text())
            self.assertEqual(config["detectors_to_exclude"], [])
            self.assertNotIn("detectors_to_run", config)
        selected = [SimpleNamespace(ARGUMENT=f"detector-{index:03}", IMPACT=index % 5) for index in range(102)]
        captured = []
        cli = SimpleNamespace(choose_detectors=lambda args, classes: captured.append((args, classes)) or selected)
        RUNNER.install_order(cli)
        args, classes = object(), object()
        result = cli.choose_detectors(args, classes)
        self.assertEqual(captured, [(args, classes)])
        self.assertEqual({id(detector) for detector in result}, {id(detector) for detector in selected})
        self.assertEqual([(detector.IMPACT, detector.ARGUMENT) for detector in result], sorted((detector.IMPACT, detector.ARGUMENT) for detector in selected))
        self.assertEqual(len(result), len(selected))

    def test_rejects_unknown_analyzer_versions_before_loading_cli(self):
        for value in ["0.11.5", "0.11.7", "", "0.11.6.dev0"]:
            with self.subTest(version=value), patch.object(RUNNER, "version", return_value=value):
                with self.assertRaises(SystemExit):
                    RUNNER.require_version()
        with patch.object(RUNNER, "version", return_value="0.11.6"):
            RUNNER.require_version()


if __name__ == "__main__":
    unittest.main()
