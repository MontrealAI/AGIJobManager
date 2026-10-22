"""Adversarial source and installed-closure checks, never hosted qualification."""
import copy
import hashlib
import json
import os
import pathlib
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
P = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))
G = P['validate_source'].__globals__
sha = P['sha']


class DiscoveryReleaseSource(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.selection = P['select'](manifest=P['MANIFEST'],
            manifest_sha256=sha((ROOT / P['MANIFEST']).read_bytes()),
            verifier_sha256=sha((ROOT / P['VERIFIER']).read_bytes()))
        cls.expected, cls.previous = P['inventory'](ROOT, cls.selection)

    def verify(self, *, selection=None, paths=None):
        return P['validate_source'](ROOT, selection or self.selection,
            paths=set(self.expected) if paths is None else paths)

    def substitute(self, name, raw, callback, *, repin=False, mode=None):
        read = G['read']
        def changed(root, candidate, **options):
            current_mode, current = read(root, candidate, **options)
            return (mode or current_mode, raw) if candidate == name else (current_mode, current)
        selection = {**self.selection, 'manifestSha256': sha(raw)} if repin else self.selection
        with patch.dict(G, {'read': changed}):
            callback(selection)

    def rejection(self, selection):
        with self.assertRaises((ValueError, FileNotFoundError)):
            self.verify(selection=selection)

    def change_manifest(self, change):
        manifest = json.loads((ROOT / P['MANIFEST']).read_bytes())
        change(manifest)
        self.substitute(P['MANIFEST'], (json.dumps(manifest) + '\n').encode(), self.rejection, repin=True)

    def test_exact_source_identity_has_no_execution_publication_or_release_approval(self):
        with patch('subprocess.check_output', side_effect=AssertionError('Byte identity must remain offline')):
            result = self.verify()
        for field in ('releaseQualified', 'publicationApproved', 'executionApproved', 'nativeExecutionQualified'):
            self.assertIs(result[field], False)
        self.assertEqual(result['version'], '1.20.0')

    def test_published_v1196_baseline_is_independently_reconstructed(self):
        self.assertEqual(P['tree_digest'](self.previous['entries']), P['BASE_TREE'])
        self.assertEqual(self.previous['commit'], '900bb4b46cb7de7f6f69f553a5687866f978a413')

    def test_selection_requires_exact_externally_reviewed_pins(self):
        for name in ('manifestSha256', 'verifierSha256'):
            self.rejection({**self.selection, name: 'a' * 64})
        for option in ({'published': 1}, {'schema_sha256': 'a' * 64}, {'manifest': 'other.json'}):
            with self.assertRaises(ValueError):
                P['select'](**{'manifest': P['MANIFEST'], 'manifest_sha256': 'a' * 64,
                    'verifier_sha256': 'b' * 64, **option})

    def test_published_selection_only_selects_source_policy_without_self_approval(self):
        selected = P['select'](manifest=P['MANIFEST'], published=True,
            manifest_sha256=self.selection['manifestSha256'], verifier_sha256=self.selection['verifierSha256'])
        self.assertEqual(selected, self.selection)
        self.assertNotIn('releaseQualified', selected)
        self.assertNotIn('publicationApproved', selected)

    def test_missing_or_rogue_inventory_input_is_rejected(self):
        for paths in (set(self.expected) - {next(iter(self.expected))}, set(self.expected) | {'unreviewed-runtime.mjs'}):
            with self.assertRaises(ValueError):
                self.verify(paths=paths)

    def test_manifest_repin_cannot_expand_shrink_or_rewrite_the_frozen_delta(self):
        self.change_manifest(lambda value: value['changes'].pop(next(iter(value['changes']))))
        self.change_manifest(lambda value: value['changes'].update({'new-unreviewed.mjs': {'before': None, 'after': {'mode': '100644', 'sha256': 'a' * 64}, 'reason': 'unreviewed'}}))
        first = next(iter(P['ADDITIONS']))
        self.change_manifest(lambda value: value['changes'][first]['after'].update({'sha256': 'f' * 64}))

    def test_manifest_repin_cannot_promote_qualification_or_change_version_baseline(self):
        for name, value in (('qualification', 'QUALIFIED'), ('version', '9.9.9'), ('baseTree', 'a' * 40), ('repository', 'other/repository'), ('publicationApproved', True)):
            self.change_manifest(lambda manifest, name=name, value=value: manifest.update({name: value}))

    def test_frozen_existing_bytes_and_executable_modes_are_mandatory(self):
        name = 'scripts/integrations/discovery-lab-work-request.mjs'
        raw = (ROOT / name).read_bytes()
        self.substitute(name, raw + b'\n', self.rejection)
        self.substitute(name, raw, self.rejection, mode='100755')

    def test_altered_baseline_or_semantically_reframed_baseline_requires_review(self):
        raw = (ROOT / P['BASELINE']).read_bytes()
        for value in (raw + b'\n', (json.dumps(json.loads(raw), indent=1) + '\n').encode()):
            self.substitute(P['BASELINE'], value, self.rejection)

    def test_repin_cannot_change_an_old_maintenance_guard_or_source_candidate(self):
        for name in P['PROTECTED']:
            self.substitute(name, P['read'](ROOT, name)[1] + b'\n', self.rejection)
        name = next(iter(P['PROTECTED']))
        self.change_manifest(lambda value: value['changes'].update({name: {'before': self.previous['entries'].get(name), 'after': {'mode': '100644', 'sha256': 'a' * 64}, 'reason': 'attempted gate change'}}))

    def test_exact_reverse_projections_restore_every_shared_published_input(self):
        P['validate_projections'](ROOT, self.previous)
        name = 'scripts/release/package-policy.py'
        raw = (ROOT / name).read_bytes() + b'\n'
        altered = json.loads((ROOT / P['MANIFEST']).read_bytes())
        altered['changes'][name]['after']['sha256'] = sha(raw)
        def outer(selection):
            self.substitute(name, raw, lambda ignored: self.rejection(selection))
        self.substitute(P['MANIFEST'], (json.dumps(altered) + '\n').encode(), outer, repin=True)

    def test_source_package_metadata_refuses_forged_qualification_and_other_identity(self):
        value = {key: None for key in ('schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files')}
        value.update({'schemaVersion': 2, 'repository': P['REPOSITORY'], 'tag': 'v1.20.0', 'name': P['TITLE'], 'sourceCommit': '1' * 40, 'sourceTree': '2' * 40, 'stage': 'source-package', **P['metadata'](self.selection)})
        P['validate_metadata'](value, self.selection)
        for name, change in (('tag', 'v1.19.6'), ('name', 'Approved deployment'), ('releaseQualified', True), ('executionApproved', True)):
            with self.assertRaises(ValueError):
                P['validate_metadata']({**value, name: change}, self.selection)


class SourcePrimitives(unittest.TestCase):
    def test_checkout_gc_metadata_only_allows_one_literal_zero_before_any_git(self):
        with tempfile.TemporaryDirectory(prefix='discovery-inert-gc-') as folder:
            root = pathlib.Path(folder); (root / '.git').mkdir()
            config = root / '.git/config'
            config.write_text('[core]\n bare = false\n[gc]\n auto = 0 # disabled by checkout\n')
            P['audit_git_main_config'](root)
            for raw in ['[gc]\n auto\n', '[gc]\n auto = 1\n', '[gc]\n auto = "0"\n',
                    '[gc]\n auto = 0\n auto = 1\n', '[gc]\n auto = 0\n auto = 0\n',
                    '[gc "inert"]\n auto = 0\n', '[gc]\n other = 0\n']:
                config.write_text(raw)
                command = unittest.mock.Mock(side_effect=AssertionError('No Git before raw metadata audit'))
                with self.subTest(raw=raw), patch.dict(G, {'git': command}), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    P['authenticate_git_root'](root)
                command.assert_not_called()

    def test_raw_main_redirection_and_namespaces_refuse_before_any_git(self):
        variants = ['[include]\n path = /inert/unavailable/config\n',
            '[filter "inert"]\n required = true\n', '[core]\n worktree = /inert/unavailable/root\n',
            '[core "inert"]\n bare = false\n', '[extensions]\n partialClone = inert\n']
        for raw in variants:
            with self.subTest(raw=raw), tempfile.TemporaryDirectory(prefix='discovery-inert-config-') as folder:
                root = pathlib.Path(folder); (root / '.git').mkdir(); (root / '.git/config').write_text(raw)
                command = unittest.mock.Mock(side_effect=AssertionError('No Git before raw metadata audit'))
                with patch.dict(G, {'git': command}), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    P['authenticate_git_root'](root)
                command.assert_not_called()

    def test_duplicate_nonfinite_and_unsafe_source_values_are_rejected(self):
        for raw in (b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":Infinity}'):
            with self.assertRaises(ValueError):
                P['strict_json'](raw)
        for name in ('../outside', '/absolute', 'a/../b', 'a\\b', 'a//b', 'a/.git/config', 'a\x00b', 'a\nb'):
            with self.assertRaises(ValueError):
                P['read'](ROOT, name)
        with self.assertRaises(ValueError):
            P['tree_digest']({'a': {'mode': '100644', 'blob': '1' * 40}, 'a/b': {'mode': '100644', 'blob': '2' * 40}})

    def test_read_refuses_indirect_or_unexpected_source_symlinks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            (root / 'real').mkdir()
            (root / 'real/file').write_text('data')
            (root / 'alias').symlink_to('real', target_is_directory=True)
            (root / 'leaf').symlink_to('real/file')
            for name in ('alias/file', 'leaf'):
                with self.assertRaises(ValueError):
                    P['read'](root, name)

    def test_ignored_regular_worktree_metadata_is_retained_with_absent_or_literal_false_main_flag(self):
        ordinary = '[core]\n repositoryformatversion = 0\n bare = false\n'
        for extension in ['', '[extensions]\n worktreeConfig = false\n',
                '[EXTENSIONS]\n worktreeConfig = FALSE # ignored per-worktree file\n']:
            with tempfile.TemporaryDirectory(prefix='discovery-ignored-worktree-') as folder:
                root = pathlib.Path(folder); metadata = root / '.git'; metadata.mkdir()
                (metadata / 'config').write_text(ordinary + extension)
                ignored = metadata / 'config.worktree'
                retained = b'[core]\n sparseCheckout = false\n sparseCheckoutCone = false\n'
                ignored.write_bytes(retained)
                with patch.dict(G, {'git': unittest.mock.Mock(side_effect=AssertionError('No Git during raw audit'))}):
                    self.assertEqual(P['audit_git_main_config'](root), root)
                self.assertEqual(ignored.read_bytes(), retained)

    def test_active_bare_multiline_and_uncertain_worktree_flags_refuse_before_any_git(self):
        ordinary = '[core]\n repositoryformatversion = 0\n bare = false\n'
        variants = ['worktreeConfig', 'worktreeConfig =', 'worktreeConfig = true',
            'worktreeConfig = yes', 'worktreeConfig = on', 'worktreeConfig = 1',
            'worktreeConfig = "false"', 'worktreeConfig = false additional',
            'worktreeConfig = fal' + chr(92) + '\n se',
            'worktreeConfig = false\n worktreeConfig = true']
        for variant in variants:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory(prefix='discovery-active-worktree-') as folder:
                root = pathlib.Path(folder); metadata = root / '.git'; metadata.mkdir()
                (metadata / 'config').write_text(ordinary + '[extensions]\n ' + variant + '\n')
                (metadata / 'config.worktree').write_text('[core]\n sparseCheckout = false\n')
                command = unittest.mock.Mock(side_effect=AssertionError('Git must not run before main flag audit'))
                with patch.dict(G, {'git': command}), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    P['authenticate_git_root'](root)
                command.assert_not_called()

    def test_ignored_worktree_metadata_must_remain_regular_and_bounded_before_any_git(self):
        for kind in ('symlink', 'directory', 'oversized'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(prefix='discovery-worktree-type-') as folder:
                root = pathlib.Path(folder); metadata = root / '.git'; metadata.mkdir()
                (metadata / 'config').write_text('[core]\n bare = false\n')
                ignored = metadata / 'config.worktree'
                if kind == 'symlink': ignored.symlink_to('config')
                elif kind == 'directory': ignored.mkdir()
                else: ignored.write_bytes(b'x' * 128001)
                command = unittest.mock.Mock(side_effect=AssertionError('Git must not run before metadata audit'))
                with patch.dict(G, {'git': command}), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    P['authenticate_git_root'](root)
                command.assert_not_called()

    def test_checkout_refuses_main_only_history_that_drops_the_public_feature_parent(self):
        with tempfile.TemporaryDirectory(prefix='discovery-feature-ancestry-') as folder:
            root = pathlib.Path(folder) / 'source'
            subprocess.run(['git', 'clone', '--shared', '--no-checkout', str(ROOT), str(root)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            source = subprocess.check_output(['git', '-C', str(root), '-c', 'user.name=Local ancestry fixture', '-c', 'user.email=fixture@example.invalid', 'commit-tree', P['BASE_TREE'], '-p', P['BASE_COMMIT'], '-m', 'Inert main-only ancestry fixture']).decode().strip()
            subprocess.run(['git', '-C', str(root), 'checkout', '--detach', source], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            with self.assertRaises(subprocess.CalledProcessError) as result:
                P['checkout'](root, {}, None, None, source, P['BASE_TREE'], alpha_root=None)
            self.assertIn(P['FEATURE_COMMIT'], result.exception.cmd)
            self.assertIn('--is-ancestor', result.exception.cmd)


class InstalledClosure(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='discovery-source-fixture-')
        self.folder = pathlib.Path(self.temp.name)
        self.manager, self.alpha = self.folder / 'manager', self.folder / 'alpha'
        self.manager.mkdir()
        self.alpha.mkdir()
        self.payload = {name: ('inert source fixture ' + name).encode() for name in P['REQUIRED_ALPHA_SOURCES'] | {P['INSPECTOR']}}
        shared = b'inert shared contract fixture; never executed'
        self.payload['examples/successor-capability/discovery-lab-contract.mjs'] = shared
        for name in P['ADAPTER_FILES']:
            target = self.manager / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(shared if name.endswith('/discovery-lab-contract.mjs') else b'inert Manager source fixture')
        self.pin = self.commit_alpha()
        self.write_pin()

    def tearDown(self):
        self.temp.cleanup()

    def command(self, *args):
        return subprocess.check_output(['git', '-C', str(self.alpha), *args], stderr=subprocess.DEVNULL).decode().strip()

    def commit_alpha(self):
        catalog_sources = {name: sha(raw) for name, raw in sorted(self.payload.items()) if name != P['INSPECTOR']}
        source_hash = sha(json.dumps(catalog_sources, sort_keys=True, separators=(',', ':')).encode())
        catalog = {'schema': 'successor-capability-source/v1', 'sourceHash': source_hash, 'sources': catalog_sources}
        catalog_raw = (json.dumps(catalog, indent=2) + '\n').encode()
        for name, raw in {**self.payload, P['CATALOG']: catalog_raw}.items():
            target = self.alpha / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        if not (self.alpha / '.git').exists():
            self.command('init', '-q')
        self.command('add', '.')
        self.command('-c', 'user.name=Local source-identity fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Local inert source identity fixture')
        return {'schema': 'successor/discovery-lab-alpha-source/v1', 'repository': P['ALPHA_REPOSITORY'], 'commit': self.command('rev-parse', 'HEAD'), 'tree': self.command('rev-parse', 'HEAD^{tree}'), 'sourceHash': source_hash, 'catalogPath': P['CATALOG'], 'catalogSha256': sha(catalog_raw), 'files': {name: sha(raw) for name, raw in sorted(self.payload.items())}, 'qualification': 'PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY'}

    def write_pin(self, pin=None):
        target = self.manager / P['NATIVE_PIN']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(self.pin if pin is None else pin) + '\n')

    def inspect(self):
        return P['installed_native_closure'](self.manager, self.alpha)

    def test_complete_git_captured_fixture_is_identity_only_without_execution(self):
        result = self.inspect()
        self.assertIs(result['nativeExecutionQualified'], False)
        self.assertEqual(result['sourceFiles'], len(self.payload) + 1)
        self.assertEqual(result['alphaCommit'], self.pin['commit'])
        self.assertGreater(result['encodedSourceBytes'], 0)

    def test_installed_root_and_compiler_inputs_are_mandatory_not_optional(self):
        with self.assertRaisesRegex(ValueError, 'mandatory'):
            P['installed_native_closure'](self.manager, None)
        with self.assertRaisesRegex(ValueError, 'absolute real'):
            P['installed_native_closure'](self.manager, pathlib.Path(os.path.relpath(self.alpha)))
        alias = self.folder / 'alias'
        alias.symlink_to(self.alpha, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'absolute real'):
            P['installed_native_closure'](self.manager, alias)

    def test_nested_tracked_copy_cannot_impersonate_the_actual_git_worktree_root(self):
        nested = self.alpha / 'nested-copy'
        for name in (*self.payload, P['CATALOG']):
            target = nested / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((self.alpha / name).read_bytes())
        actual = subprocess.check_output(['git', '-C', str(nested), 'rev-parse', '--show-toplevel']).decode().strip()
        self.assertEqual(pathlib.Path(actual), self.alpha)
        with self.assertRaisesRegex(ValueError, 'not the actual Git worktree root'):
            P['installed_native_closure'](self.manager, nested)

    def test_missing_captured_source_or_extra_source_key_cannot_be_repinned(self):
        altered = copy.deepcopy(self.pin)
        altered['files'].pop(next(iter(altered['files'])))
        self.write_pin(altered)
        with self.assertRaises(ValueError):
            self.inspect()
        altered = copy.deepcopy(self.pin)
        altered['files']['unreviewed-runtime.mjs'] = 'a' * 64
        self.write_pin(altered)
        with self.assertRaises(ValueError):
            self.inspect()

    def test_pending_pin_cannot_self_promote_execution_or_qualification(self):
        for name, value in (('qualification', 'QUALIFIED'), ('executionApproved', True), ('repository', 'other/Alpha')):
            altered = {**self.pin, name: value}
            self.write_pin(altered)
            with self.assertRaises(ValueError):
                self.inspect()

    def test_altered_raw_source_wrong_git_tree_or_dirty_index_is_rejected(self):
        name = next(iter(self.payload))
        (self.alpha / name).write_bytes(self.payload[name] + b'\n')
        with self.assertRaises(ValueError):
            self.inspect()
        (self.alpha / name).write_bytes(self.payload[name])
        self.write_pin({**self.pin, 'tree': 'a' * 40})
        with self.assertRaises(ValueError):
            self.inspect()
        self.write_pin()
        self.command('update-index', '--assume-unchanged', name)
        with self.assertRaisesRegex(ValueError, 'Hidden'):
            self.inspect()
        self.command('update-index', '--no-assume-unchanged', name)
        self.assertIs(self.inspect()['nativeExecutionQualified'], False)

    def test_untracked_source_shallow_history_or_replace_ref_is_rejected(self):
        rogue = self.alpha / 'unreviewed-runtime.mjs'
        rogue.write_text('inert rogue fixture')
        with self.assertRaisesRegex(ValueError, 'untracked'):
            self.inspect()
        rogue.unlink()
        shallow = self.alpha / '.git/shallow'
        shallow.write_text(self.pin['commit'] + '\n')
        with self.assertRaisesRegex(ValueError, 'Complete'):
            self.inspect()
        shallow.unlink()
        self.command('update-ref', 'refs/replace/' + self.pin['commit'], self.pin['commit'])
        with self.assertRaisesRegex(ValueError, 'Replaced'):
            self.inspect()

    def test_installed_manager_contract_must_match_captured_alpha_contract(self):
        (self.manager / P['ADAPTER_FILES'][1]).write_text('inert different contract')
        with self.assertRaisesRegex(ValueError, 'contracts differ'):
            self.inspect()

    def test_local_filters_includes_and_worktree_overrides_are_refused_before_status(self):
        for key, value in (('filter.fixture.required', 'true'),
                           ('include.path', '/nonexistent-included-config'),
                           ('core.attributesfile', '/nonexistent-external-attributes'),
                           ('core.worktree', str(self.alpha))):
            self.command('config', '--local', key, value)
            original_git = G['git']
            calls = []
            def tracked(root, *arguments, **options):
                calls.append(arguments)
                return original_git(root, *arguments, **options)
            with patch.dict(G, {'git': tracked}):
                with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    self.inspect()
            self.assertFalse(any(arguments[0] == 'status' for arguments in calls))
            self.command('config', '--local', '--unset', key)
        self.assertIs(self.inspect()['nativeExecutionQualified'], False)

    def test_worktree_specific_configuration_is_refused_before_source_inspection(self):
        self.command('config', '--local', 'extensions.worktreeConfig', 'true')
        self.command('config', '--worktree', 'filter.fixture.required', 'true')
        local_config = self.command('config', '--local', '--no-includes', '--list')
        self.assertNotIn('filter.fixture.required', local_config)
        original_git, calls = G['git'], []
        def tracked(root, *arguments, **options):
            calls.append(arguments)
            return original_git(root, *arguments, **options)
        with patch.dict(G, {'git': tracked}):
            with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                self.inspect()
        self.assertFalse(any(arguments[0] == 'status' or 'HEAD' in arguments or 'HEAD^{tree}' in arguments for arguments in calls))

    def test_sensitive_git_configuration_is_rejected_before_head_or_tree_reads(self):
        keys = ('tar.fixture.command', 'diff.external', 'pager.status',
                'remote.fixture.uploadpack', 'remote.fixture.receivepack', 'remote.fixture.promisor',
                'remote.fixture.vcs', 'extensions.partialClone', 'extensions.worktreeConfig',
                'core.sshCommand', 'core.gitProxy', 'core.alternateRefsCommand', 'protocol.file.allow')
        for key in keys:
            self.command('config', '--local', key, 'true' if key.lower().endswith(('promisor', 'worktreeconfig')) else 'inert-denied-value')
            original_git, calls = G['git'], []
            def tracked(root, *arguments, **options):
                calls.append(arguments)
                return original_git(root, *arguments, **options)
            with patch.dict(G, {'git': tracked}):
                with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    P['git_identity'](self.alpha)
            self.assertFalse(any('HEAD' in arguments or 'HEAD^{tree}' in arguments for arguments in calls), key)
            self.command('config', '--local', '--unset', key)
        self.assertEqual(P['git_identity'](self.alpha), {'commit': self.pin['commit'], 'tree': self.pin['tree']})

    def test_real_git_identity_accepts_ignored_worktree_file_without_removing_it(self):
        ignored = self.alpha / '.git/config.worktree'
        raw = b'[core]\n sparseCheckout = false\n sparseCheckoutCone = false\n'
        ignored.write_bytes(raw)
        for flag in ('absent', 'false'):
            if flag == 'false': self.command('config', '--local', 'extensions.worktreeConfig', 'false')
            self.assertEqual(P['git_identity'](self.alpha), {'commit': self.pin['commit'], 'tree': self.pin['tree']})
            self.assertEqual(ignored.read_bytes(), raw)

    def test_promisor_pack_marker_is_rejected_before_object_identity_reads(self):
        marker = self.alpha / '.git/objects/pack/inert.promisor'
        marker.write_text('inert marker; no pack or executable content')
        with self.assertRaisesRegex(ValueError, 'Promisor'):
            P['git_identity'](self.alpha)


class SavedAlphaCapsule(unittest.TestCase):
    """Only inert files are captured; no supplied module is evaluated by these tests."""

    command = InstalledClosure.command
    commit_alpha = InstalledClosure.commit_alpha
    write_pin = InstalledClosure.write_pin
    tearDown = InstalledClosure.tearDown

    def setUp(self):
        InstalledClosure.setUp(self)
        (self.alpha / 'LICENSE').write_bytes((ROOT / 'site/assets/successor/vendor/alpha-project/LICENSE').read_bytes())
        self.pin = self.commit_alpha()
        self.write_pin()
        self.capsule = self.folder / 'saved-alpha'
        self.capsule.mkdir()
        self.captured = P['capture_alpha_capsule'](self.manager, self.alpha)
        for name, (mode, raw) in self.captured.items():
            target = self.capsule / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            target.chmod(0o755 if mode == '100755' else 0o644)

    def test_saved_capsule_owns_raw_inputs_and_validates_without_git_or_source_checkout(self):
        import shutil
        shutil.rmtree(self.alpha)
        with patch('subprocess.check_output', side_effect=AssertionError('Installed capsule may not call Git')):
            result = P['validate_alpha_capsule'](self.manager, self.capsule)
        self.assertEqual(result['commit'], self.pin['commit'])
        self.assertEqual(set(result['files']), set(self.pin['files']) | {P['CATALOG'], 'LICENSE'})
        self.assertEqual(result['files']['LICENSE']['sha256'], P['APACHE_LICENSE_SHA256'])

    def test_saved_capsule_rejects_changed_bytes_mode_missing_extra_and_indirect_inputs(self):
        name = next(iter(self.pin['files']))
        target = self.capsule / name
        raw = target.read_bytes()
        target.write_bytes(raw + b'\n')
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)
        target.write_bytes(raw)
        target.chmod(0o755)
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)
        target.chmod(0o644)
        target.unlink()
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)
        target.write_bytes(raw)
        extra = self.capsule / 'unlisted.txt'; extra.write_text('inert extra input')
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)
        extra.unlink(); target.unlink(); target.symlink_to(self.alpha / name)
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)

    def test_saved_capsule_cannot_relabel_pin_or_omit_the_original_license(self):
        manifest_path = self.capsule / P['CAPSULE_MANIFEST']
        raw = manifest_path.read_bytes()
        changed = json.loads(raw); changed['commit'] = 'a' * 40
        manifest_path.write_text(json.dumps(changed))
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)
        manifest_path.write_bytes(raw)
        (self.capsule / 'LICENSE').unlink()
        with self.assertRaises(ValueError): P['validate_alpha_capsule'](self.manager, self.capsule)


