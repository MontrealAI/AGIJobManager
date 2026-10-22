"""Discovery Pages metadata negatives and mocked orchestration; no real publication."""
import copy
import pathlib
import runpy
import unittest
from release_common import REPOSITORY, TAG, TITLE

P = runpy.run_path(str(pathlib.Path(__file__).with_name('pages-publication-discovery.py')))
SOURCE = 'a' * 40


class PublishedPages(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'workflow_run'}
        self.run = {'id': 101, 'workflow_id': 202, 'run_attempt': 1, 'path': P['TRIGGER_PATH'],
            'event': 'workflow_dispatch', 'head_branch': 'main', 'head_sha': SOURCE, 'status': 'completed', 'conclusion': 'success',
            'repository': {'full_name': REPOSITORY}, 'head_repository': {'full_name': REPOSITORY}}
        self.event = {'action': 'completed', 'repository': {'full_name': REPOSITORY}, 'workflow_run': self.run}
        self.observed = copy.deepcopy(self.run)
        self.job = {'name': 'publish', 'status': 'completed', 'conclusion': 'success', 'head_sha': SOURCE, 'run_id': 101,
            'steps': [{'name': name, 'status': 'completed', 'conclusion': 'success'} for name in P['PUBLISH_STEPS']]}
        self.release = {'id': 303, 'tag_name': TAG, 'target_commitish': SOURCE, 'name': TITLE,
            'draft': False, 'prerelease': False, 'immutable': True, 'published_at': '2026-10-19T00:00:00Z'}
        self.expected = {name: 'b'*64 for name in P['ASSET_NAMES']}; self.sizes = {name: 100 for name in self.expected}
        self.assets = [{'name': name, 'digest': 'sha256:' + digest, 'size': self.sizes[name], 'state': 'uploaded'} for name, digest in self.expected.items()]
        self.main = SOURCE; self.tag = SOURCE
        self.config = {'candidateArtifact': {'id': 404, 'name': f'AGIJobManager-{TAG}-candidate-{SOURCE}', 'digest': 'sha256:' + 'c'*64, 'size_in_bytes': 100},
            'requiredSourceRuns': {'current-state-release.yml': {'id': 505}}}
        self.artifact = {**self.config['candidateArtifact'], 'expired': False, 'workflow_run': {'id': 505, 'head_sha': SOURCE}}
    def api(self, endpoint):
        if endpoint == 'actions/runs/101': return self.observed
        if endpoint == 'actions/workflows/202': return {'id': 202, 'path': P['TRIGGER_PATH']}
        if endpoint == 'actions/runs/101/attempts/1/jobs?per_page=100&page=1': return {'jobs': [self.job]}
        if endpoint == 'git/ref/heads/main': return {'object': {'sha': self.main}}
        if endpoint == f'git/ref/tags/{TAG}': return {'object': {'type': 'tag', 'sha': 'd'*40}}
        if endpoint == 'git/tags/' + 'd'*40: return {'object': {'type': 'commit', 'sha': self.tag}}
        if endpoint == 'releases/303/assets?per_page=100&page=1': return self.assets
        if endpoint == 'actions/artifacts/404': return self.artifact
        raise AssertionError('Unexpected metadata request: ' + endpoint)
    def authorize(self): P['authorize_event'](self.env, SOURCE, self.api, self.event)
    def release_check(self): P['validate_published_release'](self.release, SOURCE, self.api, self.expected, self.sizes)
    def test_fresh_successful_exact_source_published_release_is_authorized(self):
        self.authorize(); self.release_check(); P['validate_candidate'](self.config, SOURCE, self.api)
        self.run['event'] = self.observed['event'] = 'workflow_run'
        with self.assertRaises(ValueError): self.authorize()
    def test_wrong_event_repository_ref_or_trigger_is_rejected(self):
        for key, value in [('GITHUB_EVENT_NAME', 'push'), ('GITHUB_EVENT_NAME', 'pull_request'),
                ('GITHUB_REF', 'refs/tags/' + TAG), ('GITHUB_REPOSITORY', 'fork/repository')]:
            old = self.env[key]; self.env[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.authorize()
            self.env[key] = old
        self.event['action'] = 'requested'
        with self.assertRaises(ValueError): self.authorize()
    def test_event_and_observed_publisher_require_exact_identity_source_attempt_and_success(self):
        for target in (self.run, self.observed):
            for key, value in [('id', 999), ('workflow_id', 999), ('run_attempt', 2), ('head_sha', 'e'*40),
                    ('head_branch', 'feature'), ('event', 'pull_request'), ('path', '.github/workflows/other.yml'),
                    ('status', 'in_progress'), ('conclusion', 'failure'), ('conclusion', 'skipped'),
                    ('repository', {'full_name': 'fork/repository'}), ('head_repository', {'full_name': 'fork/repository'})]:
                old = target[key]; target[key] = value
                with self.subTest(key=key, value=value), self.assertRaises((ValueError, AssertionError)): self.authorize()
                target[key] = old
    def test_missing_failed_or_skipped_publisher_steps_block_pages(self):
        for step in self.job['steps']:
            for conclusion in ('failure', 'skipped', None):
                step['conclusion'] = conclusion
                with self.subTest(step=step['name'], conclusion=conclusion), self.assertRaises(ValueError): self.authorize()
            step['conclusion'] = 'success'
        self.job['steps'].pop()
        with self.assertRaises(ValueError): self.authorize()
    def test_stale_main_or_release_tag_is_rejected(self):
        self.main = 'e'*40
        with self.assertRaises(ValueError): self.authorize()
        with self.assertRaises(ValueError): self.release_check()
        self.main = SOURCE; self.tag = 'e'*40
        with self.assertRaises(ValueError): self.release_check()
    def test_unpublished_mutable_old_or_wrong_release_is_rejected(self):
        for key, value in [('draft', True), ('prerelease', True), ('immutable', False), ('published_at', None),
                ('tag_name', 'v1.19.3'), ('target_commitish', 'main'), ('target_commitish', 'e'*40), ('name', 'other')]:
            old = self.release[key]; self.release[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.release_check()
            self.release[key] = old
    def test_release_assets_require_complete_exact_uploaded_bytes_and_digests(self):
        for key, value in [('digest', 'sha256:' + 'e'*64), ('size', 101), ('state', 'starter')]:
            old = self.assets[0][key]; self.assets[0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): self.release_check()
            self.assets[0][key] = old
        original = list(self.assets)
        for modified in (original[:-1], original + [original[0]], original + [{'name': 'extra'}]):
            self.assets = modified
            with self.assertRaises(ValueError): self.release_check()
        self.assets = original
    def test_candidate_artifact_requires_qualified_run_source_and_exact_metadata(self):
        P['validate_candidate'](self.config, SOURCE, self.api)
        for key, value in [('expired', True), ('name', 'other'), ('digest', 'sha256:' + 'e'*64),
                ('size_in_bytes', 101), ('workflow_run', {'id': 999, 'head_sha': SOURCE}),
                ('workflow_run', {'id': 505, 'head_sha': 'e'*40})]:
            old = self.artifact[key]; self.artifact[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): P['validate_candidate'](self.config, SOURCE, self.api)
            self.artifact[key] = old



class PagesOrchestration(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.fixture = PublishedPages(); self.fixture.setUp()
        self.temporary = tempfile.TemporaryDirectory(prefix='discovery-pages-orchestration-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = pathlib.Path(self.temporary.name)
        self.root = self.directory / 'source'; self.root.mkdir()
        for name in ['config/manager-discovery-release-v1.json', 'scripts/release/discovery-release-profile.py']:
            path = self.root / name; path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('Synthetic orchestration checkpoint only; never imported.\n')
        from release_common import sha, qualification_workflows
        self.selection = {'releaseProfile': 'manager-discovery-release-v1',
            'manifestPath': 'config/manager-discovery-release-v1.json',
            'manifestSha256': sha((self.root / 'config/manager-discovery-release-v1.json').read_bytes()),
            'verifierSha256': sha((self.root / 'scripts/release/discovery-release-profile.py').read_bytes())}
        self.discovery = {'scope': 'Synthetic stub for orchestration only; actual qualifier tested separately'}
        self.config = {**self.fixture.config, 'sourceCommit': SOURCE, 'publicationAuthorized': True,
            'sourcePolicy': copy.deepcopy(self.selection), 'discoveryQualification': copy.deepcopy(self.discovery)}
        self.config['requiredSourceRuns'] = {name: {'id': 505} for name in qualification_workflows(self.config)}
        self.event = self.directory / 'event.json'
        import json
        self.event.write_text(json.dumps(self.fixture.event)); self.output = self.directory / 'output'
        self.payload = {name: b'x' * 100 for name in self.fixture.expected}
        self.attestations, self.discovery_calls, self.downloads, self.raw_checks = [], [], [], []
        self.fail_attestation = False; self.fail_raw = False; self.fail_live = False

    def api(self, endpoint):
        if endpoint.startswith('releases/tags/'):
            return {**self.fixture.release, 'assets': self.fixture.assets}
        return self.fixture.api(endpoint)

    def command(self, command, **kwargs):
        import json
        from types import SimpleNamespace
        assert command[0] == 'gh'
        if command[1] == 'api':
            prefix = 'repos/MontrealAI/AGIJobManager/'
            assert command[2].startswith(prefix) and command[3:] == ['--method', 'GET']
            return SimpleNamespace(returncode=0, stdout=json.dumps(self.api(command[2][len(prefix):])).encode())
        if command[1:3] == ['release', 'download']:
            self.downloads.append(command)
            target = pathlib.Path(command[command.index('--dir') + 1])
            for name, raw in self.payload.items(): (target / name).write_bytes(raw)
            return SimpleNamespace(returncode=0, stdout=b'')
        if command[1:3] == ['attestation', 'verify']:
            self.attestations.append(command)
            assert command[command.index('--signer-workflow') + 1] == REPOSITORY + '/.github/workflows/publish-discovery-v1.yml'
            assert command[command.index('--signer-digest') + 1] == SOURCE
            assert command[command.index('--source-digest') + 1] == SOURCE
            assert command[command.index('--source-ref') + 1] == 'refs/heads/main'
            assert '--deny-self-hosted-runners' in command
            return SimpleNamespace(returncode=1 if self.fail_attestation else 0, stdout=b'')
        raise AssertionError('Unexpected synthetic command: ' + repr(command))

    def invoke(self):
        import contextlib, io, json, os, subprocess, sys
        from unittest.mock import patch
        self.payload['QUALIFICATION.json'] = json.dumps(self.config).encode()
        for item in self.fixture.assets: item['size'] = len(self.payload[item['name']])
        real_run_path = runpy.run_path
        def selected(path, *args, **kwargs):
            if pathlib.Path(path).name == 'package-policy.py':
                def select(profile, **options):
                    assert profile == 'manager-discovery-release-v1' and options['published'] is True
                    assert options['manifest'] == self.selection['manifestPath']
                    assert options['manifest_sha256'] == self.selection['manifestSha256']
                    assert options['verifier_sha256'] == self.selection['verifierSha256']
                    return copy.deepcopy(self.selection)
                return {'select': select}
            if pathlib.Path(path).name == 'discovery-qualification.py':
                def validate(config, api, logs, download, *, alpha_api):
                    assert callable(download)
                    self.discovery_calls.append(config)
                    if self.fail_live: raise ValueError('Synthetic live gate refusal')
                    return copy.deepcopy(self.discovery)
                return {'validate': validate, 'download_native_artifact': lambda artifact: b'',
                    'ALPHA_REPOSITORY': 'MontrealAI/AGI-Alpha-Agent-v0', 'github_read_api': lambda *args: {}}
            return real_run_path(path, *args, **kwargs)
        def verify(assets, config):
            self.raw_checks.append(config)
            if self.fail_raw: raise ValueError('Synthetic raw-byte verifier refusal')
            assert {p.name for p in assets.iterdir()} == set(self.fixture.expected)
            return self.fixture.expected
        globals_ = P['main'].__globals__
        with patch.dict(os.environ, {**self.fixture.env, 'GITHUB_EVENT_PATH': str(self.event), 'GITHUB_OUTPUT': str(self.output)}), \
                patch.object(sys, 'argv', ['pages-publication-discovery.py', '--source', SOURCE]), \
                patch.object(subprocess, 'run', side_effect=self.command), \
                patch.object(subprocess, 'check_output', return_value=SOURCE + '\n'), \
                patch.object(runpy, 'run_path', side_effect=selected), \
                patch.dict(globals_, {'ROOT': self.root, 'verify_assets': verify}), \
                contextlib.redirect_stdout(io.StringIO()):
            P['main']()

    def test_mocked_orchestration_downloads_raw_checks_live_gates_and_every_attestation(self):
        self.invoke()
        self.assertEqual(self.output.read_text(), 'authorized=true\nsource=' + SOURCE + '\n')
        self.assertEqual(len(self.downloads), 1); self.assertEqual(len(self.raw_checks), 1)
        self.assertEqual(len(self.discovery_calls), 1)
        self.assertEqual(len(self.attestations), len(self.fixture.expected))

    def test_old_profile_missing_discovery_or_missing_ninth_workflow_cannot_authorize(self):
        for key, value in [('sourcePolicy', {**self.selection, 'releaseProfile': 'manager-dependency-maintenance-v1'}),
                ('sourcePolicy', {**self.selection, 'manifestSha256': '0' * 64}),
                ('discoveryQualification', None),
                ('requiredSourceRuns', {key: value for key, value in self.config['requiredSourceRuns'].items() if key != 'discovery-lab-receiver.yml'})]:
            original = self.config[key]; self.config[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): self.invoke()
            self.assertFalse(self.output.exists()); self.config[key] = original

    def test_live_discovery_raw_asset_or_attestation_failure_cannot_authorize(self):
        for key in ('fail_live', 'fail_raw', 'fail_attestation'):
            setattr(self, key, True)
            with self.subTest(gate=key), self.assertRaises(ValueError): self.invoke()
            self.assertFalse(self.output.exists()); setattr(self, key, False)

    def test_missing_published_asset_stops_before_download(self):
        self.fixture.assets.pop()
        with self.assertRaises(ValueError): self.invoke()
        self.assertFalse(self.downloads); self.assertFalse(self.output.exists())

    def test_missing_publisher_step_stops_before_download(self):
        self.fixture.job['steps'].pop()
        with self.assertRaises(ValueError): self.invoke()
        self.assertFalse(self.downloads); self.assertFalse(self.output.exists())

    def test_old_version_does_not_select_discovery_authority(self):
        from unittest.mock import patch
        with patch.dict(P['authorize_event'].__globals__, {'TAG': 'v1.19.6'}), self.assertRaises(ValueError):
            self.fixture.authorize()


if __name__ == '__main__': unittest.main()
