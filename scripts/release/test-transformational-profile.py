"""Adversarial finite-transformation policy tests; fixtures do not qualify a release."""
import copy
import json
import pathlib
import runpy
import tempfile
import unittest
from unittest.mock import patch
from release_common import sha

ROOT = pathlib.Path(__file__).resolve().parents[2]
P = runpy.run_path(str(ROOT / 'scripts/release/transformational-profile.py'))
D = runpy.run_path(str(ROOT / 'scripts/release/package-policy.py'))


class TransformationalProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='manager-transformational-profile-')
        cls.root = pathlib.Path(cls.tmp.name)
        cls.options = dict(profile=P['PROFILE'], manifest=P['MANIFEST'],
            manifest_sha256=sha((ROOT / P['MANIFEST']).read_bytes()),
            verifier_sha256=sha((ROOT / P['VERIFIER']).read_bytes()))
        cls.selection = P['select'](**cls.options)
        cls.inventory, _ = P['inventory'](ROOT, cls.selection)
        for name, item in cls.inventory.items():
            mode, data = P['read'](ROOT, name)
            target = cls.root / name; target.parent.mkdir(parents=True, exist_ok=True)
            if mode == '120000': target.symlink_to('../contracts')
            else:
                target.write_bytes(data); target.chmod(0o755 if mode == '100755' else 0o644)
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def verify(self, selection=None): return P['validate_source'](self.root, selection or self.selection)
    def rejects(self, selection=None):
        with self.assertRaises((ValueError, FileNotFoundError)): self.verify(selection)
    def mutate(self, name, data, check):
        path = self.root / name; old = path.read_bytes()
        try: path.write_bytes(data); check()
        finally: path.write_bytes(old)
    def repin(self, name, raw):
        manifest = json.loads((self.root / P['MANIFEST']).read_bytes())
        before = manifest['changes'].get(name, {}).get('before', self.inventory.get(name))
        manifest['changes'][name] = {'before': before, 'after': {'mode': '100644', 'sha256': sha(raw)}, 'reason': 'Adversarial supplied repin'}
        data = (json.dumps(manifest, indent=2) + '\n').encode()
        self.mutate(P['MANIFEST'], data, lambda: self.rejects({**self.selection, 'manifestSha256': sha(data)}))
    def test_exact_closure_only_proves_pending_identity(self):
        with patch('subprocess.check_output', side_effect=AssertionError('Offline validation must not execute Git')):
            result = self.verify()
        self.assertEqual(result['qualification'], 'PENDING_FINAL_SOURCE_MAIN_PUSH')
        self.assertNotIn('releaseQualified', result)
        self.assertEqual(D['policy'](self.selection)['PROFILE'], P['PROFILE'])
    def test_every_external_pin_is_required(self):
        for key in ('manifest', 'manifest_sha256', 'verifier_sha256'):
            options = dict(self.options); options.pop(key)
            with self.subTest(key=key), self.assertRaises(ValueError): P['select'](**options)
    def test_wrong_external_pins_are_rejected(self):
        for key in ('manifestSha256', 'verifierSha256'):
            self.rejects({**self.selection, key: '0' * 64})
    def test_contract_compiler_and_previous_history_cannot_be_repinned(self):
        for name in ('contracts/AGIJobManager.sol', 'hardhat/compiler-optimizer.cjs',
                'scripts/release/release-profile.py', 'config/explicit-governor-release-v1.json',
                'scripts/release/release_common.py', 'scripts/release/correction-profile.py',
                'config/manager-boundary-corrections-v1.json', 'scripts/release/test-correction-profile.py',
                'scripts/release/publication-authorization.py', 'scripts/release/test-publication-authorization.py',
                'scripts/release/pages-publication.py', 'scripts/release/test-pages-publication.py',
                'docs/releases/v1.19.4/RELEASE_NOTES.md',
                'config/mainnet/manager-8815-2026-10-17.json'):
            raw = (self.root / name).read_bytes() + b'\n'
            with self.subTest(name=name): self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_unchanged_runtime_verifiers_workflows_and_ui_cannot_be_repinned(self):
        # These were broad exceptions for the preceding release, but this
        # correction does not change them. Updating a supplied checksum is not
        # permission to change their reviewed predecessor bytes.
        names = ('.github/workflows/security-verification.yml',
            'scripts/release/package-release.py', 'scripts/release/release_common.py',
            'scripts/site/build.mjs', 'scripts/site/check.mjs',
            'scripts/site/browser-test.mjs', 'scripts/site/deployments.test.mjs',
            'site/deployments.mjs', 'site/template.mjs', 'site/workflows.mjs',
            'ui/scripts/sync-deployments.mjs', 'ui/src/app/deployment/page.tsx')
        for name in names:
            self.assertNotIn(name, P['ALLOWED'])
            raw = (self.root / name).read_bytes() + b'\n/* adversarial unchanged-path mutation */\n'
            with self.subTest(name=name): self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_all_reviewed_corrections_are_required(self):
        manifest = json.loads((self.root / P['MANIFEST']).read_bytes())
        self.assertEqual(set(manifest['changes']), P['ALLOWED'])
        del manifest['changes']['scripts/integrations/transformational-native-test.mjs']
        raw = (json.dumps(manifest, indent=2) + '\n').encode()
        self.mutate(P['MANIFEST'], raw, lambda: self.rejects({**self.selection, 'manifestSha256': sha(raw)}))
    def test_wrong_predecessor_and_fabricated_qualification_are_rejected(self):
        original = json.loads((self.root / P['MANIFEST']).read_bytes())
        for mutate in (lambda value: value.update(qualification='PASSED'),
                lambda value: value['changes']['package.json'].update(before=None),
                lambda value: value.update(baseCommit='0' * 40)):
            value = copy.deepcopy(original); mutate(value); raw = (json.dumps(value, indent=2) + '\n').encode()
            self.mutate(P['MANIFEST'], raw, lambda: self.rejects({**self.selection, 'manifestSha256': sha(raw)}))
    def test_version_repins_cannot_change_dependencies_or_default_transaction_targets(self):
        for name in ('package.json', 'hardhat/package-lock.json', 'config/usdc-deployment.json'):
            value = json.loads((self.root / name).read_bytes())
            if name == 'package.json': value['dependencies']['@openzeppelin/contracts'] = '4.9.5'
            elif name.endswith('package-lock.json'): value['packages']['node_modules/ethers']['version'] = '0.0.0'
            else: value['managerAddress'] = '0x1111111111111111111111111111111111111111'
            raw = (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()
            self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_advanced_console_runtime_cannot_be_repinned(self):
        for name in sorted(P['UI_LABEL_ONLY']):
            raw = (self.root / name).read_bytes() + b'\nwindow.ethereum.request({method:"eth_requestAccounts"});\n'
            with self.subTest(name=name): self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_changed_source_bytes_missing_inputs_and_extra_inputs_are_rejected(self):
        for name in ('scripts/integrations/transformational-native-test.mjs', 'site/assets/successor/jobs.mjs'):
            self.mutate(name, (self.root / name).read_bytes() + b'\n', self.rejects)
        path = self.root / 'extra.js'
        try: path.write_text('unexpected'); self.rejects()
        finally: path.unlink()
    def test_rehashed_workflow_or_security_changes_cannot_remove_old_gates(self):
        mutations = {
            '.github/workflows/current-state-release.yml': ('npm run build', 'true'),
            '.github/workflows/alpha-project-handoff.yml': ('7283b4d4d2a51ff674e6078f5940691900aae5a1', '0' * 40),
            '.github/workflows/pages.yml': ('npm run successor:browser', 'true'),
            '.github/workflows/mainnet-fork.yml': ('npm run test:cutover', 'true'),
            '.github/workflows/publish-v114.yml': ('--deny-self-hosted-runners', ''),
            'scripts/security/verify-slither-review.py': ('if changed:', 'if False:'),
            'scripts/release/pages-publication-ti.py': ('--deny-self-hosted-runners', ''),
        }
        for name, (before, after) in mutations.items():
            original = (self.root / name).read_bytes()
            self.assertIn(before.encode(), original)
            raw = original.replace(before.encode(), after.encode())
            with self.subTest(name=name): self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_rehashed_native_pin_does_not_select_a_different_contract(self):
        name = 'config/transformational-alpha-source.json'
        value = json.loads((self.root / name).read_bytes()); value['commit'] = '0' * 40
        raw = (json.dumps(value, indent=2) + '\n').encode()
        self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_comparison_hash_repins_cannot_change_observations_findings_or_approval(self):
        cases = {
            'docs/qualification/mainnet-cutover-v1.19.5-expected.json': lambda value: value.update(productionActivationApproved=True),
            'scripts/security/slither-reviewed-findings-v1.19.5.json': lambda value: value.update(reports={}),
            'docs/qualification/release-v1.19.5-provenance.json': lambda value: value.update(executed=True),
        }
        for name, mutate in cases.items():
            value = json.loads((self.root / name).read_bytes()); mutate(value)
            raw = (json.dumps(value, indent=2) + '\n').encode()
            with self.subTest(name=name): self.mutate(name, raw, lambda: self.repin(name, raw))
    def test_historical_candidate_remains_nonpublishing(self):
        candidate = D['CANDIDATE']
        with self.assertRaises(ValueError): D['select'](candidate['PROFILE'], manifest=candidate['MANIFEST'], manifest_sha256='a'*64, verifier_sha256='b'*64, schema_sha256='c'*64, published=True)


if __name__ == '__main__': unittest.main()
