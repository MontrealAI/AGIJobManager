"""Cross-file Discovery release invariants; no hosted qualification or publication."""
import argparse
import ast
import copy
import contextlib
import io
import json
import pathlib
import re
import runpy
import stat
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from release_common import (sha, source_path, require, TITLE, TAG, REPOSITORY,
                            DISCOVERY_PROFILE, BUILDER_ASSETS, BUILDER_ARCHIVE_ONLY_ASSETS, verify_assets)

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRESERVATION = runpy.run_path(str(ROOT / 'scripts/release/run-discovery-preservation.py'))
BASE = PRESERVATION['BASE_COMMIT']
FEATURE = '68d1d3cae2e6f2d46c21e8e73311d309b2b307fd'
POLICY = runpy.run_path(str(ROOT / 'scripts/release/package-policy.py'))
PROFILE = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))


def previous(name, source=BASE):
    return subprocess.check_output(['git', '--no-replace-objects', '-C', str(ROOT), 'show', source + ':' + name])


def version_only(value, old):
    restored = copy.deepcopy(value)
    restored['version'] = old['version']
    if 'packages' in restored:
        restored['packages']['']['version'] = old['packages']['']['version']
    return restored


class DiscoveryPlumbing(unittest.TestCase):
    def test_historical_maintenance_guards_publisher_and_unrelated_gate_workflows_are_byte_exact(self):
        names = set(PRESERVATION['PROTECTED']) | {'.github/workflows/' + name for name in [
            'ci.yml', 'ui.yml', 'docs.yml', 'security-verification.yml', 'alpha-project-handoff.yml']}
        for name in sorted(names):
            with self.subTest(path=name): self.assertEqual((ROOT / name).read_bytes(), previous(name))
        for name in ['scripts/integrations/discovery-lab-native-test.mjs', 'config/discovery-lab-alpha-source.json']:
            with self.subTest(path=name): self.assertEqual((ROOT / name).read_bytes(), previous(name, FEATURE))

    def test_package_and_deployment_changes_are_version_metadata_only(self):
        for name in PROFILE['PACKAGE_FILES']:
            old = json.loads(previous(name)); current = json.loads((ROOT / name).read_bytes())
            with self.subTest(path=name):
                self.assertEqual(current['version'], '1.20.0')
                self.assertEqual(version_only(current, old), old)
        name = 'config/usdc-deployment.json'
        old = json.loads(previous(name)); current = json.loads((ROOT / name).read_bytes())
        self.assertEqual(current['version'], '1.20.0'); self.assertEqual(version_only(current, old), old)

    def test_copied_apache_module_has_packaged_license_and_origin_without_relicensing_manager(self):
        license_name = 'docs/LEGAL/LICENSES/Apache-2.0.txt'
        notice_name = 'docs/LEGAL/DISCOVERY_MODULE_ORIGIN.md'
        for name in (license_name, notice_name):
            source_path(name, stat.S_IFREG | 0o644)
        self.assertEqual(sha((ROOT / license_name).read_bytes()),
            'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4')
        self.assertEqual((ROOT / license_name).read_bytes(),
            (ROOT / 'site/assets/successor/vendor/alpha-project/LICENSE').read_bytes())
        self.assertEqual((ROOT / 'LICENSE').read_bytes(), previous('LICENSE'))
        module = ROOT / 'scripts/integrations/discovery-release-module-closure.mjs'
        self.assertTrue(module.read_text().startswith('// SPDX-License-Identifier: Apache-2.0\n'))
        notice = (ROOT / notice_name).read_text()
        for value in (sha(module.read_bytes()), 'MontrealAI/AGI-Fleet-Linux',
                'e4bc09db09f7b2b0bf5e1fd20dfd88d6791fe5ad', 'LICENSES/Apache-2.0.txt'):
            self.assertIn(value, notice)

    def test_explicit_new_selector_does_not_promote_old_source_candidate_profiles(self):
        selected = {'releaseProfile': 'manager-discovery-release-v1'}
        self.assertEqual(POLICY['policy'](selected)['PROFILE'], 'manager-discovery-release-v1')
        for profile in ['unknown', 'manager-discovery-release-v2', '1.20.0']:
            with self.subTest(profile=profile), self.assertRaises(ValueError): POLICY['select'](profile)
        parser = argparse.ArgumentParser()
        POLICY['add_selection_arguments'](parser)
        self.assertEqual(parser.parse_args(['--profile', 'manager-discovery-release-v1']).profile, 'manager-discovery-release-v1')
        for filename in ['discovery-lab-profile.py', 'discovery-lab-profile-v2.py']:
            old = runpy.run_path(str(ROOT / 'scripts/release' / filename))
            self.assertNotEqual(old['PROFILE'], selected['releaseProfile'])
            self.assertIn('published', __import__('inspect').signature(old['select']).parameters)

    def test_new_publisher_requires_dispatch_confirmation_readiness_and_exact_source_attestation(self):
        text = (ROOT / '.github/workflows/publish-discovery-v1.yml').read_text()
        for exact in ["github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'",
                "inputs.confirmation == 'PUBLISH_v1.20.0'", "if: steps.readiness.outputs.ready != 'true'\n        run: exit 1",
                'wait-qualification.py --source "$SOURCE_COMMIT" --profile manager-discovery-release-v1',
                '--deny-self-hosted-runners', '--source-ref refs/heads/main', '--signer-digest "$SOURCE_COMMIT"',
                '--source-digest "$SOURCE_COMMIT"', '$GITHUB_REPOSITORY/.github/workflows/publish-discovery-v1.yml']:
            self.assertIn(exact, text)
        self.assertNotIn('workflow_run:', text)
        self.assertEqual(text.count('--profile manager-discovery-release-v1'), 4)
        self.assertEqual(text.count('--native-source-root "$RUNNER_TEMP/discovery-alpha"'), 3)

    def test_actual_external_alpha_checkout_precedes_every_current_source_or_rebuild_gate(self):
        for filename in ['current-state-release.yml', 'discovery-lab-receiver.yml', 'publish-discovery-v1.yml']:
            text = (ROOT / '.github/workflows' / filename).read_text()
            with self.subTest(workflow=filename):
                capture = text.index('- name: Capture the exact reviewed Alpha implementation')
                isolate = text.index('mv "$GITHUB_WORKSPACE/build/discovery-alpha" "$RUNNER_TEMP/discovery-alpha"')
                self.assertLess(capture, isolate)
                self.assertIn('fetch-depth: 0', text[capture:isolate]); self.assertIn('persist-credentials: false', text[capture:isolate])
                self.assertIn('repository: MontrealAI/AGI-Alpha-Agent-v0', text[capture:isolate])
                for marker in ['scripts/release/discovery-release-profile.py --', 'scripts/release/collect-qualification.py --']:
                    if marker in text: self.assertLess(isolate, text.index(marker))
                self.assertIn('--native-source-root "$RUNNER_TEMP/discovery-alpha"', text)

    def test_native_matrix_and_log_markers_bind_actual_node_and_raw_manager_sources(self):
        text = (ROOT / '.github/workflows/discovery-lab-receiver.yml').read_text()
        self.assertIn("node: ['22.23.2', '24.21.0']", text)
        self.assertIn('fail-fast: false', text)
        for step in ['Verify qualified source checkout', 'Check exact source and run transport-policy regressions',
                'Verify the versioned Discovery release source inventory', 'Capture the exact reviewed Alpha implementation',
                'Run actual pinned synthetic campaign and native admission', 'Retain exact-source policy and actual local native evidence']:
            self.assertEqual(text.count('- name: ' + step + '\n'), 1)
        producer = (ROOT / 'scripts/release/discovery-saved-candidate.py').read_text()
        self.assertIn('discovery-saved-candidate.py --source', text)
        for marker in ['ALPHA_COMMIT', 'ALPHA_TREE', 'SOURCE_HASH', 'NODE', 'ADAPTER_SHA256',
                'CONTRACT_SHA256', 'RUNNER_SHA256', 'EVIDENCE_SHA256']:
            self.assertEqual(producer.count("'" + marker + "':"), 1)
        self.assertIn("evidence['node'] == 'v' + os.environ['DISCOVERY_MATRIX_NODE']", producer)
        self.assertIn('candidateArchiveSha256', producer)
        self.assertIn('scripts/integrations/discovery-release-native-test.mjs', producer)
        candidate = (ROOT / '.github/workflows/current-state-release.yml').read_text()
        self.assertEqual(candidate.count('discovery-browser-input.py --output'), 1)
        self.assertEqual(candidate.count('--browser-input-root "$RUNNER_TEMP/discovery-browser-input"'), 1)
        self.assertLess(candidate.index('discovery-browser-input.py --output'), candidate.index('for output in'))

    def test_expected_fork_and_scan_are_comparisons_with_unchanged_observations(self):
        provenance = json.loads((ROOT / 'docs/qualification/release-v1.20.0-provenance.json').read_bytes())
        self.assertIs(provenance['executed'], False)
        self.assertEqual(provenance['baselineCommit'], BASE)
        for kind, field in [('fork', 'sourceSha256'), ('staticAnalysis', 'source_sha256')]:
            item = provenance[kind]
            old_raw = previous(item['previousPath']); raw = (ROOT / item['expectedPath']).read_bytes()
            self.assertEqual(sha(old_raw), item['previousSha256']); self.assertEqual(sha(raw), item['expectedSha256'])
            old, current = json.loads(old_raw), json.loads(raw)
            old_hashes, current_hashes = old.pop(field), current.pop(field)
            changed = sorted(name for name in old_hashes if old_hashes[name] != current_hashes[name])
            self.assertEqual(set(old_hashes), set(current_hashes)); self.assertEqual(changed, item['changedSourceHashes'])
            for name, digest in current_hashes.items():
                with self.subTest(kind=kind, path=name): self.assertEqual(sha((ROOT / name).read_bytes()), digest)
            if kind == 'staticAnalysis':
                self.assertIn('EXPECTED_ONLY_PENDING_FINAL_SOURCE_EXECUTION', current.pop('scope'))
                old.pop('scope', None)
            self.assertEqual(current, old)
            self.assertIs(item['executed'], False); self.assertIs(item['observationsOrFindingsChanged'], False)
        fork = (ROOT / '.github/workflows/mainnet-fork.yml').read_bytes()
        self.assertEqual(fork.replace(b'v1.20.0-expected.json', b'v1.19.6-expected.json'), previous('.github/workflows/mainnet-fork.yml'))

    def test_current_pages_dispatch_is_explicit_and_historical_preservation_is_separate(self):
        text = (ROOT / '.github/workflows/pages.yml').read_text()
        for exact in ['.github/workflows/publish-discovery-v1.yml)', 'pages-publication-discovery.py --source',
                '.github/workflows/publish-v114.yml)', 'pages-publication-maintenance.py --source',
                '*) exit 1 ;;', 'run-discovery-preservation.py --pages build/pages']:
            self.assertIn(exact, text)
        self.assertIn('VERSION = \'1.20.0\'', (ROOT / 'scripts/release/run-discovery-preservation.py').read_text())
        self.assertIn('materialize(source_objects)', (ROOT / 'scripts/release/run-discovery-preservation.py').read_text())
        self.assertIn('test-discovery-lab-profile.py', (ROOT / 'scripts/release/run-discovery-preservation.py').read_text())

    def test_every_package_collector_and_publisher_workflow_flag_is_supported_by_the_real_cli(self):
        calls = {name: [] for name in ['collect-qualification', 'publish-release', 'package-release', 'verify-package']}
        for filename in ['current-state-release.yml', 'publish-discovery-v1.yml']:
            lines = (ROOT / '.github/workflows' / filename).read_text().splitlines()
            for index, line in enumerate(lines):
                for name in calls:
                    if 'python3 scripts/release/' + name + '.py ' not in line:
                        continue
                    command = line
                    while lines[index].rstrip().endswith(chr(92)):
                        index += 1; command += '\n' + lines[index]
                    calls[name].append((filename, set(re.findall(r'--[a-z][a-z-]*', command))))
        for name, invocations in calls.items():
            self.assertTrue(invocations, 'Missing real workflow invocation: ' + name)
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/release' / (name + '.py')), '--help'],
                capture_output=True, text=True, timeout=30, cwd=ROOT)
            self.assertEqual(result.returncode, 0, result.stderr)
            supported = set(re.findall(r'--[a-z][a-z-]*', result.stdout))
            for filename, flags in invocations:
                with self.subTest(script=name, workflow=filename): self.assertLessEqual(flags, supported)

    def test_live_native_and_inherited_gates_exist_at_every_discovery_publication_boundary(self):
        for name in ['collect-qualification.py', 'publish-release.py', 'pages-publication-discovery.py']:
            tree = ast.parse((ROOT / 'scripts/release' / name).read_text())
            strings = [node.value for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str)]
            with self.subTest(path=name):
                self.assertTrue(any(value.endswith('discovery-qualification.py') for value in strings))
                self.assertIn('validate', strings)
        publisher = (ROOT / 'scripts/release/publish-release.py').read_text()
        self.assertEqual(publisher.count("discovery['validate']"), 2)
        verify = (ROOT / 'scripts/release/verify-package.py').read_text()
        self.assertIn("['verify_record'](config)", verify)
        self.assertIn("['validate_alpha_capsule'](source_dir, capsule)", verify)
        self.assertIn("'--installed'", verify)
        self.assertIn("['validate_browser_capsule'](source_dir, browser_capsule)", verify)
        self.assertIn('discovery-continuation/fleet-browser-workspace.json', verify)
        self.assertIn('discovery-continuation/fleet-browser-request.json', verify)
        self.assertIn("'scripts/integrations/discovery-release-native-test.mjs'", verify)
        self.assertIn('publication-authorization-discovery.py', publisher)
        self.assertIn("['extract_browser_capsule']", publisher)
        self.assertIn("rebuild_args.extend(['--browser-input-root'", publisher)


