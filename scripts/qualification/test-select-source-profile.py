#!/usr/bin/env python3
"""Tiny routing-unit adversarial tests. Mocked dispatch is NOT source qualification.

No EVM, installation, provider, network, source mutation, or parity suite runs.
Synthetic fixtures deliberately replace the immutable anchor only in this test
process. Production selector CLI has no replacement or re-anchoring option.
"""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

sys.dont_write_bytecode = True
SCRIPT = pathlib.Path(__file__).resolve().with_name('select-source-profile.py')
SPEC = importlib.util.spec_from_file_location('reviewed_profile_selector', SCRIPT)
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
HARNESS = SCRIPT.parents[2]


def encode(value):
    return (json.dumps(value, indent=2) + '\n').encode()


class RoutingUnits(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='profile-routing-unit-')
        self.addCleanup(self.temp.cleanup)
        self.base = pathlib.Path(self.temp.name)
        self.root = self.base / 'source'
        self.root.mkdir()
        self.dependencies = self.base / 'dependencies'
        self.dependencies.mkdir()
        self.store = self.base / 'objects'
        self.store.mkdir()
        self.binding_path = self.base / 'binding.json'
        self.target_path = self.base / 'target.json'
        self.target = json.loads((HARNESS / 'config/reviewed-d371-target.json').read_text())
        for key, name in M.POLICY_PATHS.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(('synthetic mock-only ' + name + '\n').encode())
            self.target[key] = M.sha(path.read_bytes())
        for name in sorted(M.LOCK_PATHS):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(encode({'synthetic': name}))
            self.target['lockSha256'][name] = M.sha(path.read_bytes())
        self.binding = {key: self.target[key] for key in M.BINDING_FIELDS}
        self.binding['schema'] = 'agijobmanager/source-review-binding/v1'
        self.write_fixture()
        self.anchor = mock.patch.object(M, 'REVIEWED_TARGET_MANIFEST_SHA256', self.target_hash)
        self.anchor.start()
        self.addCleanup(self.anchor.stop)

    def write_fixture(self):
        self.binding_path.write_bytes(encode(self.binding))
        self.binding_hash = M.sha(self.binding_path.read_bytes())
        self.target['reviewBindingSha256'] = self.binding_hash
        self.target_path.write_bytes(encode(self.target))
        self.target_hash = M.sha(self.target_path.read_bytes())

    def cli(self):
        return ['--profile', M.PROFILE, '--mode', 'bound', '--source-root', str(self.root),
                '--target-manifest', str(self.target_path), '--target-manifest-sha256', self.target_hash,
                '--review-binding', str(self.binding_path), '--review-binding-sha256', self.binding_hash]

    def args(self):
        return M.parse_args(self.cli())

    def assert_parse_rejected(self, cli):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            M.parse_args(cli)
        self.assertEqual(error.exception.code, 2)

    def assert_preflight_rejected(self, args=None, match=None):
        with mock.patch.object(M, 'observe_source') as observed, \
             mock.patch.object(M.subprocess, 'run') as dispatched:
            with self.assertRaises(M.SelectionError) as error:
                M.run(args or self.args())
            dispatched.assert_not_called()
            if match:
                self.assertIn(match, str(error.exception))
            return observed

    def test_unknown_profile_rejected_without_dispatch(self):
        self.assert_parse_rejected(['--profile', 'auto', '--source-root', str(self.root)])

    def test_omitted_explicit_profile_rejected(self):
        self.assert_parse_rejected(['--source-root', str(self.root)])

    def test_each_missing_explicit_binding_option_rejected(self):
        for option in ('--mode', '--target-manifest', '--target-manifest-sha256',
                       '--review-binding', '--review-binding-sha256'):
            with self.subTest(option=option):
                cli = self.cli()
                offset = cli.index(option)
                del cli[offset:offset + 2]
                self.assert_parse_rejected(cli)

    def test_staged_mode_rejected_without_fallback(self):
        cli = self.cli()
        cli[cli.index('--mode') + 1] = 'staged'
        self.assert_parse_rejected(cli)

    def test_explicit_legacy_target_override_rejected(self):
        for option in ('--source-commit', '--source-tree'):
            with self.subTest(option=option):
                self.assert_parse_rejected(self.cli() + [option, '0' * 40])

    def test_fallback_override_rejected(self):
        self.assert_parse_rejected(self.cli() + ['--fallback-profile', 'legacy-v114'])

    def test_abbreviated_options_rejected(self):
        cli = self.cli()
        cli[cli.index('--target-manifest-sha256')] = '--target-manifest-sha'
        self.assert_parse_rejected(cli)

    def test_duplicate_security_options_rejected(self):
        self.assert_parse_rejected(self.cli() + ['--profile', 'legacy-v114'])
        self.assert_parse_rejected(self.cli() + ['--mode=bound'])

    def test_corrected_checkpoint_requires_exactly_one_parent(self):
        for parents in ([], ['1' * 40, '2' * 40]):
            with self.subTest(parents=parents):
                self.target['sourceParents'] = parents
                self.write_fixture()
                with mock.patch.object(M, 'REVIEWED_TARGET_MANIFEST_SHA256', self.target_hash):
                    self.assert_preflight_rejected(match='Complete target commit/tree/ordered parents required')

    def test_mutable_expected_manifest_hash_cannot_authorize_new_target(self):
        self.target['sourceCommit'] = '0' * 40
        self.target_path.write_bytes(encode(self.target))
        args = self.args()
        args.target_manifest_sha256 = M.sha(self.target_path.read_bytes())
        self.assert_preflight_rejected(args, 'immutable reviewed anchor')

    def test_mutated_target_manifest_rejected(self):
        self.target_path.write_bytes(self.target_path.read_bytes() + b' ')
        self.assert_preflight_rejected(match='manifest bytes changed')

    def test_binding_byte_mutation_rejected(self):
        self.binding_path.write_bytes(self.binding_path.read_bytes() + b' ')
        self.assert_preflight_rejected(match='binding digest differs')

    def test_binding_hash_override_rejected(self):
        args = self.args()
        args.review_binding_sha256 = '0' * 64
        self.assert_preflight_rejected(args, 'binding digest differs')

    def test_binding_target_and_policy_mismatch_even_after_test_only_reanchor(self):
        for key in ('sourceCommit', 'sourceTree', *M.POLICY_PATHS, 'profile', 'disposition'):
            with self.subTest(field=key):
                before = copy.deepcopy(self.binding)
                self.binding[key] = 'incorrect'
                self.write_fixture()
                with mock.patch.object(M, 'REVIEWED_TARGET_MANIFEST_SHA256', self.target_hash):
                    self.assert_preflight_rejected(match='binding target/policy/scope differs')
                self.binding = before

    def test_all_four_source_policy_byte_mutations_rejected(self):
        for key, name in M.POLICY_PATHS.items():
            with self.subTest(policy=key):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b'mutation\n')
                self.assert_preflight_rejected(match=key)
                path.write_bytes(original)

    def test_all_three_source_lock_byte_mutations_rejected(self):
        for name in sorted(M.LOCK_PATHS):
            with self.subTest(lock=name):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b' ')
                self.assert_preflight_rejected(match=name)
                path.write_bytes(original)

    def test_source_commit_tree_or_parents_mismatch_stops_before_dispatch(self):
        for cause in ('Source commit differs', 'Source tree differs', 'Ordered source parents differ'):
            with self.subTest(cause=cause), \
                 mock.patch.object(M, 'observe_source', side_effect=M.SelectionError(cause)), \
                 mock.patch.object(M.subprocess, 'run') as dispatched:
                with self.assertRaisesRegex(M.SelectionError, cause):
                    M.run(self.args())
                dispatched.assert_not_called()

    def test_mocked_explicit_dispatch_argv_is_exact_and_bound(self):
        args = self.args()
        args.object_store = [str(self.store), str(self.root)]
        args.dependency_root = str(self.dependencies)
        with mock.patch.object(M, 'observe_source') as observed, \
             mock.patch.object(M.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as run:
            self.assertEqual(M.run(args), 0)
        observed.assert_has_calls([mock.call(self.root, self.target['sourceCommit'],
            self.target['sourceTree'], self.target['sourceParents'])] * 2)
        run.assert_called_once()
        command = run.call_args.args[0]
        expected = [sys.executable, str(self.root / M.POLICY_PATHS['dispatcherSha256']),
            '--profile', M.PROFILE, '--mode', 'bound', '--source-root', str(self.root),
            '--manifest', self.target['manifestPath'], '--manifest-sha256', self.target['manifestSha256'],
            '--schema-sha256', self.target['schemaSha256'], '--verifier-sha256', self.target['verifierSha256'],
            '--review-binding', str(self.binding_path), '--review-binding-sha256', self.binding_hash,
            '--dependency-root', str(self.dependencies), '--object-store', str(self.store),
            '--object-store', str(self.root)]
        self.assertEqual(command, expected)
        self.assertEqual(run.call_args.kwargs['cwd'], self.root)
        self.assertFalse(run.call_args.kwargs['check'])
        self.assertNotIn('shell', run.call_args.kwargs)

    def test_checker_rejection_propagates_once_without_legacy_or_staged_retry(self):
        # Model finite-path, dependency and byte rejection from the real checker;
        # the underlying verifier's actual mutation suite is separate evidence.
        for rejection in ('unexpected finite path', 'changed dependency', 'mutated source byte'):
            with self.subTest(checker_rejection=rejection), \
                 mock.patch.object(M, 'observe_source'), \
                 mock.patch.object(M.subprocess, 'run', return_value=types.SimpleNamespace(returncode=7)) as run:
                self.assertEqual(M.run(self.args()), 7)
                run.assert_called_once()
                self.assertNotIn(M.LEGACY, run.call_args.args[0])
                self.assertNotIn('staged', run.call_args.args[0])

    def test_child_spawn_failure_does_not_fallback(self):
        with mock.patch.object(M, 'observe_source'), \
             mock.patch.object(M.subprocess, 'run', side_effect=OSError('cannot execute')) as run:
            with self.assertRaises(OSError):
                M.run(self.args())
            run.assert_called_once()

    def test_policy_drift_during_successful_child_is_rejected(self):
        def mutate(*args, **kwargs):
            (self.root / M.POLICY_PATHS['dispatcherSha256']).write_text('changed while running\n')
            return types.SimpleNamespace(returncode=0)
        with mock.patch.object(M, 'observe_source'), mock.patch.object(M.subprocess, 'run', side_effect=mutate):
            with self.assertRaisesRegex(M.SelectionError, 'Source policy bytes differ'):
                M.run(self.args())

    def test_binding_drift_during_successful_child_is_rejected(self):
        def mutate(*args, **kwargs):
            self.binding_path.write_bytes(self.binding_path.read_bytes() + b' ')
            return types.SimpleNamespace(returncode=0)
        with mock.patch.object(M, 'observe_source'), mock.patch.object(M.subprocess, 'run', side_effect=mutate):
            with self.assertRaisesRegex(M.SelectionError, 'binding digest differs'):
                M.run(self.args())

    def test_binding_and_manifest_must_be_external(self):
        for attribute, original in (('target_manifest', self.target_path), ('review_binding', self.binding_path)):
            with self.subTest(path=attribute):
                inside = self.root / original.name
                inside.write_bytes(original.read_bytes())
                args = self.args()
                setattr(args, attribute, str(inside))
                self.assert_preflight_rejected(args, 'must be external')

    def test_symlink_policy_binding_and_source_alias_rejected(self):
        for original in (self.binding_path, self.root / M.POLICY_PATHS['verifierSha256']):
            with self.subTest(path=str(original)):
                retained = original.with_suffix('.retained')
                original.rename(retained)
                original.symlink_to(retained)
                self.assert_preflight_rejected(match='without symlink aliases')
                original.unlink()
                retained.rename(original)
        alias = self.base / 'source-alias'
        alias.symlink_to(self.root, target_is_directory=True)
        args = self.args()
        args.source_root = str(alias)
        self.assert_preflight_rejected(args, 'without symlink aliases')

    def test_json_duplicates_and_nonfinite_values_rejected(self):
        for data in (b'{"schema":1,"schema":2}', b'{"schema":NaN}', b'{"schema":Infinity}'):
            with self.subTest(data=data), self.assertRaises(M.SelectionError):
                M.strict_json(data)

    def test_extra_binding_field_rejected_even_after_test_only_reanchor(self):
        self.binding['fallbackProfile'] = 'legacy-v114'
        self.write_fixture()
        with mock.patch.object(M, 'REVIEWED_TARGET_MANIFEST_SHA256', self.target_hash):
            self.assert_preflight_rejected(match='binding target/policy/scope differs')

    def legacy_cli(self):
        return ['--profile', 'legacy-v114', '--source-root', str(self.root),
                '--source-commit', M.LEGACY_COMMIT, '--source-tree', M.LEGACY_TREE]

    def test_legacy_explicit_options_and_target_drift_rejected(self):
        for extra in (['--review-binding', str(self.binding_path)], ['--object-store', str(self.store)],
                      ['--dependency-root', str(self.dependencies)], ['--mode', 'staged']):
            with self.subTest(extra=extra):
                self.assert_parse_rejected(self.legacy_cli() + extra)
        for flag in ('--source-commit', '--source-tree'):
            cli = self.legacy_cli()
            cli[cli.index(flag) + 1] = '0' * 40
            self.assert_parse_rejected(cli)

    def test_mocked_legacy_dispatch_invokes_original_executable_without_new_flags(self):
        pins = {}
        for name in M.LEGACY_PINS:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('synthetic legacy fixture\n')
            pins[name] = M.sha(path.read_bytes())
        with mock.patch.object(M, 'LEGACY_PINS', pins), \
             mock.patch.object(M, 'observe_source') as observed, \
             mock.patch.object(M, 'legacy_clean_source') as clean, \
             mock.patch.object(M.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as run:
            self.assertEqual(M.run(M.parse_args(self.legacy_cli())), 0)
        observed.assert_has_calls([mock.call(self.root, M.LEGACY_COMMIT, M.LEGACY_TREE)] * 2)
        self.assertEqual(clean.call_count, 2)
        run.assert_called_once_with([sys.executable, str(self.root / M.LEGACY)],
                                   cwd=self.root, env=M.offline_env(), check=False)

    def test_legacy_original_byte_change_stops_before_dispatch(self):
        for name in M.LEGACY_PINS:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('not the original bytes\n')
        with mock.patch.object(M, 'observe_source'), mock.patch.object(M, 'legacy_clean_source'), \
             mock.patch.object(M.subprocess, 'run') as run:
            with self.assertRaisesRegex(M.SelectionError, 'Original legacy bytes changed'):
                M.run(M.parse_args(self.legacy_cli()))
            run.assert_not_called()

    def test_git_environment_overrides_are_sanitized(self):
        with mock.patch.dict(os.environ, {'GIT_DIR': '/attacker', 'GIT_WORK_TREE': '/attacker',
            'GIT_CONFIG_COUNT': '99', 'GIT_CONFIG_KEY_98': 'protocol.allow',
            'GIT_CONFIG_VALUE_98': 'always', 'GIT_ALLOW_PROTOCOL': 'https:file:ssh',
            'GIT_SSH_COMMAND': 'unexpected'}):
            env = M.offline_env()
        for forbidden in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_KEY_98', 'GIT_CONFIG_VALUE_98', 'GIT_SSH_COMMAND'):
            self.assertNotIn(forbidden, env)
        self.assertEqual(env['GIT_NO_LAZY_FETCH'], '1')
        self.assertEqual(env['GIT_ALLOW_PROTOCOL'], '')
        self.assertEqual(env['GIT_CONFIG_VALUE_0'], 'never')

    def test_git_observer_command_denies_transports(self):
        response = types.SimpleNamespace(returncode=0, stdout=b'answer', stderr=b'')
        with mock.patch.object(M.subprocess, 'run', return_value=response) as run:
            self.assertEqual(M.git(self.root, 'rev-parse', 'HEAD'), b'answer')
        command = run.call_args.args[0]
        self.assertIn('protocol.allow=never', command)
        self.assertIn('--no-replace-objects', command)
        self.assertEqual(run.call_args.kwargs['env']['GIT_ALLOW_PROTOCOL'], '')

    def test_missing_local_object_is_failure_not_fetch(self):
        response = types.SimpleNamespace(returncode=128, stdout=b'', stderr=b'object unavailable')
        with mock.patch.object(M.subprocess, 'run', return_value=response) as run:
            with self.assertRaisesRegex(M.SelectionError, 'Required local Git object'):
                M.git(self.root, 'cat-file', 'commit', self.target['sourceCommit'])
            run.assert_called_once()
            self.assertNotIn('fetch', run.call_args.args[0])

    def test_raw_commit_tree_parents_and_identity_validation(self):
        tree = '1' * 40
        parents = ['2' * 40, '3' * 40]
        raw = ('tree ' + tree + '\nparent ' + parents[0] + '\nparent ' + parents[1] +
               '\nauthor Fixture <fixture@example.invalid> 0 +0000\n' +
               'committer Fixture <fixture@example.invalid> 0 +0000\n\nSynthetic test only\n').encode()
        commit = hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        def observe(*args):
            operation = args[1:]
            if operation == ('rev-parse', '--show-toplevel'):
                return str(self.root).encode() + b'\n'
            if operation == ('rev-parse', 'HEAD'):
                return commit.encode() + b'\n'
            return raw
        with mock.patch.object(M, 'git', side_effect=observe):
            M.observe_source(self.root, commit, tree, parents)
            for bad_commit, bad_tree, bad_parents, text in (
                ('0' * 40, tree, parents, 'Source commit'),
                (commit, '0' * 40, parents, 'Source tree'),
                (commit, tree, parents[::-1], 'Ordered source parents')):
                with self.subTest(cause=text), self.assertRaisesRegex(M.SelectionError, text):
                    M.observe_source(self.root, bad_commit, bad_tree, bad_parents)
        with mock.patch.object(M, 'git', side_effect=[str(self.root).encode(), commit.encode(), raw + b' ']):
            with self.assertRaisesRegex(M.SelectionError, 'Raw commit object'):
                M.observe_source(self.root, commit, tree, parents)


class FrozenProductionInputs(unittest.TestCase):
    def test_target_anchor_and_binding_are_exact(self):
        target_bytes = (HARNESS / 'config/reviewed-d371-target.json').read_bytes()
        binding_bytes = (HARNESS / 'config/d371-source-review-binding.json').read_bytes()
        self.assertEqual(M.sha(target_bytes), M.REVIEWED_TARGET_MANIFEST_SHA256)
        target, binding = json.loads(target_bytes), json.loads(binding_bytes)
        self.assertEqual(target['sourceCommit'], 'd371d95cfcc44b9133cda4bba55304f727917f18')
        self.assertEqual(target['sourceTree'], '93faf6e9a6875026c1eb9bc2f0f9bdada308d296')
        self.assertEqual(target['sourceParents'], ['c2f72180d2f0d6ecd5b92d8e5197c5344be2c699'])
        self.assertEqual(M.sha(binding_bytes), target['reviewBindingSha256'])
        expected = {key: target[key] for key in M.BINDING_FIELDS}
        expected['schema'] = 'agijobmanager/source-review-binding/v1'
        self.assertEqual(binding, expected)


if __name__ == '__main__':
    print('ROUTING UNIT TESTS: mocked dispatch; not authentic c2 or legacy qualification.', flush=True)
    unittest.main(verbosity=2)
