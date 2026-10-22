"""Synthetic Discovery dispatch/readiness regressions; no network or publication."""
import copy
import pathlib
import runpy
import unittest
from unittest.mock import patch
from release_common import DISCOVERY_PROFILE, REPOSITORY, TAG, WORKFLOWS, qualification_workflows

HERE = pathlib.Path(__file__).parent
AUTH = runpy.run_path(str(HERE / 'publication-authorization-discovery.py'))
WAIT = runpy.run_path(str(HERE / 'wait-qualification.py'))
SOURCE = 'a' * 40


class DispatchAuthorization(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_REF': 'refs/heads/main',
            'GITHUB_EVENT_NAME': 'workflow_dispatch', 'RELEASE_PUBLISH_CONFIRMATION': 'PUBLISH_' + TAG,
            'GITHUB_WORKFLOW_REF': REPOSITORY + '/' + AUTH['TRIGGER_PATH'] + '@refs/heads/main',
            'GITHUB_SHA': SOURCE}
        self.calls = []
    def api(self, endpoint):
        self.calls.append(endpoint)
        self.assertEqual(endpoint, 'git/ref/heads/main')
        return {'object': {'sha': SOURCE}}
    def test_only_explicit_current_version_exact_main_dispatch_authorizes(self):
        self.assertEqual(AUTH['authorize'](self.env, SOURCE, self.api), 'manual-confirmed-discovery-main')
        self.assertEqual(self.calls, ['git/ref/heads/main'])
    def test_invalid_context_is_rejected_before_any_api_read(self):
        alternatives = {'GITHUB_REPOSITORY': ['fork/repository', None],
            'GITHUB_REF': ['refs/heads/feature', 'refs/tags/' + TAG, None],
            'GITHUB_EVENT_NAME': ['workflow_run', 'push', 'pull_request', 'schedule', None],
            'RELEASE_PUBLISH_CONFIRMATION': ['', 'PUBLISH_v1.19.6', None],
            'GITHUB_WORKFLOW_REF': [REPOSITORY + '/.github/workflows/publish-v114.yml@refs/heads/main',
                REPOSITORY + '/' + AUTH['TRIGGER_PATH'] + '@refs/heads/feature', None],
            'GITHUB_SHA': ['b' * 40, None]}
        for key, values in alternatives.items():
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    AUTH['authorize']({**self.env, key: value}, SOURCE, self.api)
                self.assertFalse(self.calls)
    def test_invalid_source_old_version_and_superseded_main_cannot_publish(self):
        for source in ['', 'a' * 39, 'A' * 40, 'b' * 41, None]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                AUTH['authorize'](self.env, source, self.api)
        self.assertFalse(self.calls)
        with patch.dict(AUTH['authorize'].__globals__, {'TAG': 'v1.19.6'}), self.assertRaises(ValueError):
            AUTH['authorize'](self.env, SOURCE, self.api)
        with self.assertRaisesRegex(ValueError, 'superseded'):
            AUTH['authorize'](self.env, SOURCE, lambda endpoint: {'object': {'sha': 'b' * 40}})