class QualifiedDiscoveryRebuild(unittest.TestCase):
    """Real ZIP/package/collector/extractor phases with inert source and Builder outputs.

    Source authentication and the external Builder process use trusted fixtures;
    this establishes phase plumbing, never final-source/native qualification.
    """

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='manager-qualified-rebuild-')
        self.addCleanup(temporary.cleanup)
        self.folder = pathlib.Path(temporary.name)
        self.root = self.folder / 'source'; self.root.mkdir()
        fixture = runpy.run_path(str(ROOT / 'scripts/release/test-discovery-qualification.py'))
        pin, files, _, _ = fixture['browser_artifact_fixture']()
        for name, raw in {
                'config/discovery-release-browser-artifact-v1.json': (json.dumps(pin) + '\n').encode(),
                'scripts/release/discovery-qualification.py': (ROOT / 'scripts/release/discovery-qualification.py').read_bytes(),
                'LICENSE': b'MIT fixture\n', 'ui/agijobmanager-usdc.html': b'<!doctype html><title>fixture</title>',
                **{'docs/releases/' + TAG + '/' + name: b'Inert phase fixture.\n'
                    for name in ('START_HERE.md', 'RELEASE_NOTES.md', 'RECOVERY_GUIDE.md', 'VALIDATION.md')},
                }.items():
            target = self.root / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        binding = PROFILE['browser_policy'](self.root)['verify_browser_files'](self.root, files)
        self.browser_bytes = {**files, PROFILE['BROWSER_MANIFEST']: (json.dumps(binding) + '\n').encode()}
        self.browser = self.folder / 'original-input'; self.browser.mkdir()
        for name, raw in self.browser_bytes.items():
            target = self.browser / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        for command in (['init', '-q'], ['add', '.'], ['-c', 'user.name=Inert phase fixture',
                '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Trusted inert phase inputs']):
            subprocess.run(['git', '-C', str(self.root), *command], check=True)
        self.source = subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD']).decode().strip()
        self.tree = subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD^{tree}']).decode().strip()
        self.selection = PROFILE['select'](manifest=PROFILE['MANIFEST'],
            manifest_sha256='1' * 64, verifier_sha256='2' * 64)
        self.verifier = runpy.run_path(str(ROOT / 'scripts/release/verify-package.py'))
        self.packager = runpy.run_path(str(ROOT / 'scripts/release/package-release.py'), run_name='phase_fixture')
        self.package_calls = []
        self.assets = self.folder / 'candidate'
        self.package(self.assets, self.browser)
        self.config = {'repository': REPOSITORY, 'tag': TAG, 'name': TITLE, 'status': 'qualified',
            'sourceCommit': self.source, 'sourceTree': self.tree, 'checkoutCommit': self.source,
            'sourcePolicy': self.selection,
            'artifactDigests': {name: digest for name, digest in verify_assets(self.assets).items()
                if name != 'SHA256SUMS.txt'}}

    def package(self, output, browser):
        self.assertEqual(PROFILE['validate_browser_capsule'](self.root, browser, return_files=True)['files'],
            self.browser_bytes)
        self.package_calls.append(pathlib.Path(browser))
        context = {'sourceManifest': {'scope': 'inert phase fixture'}}
        def builder(command, **options):
            self.assertEqual(command[:2], ['node', 'scripts/successor/build.mjs'])
            generated = pathlib.Path(command[3]); generated.mkdir()
            for name in BUILDER_ASSETS | BUILDER_ARCHIVE_ONLY_ASSETS:
                value = context['sourceManifest'] if name == 'SOURCE_MANIFEST.json' else {
                    'sourceManifest': context['sourceManifest'], 'managerSource': {}} if name == 'MANAGER_CONTEXT.json' else None
                (generated / name).write_bytes((json.dumps(value) + '\n').encode() if value is not None
                    else ('Trusted inert Builder fixture ' + name).encode())
        discovery = {**PROFILE, 'capture_alpha_capsule': lambda *args: {
            'inert-source.mjs': ('100644', b'// inert; never imported\n')}}
        policy = {**POLICY, 'select': lambda *args, **kwargs: self.selection,
            'discovery_release': lambda: {'git_identity': lambda root: {'commit': self.source, 'tree': self.tree}},
            'checkout': lambda *args, **kwargs: None, 'validate_source': lambda *args: None,
            'policy': lambda selection: discovery}
        with patch.dict(self.packager['package'].__globals__, {'root': self.root, 'candidate_policy': policy,
                'subprocess': SimpleNamespace(run=builder, check_output=subprocess.check_output),
                'verified_builder_context': lambda *args: (context, b'{"version":"fixture"}\n'),
                'builder_reconstruction': lambda *args: contextlib.nullcontext()}), \
                contextlib.redirect_stdout(io.StringIO()):
            self.packager['package'](output, profile=DISCOVERY_PROFILE, browser_input_root=browser,
                native_source_root=self.folder / 'inert-alpha', dependency_root=self.folder / 'inert-compiler')

    def qualify(self):
        tree = ast.parse((ROOT / 'scripts/release/collect-qualification.py').read_text())
        start = next(index for index, node in enumerate(tree.body) if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == 'qualification_raw' for target in node.targets))
        # Execute the actual collector's file write, checksum regeneration and qualified verification.
        block = ast.Module(body=tree.body[start:-1], type_ignores=[])
        exec(compile(ast.fix_missing_locations(block), '<inert-collector-qualified-phase>', 'exec'),
            {'json': json, 'config': self.config, 'args': SimpleNamespace(out=self.assets, profile=DISCOVERY_PROFILE),
             'DISCOVERY_PROFILE': DISCOVERY_PROFILE, 'discovery': {'MAX_QUALIFICATION_BYTES': 64 * 1024 * 1024},
             'require': require, 'sha': sha, 'verify_assets': verify_assets})

    def extraction(self, destination, qualification=None):
        with patch.dict(self.verifier['extract_browser_capsule'].__globals__,
                {'__file__': str(self.root / 'scripts/release/verify-package.py')}):
            return self.verifier['extract_browser_capsule'](self.assets, destination, self.selection,
                qualification=qualification)

    def test_actual_publisher_rebuild_uses_the_collected_qualified_phase_and_original_capsule(self):
        self.qualify()
        with self.assertRaisesRegex(ValueError, 'Unexpected or missing assets'):
            verify_assets(self.assets)  # The former candidate-only call rejects this real qualified inventory.
        publisher = ast.parse((ROOT / 'scripts/release/publish-release.py').read_text())
        block = next(node for node in publisher.body if isinstance(node, ast.With) and any(
            isinstance(value, ast.Constant) and value.value == 'v114-publication-rebuild-'
            for value in ast.walk(node)))
        def build(command, **options):
            self.assertEqual(command[:2], ['python3', 'scripts/release/package-release.py'])
            self.assertEqual(options, {'cwd': self.root, 'check': True})
            self.package(pathlib.Path(command[command.index('--out') + 1]),
                pathlib.Path(command[command.index('--browser-input-root') + 1]))
        scope = {'tempfile': tempfile, 'pathlib': pathlib, 'profile_args': ['--profile', DISCOVERY_PROFILE],
            'args': SimpleNamespace(profile=DISCOVERY_PROFILE), 'DISCOVERY_PROFILE': DISCOVERY_PROFILE,
            'runpy': SimpleNamespace(run_path=lambda path: self.verifier), '__file__': str(ROOT / 'scripts/release/publish-release.py'),
            'out': self.assets, 'source_policy': self.selection, 'config': self.config,
            'subprocess': SimpleNamespace(run=build), 'root': self.root, 'verify_assets': verify_assets, 'require': require}
        with patch.dict(self.verifier['extract_browser_capsule'].__globals__,
                {'__file__': str(self.root / 'scripts/release/verify-package.py')}):
            old = ast.parse(previous('scripts/release/publish-release.py',
                '1ca9ab4c0064d7f53d00e661c675fc0dda87c6f1').decode())
            old_block = next(node for node in old.body if isinstance(node, ast.With) and any(
                isinstance(value, ast.Constant) and value.value == 'v114-publication-rebuild-'
                for value in ast.walk(node)))
            with self.assertRaisesRegex(ValueError, 'Unexpected or missing assets'):
                exec(compile(ast.fix_missing_locations(ast.Module(body=[old_block], type_ignores=[])),
                    '<retained-1ca-publisher-phase-failure>', 'exec'), scope)
            self.assertEqual(len(self.package_calls), 1)
            exec(compile(ast.fix_missing_locations(ast.Module(body=[block], type_ignores=[])),
                '<actual-publisher-qualified-rebuild>', 'exec'), scope)
        self.assertEqual(len(self.package_calls), 2)
        self.assertEqual({name: digest for name, digest in scope['actual'].items() if name != 'SHA256SUMS.txt'},
            self.config['artifactDigests'])

    def test_candidate_and_qualified_extraction_require_their_explicit_inventory_context(self):
        self.extraction(self.folder / 'candidate-extracted')
        self.qualify()
        with self.assertRaisesRegex(ValueError, 'Unexpected or missing assets'):
            self.extraction(self.folder / 'unqualified-extracted')
        self.extraction(self.folder / 'qualified-extracted', self.config)
        with self.assertRaisesRegex(ValueError, 'qualification context'):
            self.extraction(self.folder / 'wrong-policy', {**self.config, 'sourcePolicy': {}})

    def test_rehashed_qualification_or_assets_cannot_replace_the_callers_trusted_bindings(self):
        self.qualify()
        retained = self.assets / 'QUALIFICATION.json'; original = retained.read_bytes()
        retained.write_text(json.dumps({**self.config, 'ancillary': 'substituted'}))
        (self.assets / 'SHA256SUMS.txt').write_text(''.join(sha(p.read_bytes()) + '  ' + p.name + '\n'
            for p in sorted(self.assets.iterdir()) if p.name != 'SHA256SUMS.txt'))
        with self.assertRaisesRegex(ValueError, 'trusted qualification'):
            self.extraction(self.folder / 'changed-qualification', self.config)
        retained.write_bytes(original)
        (self.assets / 'agijobmanager-usdc.html').write_bytes(b'changed but rehashed standalone output')
        (self.assets / 'SHA256SUMS.txt').write_text(''.join(sha(p.read_bytes()) + '  ' + p.name + '\n'
            for p in sorted(self.assets.iterdir()) if p.name != 'SHA256SUMS.txt'))
        with self.assertRaisesRegex(ValueError, 'Qualification asset binding'):
            self.extraction(self.folder / 'changed-candidate', self.config)
        self.assertEqual(len(self.package_calls), 1)


