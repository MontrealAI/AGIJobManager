#!/usr/bin/env python3
"""Serial offline source-boundary tests; temporary fixtures never qualify a release.

Example: python3 scripts/release/test-source-boundary-dispatch.py \
  --object-store /absolute/original-object-store --dependency-root /absolute/node_modules
Existing Git object stores may be repeated. No fetch, install, compile or provider.
"""
import argparse
import copy
import json
import os
import pathlib
import runpy
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
M = runpy.run_path(str(ROOT / 'scripts/release/check-explicit-governor-boundaries.py'))
OPTIONS = None


def local_git(root, *args, input=None):
    return subprocess.check_output(['git', '--no-replace-objects', '-c', 'protocol.allow=never',
        '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', *args],
        cwd=root, env=M['git_env'](), input=input, stderr=subprocess.PIPE)


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n')


def materialize(root, entries, blobs):
    for name, item in entries.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        data = blobs[item['gitBlob']]
        if item['mode'] == '120000':
            target.symlink_to(data.decode())
        else:
            target.write_bytes(data)
            target.chmod(0o755 if item['mode'] == '100755' else 0o644)


class SourceBoundaryDispatch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='source-boundary-offline-')
        cls.directory = pathlib.Path(cls.temp.name)
        cls.stores = OPTIONS.object_store or [str(ROOT)]
        cls.objects = M['Git'](cls.stores[0], [M['Git'](p) for p in cls.stores[1:]] + [M['Git'](ROOT)])
        cls.dependencies = pathlib.Path(OPTIONS.dependency_root or ROOT / 'node_modules').resolve()
        cls.manifest = M['strict_json']((ROOT / M['MANIFEST']).read_bytes())
        cls.current = cls.directory / 'current'
        cls.current.mkdir()
        cls.init_repository(cls.current)
        local_git(cls.current, 'read-tree', M['PREDECESSOR'])
        for name in [*cls.manifest['inputs'], M['MANIFEST']]:
            mode, data = M['raw_file'](ROOT, name)
            target = cls.current / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if mode == '120000':
                target.symlink_to(data.decode())
            else:
                target.write_bytes(data)
                target.chmod(0o755 if mode == '100755' else 0o644)
        cls.legacy = cls.directory / 'legacy'
        cls.legacy.mkdir()
        cls.init_repository(cls.legacy)
        cls.legacy_commit = '06add2a669f3ed1eb03019ab95cad1cb2095a2c8'
        cls.legacy_tree = '47123ade3e386481f6de1d5f4830c86c016accd3'
        entries = cls.objects.tree(cls.legacy_commit)
        blobs = cls.objects.blobs(entries, require_all=False)
        for name, item in entries.items():
            if item['gitBlob'] in blobs:
                continue
            if not OPTIONS.historical_bytes_root:
                raise M['BoundaryError']('Original historical object missing offline: ' + name)
            mode, data = M['raw_file'](pathlib.Path(OPTIONS.historical_bytes_root), name)
            import hashlib
            oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            M['require'](mode == item['mode'] and oid == item['gitBlob'],
                         'Retained original bytes differ from authentic tree: ' + name)
            M['require'](local_git(cls.legacy, 'hash-object', '-w', '--stdin', input=data).decode().strip() == oid,
                         'Fixture-local original object import differs')
            blobs[oid] = data
        materialize(cls.legacy, entries, blobs)
        local_git(cls.legacy, 'read-tree', cls.legacy_commit)
        local_git(cls.legacy, 'update-ref', 'refs/heads/fixture', cls.legacy_commit)
        local_git(cls.legacy, 'symbolic-ref', 'HEAD', 'refs/heads/fixture')

    @classmethod
    def init_repository(cls, root):
        local_git(root, 'init', '--quiet')
        paths = []
        for source in [*cls.stores, str(ROOT)]:
            resolved = local_git(pathlib.Path(source), 'rev-parse', '--git-path', 'objects').decode().strip()
            path = pathlib.Path(resolved)
            if not path.is_absolute():
                path = pathlib.Path(source) / path
            paths.append(str(path.resolve()))
        (root / '.git/objects/info/alternates').write_text('\n'.join(dict.fromkeys(paths)) + '\n')

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def args(self, root=None, mode='staged'):
        root = root or self.current
        return types.SimpleNamespace(source_root=str(root), object_store=self.stores,
            dependency_root=str(self.dependencies), manifest=M['MANIFEST'],
            manifest_sha256=M['sha']((root / M['MANIFEST']).read_bytes()),
            schema_sha256=M['sha']((root / M['SCHEMA']).read_bytes()),
            verifier_sha256=M['sha']((ROOT / M['VERIFIER']).read_bytes()), mode=mode,
            review_binding=None, review_binding_sha256=None, source_commit=None, source_tree=None)

    def dispatch(self, arguments):
        return subprocess.run([sys.executable, str(ROOT / M['DISPATCHER']), *arguments],
            capture_output=True, text=True, env=M['git_env']())

    def explicit_cli(self, root=None):
        args = self.args(root)
        result = ['--profile', M['PROFILE'], '--mode', args.mode, '--source-root', args.source_root,
            '--manifest', args.manifest, '--manifest-sha256', args.manifest_sha256,
            '--schema-sha256', args.schema_sha256, '--verifier-sha256', args.verifier_sha256,
            '--dependency-root', args.dependency_root]
        for store in self.stores:
            result.extend(['--object-store', store])
        return result

    def mutate(self, root, name, change, check):
        path = root / name
        before, mode = path.read_bytes(), path.stat().st_mode
        try:
            result = change(before)
            if result is not None:
                path.write_bytes(result)
            check()
        finally:
            path.write_bytes(before)
            path.chmod(mode)

    def test_01_explicit_positive_and_external_pins(self):
        result = self.dispatch(self.explicit_cli())
        self.assertEqual(result.returncode, 0, result.stderr)
        observed = json.loads(result.stdout)
        self.assertEqual(observed['status'], 'STAGED_INPUT_BOUNDARIES_PASSED')
        self.assertFalse(observed['releaseQualified'])
        for flag in ('--manifest-sha256', '--verifier-sha256', '--schema-sha256'):
            with self.subTest(flag=flag):
                cli = self.explicit_cli()
                cli[cli.index(flag) + 1] = '0' * 64
                self.assertNotEqual(self.dispatch(cli).returncode, 0)

    def test_02_selection_fails_without_fallback(self):
        for arguments in ([], ['--profile', 'auto'], ['--profile', 'manager-explicit-governor-v1'],
                          self.explicit_cli() + ['--source-commit', M['PREDECESSOR']]):
            with self.subTest(arguments=arguments[:3]):
                self.assertNotEqual(self.dispatch(arguments).returncode, 0)
        args = self.args(mode='bound')
        with self.assertRaises(M['BoundaryError']):
            M['verify_explicit'](args)

    def test_03_original_legacy_positive_and_candidate_rejected(self):
        base = ['--profile', 'legacy-v114', '--source-root', str(self.legacy),
            '--source-commit', self.legacy_commit, '--source-tree', self.legacy_tree,
            '--verifier-sha256', M['sha']((ROOT / M['VERIFIER']).read_bytes())]
        result = self.dispatch(base)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('ORIGINAL_SOURCE_BOUNDARIES_PASSED', result.stdout)
        # The authentic predecessor has seven/six/three constructors: its
        # unchanged historical checker must fail, not be retried as new policy.
        result = subprocess.run([sys.executable, str(self.current / M['LEGACY'])],
            cwd=self.current, env=M['git_env'](), capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('reviewed source inventory', result.stderr)

    def test_04_dependency_policy_mutation_parity(self):
        """Each mutation must fail both original executable and new repeated invariants."""
        counts = []
        def rejected():
            old = subprocess.run([sys.executable, str(self.legacy / M['LEGACY'])],
                cwd=self.legacy, env=M['git_env'](), capture_output=True, text=True)
            self.assertNotEqual(old.returncode, 0, 'Historical checker unexpectedly accepted mutation')
            with self.assertRaises((M['BoundaryError'], KeyError, TypeError)):
                M['dependency_boundaries'](self.legacy, self.objects)
            counts.append(1)
        def json_change(fn):
            def apply(data):
                value = json.loads(data)
                fn(value)
                return (json.dumps(value) + '\n').encode()
            return apply
        # All six dependency/toolchain fields in all three workspaces, including absent fields.
        for directory in M['WORKSPACES']:
            for field in M['DEP_FIELDS']:
                with self.subTest(workspace=directory, field=field):
                    self.mutate(self.legacy, directory + 'package.json',
                        json_change(lambda value, key=field: value.__setitem__(key, {'unreviewed': '1.0.0'})), rejected)
            for mutation in ('resolution', 'extra', 'missing', 'top-level', 'root-version'):
                def edit(value, which=mutation):
                    if which == 'resolution':
                        key = next(k for k in value['packages'] if k)
                        value['packages'][key]['integrity'] = 'sha512-unreviewed'
                    elif which == 'extra':
                        value['packages']['node_modules/unreviewed'] = {'version': '1.0.0'}
                    elif which == 'missing':
                        value['packages'].pop(next(k for k in value['packages'] if k))
                    elif which == 'top-level':
                        value['unreviewed'] = True
                    else:
                        value['packages']['']['version'] = '0.0.0'
                with self.subTest(workspace=directory, lock=mutation):
                    self.mutate(self.legacy, directory + 'package-lock.json', json_change(edit), rejected)
        for name in ('hardhat.config.mjs', 'hardhat/hardhat.config.js', 'foundry.toml',
                     'ui/vendor/braces/lib/guard.js', 'test/fixtures/ENSOwnership.pre-revocation.sol.txt'):
            with self.subTest(path=name):
                self.mutate(self.legacy, name, lambda data: data + b'\n// unreviewed\n', rejected)
        # Previously absent compiler input, extra/missing vendor file and bootstrap material.
        for name in ('ui/vendor/braces/unreviewed.js', '.v114-bootstrap-unreviewed'):
            with self.subTest(extra=name):
                path = self.legacy / name
                self.assertFalse(path.exists())
                path.write_text('unreviewed\n')
                try:
                    rejected()
                finally:
                    path.unlink()
        for command in ('reverify:mainnet', 'reverify:sepolia', 'check:readiness', 'check:readiness:sepolia'):
            self.mutate(self.legacy, 'hardhat/package.json', json_change(lambda value, cmd=command:
                value['scripts'].__setitem__(cmd, value['scripts'][cmd].replace('--no-compile', ''))), rejected)
        self.mutate(self.legacy, 'hardhat/scripts/check-readiness.cjs',
            lambda data: data.replace(b'readRegistrySnapshot', b'unreviewedRegistry'), rejected)
        self.mutate(self.legacy, 'hardhat/scripts/check-readiness.cjs',
            lambda data: data + b'\nawait checkNftPolicy(\n', rejected)
        self.assertEqual(len(counts), 46)
        repairs = json.loads((self.legacy / M['REPAIRS']).read_text())
        # Every authorized lock-repair entry and every retained vendor file is
        # independently covered, including additions and replacement entries.
        for lock_name, changes in repairs['lockChanges'].items():
            for package in changes:
                with self.subTest(repaired=lock_name + ':' + package):
                    self.mutate(self.legacy, lock_name, json_change(lambda value, pkg=package:
                        value['packages'][pkg].update(unreviewed=True)), rejected)
        for name in repairs['vendoredFiles']:
            with self.subTest(vendored=name):
                self.mutate(self.legacy, name, lambda data:data+b'\n', rejected)
        self.assertEqual(len(counts), 103)
        # The old executable ignores an untracked remappings.txt. Keep its
        # original behavior and explicitly test the new profile's stronger gate.
        remappings = self.legacy / 'remappings.txt'
        remappings.write_text('unreviewed\n')
        try:
            with self.assertRaises(M['BoundaryError']):
                M['dependency_boundaries'](self.legacy, self.objects)
        finally:
            remappings.unlink()
        M['dependency_boundaries'](self.legacy, self.objects)

    def test_05_contract_membership_and_policy_history(self):
        def rejected():
            with self.assertRaises(M['BoundaryError']):
                M['verify_explicit'](self.args())
        for name in ('contracts/AGIJobManager.sol', 'contracts/utils/ENSOwnership.sol',
                     'hardhat/scripts/core-session.cjs', 'hardhat/scripts/actor-policy.cjs',
                     'hardhat/scripts/core-creation-plan.cjs',
                     'hardhat/test/direct-origin-policy.test.cjs',
                     'hardhat/test/direct-origin-trace.test.js',
                     'docs/deployment/direct-origination-profile.md',
                     'docs/deployment/ubuntu-ephemeral-creator.md',
                     'hardhat.creator.config.mjs',
                     'hardhat/scripts/deploy-core-tty.cjs',
                     'hardhat/scripts/deploy-core-tty.js',
                     'hardhat/scripts/ephemeral-key.cjs',
                     'hardhat/test/deploy-core-tty.test.cjs',
                     'hardhat/test/deploy-core-tty.test.js',
                     'hardhat/test/ephemeral-key.test.cjs',
                     'hardhat/scripts/operator-paths.cjs',
                     'hardhat/scripts/export-verification-package.cjs',
                     'hardhat/test/operator-private-state.regression.test.cjs',
                     'hardhat/test/core-session-output.test.cjs',
                     'hardhat/test/core-session.test.js', 'docs/ui/abi/AGIJobManager.json',
                     M['LEGACY'], M['REPAIRS'], M['INVENTORY'],
                     'scripts/successor/preservation.test.mjs',
                     'docs/qualification/mainnet-cutover-next-deployment.json'):
            with self.subTest(path=name):
                self.mutate(self.current, name, lambda data: data + b'\n', rejected)
        for name in ('contracts/Unreviewed.sol', 'contracts/ignored.bin', 'hardhat/scripts/unreviewed.pyc',
                     'hardhat/scripts/direct-origin-unreviewed.cjs',
                     'hardhat/test/direct-origin-unreviewed.test.cjs',
                     'docs/deployment/direct-origination-unreviewed.md',
                     'hardhat/scripts/deploy-core-tty-unreviewed.cjs',
                     'hardhat.creator.unreviewed.config.mjs',
                     'docs/deployment/ubuntu-ephemeral-unreviewed.md'):
            path = self.current / name
            path.write_text('// unreviewed\n')
            try:
                rejected()
                # Inventing a new digest/review reason cannot expand the finite
                # profile, even before externally pinned manifest validation.
                forged = copy.deepcopy(self.manifest)
                forged['inputs'][name] = {'mode': '100644',
                    'sha256': M['sha'](path.read_bytes()), 'predecessorGitBlob': None,
                    'predecessorSha256': None, 'reviewReason': 'Self-approved unexpected path'}
                forged['reviewedInputChanges'].append(name)
                with self.assertRaisesRegex(M['BoundaryError'], 'Unreviewed source input additions'):
                    M['source_inventory'](self.current, self.objects, forged, 'staged')
            finally:
                path.unlink()
        path = self.current / 'contracts/ens/ENSJobPages.sol'
        before = path.read_bytes()
        path.unlink()
        try:
            rejected()
        finally:
            path.write_bytes(before)
        path = self.current / 'hardhat/scripts/core-session.cjs'
        self.mutate(self.current, str(path.relative_to(self.current)),
            lambda data: (path.chmod(0o755), None)[1], rejected)
        before = path.read_bytes()
        path.unlink()
        path.symlink_to('../../README.md')
        try:
            rejected()
        finally:
            path.unlink()
            path.write_bytes(before)

    def test_06_schema_duplicate_keys_and_omitted_closure(self):
        schema = M['strict_json']((self.current / M['SCHEMA']).read_bytes())
        for change in (lambda m: m.update(unreviewed=True),
                       lambda m: m['claims'].update(sepolia='PASS'),
                       lambda m: m['releaseIdentity'].update(version='1.18.0'),
                       lambda m: m['constructorSchemas']['managerExplicit']['inputs'].pop(),
                       lambda m: m['evidenceReferences']['candidate-compatibility-3c974'].update(workflowConclusion='success'),
                       lambda m: m['evidenceReferences']['candidate-compatibility-3c974'].update(attempt=True),
                       lambda m: m['evidenceReferences']['legacy-baseline-06add'].update(sourceCommit=M['PREDECESSOR']),
                       lambda m: m['generatedOutputSchema'].update(coreArtifactCount=11),
                       lambda m: m['inputs'].update({'../escape': copy.deepcopy(next(iter(m['inputs'].values())))})):
            manifest = copy.deepcopy(self.manifest)
            change(manifest)
            with self.assertRaises(M['BoundaryError']):
                M['validate_schema'](manifest, schema)
        with self.assertRaises(M['BoundaryError']):
            M['strict_json']('{"profile":"legacy-v114","profile":"manager-explicit-governor-v1"}')
        for collection, name in (('inputs', 'hardhat/scripts/actor-policy.cjs'),
                                 ('compilerSourceClosure', '@openzeppelin/contracts/access/Ownable.sol')):
            manifest = copy.deepcopy(self.manifest)
            manifest[collection].pop(name)
            with self.assertRaises(M['BoundaryError']):
                if collection == 'inputs':
                    M['source_inventory'](self.current, self.objects, manifest, 'staged')
                else:
                    M['compiler_closure'](self.current, manifest, str(self.dependencies))

    def test_07_raw_git_hidden_mode_index_and_replacements(self):
        name = 'hardhat/scripts/core-session.cjs'
        for flag in ('assume-unchanged', 'skip-worktree'):
            local_git(self.current, 'update-index', '--' + flag, '--', name)
            try:
                with self.assertRaisesRegex(M['BoundaryError'], 'Hidden'):
                    M['Git'](self.current).index()
            finally:
                local_git(self.current, 'update-index', '--no-' + flag, '--', name)
        local_git(self.current, 'update-index', '--chmod=+x', '--', name)
        try:
            with self.assertRaisesRegex(M['BoundaryError'], 'Raw index'):
                M['source_inventory'](self.current, self.objects, self.manifest, 'staged')
        finally:
            local_git(self.current, 'read-tree', M['PREDECESSOR'])
        local_git(self.current, 'update-ref', 'refs/replace/' + M['PREDECESSOR'], self.legacy_commit)
        try:
            with self.assertRaisesRegex(M['BoundaryError'], 'replacement'):
                M['Git'](self.current)
        finally:
            local_git(self.current, 'update-ref', '-d', 'refs/replace/' + M['PREDECESSOR'])
        before = os.environ.get('GIT_DIR')
        os.environ['GIT_DIR'] = '/unreviewed/ambient/repository'
        try:
            self.assertEqual(M['Git'](self.current).index(), self.objects.tree(M['PREDECESSOR']))
        finally:
            if before is None:
                del os.environ['GIT_DIR']
            else:
                os.environ['GIT_DIR'] = before
        for key, value in (('include.path', '/unreviewed/config'),
                           ('filter.unreviewed.clean', 'must-not-execute')):
            local_git(self.current, 'config', '--local', key, value)
            try:
                with self.assertRaisesRegex(M['BoundaryError'], 'configuration'):
                    M['Git'](self.current)
            finally:
                local_git(self.current, 'config', '--local', '--unset', key)
        env = M['git_env']()
        self.assertEqual(env['GIT_NO_LAZY_FETCH'], '1')
        self.assertEqual(env['GIT_CONFIG_VALUE_0'], 'never')
        with self.assertRaisesRegex(M['BoundaryError'], 'unavailable offline'):
            M['Git'](self.current).blobs({'missing': {'gitBlob':'0'*40, 'mode':'100644'}})

    def test_08_compiler_dependency_bytes(self):
        dependency_copy = self.directory / 'dependency-copy'
        shutil.copytree(self.dependencies / '@openzeppelin', dependency_copy / '@openzeppelin')
        (dependency_copy / 'solc').mkdir()
        for name in ('package.json', 'soljson.js'):
            shutil.copyfile(self.dependencies / 'solc' / name, dependency_copy / 'solc' / name)
        try:
            patches = json.loads((self.current / 'scripts/security/openzeppelin-compiler-patches.json').read_text())
            names = ['@openzeppelin/contracts/access/Ownable.sol', *self.manifest['compilerInstall'],
                     *('@openzeppelin/contracts/' + n for n in patches['files'])]
            for name in names:
                with self.subTest(compiler_input=name):
                    path = dependency_copy / name
                    before = path.read_bytes()
                    path.write_bytes(before + b'\n')
                    try:
                        with self.assertRaises(M['BoundaryError']):
                            M['compiler_closure'](self.current, self.manifest, str(dependency_copy))
                    finally:
                        path.write_bytes(before)
            M['compiler_closure'](self.current, self.manifest, str(dependency_copy))
        finally:
            shutil.rmtree(dependency_copy)

    def test_09_clean_full_binding_fixture_and_revision_drift(self):
        # This local test-only commit exercises the gate. It is never offered as
        # an externally reviewed real candidate checkpoint.
        records = []
        for name in [*self.manifest['inputs'], M['MANIFEST']]:
            mode, data = M['raw_file'](self.current, name)
            entry = self.manifest['inputs'].get(name)
            if entry and entry['predecessorSha256'] == M['sha'](data):
                oid = entry['predecessorGitBlob']
            else:
                oid = local_git(self.current, 'hash-object', '-w', '--stdin', input=data).decode().strip()
            records.append((mode + ' ' + oid + '\t' + name).encode() + b'\0')
        local_git(self.current, 'update-index', '-z', '--index-info', input=b''.join(records))
        tree = local_git(self.current, 'write-tree').decode().strip()
        env = M['git_env']()
        env.update(GIT_AUTHOR_NAME='Offline fixture', GIT_AUTHOR_EMAIL='fixture@invalid',
                   GIT_COMMITTER_NAME='Offline fixture', GIT_COMMITTER_EMAIL='fixture@invalid',
                   GIT_AUTHOR_DATE='2000-01-01T00:00:00Z', GIT_COMMITTER_DATE='2000-01-01T00:00:00Z')
        commit = subprocess.check_output(['git', '-c', 'protocol.allow=never', '-c', 'core.hooksPath=/dev/null',
            'commit-tree', tree, '-p', M['PREDECESSOR']], cwd=self.current, env=env,
            input=b'TEST FIXTURE ONLY: no human review or release qualification\n').decode().strip()
        local_git(self.current, 'update-ref', 'refs/heads/fixture', commit)
        local_git(self.current, 'symbolic-ref', 'HEAD', 'refs/heads/fixture')
        binding = {'schema':'agijobmanager/source-review-binding/v1', 'profile':M['PROFILE'],
            'sourceCommit':commit, 'sourceTree':tree, 'manifestPath':M['MANIFEST'],
            'disposition':'SOURCE_BOUNDARIES_ONLY_NOT_RELEASE_QUALIFICATION',
            'lockSha256':{d+'package-lock.json':M['sha']((self.current/(d+'package-lock.json')).read_bytes()) for d in M['WORKSPACES']}}
        for key, name in [('manifestSha256',M['MANIFEST']),('dispatcherSha256',M['DISPATCHER']),
                          ('verifierSha256',M['VERIFIER']),('schemaSha256',M['SCHEMA'])]:
            binding[key] = M['sha']((self.current/name).read_bytes())
        binding_path = self.directory / 'TEST_ONLY_REVIEW_BINDING.json'
        write_json(binding_path, binding)
        args = self.args(mode='bound')
        args.review_binding = str(binding_path)
        args.review_binding_sha256 = M['sha'](binding_path.read_bytes())
        try:
            result = M['verify_explicit'](args)
            self.assertEqual(result['status'],'CLEAN_SOURCE_BOUNDARIES_PASSED')
            self.assertFalse(result['releaseQualified'])
            for key, replacement in [('sourceCommit',self.legacy_commit),('sourceTree',self.legacy_tree),
                                     ('dispatcherSha256','0'*64),('verifierSha256','0'*64)]:
                changed = dict(binding); changed[key] = replacement
                write_json(binding_path, changed)
                args.review_binding_sha256 = M['sha'](binding_path.read_bytes())
                with self.assertRaises(M['BoundaryError']):
                    M['check_binding'](self.current,self.manifest,args)
            write_json(binding_path,binding)
            args.review_binding_sha256 = M['sha'](binding_path.read_bytes())
            self.mutate(self.current, 'README.md', lambda data:data+b'\n',
                lambda:self.assertRaises(M['BoundaryError'],M['verify_explicit'],args))
        finally:
            local_git(self.current, 'read-tree', M['PREDECESSOR'])
            local_git(self.current, 'update-ref', '-d', 'refs/heads/fixture')


    def test_10_exact_additive_history_bytes_omission_and_provenance(self):
        M['verify_additive_history'](self.current, self.manifest)
        for name in M['ADDITIVE_HISTORY']:
            with self.subTest(history=name):
                path = self.current / name
                before = path.read_bytes()
                path.write_bytes(before + b'\n')
                try:
                    with self.assertRaisesRegex(M['BoundaryError'], 'historical bytes'):
                        M['verify_additive_history'](self.current, self.manifest)
                finally:
                    path.write_bytes(before)
                path.unlink()
                try:
                    with self.assertRaisesRegex(M['BoundaryError'], 'Missing source'):
                        M['verify_additive_history'](self.current, self.manifest)
                finally:
                    path.write_bytes(before)
                missing = copy.deepcopy(self.manifest)
                missing['additiveHistory'].pop(name)
                with self.assertRaisesRegex(M['BoundaryError'], 'membership/provenance'):
                    M['verify_additive_history'](self.current, missing)
                omitted_input = copy.deepcopy(self.manifest)
                omitted_input['inputs'].pop(name)
                with self.assertRaises(M['BoundaryError']):
                    M['source_inventory'](self.current, self.objects, omitted_input, 'staged')
                for key in ('sha256', 'externalSourceCommit', 'externalSourcePath',
                            'externalGitBlob', 'scope'):
                    tampered = copy.deepcopy(self.manifest)
                    tampered['additiveHistory'][name][key] = 'unreviewed-provenance-or-promotion'
                    with self.assertRaisesRegex(M['BoundaryError'], 'membership/provenance'):
                        M['verify_additive_history'](self.current, tampered)
        extra = self.current / 'docs/qualification/history/unreviewed.pyc'
        extra.write_bytes(b'ignored archive input')
        try:
            with self.assertRaises(M['BoundaryError']):
                M['source_inventory'](self.current, self.objects, self.manifest, 'staged')
        finally:
            extra.unlink()



    def test_11_exact_slither_review_slice_and_unexpected_paths(self):
        """Evidence/order integration is finite; it grants no security acceptance."""
        reviewed = (
            '.github/workflows/security-verification.yml',
            'docs/security/pr1586-e1ed502-evidence.json',
            'docs/security/pr1586-e1ed502-review.md',
            'scripts/security/run-slither-deterministic.py',
            'scripts/security/run-slither-extended.sh',
            'scripts/security/slither-reviewed-findings-pr1586-e1ed502.json',
            'scripts/security/test-slither-deterministic.py',
            'scripts/security/test-slither-review.py',
            'scripts/security/verify-slither-review.py',
        )
        schema = M['strict_json']((self.current / M['SCHEMA']).read_bytes())
        allowed = schema['properties']['reviewedInputChanges']['items']['enum']
        self.assertTrue(set(reviewed) <= M['REVIEW_PATHS'])
        self.assertTrue(set(reviewed) <= set(allowed))
        self.assertTrue(set(reviewed) <= set(self.manifest['reviewedInputChanges']))
        M['verify_explicit'](self.args())
        for name in reviewed:
            with self.subTest(changed=name):
                self.mutate(self.current, name, lambda data: data + b'\n',
                    lambda: self.assertRaises(M['BoundaryError'], M['verify_explicit'], self.args()))
                omitted = copy.deepcopy(self.manifest)
                omitted['inputs'].pop(name)
                with self.assertRaises(M['BoundaryError']):
                    M['source_inventory'](self.current, self.objects, omitted, 'staged')
        historical = 'scripts/security/slither-reviewed-findings-v1.18.0.json'
        self.assertEqual(M['sha']((self.current / historical).read_bytes()),
                         '2769b2c2d752771d19e2f1ae3345703b9c0986716d3af5dd659921a21f309209')
        for name in ('scripts/security/run-slither-unreviewed.py',
                     'docs/security/pr1586-unreviewed-review.md',
                     '.github/workflows/unreviewed-slither.yml'):
            with self.subTest(unexpected=name):
                path = self.current / name
                self.assertFalse(path.exists())
                path.write_text('unreviewed\n')
                try:
                    forged = copy.deepcopy(self.manifest)
                    forged['inputs'][name] = {'mode': '100644',
                        'sha256': M['sha'](path.read_bytes()), 'predecessorGitBlob': None,
                        'predecessorSha256': None, 'reviewReason': 'Self-approved security path'}
                    forged['reviewedInputChanges'].append(name)
                    with self.assertRaisesRegex(M['BoundaryError'], 'Schema enum mismatch'):
                        M['validate_schema'](forged, schema)
                    with self.assertRaisesRegex(M['BoundaryError'], 'Unreviewed source input additions'):
                        M['source_inventory'](self.current, self.objects, forged, 'staged')
                finally:
                    path.unlink()



    def test_12_fresh_fork_provenance_and_exact_report_comparison(self):
        """Fresh execution provenance does not promote archived evidence or flags."""
        workflow = '.github/workflows/mainnet-fork.yml'
        provenance = 'docs/qualification/mainnet-cutover-f274c6be-provenance.json'
        expected = 'docs/qualification/history/mainnet-cutover-3c974ad3-compatibility.json'
        historical = 'docs/qualification/mainnet-cutover-next-deployment.json'
        expected_sha = '34d8d737fd540f83317551bdf3e190c0c8d72d7e7aaef60303d0234f4bbfb0b1'
        earlier_sha = '36bc8cfb2d3d8e15b04372ea1fbed3fe407a921c0d70b525d673be4447f63746'
        workflow_text = (self.current / workflow).read_text()
        command = 'diff -u ' + expected + ' build/qualification/mainnet-cutover.json'
        self.assertEqual([line.strip() for line in workflow_text.splitlines()
                          if 'run: diff ' in line], ['run: ' + command])
        self.assertEqual(workflow_text.count('run: npm run test:mainnet-fork'), 1)
        self.assertEqual(workflow_text.count('run: npm run test:cutover'), 1)
        raw = (self.current / expected).read_bytes()
        self.assertEqual(M['sha'](raw), expected_sha)
        self.assertEqual(M['sha']((self.current / historical).read_bytes()), earlier_sha)
        report = M['strict_json'](raw)
        self.assertEqual(len(report['sourceSha256']), 76)
        for name, digest in report['sourceSha256'].items():
            self.assertEqual(M['sha']((self.current / name).read_bytes()), digest, name)
        self.assertEqual(report['passed'], 23)
        self.assertEqual(len(report['assertions']), 23)
        self.assertEqual(report['publicTransactionsBroadcast'], 0)
        self.assertIs(report['fixtureWallets'], True)
        self.assertIs(report['productionActivationApproved'], False)
        receipt = M['strict_json']((self.current / provenance).read_bytes())
        required = {
            'sourceCommit': 'f274c6be8ff982deed8edbc1003e24fa45fc07ad',
            'sourceTree': 'aa9874d205712d0c4ee7caf93018fc2cc9704606',
            'run': 38980884057, 'job': 117241221836,
            'workflowConclusion': 'failure', 'artifactId': 12081485164,
            'artifactBytes': 8981,
            'artifactSha256': '69f6e651297714385e6fca1a5f112872d19e1f70a4bda6394a924bd8f4f07d3d',
            'artifactMember': 'mainnet-cutover.json', 'reportBytes': len(raw),
            'reportSha256': expected_sha, 'expectedReport': expected,
            'executedReportEqualsExpectedBytes': True, 'sourceInputs': 76,
            'allSourceHashesMatchRecordedSource': True,
            'preservedEarlierReport': {'path': historical, 'sha256': earlier_sha},
            'usdcCasesPassed': 11, 'cutoverCasesPassed': 23,
            'publicTransactionsBroadcast': 0, 'fixtureWallets': True,
            'productionActivationApproved': False, 'scope': report['scope'],
        }
        for key, value in required.items():
            self.assertEqual(receipt[key], value, key)
        # Execute the same full-byte comparator as CI, without a fork/provider.
        with tempfile.TemporaryDirectory(dir=self.directory) as temp:
            executed = pathlib.Path(temp) / 'executed.json'
            def compared(data):
                executed.write_bytes(data)
                return subprocess.run(['diff', '-u', str(self.current / expected), str(executed)],
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False).returncode
            self.assertEqual(compared(raw), 0)
            mutations = []
            changed = copy.deepcopy(report)
            changed['sourceSha256'][next(iter(changed['sourceSha256']))] = '0' * 64
            mutations.append(('source-hash', changed))
            for key, value in (('passed', 22), ('publicTransactionsBroadcast', 1),
                               ('productionActivationApproved', True), ('fixtureWallets', False)):
                changed = copy.deepcopy(report); changed[key] = value
                mutations.append((key, changed))
            changed = copy.deepcopy(report); changed['assertions'].pop()
            mutations.append(('removed-assertion', changed))
            changed = copy.deepcopy(report); changed['unreviewedField'] = 'extra'
            mutations.append(('unknown-field', changed))
            for label, changed in mutations:
                with self.subTest(report_drift=label):
                    self.assertEqual(compared((json.dumps(changed, indent=2) + '\n').encode()), 1)
        schema = M['strict_json']((self.current / M['SCHEMA']).read_bytes())
        for name in (workflow, provenance):
            self.assertIn(name, M['REVIEW_PATHS'])
            self.assertIn(name, schema['properties']['reviewedInputChanges']['items']['enum'])
            with self.subTest(source_input=name):
                self.mutate(self.current, name, lambda data: data + b'\n',
                    lambda: self.assertRaises(M['BoundaryError'], M['verify_explicit'], self.args()))
                omitted = copy.deepcopy(self.manifest); omitted['inputs'].pop(name)
                with self.assertRaises(M['BoundaryError']):
                    M['source_inventory'](self.current, self.objects, omitted, 'staged')
        name = 'docs/qualification/mainnet-cutover-unreviewed-provenance.json'
        path = self.current / name
        self.assertFalse(path.exists()); path.write_text('{}\n')
        try:
            forged = copy.deepcopy(self.manifest)
            forged['inputs'][name] = {'mode': '100644', 'sha256': M['sha'](path.read_bytes()),
                'predecessorGitBlob': None, 'predecessorSha256': None,
                'reviewReason': 'Self-approved adjacent evidence'}
            forged['reviewedInputChanges'].append(name)
            with self.assertRaisesRegex(M['BoundaryError'], 'Schema enum mismatch'):
                M['validate_schema'](forged, schema)
            with self.assertRaisesRegex(M['BoundaryError'], 'Unreviewed source input additions'):
                M['source_inventory'](self.current, self.objects, forged, 'staged')
        finally:
            path.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--object-store', action='append')
    parser.add_argument('--dependency-root')
    parser.add_argument('--historical-bytes-root')
    OPTIONS, rest = parser.parse_known_args()
    unittest.main(argv=[sys.argv[0], *rest], verbosity=2)