class ExactSourceReadiness(unittest.TestCase):
    def setUp(self):
        self.responses = {'git/ref/heads/main': {'object': {'sha': SOURCE}}}
        self.endpoints = {}
        for index, workflow in enumerate(qualification_workflows({'sourcePolicy': {'releaseProfile': DISCOVERY_PROFILE}}), 1):
            self.responses[f'actions/workflows/{workflow}'] = {'id': index, 'path': '.github/workflows/' + workflow}
            endpoint = f'actions/workflows/{index}/runs?head_sha={SOURCE}&event=push&per_page=100'
            self.endpoints[workflow] = endpoint
            self.responses[endpoint] = {'workflow_runs': [{'id': index, 'workflow_id': index,
                'head_sha': SOURCE, 'head_branch': 'main', 'event': 'push', 'status': 'completed',
                'conclusion': 'success', 'repository': {'full_name': REPOSITORY},
                'head_repository': {'full_name': REPOSITORY}}]}
        self.calls = []
    def api(self, endpoint):
        self.calls.append(endpoint); return self.responses[endpoint]
    def ready(self, profile=DISCOVERY_PROFILE): return WAIT['readiness'](self.api, SOURCE, profile)
    def test_discovery_requires_nine_while_historical_default_retains_eight(self):
        self.assertEqual(self.ready(), 'ready')
        ninth = self.endpoints['discovery-lab-receiver.yml']
        self.responses[ninth] = {'workflow_runs': []}
        self.assertEqual(self.ready(), 'pending')
        self.calls.clear(); self.assertEqual(self.ready(profile=None), 'ready')
        self.assertNotIn('actions/workflows/discovery-lab-receiver.yml', self.calls)
        self.assertEqual(len(WORKFLOWS), 8)
    def test_every_missing_or_incomplete_exact_source_run_waits(self):
        for endpoint in self.endpoints.values():
            old = self.responses[endpoint]
            for altered in [{'workflow_runs': []}, {'workflow_runs': [{**old['workflow_runs'][0], 'status': 'in_progress', 'conclusion': None}]}]:
                self.responses[endpoint] = altered
                with self.subTest(endpoint=endpoint): self.assertEqual(self.ready(), 'pending')
            self.responses[endpoint] = old
    def test_failed_cancelled_skipped_or_wrong_identity_run_is_not_ready(self):
        run = self.responses[self.endpoints['discovery-lab-receiver.yml']]['workflow_runs'][0]
        for key, value in [('conclusion', 'failure'), ('conclusion', 'cancelled'), ('conclusion', 'skipped'),
                ('workflow_id', 999), ('repository', {'full_name': 'fork/repository'}),
                ('head_repository', {'full_name': 'fork/repository'})]:
            old = run[key]; run[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.ready()
            run[key] = old
    def test_latest_pending_retry_does_not_fall_back_to_old_success(self):
        for endpoint in self.endpoints.values():
            run = self.responses[endpoint]['workflow_runs'][0]
            self.responses[endpoint]['workflow_runs'].append({**run, 'id': run['id'] + 1000,
                'status': 'queued', 'conclusion': None})
        self.assertEqual(self.ready(), 'pending')
    def test_unrelated_source_branch_event_or_workflow_cannot_replace_required_run(self):
        endpoint = self.endpoints['discovery-lab-receiver.yml']
        run = self.responses[endpoint]['workflow_runs'][0]
        for key, value in [('head_sha', 'b' * 40), ('head_branch', 'feature'), ('event', 'workflow_dispatch')]:
            self.responses[endpoint] = {'workflow_runs': [{**run, key: value}]}
            with self.subTest(key=key): self.assertEqual(self.ready(), 'pending')
        self.responses[endpoint] = {'workflow_runs': [run]}
        self.responses['actions/workflows/discovery-lab-receiver.yml']['path'] = '.github/workflows/unrelated.yml'
        with self.assertRaises(ValueError): self.ready()
    def test_superseded_main_stops_before_workflow_reads(self):
        self.responses['git/ref/heads/main']['object']['sha'] = 'b' * 40
        self.assertEqual(self.ready(), 'superseded')
        self.assertEqual(self.calls, ['git/ref/heads/main'])
    def test_workflow_selector_returns_independent_job_lists(self):
        selected = qualification_workflows({'sourcePolicy': {'releaseProfile': DISCOVERY_PROFILE}})
        selected['ci.yml'].clear(); selected['discovery-lab-receiver.yml'].clear()
        self.assertEqual(len(WORKFLOWS['ci.yml']), 4)
        self.assertEqual(len(qualification_workflows({'sourcePolicy': {'releaseProfile': DISCOVERY_PROFILE}})['discovery-lab-receiver.yml']), 2)


if __name__ == '__main__': unittest.main()