class FinalDiscoveryPublicationIdentity(unittest.TestCase):
    """Run only the actual final guarded publisher block with inert API responses."""

    def run_tail(self, mutation=None, profile=DISCOVERY_PROFILE):
        tree = ast.parse((ROOT / 'scripts/release/publish-release.py').read_text())
        helper = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
            and node.name == 'verify_discovery_publication_identity')
        final = next(node for node in tree.body if isinstance(node, ast.If) and any(
            isinstance(value, ast.Constant) and value.value == 'Discovery native qualification changed during publication'
            for value in ast.walk(node)))
        publication = tree.body[tree.body.index(final) + 1]
        self.assertIsInstance(publication, ast.Expr)
        self.assertEqual(publication.value.func.id, 'api')
        self.assertEqual(publication.value.args[1].value, 'PATCH')
        source, tag = 'a' * 40, 'v1.20.0'
        release = {'id': 99, 'draft': True, 'prerelease': False, 'tag_name': tag,
            'target_commitish': source, 'name': TITLE, 'body': 'Reviewed notes'}
        asset = {'name': 'COMPLETE.zip', 'digest': 'sha256:' + 'c' * 64, 'state': 'uploaded'}
        remote = {'tag': {'object': {'sha': source}}, 'draft': copy.deepcopy(release),
            'assets': [asset], 'main': {'object': {'sha': source}}}
        self.events = []
        def validate(*args, **options):
            self.events.append('qualification')
            if mutation == 'tag': remote['tag']['object']['sha'] = 'b' * 40
            elif mutation == 'main': remote['main']['object']['sha'] = 'b' * 40
            elif mutation == 'asset-digest': remote['assets'][0]['digest'] = 'sha256:' + 'd' * 64
            elif mutation == 'asset-state': remote['assets'][0]['state'] = 'starter'
            elif mutation == 'asset-duplicate': remote['assets'].append(copy.deepcopy(asset))
            elif mutation and mutation.startswith('draft-'):
                key = mutation.removeprefix('draft-')
                remote['draft'][key] = False if key == 'draft' else True if key == 'prerelease' else 'changed'
            return {'checked': True}
        def api(endpoint, method='GET', body=None):
            if method == 'PATCH':
                self.events.append('PATCH'); return {}
            key = {f'git/ref/tags/{tag}': 'tag', 'releases/99': 'draft', 'git/ref/heads/main': 'main'}[endpoint]
            self.events.append(key); return copy.deepcopy(remote[key])
        def assets(release_id):
            self.assertEqual(release_id, 99); self.events.append('assets'); return copy.deepcopy(remote['assets'])
        scope = {'require': require, 'TITLE': TITLE, 'DISCOVERY_PROFILE': DISCOVERY_PROFILE,
            'args': argparse.Namespace(profile=profile), 'config': {'discoveryQualification': {'checked': True}},
            'discovery': {'validate': validate, 'download_native_artifact': lambda *args: None},
            'api': api, 'tag_target': lambda ref: ref['object']['sha'], 'release_assets': assets,
            'tag': tag, 'source': source, 'release': release, 'notes': 'Reviewed notes',
            'wanted': {'COMPLETE.zip': asset['digest']}, 'release_endpoint': 'releases/99'}
        module = ast.Module(body=[helper, final, publication], type_ignores=[])
        exec(compile(ast.fix_missing_locations(module), '<inert-final-publication-block>', 'exec'), scope)

    def test_all_mutable_identities_follow_final_qualification_with_main_last_before_publication(self):
        self.run_tail()
        self.assertEqual(self.events, ['qualification', 'tag', 'draft', 'assets', 'main', 'PATCH'])

    def test_changes_during_final_qualification_refuse_before_any_publication_patch(self):
        for mutation in ['tag', 'main', 'asset-digest', 'asset-state', 'asset-duplicate',
                *('draft-' + key for key in ['id', 'draft', 'prerelease', 'tag_name', 'target_commitish', 'name', 'body'])]:
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.run_tail(mutation)
            self.assertEqual(self.events[0], 'qualification')
            self.assertNotIn('PATCH', self.events)

    def test_additional_final_identity_guard_is_discovery_only(self):
        self.run_tail(profile='manager-dependency-maintenance-v1')
        self.assertEqual(self.events, ['PATCH'])


