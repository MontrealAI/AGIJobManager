"""Adversarial published-Pages authorization checks; no network or publication."""
import copy
import pathlib
import runpy
import unittest
from release_common import REPOSITORY, TAG, TITLE

P = runpy.run_path(str(pathlib.Path(__file__).with_name('pages-publication.py')))
SOURCE = 'a' * 40


class PublishedPages(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'workflow_run'}
        self.run = {'id': 101, 'workflow_id': 202, 'run_attempt': 1, 'path': P['TRIGGER_PATH'],
            'event': 'workflow_run', 'head_branch': 'main', 'head_sha': SOURCE, 'status': 'completed', 'conclusion': 'success',
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
        self.run['event'] = self.observed['event'] = 'workflow_dispatch'
        self.authorize()
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


if __name__ == '__main__': unittest.main()
