#!/usr/bin/env python3
"""Offline candidate package regressions; synthetic fixtures never qualify a release."""
import json
import pathlib
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from release_common import BUILDER_ASSETS, LIMIT, REPOSITORY, TAG, TITLE, sha

ROOT = pathlib.Path(__file__).resolve().parents[2]
POLICY = runpy.run_path(str(pathlib.Path(__file__).with_name('candidate-profile.py')))
VERIFY = runpy.run_path(str(pathlib.Path(__file__).with_name('verify-package.py')))
PACKAGE = runpy.run_path(str(pathlib.Path(__file__).with_name('package-release.py')))
SOURCE, TREE = 'a' * 40, 'b' * 40


class CandidatePackageProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='candidate-package-profile-')
        cls.directory = pathlib.Path(cls.temp.name)
        cls.source = cls.directory / 'source'
        cls.source.mkdir()
        # Refresh only fixture digests to allow testing while the integration
        # inventory is being assembled. External pins select this synthetic
        # fixture; this does not assert source provenance or qualification.
        cls.manifest = json.loads((ROOT / POLICY['MANIFEST']).read_bytes())
        for original, retained in POLICY['HISTORICAL_RELOCATIONS'].items():
            cls.manifest['protectedHistory'][original]['retainedPath'] = retained
            cls.manifest['inputs'].setdefault(retained, {'mode': '100644', 'sha256': '',
                'predecessorGitBlob': None, 'predecessorSha256': None,
                'reviewReason': 'Synthetic exact historical fixture used only by offline package regressions.'})
        for name, item in cls.manifest['inputs'].items():
            original, target = ROOT / name, cls.source / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if item['mode'] == '120000':
                target.symlink_to('../contracts', target_is_directory=True)
                data = b'../contracts'
            else:
                data = original.read_bytes()
                target.write_bytes(data)
                target.chmod(0o755 if item['mode'] == '100755' else 0o644)
            item['sha256'] = sha(data)
        cls.manifest_path = cls.source / POLICY['MANIFEST']
        cls.manifest_path.write_text(json.dumps(cls.manifest, indent=2) + '\n')
        cls.options = {'profile': POLICY['PROFILE'], 'manifest': POLICY['MANIFEST'],
            'manifest_sha256': sha(cls.manifest_path.read_bytes()),
            'verifier_sha256': sha((cls.source / POLICY['VERIFIER']).read_bytes()),
            'schema_sha256': sha((cls.source / POLICY['SCHEMA']).read_bytes())}
        cls.selection = POLICY['select'](**cls.options)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def assert_static_source(self, selection=None):
        with patch('subprocess.run', side_effect=AssertionError('Extraction must be offline and static')), \
                patch('subprocess.check_output', side_effect=AssertionError('Extraction must not invoke Git or dependencies')):
            return POLICY['validate_source'](self.source, selection or self.selection)

    def mutate(self, name, change, check):
        target = self.source / name
        data, mode = target.read_bytes(), target.stat().st_mode
        try:
            changed = change(data)
            if changed is not None:
                target.write_bytes(changed)
            check()
        finally:
            target.write_bytes(data)
            target.chmod(mode & 0o777)

    def asset_fixture(self):
        temporary = tempfile.TemporaryDirectory(prefix='candidate-assets-')
        self.addCleanup(temporary.cleanup)
        directory = pathlib.Path(temporary.name)
        manifest = {'schemaVersion': 2, 'repository': REPOSITORY, 'tag': TAG, 'name': TITLE,
            'sourceCommit': SOURCE, 'sourceTree': TREE, 'builderSource': {}, 'stage': 'source-package',
            'qualification': '', 'archiveLimitBytes': LIMIT, 'toolchain': {}, 'exclusions': [], 'files': {}}
        manifest.update(POLICY['metadata'](self.selection))
        for name in {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html'} | BUILDER_ASSETS:
            (directory / name).write_bytes(('fixture ' + name).encode())
        self.write_assets(directory, manifest)
        return directory, manifest

    def write_assets(self, directory, manifest):
        (directory / 'RELEASE_MANIFEST.json').write_text(json.dumps(manifest) + '\n')
        (directory / 'SHA256SUMS.txt').write_text(''.join(f'{sha(target.read_bytes())}  {target.name}\n'
            for target in sorted(directory.iterdir()) if target.name != 'SHA256SUMS.txt'))

    def test_explicit_selection_requires_every_external_pin(self):
        self.assertIsNone(POLICY['select']())
        for name in ('manifest', 'manifest_sha256', 'verifier_sha256', 'schema_sha256'):
            options = dict(self.options)
            options.pop(name)
            with self.subTest(name=name), self.assertRaises(ValueError):
                POLICY['select'](**options)
        for profile in ('auto', 'manager-explicit-governor-v2', '', None):
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                POLICY['select'](**{**self.options, 'profile': profile})
        for key in ('manifest_sha256', 'verifier_sha256', 'schema_sha256'):
            for value in ('a', 'A' * 64, None, 7):
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    POLICY['select'](**{**self.options, key: value})
        with self.assertRaises(ValueError):
            POLICY['select'](**{**self.options, 'profile': POLICY['LEGACY']})

    def test_exact_archive_inventory_is_static_without_git_or_dependencies(self):
        result = self.assert_static_source()
        self.assertEqual(result['status'], 'PACKAGED_INPUT_IDENTITY_PASSED')
        self.assertFalse(result['releaseQualified'])
        self.assertEqual(result['sourceInputs'], len(self.manifest['inputs']) + 1)
        self.assertFalse((self.source / '.git').exists())
        self.assertFalse((self.source / 'node_modules').exists())

    def test_wrong_or_mutated_policy_pins_fail_before_loading_verifier(self):
        for key in ('manifestSha256', 'verifierSha256', 'schemaSha256'):
            with self.subTest(key=key), patch('runpy.run_path', side_effect=AssertionError('Unpinned code executed')):
                with self.assertRaisesRegex(ValueError, 'archived policy pin differs'):
                    self.assert_static_source({**self.selection, key: '0' * 64})

    def test_rehashed_outer_assets_cannot_change_input_bytes_or_mode(self):
        target = 'contracts/AGIJobManager.sol'
        with self.assertRaisesRegex(ValueError, 'input bytes/mode differ'):
            self.mutate(target, lambda data: data + b'\n', self.assert_static_source)
        with self.assertRaisesRegex(ValueError, 'input bytes/mode differ'):
            self.mutate(target, lambda data: (self.source / target).chmod(0o755), self.assert_static_source)

    def test_extraneous_and_missing_source_are_rejected(self):
        extra = self.source / 'scripts/release/unreviewed-source.py'
        extra.write_text('pass\n')
        try:
            with self.assertRaisesRegex(ValueError, 'missing or extraneous'):
                self.assert_static_source()
        finally:
            extra.unlink()
        target = self.source / 'contracts/AGIJobManager.sol'
        data = target.read_bytes()
        target.unlink()
        try:
            with self.assertRaisesRegex(ValueError, 'missing or extraneous'):
                self.assert_static_source()
        finally:
            target.write_bytes(data)

    def test_profile_and_claim_drift_fail_even_when_manifest_is_repinned(self):
        for key, value in [('profile', 'legacy-v114'), ('releaseIdentity', {'status': 'selected', 'version': '1.19.0'}),
                           ('claims', {**self.manifest['claims'], 'packageAndRelease': 'GO'})]:
            def changed(data):
                manifest = json.loads(data)
                manifest[key] = value
                return (json.dumps(manifest) + '\n').encode()
            def repinned():
                self.assert_static_source({**self.selection, 'manifestSha256': sha(self.manifest_path.read_bytes())})
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.mutate(POLICY['MANIFEST'], changed, repinned)

    def test_only_the_exact_original_preservation_fixture_is_historical(self):
        original = 'scripts/successor/preservation.test.mjs'
        retained = POLICY['HISTORICAL_RELOCATIONS'][original]
        self.assertNotEqual(sha((self.source / original).read_bytes()), sha((self.source / retained).read_bytes()))
        self.assert_static_source()
        with self.assertRaises(ValueError):
            self.mutate(retained, lambda data: data + b'\n', self.assert_static_source)
        target = self.source / retained
        data = target.read_bytes()
        target.unlink()
        try:
            with self.assertRaises(ValueError):
                self.assert_static_source()
        finally:
            target.write_bytes(data)
        for field, value in [('retainedPath', original), ('retainedPath', 'test/fixtures/unreviewed.txt'),
                             ('originalPath', retained), ('originalCommit', SOURCE)]:
            def changed(data):
                manifest = json.loads(data)
                manifest['protectedHistory'][original][field] = value
                return (json.dumps(manifest) + '\n').encode()
            def repinned():
                self.assert_static_source({**self.selection, 'manifestSha256': sha(self.manifest_path.read_bytes())})
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.mutate(POLICY['MANIFEST'], changed, repinned)

    def test_candidate_metadata_scope_and_policy_are_not_checksum_approvals(self):
        assets, manifest = self.asset_fixture()
        self.assertEqual(VERIFY['package_inventory'](assets, **self.options)[0], manifest)
        mutations = [('sourcePackageOnly', False), ('sourceBound', False), ('releaseQualified', True),
            ('releaseQualified', 0), ('candidateProfile', 'legacy-v114'), ('qualification', 'qualified'),
            ('releaseIdentity', {'status': 'selected', 'version': '1.19.0'}), ('stage', 'qualified'),
            ('sourceBoundaryStatus', 'CLEAN_SOURCE_BOUNDARIES_PASSED'), ('publicationAuthorized', True),
            ('sourceBoundaryPolicy', {**self.selection, 'manifestSha256': '0' * 64})]
        for key, value in mutations:
            self.write_assets(assets, {**manifest, key: value})
            with self.subTest(key=key), self.assertRaises(ValueError):
                VERIFY['package_inventory'](assets, **self.options)
        for key in POLICY['CANDIDATE_KEYS']:
            changed = dict(manifest)
            changed.pop(key)
            self.write_assets(assets, changed)
            with self.subTest(missing=key), self.assertRaises(ValueError):
                VERIFY['package_inventory'](assets, **self.options)

    def test_candidate_cannot_fall_back_or_accept_release_approval(self):
        assets, manifest = self.asset_fixture()
        with self.assertRaisesRegex(ValueError, 'requires explicit profile'):
            VERIFY['package_inventory'](assets)
        with self.assertRaisesRegex(ValueError, 'cannot accept published'):
            VERIFY['package_inventory'](assets, published=True, **self.options)
        with self.assertRaisesRegex(ValueError, 'cannot accept published'):
            VERIFY['verify_package'](assets, published=True, **self.options)
        (assets / 'QUALIFICATION.json').write_text('{"status":"qualified","publicationAuthorized":true}\n')
        self.write_assets(assets, manifest)
        with self.assertRaisesRegex(ValueError, 'Unexpected or missing assets'):
            VERIFY['package_inventory'](assets, **self.options)

    def test_published_cli_is_rejected_before_accessing_assets(self):
        command = [sys.executable, str(ROOT / 'scripts/release/verify-package.py'), '/nonexistent/candidate-assets', '--published']
        for key, value in self.options.items():
            command.extend(['--' + key.replace('_', '-'), value])
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Candidate source package cannot accept published qualification or release approval', result.stderr)
        self.assertNotIn('FileNotFoundError', result.stderr)

    def test_packaging_default_still_executes_the_unchanged_legacy_gate(self):
        def git(*args):
            return {('rev-parse', 'HEAD'): SOURCE.encode(), ('rev-parse', 'HEAD^{tree}'): TREE.encode(),
                    ('status', '--porcelain', '--untracked-files=no'): b''}[args]
        with patch.dict(PACKAGE['package'].__globals__, {'git': git}), \
                patch('subprocess.run', side_effect=RuntimeError('legacy gate stop')) as legacy:
            with self.assertRaisesRegex(RuntimeError, 'legacy gate stop'):
                PACKAGE['package'](self.directory / 'unused')
            self.assertEqual(legacy.call_args.args[0], ['python3', 'scripts/release/check-v114-boundaries.py'])

    def test_packaging_candidate_never_retries_the_legacy_gate(self):
        def git(*args):
            return {('rev-parse', 'HEAD'): SOURCE.encode(), ('rev-parse', 'HEAD^{tree}'): TREE.encode(),
                    ('status', '--porcelain', '--untracked-files=no'): b''}[args]
        with patch.dict(PACKAGE['package'].__globals__, {'git': git}), \
                patch.dict(PACKAGE['candidate_policy'], {'checkout': lambda *args: (_ for _ in ()).throw(ValueError('candidate boundary failure'))}), \
                patch('subprocess.run', side_effect=AssertionError('Legacy fallback prohibited')):
            with self.assertRaisesRegex(ValueError, 'candidate boundary failure'):
                PACKAGE['package'](self.directory / 'unused', object_store=[str(self.source)],
                    dependency_root=str(self.source), **self.options)

    def test_checkout_binding_requires_exact_source_and_nonqualified_scope(self):
        result = {'profile': POLICY['PROFILE'], 'mode': 'checkout', 'status': 'CHECKED_OUT_INPUT_BOUNDARIES_PASSED',
            'manifestSha256': self.selection['manifestSha256'], 'sourceCommit': SOURCE,
            'sourceTree': TREE, 'releaseQualified': False, 'externalReviewBound': False}
        def check(value):
            with patch('subprocess.check_output', return_value=json.dumps(value).encode()) as command:
                observed = POLICY['checkout'](self.source, self.selection, [str(self.source)], str(self.source), SOURCE, TREE)
                arguments = command.call_args.args[0]
                self.assertEqual(arguments[arguments.index('--mode') + 1], 'checkout')
                self.assertIn('--object-store', arguments)
                self.assertIn('--dependency-root', arguments)
                return observed
        self.assertEqual(check(result), result)
        for key, value in [('sourceCommit', 'c' * 40), ('sourceTree', 'd' * 40), ('releaseQualified', True),
                           ('externalReviewBound', True), ('mode', 'bound'), ('status', 'CLEAN_SOURCE_BOUNDARIES_PASSED'),
                           ('manifestSha256', '0' * 64), ('profile', 'legacy-v114')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                check({**result, key: value})
        for stores, dependencies in [(None, str(self.source)), ([str(self.source)], None), (['relative'], str(self.source))]:
            with self.subTest(stores=stores, dependencies=dependencies), self.assertRaises(ValueError):
                POLICY['checkout'](self.source, self.selection, stores, dependencies, SOURCE, TREE)


if __name__ == '__main__':
    unittest.main()