class PreservationGitConfiguration(unittest.TestCase):
    def test_actual_nested_directory_cannot_impersonate_the_git_worktree_root(self):
        with tempfile.TemporaryDirectory(prefix='discovery-preservation-root-') as temporary:
            root = pathlib.Path(temporary)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            nested = root / 'nested-copy'; nested.mkdir()
            with self.assertRaisesRegex(ValueError, 'actual Git root'):
                PRESERVATION['validate_current'](nested)
    def test_worktree_specific_filter_metadata_is_refused_without_installing_a_command(self):
        with tempfile.TemporaryDirectory(prefix='discovery-preservation-worktree-config-') as temporary:
            root = pathlib.Path(temporary)
            command = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL)
            command('init', '-q'); command('config', 'user.name', 'Local ordering fixture')
            command('config', 'user.email', 'fixture@example.invalid')
            (root / 'probe').write_text('initial source\n'); command('add', '.')
            command('commit', '-qm', 'Inert source fixture')
            command('config', '--local', 'extensions.worktreeConfig', 'true')
            command('config', '--worktree', 'filter.fixture.required', 'false')
            (root / '.git/info/attributes').write_text('probe filter=fixture\n')
            (root / 'probe').write_text('changed source\n')
            self.assertNotIn(b'filter.fixture.required', command('config', '--local', '--no-includes', '--list'))
            with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                PRESERVATION['validate_current'](root)

    def test_preservation_audits_active_worktree_flag_before_its_first_git_call(self):
        for value in ('true', '', 'uncertain'):
            with self.subTest(value=value), tempfile.TemporaryDirectory(prefix='discovery-preservation-main-') as folder:
                root = pathlib.Path(folder); metadata = root / '.git'; metadata.mkdir()
                entry = ' worktreeConfig' if not value else ' worktreeConfig = ' + value
                (metadata / 'config').write_text('[core]\n bare = false\n[extensions]\n' + entry + '\n')
                (metadata / 'config.worktree').write_text('[core]\n sparseCheckout = false\n')
                command = unittest.mock.Mock(side_effect=AssertionError('Git must follow the raw main configuration audit'))
                with patch.dict(PRESERVATION['validate_current'].__globals__, {'git': command}), \
                        self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                    PRESERVATION['validate_current'](root)
                command.assert_not_called()

    def test_preservation_keeps_regular_ignored_worktree_file_and_reaches_git_with_false_or_absent_flag(self):
        for extension in ('', '[extensions]\n worktreeConfig = false\n'):
            with tempfile.TemporaryDirectory(prefix='discovery-preservation-ignored-') as folder:
                root = pathlib.Path(folder); metadata = root / '.git'; metadata.mkdir()
                (metadata / 'config').write_text('[core]\n bare = false\n' + extension)
                ignored = metadata / 'config.worktree'; raw = b'[core]\n sparseCheckout = false\n'
                ignored.write_bytes(raw)
                command = unittest.mock.Mock(side_effect=RuntimeError('Ordinary Git boundary reached'))
                with patch.dict(PRESERVATION['validate_current'].__globals__, {'git': command}), \
                        self.assertRaisesRegex(RuntimeError, 'Ordinary Git boundary reached'):
                    PRESERVATION['validate_current'](root)
                command.assert_called_once()
                self.assertEqual(ignored.read_bytes(), raw)

    def test_actual_local_filters_includes_and_worktree_overrides_are_refused_before_status(self):
        with tempfile.TemporaryDirectory(prefix='discovery-preservation-config-') as temporary:
            root = pathlib.Path(temporary)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            original = PRESERVATION['git']
            for key, value in [('filter.fixture.required', 'false'),
                    ('include.path', '/nonexistent-included-config'),
                    ('includeIf.gitdir:/fixture/.path', '/nonexistent-included-config'),
                    ('core.worktree', str(root)), ('core.attributesFile', '/nonexistent-attributes')]:
                subprocess.run(['git', '-C', str(root), 'config', '--local', key, value], check=True)
                calls = []
                def observed(folder, *arguments, **options):
                    calls.append(arguments)
                    if arguments[0] == 'status':
                        raise AssertionError('Status must not precede configuration refusal')
                    return original(folder, *arguments, **options)
                with patch.dict(PRESERVATION['validate_current'].__globals__, {'git': observed}):
                    with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                        PRESERVATION['validate_current'](root)
                self.assertFalse(any(arguments[0] == 'status' for arguments in calls))
                subprocess.run(['git', '-C', str(root), 'config', '--local', '--unset', key], check=True)

    def test_inert_transport_config_and_promisor_metadata_are_refused_before_object_reads(self):
        with tempfile.TemporaryDirectory(prefix='discovery-preservation-transport-metadata-') as temporary:
            root = pathlib.Path(temporary)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            cases = [('remote.fixture.promisor', 'true'), ('extensions.partialClone', 'fixture'),
                ('remote.fixture.uploadpack', 'unsupported-policy-value'),
                ('remote.fixture.receivepack', 'unsupported-policy-value'),
                ('remote.fixture.vcs', 'unsupported-policy-value'),
                ('core.sshCommand', 'unsupported-policy-value'), ('core.gitProxy', 'unsupported-policy-value'),
                ('core.alternateRefsCommand', 'unsupported-policy-value'),
                ('protocol.file.allow', 'never'), ('http.proxy', 'https://example.invalid'),
                ('remote.fixture.proxy', 'https://example.invalid'), ('archive.fixture.command', 'unsupported-policy-value'),
                ('pager.fixture', 'unsupported-policy-value')]
            original = PRESERVATION['git']
            for key, value in cases:
                subprocess.run(['git', '-C', str(root), 'config', '--local', key, value], check=True)
                calls = []
                def metadata_only(folder, *arguments, **options):
                    calls.append(arguments)
                    self.assertFalse(arguments[0] in {'status', 'show', 'ls-tree', 'merge-base', 'cat-file'})
                    self.assertFalse(arguments[0] == 'rev-parse' and any('HEAD' in item or '^{tree}' in item for item in arguments))
                    return original(folder, *arguments, **options)
                with patch.dict(PRESERVATION['validate_current'].__globals__, {'git': metadata_only}):
                    with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                        PRESERVATION['validate_current'](root)
                subprocess.run(['git', '-C', str(root), 'config', '--local', '--unset', key], check=True)
            packs = root / '.git/objects/pack'; packs.mkdir(exist_ok=True)
            (packs / ('pack-' + 'a' * 40 + '.promisor')).write_bytes(b'')
            with patch.dict(PRESERVATION['validate_current'].__globals__, {'git': metadata_only}):
                with self.assertRaisesRegex(ValueError, 'Promisor'):
                    PRESERVATION['validate_current'](root)


