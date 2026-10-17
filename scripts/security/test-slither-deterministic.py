#!/usr/bin/env python3
"""Regress Slither's explicit-selection order without compiling Solidity."""

import importlib.util
import contextlib
import io
from itertools import permutations
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("deterministic_slither", Path(__file__).with_name("run-slither-deterministic.py"))
WRAPPER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WRAPPER)


def detector(name, impact):
    return type(name, (), {"ARGUMENT": name, "IMPACT": impact})


class DeterministicDetectorTests(unittest.TestCase):
    def setUp(self):
        self.balance = detector("reentrancy-balance", 0)
        self.medium = detector("reentrancy-no-eth", 1)
        self.benign = detector("reentrancy-benign", 2)
        self.events = detector("reentrancy-events", 2)
        self.unselected = detector("timestamp", 2)
        self.available = [self.events, self.balance, self.unselected, self.medium, self.benign]

    def test_adversarial_upstream_order_runs_balance_first_without_changing_selection(self):
        args = SimpleNamespace(detectors_to_run="reentrancy-events,reentrancy-balance,reentrancy-no-eth")
        selected = [self.events, self.medium, self.balance]
        calls = []

        def original(original_args, available):
            calls.append((original_args, available))
            return selected

        cli = SimpleNamespace(choose_detectors=original)
        WRAPPER.install(cli, "0.11.6")
        ordered = cli.choose_detectors(args, self.available)
        self.assertEqual(ordered, [self.balance, self.medium, self.events])
        self.assertEqual(set(ordered), set(selected))
        self.assertEqual(selected, [self.events, self.medium, self.balance])
        self.assertEqual(calls, [(args, self.available)])
        self.assertNotIn(self.unselected, ordered)

    def test_same_severity_order_is_stable_for_every_upstream_permutation(self):
        for selected in permutations([self.events, self.balance, self.benign]):
            with self.subTest(order=[item.ARGUMENT for item in selected]):
                ordered = WRAPPER.ordered_selection(selected, self.available)
                self.assertEqual(ordered, [self.balance, self.benign, self.events])

    def test_empty_and_set_selections_preserve_membership(self):
        self.assertEqual(WRAPPER.ordered_selection([], self.available), [])
        self.assertEqual(WRAPPER.ordered_selection({self.events, self.balance}, self.available), [self.balance, self.events])

    def test_duplicate_classes_and_detector_arguments_fail_closed(self):
        duplicate_name = detector("reentrancy-balance", 0)
        for selected, available in [([self.balance, self.balance], self.available), ([self.balance, duplicate_name], self.available + [duplicate_name])]:
            with self.subTest(selected=selected), self.assertRaisesRegex(ValueError, "duplicate"):
                WRAPPER.ordered_selection(selected, available)

    def test_malformed_or_unknown_selection_fails_closed(self):
        malformed = [detector("Bad Name", 0), detector("invalid-impact", 99), detector("boolean-impact", True), object()]
        for selected in [None, {}, [self.unselected]]:
            with self.subTest(selected=selected), self.assertRaises(ValueError):
                WRAPPER.ordered_selection(selected, [self.balance])
        for item in malformed:
            with self.subTest(detector=item), self.assertRaises(ValueError):
                WRAPPER.ordered_selection([item], [item])

    def test_version_mismatch_does_not_modify_upstream(self):
        original = lambda args, available: available
        cli = SimpleNamespace(choose_detectors=original)
        with self.assertRaisesRegex(ValueError, "requires Slither 0.11.6"):
            WRAPPER.install(cli, "0.11.7")
        self.assertIs(cli.choose_detectors, original)

    def test_main_rejects_unpinned_version_before_importing_analyzer(self):
        with patch.object(WRAPPER.metadata, "version", return_value="0.11.7"), patch.object(WRAPPER.importlib, "import_module") as load:
            with self.assertRaisesRegex(ValueError, "requires Slither 0.11.6"):
                WRAPPER.main()
            load.assert_not_called()

    def test_main_preserves_upstream_arguments_output_and_return(self):
        cli = SimpleNamespace(choose_detectors=lambda args, available: [self.events, self.balance])
        calls = []

        def upstream_main():
            calls.append((list(sys.argv), cli.choose_detectors(None, self.available)))
            print("upstream analyzer output")
            print("upstream analyzer diagnostic", file=sys.stderr)
            return 42

        cli.main = upstream_main
        arguments = ["run-slither-deterministic.py", ".", "--detect", "reentrancy-events,reentrancy-balance", "--json", "report.json"]
        output, diagnostic = io.StringIO(), io.StringIO()
        with patch.object(WRAPPER.metadata, "version", return_value="0.11.6"), patch.object(WRAPPER.importlib, "import_module", return_value=cli), patch.object(sys, "argv", arguments), contextlib.redirect_stdout(output), contextlib.redirect_stderr(diagnostic):
            self.assertEqual(WRAPPER.main(), 42)
        self.assertEqual(calls, [(arguments, [self.balance, self.events])])
        self.assertEqual(output.getvalue(), "upstream analyzer output\n")
        self.assertEqual(diagnostic.getvalue(), "upstream analyzer diagnostic\n")


if __name__ == "__main__":
    unittest.main()
