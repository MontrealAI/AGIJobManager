#!/usr/bin/env python3
"""Static finite workflow invariants, using only the standard library."""
import hashlib
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/core-native-qualification.yml'


DEPENDENCY_STEPS = [
    'Install only the existing exact source and historical locks',
    'Check original legacy policy without changing its semantics',
    'Bind actual d371 to the separately reviewed finite source policy',
    'Check routing, evidence wrapper and retained fork provenance adversarial cases',
    'Compile the exact new and authentic historical constructors separately',
    'Prove the exact hosted compiler containers after separate compilation',
    'Run the original named-root nine-CREATE regression',
    'Run the genuine source tooling suite and unchanged dependency parity groups',
    'Run complete full96 in its own guarded invocation',
    'Run complete marker30 independently after fresh safety gates',
    'Require both complete guarded campaign outcomes',
]


def require_dependency_order(text):
    names = re.findall(r'^      - name: (.*)$', text, re.M)
    if any(names.count(name) != 1 for name in DEPENDENCY_STEPS):
        raise ValueError('Every required producer and consumer must appear exactly once')
    positions = [names.index(name) for name in DEPENDENCY_STEPS]
    if positions != sorted(positions):
        raise ValueError('Source binding and exact compilation must precede artifact consumers')


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
        self.assertIn('ref: d371d95cfcc44b9133cda4bba55304f727917f18', self.text)
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

    def test_compilation_precedes_artifact_consumers(self):
        require_dependency_order(self.text)

    def test_old_compile_after_tooling_order_is_rejected(self):
        start = self.text.index('      - name: Compile the exact new and authentic historical constructors separately\n')
        end = self.text.index('      - name: ', start + 1)
        compile_step = self.text[start:end]
        reordered = self.text[:start] + self.text[end:]
        index = reordered.index('      - name: Run complete full96')
        reordered = reordered[:index] + compile_step + reordered[index:]
        with self.assertRaisesRegex(ValueError, 'precede artifact consumers'):
            require_dependency_order(reordered)

    def test_exact_container_profile_is_explicit_and_proved_after_compilation(self):
        self.assertIn('--container-profile github-ubuntu-source-legacy-v1', self.text)
        self.assertIn('test-prove-container-profile.mjs --profile-file', self.text)
        self.assertIn('prove-container-profile.mjs --profile-file', self.text)
        self.assertIn('--profile hosted --source-root', self.text)
        require_dependency_order(self.text)

    def test_original_and_explicit_profiles_are_both_selected(self):
        self.assertIn('--profile legacy-v114', self.text)
        self.assertIn('--profile manager-explicit-governor-v1 --mode bound', self.text)
        self.assertIn('test-source-boundary-dispatch.py', self.text)
        self.assertNotIn('--mode staged', self.text)

    def test_external_marker_helper_selects_checkout_dependency_without_scratch_fallback(self):
        self.assertIn('MANAGER_QUALIFICATION_SOURCE_ROOT="$(realpath source)" node', self.text)
        test = (ROOT / 'runners/marker/hardhat/test/marker-native-evidence.test.cjs').read_text()
        self.assertIn('process.env.MANAGER_QUALIFICATION_SOURCE_ROOT', test)
        self.assertIn('fs.realpathSync(sourceRoot)', test)
        self.assertIn("createRequire(path.join(sourceRoot, 'package.json'))", test)
        self.assertNotIn('/tmp/manager-', test)

    def test_original_c2_expectations_and_provenance_remain_exact(self):
        original = ROOT / 'config/expected-campaigns.json'
        self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), '046aed913f8a729fc012ce5ee606d7d335c3dd57dc7d81a249752d89fd764772')
        self.assertEqual(hashlib.sha256((ROOT / 'config/c2-fork-provenance.json').read_bytes()).hexdigest(), '309cfe866cb55a476cac7cb40143203c51c0b40f4bbe2f3b1485adc3455a2d0a')
        self.assertEqual(hashlib.sha256((ROOT / 'config/reviewed-c2-target.json').read_bytes()).hexdigest(), 'd56bcfd0a47c83f220a81ebd4de3b3e18b5c4952ecc10024a889b1e64f99999a')
        self.assertEqual(hashlib.sha256((ROOT / 'config/c2-source-review-binding.json').read_bytes()).hexdigest(), 'dd3c4500be119cd8802d24486ad4ea3073fb1fe7e7e1977bcd6762a6ab76fa2a')

    def test_all_native_creations_use_four_original_named_roots(self):
        expression = "rootNodes: ['club.agi.eth', 'agent.agi.eth', 'alpha.club.agi.eth', 'alpha.agent.agi.eth'].map(E.namehash)"
        for suite in ('full', 'marker'):
            script = (ROOT / 'runners' / suite / 'scripts/qualification/core-session-native.mjs').read_text()
            self.assertIn(expression, script)
            self.assertNotIn('rootNodes: Array(4).fill(E.ZeroHash)', script)
        self.assertIn("--grep 'four distinct ENS roots'", self.text)
        self.assertIn('--config hardhat.core-session.config.mjs test mocha --no-compile', self.text)

    def test_exact_tooling_suite_and_no_native_subset(self):
        self.assertIn('--test-concurrency=1 hardhat/test/*.test.cjs', self.text)
        self.assertIn("{'tests': 867, 'pass': 867, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}", self.text)
        self.assertIn('run-native-campaigns.py', self.text)
        self.assertNotIn('--suite positive', self.text)
        self.assertNotIn('--suite source', self.text)

    def test_fresh_external_output_and_narrow_always_upload(self):
        for suite in ('full', 'marker'):
            self.assertIn('--output "$(realpath "$RUNNER_TEMP")/manager-d371-native-' + suite + '"', self.text)
        self.assertIn('if: always()', self.text)
        self.assertEqual(re.findall(r'^            (\$\{\{ runner.temp.*)$', self.text, re.M),
                         ['${{ runner.temp }}/manager-d371-native-full/shareable/',
                          '${{ runner.temp }}/manager-d371-native-marker/shareable/'])
        self.assertNotIn('path: /tmp', self.text)
        self.assertNotIn('path: source/', self.text)

    def test_separate_complete_campaigns_cannot_hide_either_failure(self):
        self.assertEqual(self.text.count('--suite full'), 1)
        self.assertEqual(self.text.count('--suite marker'), 1)
        self.assertEqual(self.text.count('continue-on-error: true'), 2)
        self.assertIn("if: ${{ !cancelled() && (steps.full_campaign.outcome == 'success' || steps.full_campaign.outcome == 'failure') }}", self.text)
        self.assertIn('test "$FULL_OUTCOME" = success', self.text)
        self.assertIn('test "$MARKER_OUTCOME" = success', self.text)
        self.assertEqual(self.text.count('--expected-harness-commit "$HARNESS_COMMIT"'), 2)
        self.assertEqual(self.text.count('--container-profile github-ubuntu-source-legacy-v1'), 2)
        self.assertIn('node --max-old-space-size=256 --test qualifier/scripts/qualification/test-fixture-copy.mjs', self.text)
        require_dependency_order(self.text)

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