class EntrypointGitGuardOrdering(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='discovery-entrypoint-filter-')
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        self.command('init', '-q'); self.command('config', 'user.name', 'Local entrypoint ordering fixture')
        self.command('config', 'user.email', 'fixture@example.invalid')
        (self.root / '.gitattributes').write_text('probe filter=fixture\n')
        (self.root / 'probe').write_text('initial source\n')
        self.command('add', '.'); self.command('commit', '-qm', 'Inert entrypoint fixture')
        self.source = self.command('rev-parse', 'HEAD').decode().strip()
        self.tree = self.command('rev-parse', 'HEAD^{tree}').decode().strip()
        self.command('config', '--local', 'filter.fixture.required', 'false')
        (self.root / 'probe').write_text('changed source\n')
        self.options = {'profile': PROFILE['PROFILE'], 'manifest': PROFILE['MANIFEST'],
            'manifest_sha256': 'a' * 64, 'verifier_sha256': 'b' * 64}
    def command(self, *arguments):
        return subprocess.check_output(['git', '-C', str(self.root), *arguments], stderr=subprocess.DEVNULL)
    def test_real_package_entrypoint_rejects_inert_filter_metadata_before_status_or_compilation(self):
        package = runpy.run_path(str(ROOT / 'scripts/release/package-release.py'))
        with patch.dict(package['package'].__globals__, {'root': self.root}):
            with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                package['package'](self.root / 'output', **self.options,
                    dependency_root=str(self.root), native_source_root=str(self.root))
        self.assertFalse((self.root / 'output').exists())
    def test_real_publisher_entrypoint_rejects_inert_filter_metadata_before_status_or_remote_work(self):
        scripts = self.root / 'scripts/release'; scripts.mkdir(parents=True)
        for name in ['publish-release.py', 'package-policy.py', 'candidate-profile.py',
                'release-profile.py', 'discovery-release-profile.py']:
            (scripts / name).write_bytes((ROOT / 'scripts/release' / name).read_bytes())
        qualification = self.root / 'qualification.json'
        qualification.write_text(json.dumps({'sourceCommit': self.source, 'sourceTree': self.tree,
            'sourcePolicy': POLICY['select'](**self.options, published=True)}))
        script = scripts / 'publish-release.py'
        arguments = [str(script), '--qualification', str(qualification), '--assets', str(self.root / 'assets'),
            '--profile', self.options['profile'], '--manifest', self.options['manifest'],
            '--manifest-sha256', self.options['manifest_sha256'], '--verifier-sha256', self.options['verifier_sha256'],
            '--dependency-root', str(self.root), '--native-source-root', str(self.root)]
        original = subprocess.run; remote_calls = []
        def local_only(command, **kwargs):
            if command[0] == 'gh':
                remote_calls.append(command); raise AssertionError('Guard must precede remote evidence work')
            return original(command, **kwargs)
        with patch.object(sys, 'argv', arguments), patch.object(subprocess, 'run', side_effect=local_only):
            with self.assertRaisesRegex(ValueError, 'configuration is prohibited'):
                runpy.run_path(str(script), run_name='__main__')
        self.assertFalse(remote_calls)
        self.assertFalse((self.root / 'assets').exists())


