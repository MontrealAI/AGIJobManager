"""Synthetic event/readiness regressions. No network, signing or publication."""
import copy
import pathlib
import runpy
import unittest
from release_common import REPOSITORY, TAG, WORKFLOWS

HERE = pathlib.Path(__file__).parent
AUTH = runpy.run_path(str(HERE / 'publication-authorization.py'))
WAIT = runpy.run_path(str(HERE / 'wait-qualification.py'))
SOURCE = 'a' * 40


class PublicationAuthorization(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_REF': 'refs/heads/main',
            'GITHUB_EVENT_NAME': 'workflow_run', 'RELEASE_PUBLISH_CONFIRMATION': 'PUBLISH_' + TAG}
        self.run = {'id': 123, 'workflow_id': 456, 'run_attempt': 1,
            'path': AUTH['TRIGGER_PATH'], 'event': 'push', 'head_branch': 'main', 'head_sha': SOURCE,
            'status': 'completed', 'conclusion': 'success', 'repository': {'full_name': REPOSITORY},
            'head_repository': {'full_name': REPOSITORY}}
        self.observed = copy.deepcopy(self.run)
    def api(self, endpoint):
        if endpoint == 'actions/runs/123': return self.observed
        if endpoint == 'git/ref/heads/main': return {'object': {'sha': SOURCE}}
        raise AssertionError('Unexpected public metadata request')
    def authorize(self): return AUTH['authorize'](self.env, SOURCE, self.api, {'workflow_run': self.run})
    def test_exact_qualified_completion_and_manual_confirmation_are_allowed(self):
        self.assertIn('qualification-completion', self.authorize())
        self.env['GITHUB_EVENT_NAME'] = 'workflow_dispatch'
        self.assertEqual(self.authorize(), 'manual-confirmed-main')
    def test_unrelated_events_branches_repositories_or_confirmation_are_rejected(self):
        for key, value in [('GITHUB_EVENT_NAME', 'push'), ('GITHUB_EVENT_NAME', 'pull_request'),
                ('GITHUB_REF', 'refs/heads/feature'), ('GITHUB_REPOSITORY', 'other/repository'),
                ('RELEASE_PUBLISH_CONFIRMATION', 'PUBLISH_other')]:
            old = self.env[key]; self.env[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.authorize()
            self.env[key] = old
    def test_event_and_reobserved_run_must_both_match_exact_main_source(self):
        for target in (self.run, self.observed):
            for key, value in [('head_sha', 'b'*40), ('head_branch', 'feature'), ('event', 'pull_request'),
                    ('path', '.github/workflows/unrelated.yml'), ('status', 'in_progress'),
                    ('conclusion', 'failure'), ('conclusion', 'skipped'),
                    ('repository', {'full_name': 'other/repository'}),
                    ('head_repository', {'full_name': 'fork/repository'})]:
                old = target[key]; target[key] = value
                with self.subTest(key=key, value=value), self.assertRaises(ValueError): self.authorize()
                target[key] = old
    def test_attempt_workflow_and_current_main_are_rechecked(self):
        for key in ('workflow_id', 'run_attempt'):
            self.observed[key] += 1
            with self.subTest(key=key), self.assertRaises(ValueError): self.authorize()
            self.observed[key] -= 1
        for key in ('workflow_id', 'run_attempt'):
            old = self.run[key]; self.run[key] = None
            with self.subTest(key=key), self.assertRaises(ValueError): self.authorize()
            self.run[key] = old
        with self.assertRaises(ValueError):
            AUTH['authorize'](self.env, SOURCE, lambda endpoint: {'object': {'sha': 'b'*40}} if endpoint.startswith('git/') else self.observed, {'workflow_run': self.run})
    def test_every_required_workflow_is_needed_and_incomplete_runs_wait(self):
        responses = {'git/ref/heads/main': {'object': {'sha': SOURCE}}}
        endpoints = []
        for index, workflow in enumerate(WORKFLOWS, 1):
            responses[f'actions/workflows/{workflow}'] = {'id': index, 'path': '.github/workflows/' + workflow}
            endpoint = f'actions/workflows/{index}/runs?head_sha={SOURCE}&event=push&per_page=100'
            endpoints.append(endpoint)
            responses[endpoint] = {'workflow_runs': [{**self.run, 'id': index, 'workflow_id': index}]}
        ready = lambda: WAIT['readiness'](lambda endpoint: responses[endpoint], SOURCE)
        self.assertEqual(ready(), 'ready')
        for endpoint in endpoints:
            original = responses[endpoint]
            for altered in ({'workflow_runs': []}, {'workflow_runs': [{**original['workflow_runs'][0], 'status': 'in_progress', 'conclusion': None}]}):
                responses[endpoint] = altered; self.assertEqual(ready(), 'pending')
            responses[endpoint] = original
        failed = responses[endpoints[-1]]['workflow_runs'][0]
        for conclusion in ('failure', 'cancelled', 'skipped'):
            failed['conclusion'] = conclusion
            with self.subTest(conclusion=conclusion), self.assertRaises(ValueError): ready()
        responses['git/ref/heads/main']['object']['sha'] = 'b'*40
        self.assertEqual(ready(), 'superseded')
    def test_newer_pending_retry_is_never_replaced_by_older_success(self):
        responses = {'git/ref/heads/main': {'object': {'sha': SOURCE}}}
        for index, workflow in enumerate(WORKFLOWS, 1):
            responses[f'actions/workflows/{workflow}'] = {'id': index, 'path': '.github/workflows/' + workflow}
            responses[f'actions/workflows/{index}/runs?head_sha={SOURCE}&event=push&per_page=100'] = {'workflow_runs': [
                {**self.run, 'id': index, 'workflow_id': index},
                {**self.run, 'id': index + 1000, 'workflow_id': index, 'status': 'queued', 'conclusion': None}]}
        self.assertEqual(WAIT['readiness'](lambda endpoint: responses[endpoint], SOURCE), 'pending')


if __name__ == '__main__': unittest.main()
