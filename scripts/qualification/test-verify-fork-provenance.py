#!/usr/bin/env python3
"""Lightweight receipt checks; no native campaign, provider or fork execution."""
import argparse
import copy
import hashlib
import json
import pathlib
import runpy
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
M = runpy.run_path(str(ROOT / 'scripts/qualification/verify-fork-provenance.py'))
H = runpy.run_path(str(ROOT / 'scripts/qualification/select-source-profile.py'))
SOURCE = None


class ForkProvenance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.receipt_bytes = (ROOT / M['RECEIPT']).read_bytes()
        cls.receipt = H['strict_json'](cls.receipt_bytes)
        cls.report = H['source_file'](SOURCE, M['REPORT'])

    def test_01_exact_receipt_and_selector_pins(self):
        self.assertEqual(M['sha'](self.receipt_bytes), M['RECEIPT_SHA256'])
        self.assertEqual(M['sha']((ROOT / 'scripts/qualification/select-source-profile.py').read_bytes()),
                         M['SELECTOR_SHA256'])

    def test_02_retained_source_bytes_positive_without_claiming_actual_checkout(self):
        result = M['validate_record'](self.receipt, self.report, SOURCE, H)
        self.assertEqual(result['sourceEntriesVerified'], 76)
        self.assertFalse(result['newForkExecutedByThisCommand'])
        for key in ('acceptanceComplete', 'nativeCLIQualified', 'activationAuthorized'):
            self.assertIs(result[key], False)

    def test_03_exact_execution_and_scope_fields(self):
        for key, bad in {'sourceCommit': '0' * 40, 'sourceTree': '0' * 40,
                         'parents': list(reversed(M['PARENTS'])), 'workflowRun': 0,
                         'workflowJob': 0, 'artifactId': 0, 'workflowConclusion': 'success',
                         'failedStage': None, 'executedCases': {'cutoverCompatibility': 23},
                         'status': 'QUALIFIED', 'reportSha256': '0' * 64,
                         'immutableIdenticalHistoricalReport': 'other',
                         'publicTransactionsBroadcast': 1, 'fixtureWallets': False,
                         'newSourceRunDoesNotRewriteOldReport': False,
                         'identicalReportDoesNotRelabelHistoricalRun': False}.items():
            with self.subTest(key=key):
                changed = copy.deepcopy(self.receipt); changed[key] = bad
                with self.assertRaises(ValueError):
                    M['validate_record'](changed, self.report, SOURCE, H)

    def test_04_operational_claim_elevation(self):
        for key in ('productionActivationApproved', 'independentGovernorOrNativeSignerAcceptanceEstablished',
                    'nativeCLIQualified', 'acceptanceComplete'):
            for value in (True, 0, None):
                with self.subTest(key=key, value=value):
                    changed = copy.deepcopy(self.receipt); changed[key] = value
                    with self.assertRaises(ValueError):
                        M['validate_record'](changed, self.report, SOURCE, H)

    def test_05_missing_extra_and_mutated_inventory(self):
        for mutation in ('missing', 'extra', 'changed'):
            changed = copy.deepcopy(self.receipt)
            if mutation == 'missing': changed['sourceSha256'].pop(next(iter(changed['sourceSha256'])))
            if mutation == 'extra': changed['sourceSha256']['unexpected'] = '0' * 64
            if mutation == 'changed': changed['sourceSha256'][next(iter(changed['sourceSha256']))] = '0' * 64
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                M['validate_record'](changed, self.report, SOURCE, H)

    def test_06_report_observation_changed(self):
        changed = json.loads(self.report); changed['passed'] = False
        with self.assertRaises(ValueError):
            M['validate_record'](self.receipt, json.dumps(changed).encode(), SOURCE, H)

    def test_07_source_byte_drift(self):
        helpers = dict(H); original = helpers['source_file']
        helpers['source_file'] = lambda root, name: original(root, name) + b'\n'
        with self.assertRaisesRegex(ValueError, 'Observed compatibility source differs'):
            M['validate_record'](self.receipt, self.report, SOURCE, helpers)

    def test_08_unknown_and_legacy_profiles_cannot_be_reclassified(self):
        for profile in ('auto', 'legacy-v114'):
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/qualification/verify-fork-provenance.py'),
                '--profile', profile, '--source-root', str(SOURCE)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn(b'PROVENANCE_VERIFIED', result.stdout)

    def test_09_every_receipt_byte_change_breaks_review_pin(self):
        self.assertNotEqual(M['sha'](self.receipt_bytes + b'\n'), M['RECEIPT_SHA256'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument('--source-root', required=True)
    args, rest = parser.parse_known_args()
    SOURCE = H['exact_path'](args.source_root, directory=True)
    unittest.main(argv=[sys.argv[0], *rest])
