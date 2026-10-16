#!/usr/bin/env python3
"""Static finite workflow invariants, using only the standard library."""
import hashlib
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/core-native-qualification.yml'


class WorkflowInvariants(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text()

    def test_read_only_permissions_and_no_sensitive_input(self):
        self.assertIn('permissions:\n  contents: read\n', self.text)
        for forbidden in ('contents: write', 'actions: write', 'secrets.', 'pull_request_target:',
                          'MAINNET_RPC_URL:', 'PRIVATE_KEY:', 'NODE_TLS_REJECT_UNAUTHORIZED:',
                          'npm install', 'workflow_call:'):
            self.assertNotIn(forbidden, self.text)

    def test_exact_existing_action_pins(self):
        pins = set(re.findall(r'uses: ([^\s]+)', self.text))
        self.assertEqual(pins, {
            'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
            'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
            'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'})

    def test_actual_distinct_source_harness_and_legacy_checkouts(self):
        self.assertEqual(self.text.count('fetch-depth: 0'), 3)
        self.assertEqual(self.text.count('persist-credentials: false'), 3)
        for root in ('source', 'legacy', 'qualifier'):
            self.assertIn('path: ' + root + '\n', self.text)
        self.assertIn('ref: c2f72180d2f0d6ecd5b92d8e5197c5344be2c699', self.text)
        self.assertIn('ref: 6484d09afbba64d7de24cd18ae4dbd246caffd17', self.text)
        self.assertIn('--expected-harness-commit "$HARNESS_COMMIT"', self.text)

    def test_locked_installs_and_separate_compile_without_export(self):
        self.assertEqual(re.findall(r'^          npm (.*)$', self.text, re.M),
                         ['--prefix source ci', '--prefix source/hardhat ci',
                          '--prefix legacy ci', '--prefix legacy/hardhat ci'])
        self.assertEqual(self.text.count('--config hardhat.config.mjs compile)'), 2)
        self.assertNotIn('npm run build', self.text)
        self.assertNotIn('export-contract-artifacts', self.text)
        self.assertIn('node-version: 22.23.2', self.text)

    def test_original_and_explicit_profiles_are_both_selected(self):
        self.assertIn('--profile legacy-v114', self.text)
        self.assertIn('--profile manager-explicit-governor-v1 --mode bound', self.text)
        self.assertIn('test-source-boundary-dispatch.py', self.text)
        self.assertNotIn('--mode staged', self.text)

    def test_exact_tooling_suite_and_no_native_subset(self):
        self.assertIn('--test-concurrency=1 hardhat/test/*.test.cjs', self.text)
        self.assertIn("{'tests': 867, 'pass': 867, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}", self.text)
        self.assertIn('run-native-campaigns.py', self.text)
        self.assertNotIn('--suite positive', self.text)
        self.assertNotIn('--suite source', self.text)

    def test_fresh_external_output_and_narrow_always_upload(self):
        self.assertIn('--output "$(realpath "$RUNNER_TEMP")/manager-c2-native-campaigns"', self.text)
        self.assertIn('if: always()', self.text)
        self.assertEqual(re.findall(r'^          path: (\$\{\{ runner.temp.*)$', self.text, re.M),
                         ['${{ runner.temp }}/manager-c2-native-campaigns/shareable/'])
        self.assertNotIn('path: /tmp', self.text)
        self.assertNotIn('path: source/', self.text)

    def test_workflow_pin_matches_complete_harness_inventory(self):
        pinfile = ROOT / 'config/native-harness-pins.json'
        self.assertTrue(pinfile.is_file(), 'Final inventory must be generated before freeze')
        pinbytes = pinfile.read_bytes()
        self.assertIn('HARNESS_PINS_SHA256: ' + hashlib.sha256(pinbytes).hexdigest(), self.text)
        pins = json.loads(pinbytes)
        self.assertEqual(pins['schema'], 'agijobmanager/native-harness-pins/v1')
        self.assertNotIn('.github/workflows/core-native-qualification.yml', pins['files'])
        self.assertNotIn('config/native-harness-pins.json', pins['files'])
        for name, digest in pins['files'].items():
            path = ROOT / name
            self.assertFalse(path.is_symlink())
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest, name)
        self.assertIn('scripts/qualification/test-native-workflow.py', pins['files'])


if __name__ == '__main__':
    unittest.main()