class CurrentPagesPreservation(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='discovery-current-pages-')
        self.addCleanup(self.temporary.cleanup)
        self.pages = pathlib.Path(self.temporary.name) / 'pages'; self.pages.mkdir()
        routes = json.loads((ROOT / 'docs/successor/PRESERVATION_BASELINE.json').read_bytes())['routes']
        routes = (set(routes) | {'successor/index.html', 'fr/successor/index.html'}) - {'build-info.json', '.nojekyll'}
        self.files = {}
        for name in routes:
            target = self.pages / name; target.parent.mkdir(parents=True, exist_ok=True)
            raw = b'<html><p>Inert synthetic raw inventory fixture</p></html>'
            target.write_bytes(raw); self.files[name] = {'bytes': len(raw), 'sha256': sha(raw)}
        (self.pages / '.nojekyll').write_bytes(b'')
        self.info = {'sourceCommit': 'a' * 40, 'sourceVersion': '1.20.0', 'files': self.files,
            'buildOnlyFiles': {'.nojekyll': {'bytes': 0, 'sha256': sha(b'')}}}
        self.write_info()
    def write_info(self): (self.pages / 'build-info.json').write_text(json.dumps(self.info))
    def validate(self): PRESERVATION['validate_pages'](ROOT, self.pages, 'a' * 40)
    def test_complete_source_bound_raw_inventory_is_accepted(self): self.validate()
    def test_missing_changed_or_extra_raw_asset_is_rejected(self):
        name = next(iter(self.files)); path = self.pages / name; raw = path.read_bytes()
        path.unlink()
        with self.assertRaises(ValueError): self.validate()
        path.write_bytes(raw + b' ')
        with self.assertRaises(ValueError): self.validate()
        path.write_bytes(raw); extra = self.pages / 'unexpected.html'; extra.write_bytes(b'x')
        with self.assertRaises(ValueError): self.validate()
    def test_rehashed_inventory_cannot_omit_retained_route_or_rebind_source(self):
        name = 'successor/index.html'
        (self.pages / name).unlink(); self.info['files'].pop(name); self.write_info()
        with self.assertRaisesRegex(ValueError, 'route is missing'): self.validate()
        self.info['sourceCommit'] = 'b' * 40; self.write_info()
        with self.assertRaisesRegex(ValueError, 'source identity'): self.validate()
    def test_wrong_version_and_indirect_raw_assets_are_rejected(self):
        self.info['sourceVersion'] = '1.19.6'; self.write_info()
        with self.assertRaisesRegex(ValueError, 'source identity'): self.validate()
        self.info['sourceVersion'] = '1.20.0'; self.write_info()
        name = next(iter(self.files)); path = self.pages / name; path.unlink()
        path.symlink_to(self.pages / '.nojekyll')
        with self.assertRaisesRegex(ValueError, 'indirect'): self.validate()


if __name__ == '__main__': unittest.main()