class SavedBrowserCapsule(unittest.TestCase):
    """The source fixture supplies inert Alpha JSON and ZIP metadata; no browser or module runs."""

    def setUp(self):
        fixture = runpy.run_path(str(ROOT / 'scripts/release/test-discovery-qualification.py'))
        self.pin, self.files, _, _ = fixture['browser_artifact_fixture']()
        self.temporary = tempfile.TemporaryDirectory(prefix='manager-saved-browser-')
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name) / 'source'
        (self.root / 'config').mkdir(parents=True)
        (self.root / 'config/discovery-release-browser-artifact-v1.json').write_text(json.dumps(self.pin) + '\n')
        target = self.root / 'scripts/release/discovery-qualification.py'
        target.parent.mkdir(parents=True)
        target.write_bytes((ROOT / 'scripts/release/discovery-qualification.py').read_bytes())
        self.binding = P['browser_policy'](self.root)['verify_browser_files'](self.root, self.files)
        self.capsule = pathlib.Path(self.temporary.name) / 'discovery-browser'
        self.capsule.mkdir()
        self.raw = {**self.files, P['BROWSER_MANIFEST']: (json.dumps(self.binding) + '\n').encode()}
        for name, raw in self.raw.items():
            target = self.capsule / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw); target.chmod(0o644)

    def test_saved_browser_inputs_validate_offline_and_return_the_same_owned_bytes(self):
        with patch('subprocess.run', side_effect=AssertionError('Saved input validation cannot make a request')):
            result = P['validate_browser_capsule'](self.root, self.capsule, return_files=True)
        self.assertEqual(result, {'binding': self.binding, 'files': self.raw})
        original = result['files']['discovery-continuation/fleet-browser-workspace.json']
        (self.capsule / 'discovery-continuation/fleet-browser-workspace.json').write_bytes(original + b' ')
        self.assertEqual(result['files']['discovery-continuation/fleet-browser-workspace.json'], original)
        with self.assertRaises(ValueError): P['validate_browser_capsule'](self.root, self.capsule)

    def test_saved_browser_inputs_refuse_extra_indirect_and_relabelled_custody(self):
        extra = self.capsule / 'unreviewed.json'; extra.write_text('{}')
        with self.assertRaises(ValueError): P['validate_browser_capsule'](self.root, self.capsule)
        extra.unlink()
        target = self.capsule / 'discovery-continuation/fleet-browser-workspace.json'
        target.unlink(); target.symlink_to(self.capsule / 'discovery-continuation/jobs-browser-workspace.json')
        with self.assertRaises(ValueError): P['validate_browser_capsule'](self.root, self.capsule)
        target.unlink(); target.write_bytes(self.raw['discovery-continuation/fleet-browser-workspace.json'])
        (self.capsule / P['BROWSER_MANIFEST']).write_text(json.dumps({**self.binding, 'missionId': 'capability-other'}))
        with self.assertRaises(ValueError): P['validate_browser_capsule'](self.root, self.capsule)


if __name__ == '__main__':
    unittest.main()
