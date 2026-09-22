#!/usr/bin/env python3
"""Exercise source qualification offline; every subprocess and GitHub response is mocked."""

import contextlib
import copy
import ast
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.parse import quote


PUBLISHER = Path(__file__).with_name('publish-release.py')
REPOSITORY = 'MontrealAI/AGIJobManager'
SOURCE = 'a' * 40
TREE = 'b' * 40
CHECKOUT = SOURCE
WORKFLOWS = {
    'ci.yml': ['build (0)', 'build (1)', 'build (2)', 'build (3)'],
    'ui.yml': ['ui'],
    'docs.yml': ['docs'],
    'security-verification.yml': ['security-verification'],
    'mainnet-fork.yml': ['mainnet-usdc'],
}


class ReleaseGateTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='release-gate-test-')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.script = self.root / 'scripts/release/publish-release.py'
        self.script.parent.mkdir(parents=True)
        self.script.write_text(PUBLISHER.read_text())
        self.meta = self.root / 'docs/releases/v1.9.1'
        self.meta.mkdir(parents=True)
        self.config = {
            'repository': REPOSITORY, 'tag': 'v1.9.1', 'sourceCommit': SOURCE,
            'sourceTree': TREE,
            'requiredSourceRuns': {
                workflow: {'id': index, 'workflow': workflow, 'requiredJobs': jobs[:]}
                for index, (workflow, jobs) in enumerate(WORKFLOWS.items(), 1)
            },
        }
        self.evidence = {'sourceCommit': SOURCE, 'sourceTree': TREE, 'checkoutCommit': CHECKOUT}
        self.responses = {f'git/commits/{CHECKOUT}': {'tree': {'sha': TREE}}}
        for item in self.config['requiredSourceRuns'].values():
            endpoint = f'actions/runs/{item["id"]}'
            self.responses[endpoint] = {
                'repository': {'full_name': REPOSITORY}, 'head_sha': SOURCE,
                'path': '.github/workflows/' + item['workflow'],
                'status': 'completed', 'conclusion': 'success',
                'name': item['workflow'], 'html_url': 'https://github.invalid/' + endpoint,
            }
            self.responses[endpoint + '/jobs?per_page=100&page=1'] = {
                'jobs': [self.job(item['id'] * 1000 + index, name)
                         for index, name in enumerate(item['requiredJobs'])],
            }
        self.calls = []

    def job(self, job_id, name):
        self.responses[f'actions/jobs/{job_id}/logs'] = (
            '2026-09-17T12:00:00.0000000Z unrelated log output\n'
            f'2026-09-17T12:00:00.0000000Z QUALIFIED_SOURCE_COMMIT={SOURCE}\n')
        return {'id': job_id, 'name': name, 'status': 'completed', 'conclusion': 'success',
                'steps': [{'name': 'Verify qualified source checkout', 'status': 'completed', 'conclusion': 'success'}]}

    def fake_run(self, command, **kwargs):
        prefix = ['gh', 'api', f'repos/{REPOSITORY}/']
        if (len(command) < 3 or command[:2] != prefix[:2]
                or not command[2].startswith(prefix[2])
                or kwargs.get('input') is not None or kwargs.get('timeout') != 180):
            raise RuntimeError(f'Unexpected or mutating subprocess in offline test: {command!r}')
        endpoint = command[2][len(prefix[2]):]
        flags = ['--method', 'GET']
        if endpoint.startswith('actions/jobs/') and endpoint.endswith('/logs'):
            flags.append('--allow-escape-sequences')
            if kwargs.get('capture_output') is not True:
                raise RuntimeError('Job logs must be captured, never printed directly')
        if command[3:] != flags:
            raise RuntimeError(f'Unexpected transport flags in offline test: {command!r}')
        self.calls.append(endpoint)
        if endpoint not in self.responses:
            raise RuntimeError(f'Unmocked GitHub endpoint: {endpoint}')
        response = self.responses[endpoint]
        if isinstance(response, Exception):
            raise response
        return subprocess.CompletedProcess(command, 0, stdout=response if isinstance(response, str) else json.dumps(response), stderr='')

    def verify(self):
        (self.meta / 'release.json').write_text(json.dumps(self.config))
        (self.meta / 'SOURCE_CI.json').write_text(json.dumps(self.evidence))
        self.calls = []
        self.output = io.StringIO()
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': REPOSITORY}, clear=True), \
                patch.object(sys, 'argv', [str(self.script)]), \
                patch('subprocess.run', side_effect=self.fake_run), \
                patch('subprocess.check_output', side_effect=RuntimeError('Unexpected local subprocess')), \
                contextlib.redirect_stdout(self.output):
            runpy.run_path(str(self.script), run_name='__main__')

    def rejects(self):
        with self.assertRaises((AssertionError, subprocess.CalledProcessError)):
            self.verify()

    def test_valid_nonpublish_checks_all_five_workflows_without_mutation(self):
        with self.assertRaises(SystemExit) as result:
            self.verify()
        self.assertEqual(result.exception.code, 0)
        self.assertEqual(set(self.calls), set(self.responses))
        self.assertEqual(len(self.calls), 19)

    def test_jobs_pagination_is_fully_checked(self):
        item = self.config['requiredSourceRuns']['ci.yml']
        item['requiredJobs'] = [f'qualification ({index})' for index in range(101)]
        jobs = [self.job(10000 + index, name) for index, name in enumerate(item['requiredJobs'])]
        endpoint = f'actions/runs/{item["id"]}/jobs?per_page=100&page='
        self.responses[endpoint + '1'] = {'jobs': jobs[:100]}
        self.responses[endpoint + '2'] = {'jobs': jobs[100:]}
        with self.assertRaises(SystemExit) as result:
            self.verify()
        self.assertEqual(result.exception.code, 0)
        self.assertIn(endpoint + '2', self.calls)
        self.responses[endpoint + '2']['jobs'][0]['conclusion'] = 'failure'
        self.rejects()

    def test_rejects_wrong_recorded_source_or_tree(self):
        for field in ['sourceCommit', 'sourceTree']:
            with self.subTest(field=field):
                original = self.evidence[field]
                self.evidence[field] = 'd' * 40
                self.rejects()
                self.evidence[field] = original

    def test_rejects_different_checkout_tree(self):
        self.responses[f'git/commits/{CHECKOUT}']['tree']['sha'] = 'd' * 40
        self.rejects()

    def test_rejects_unrelated_checkout_even_with_identical_tree(self):
        other = 'c' * 40
        self.evidence['checkoutCommit'] = other
        self.responses[f'git/commits/{other}'] = {'tree': {'sha': TREE}}
        self.rejects()

    def test_rejects_missing_duplicate_or_unsuccessful_checkout_assertion(self):
        job = self.responses['actions/runs/1/jobs?per_page=100&page=1']['jobs'][0]
        step = job['steps'][0]
        cases = [[], [step, dict(step)], [dict(step, name='unrelated step')],
                 [dict(step, status='queued', conclusion=None)],
                 [dict(step, conclusion='skipped')], [dict(step, conclusion='failure')]]
        for index, steps in enumerate(cases):
            with self.subTest(case=index):
                job['steps'] = steps
                self.rejects()

    def test_rejects_missing_wrong_duplicate_or_echoed_checkout_marker(self):
        for item in self.config['requiredSourceRuns'].values():
            jobs = self.responses[f'actions/runs/{item["id"]}/jobs?per_page=100&page=1']['jobs']
            for job in jobs:
                endpoint = f'actions/jobs/{job["id"]}/logs'
                original = self.responses[endpoint]
                cases = ['', original.replace(SOURCE, 'c' * 40), original + original,
                         f'2026-09-17T12:00:00Z echo QUALIFIED_SOURCE_COMMIT={SOURCE}\n']
                for index, logs in enumerate(cases):
                    with self.subTest(job=job['name'], case=index):
                        self.responses[endpoint] = logs
                        self.rejects()
                self.responses[endpoint] = original

    def test_accepts_plain_and_crlf_checkout_log_lines(self):
        for logs in [f'QUALIFIED_SOURCE_COMMIT={SOURCE}\n',
                     f'2026-09-17T12:00:00.0000000Z QUALIFIED_SOURCE_COMMIT={SOURCE}\r\n']:
            with self.subTest(logs=logs):
                self.responses['actions/jobs/1000/logs'] = logs
                with self.assertRaises(SystemExit) as result:
                    self.verify()
                self.assertEqual(result.exception.code, 0)

    def test_ansi_logs_are_captured_without_weakening_checkout_evidence(self):
        endpoint = 'actions/jobs/1000/logs'
        noise = '2026-09-17T12:00:00Z \x1b[32mANSI log content must stay captured\x1b[0m\n'
        marker = f'2026-09-17T12:00:00Z QUALIFIED_SOURCE_COMMIT={SOURCE}\n'
        self.responses[endpoint] = noise + marker
        with self.assertRaises(SystemExit) as result:
            self.verify()
        self.assertEqual(result.exception.code, 0)
        self.assertNotIn('ANSI log content', self.output.getvalue())
        self.assertNotIn('\x1b', self.output.getvalue())
        for logs in [noise, noise + marker.replace(SOURCE, 'c' * 40), noise + marker + marker]:
            with self.subTest(logs=logs):
                self.responses[endpoint] = logs
                self.rejects()

    def test_mock_requires_escape_flag_only_for_captured_job_logs(self):
        log_command = ['gh', 'api', f'repos/{REPOSITORY}/actions/jobs/1000/logs', '--method', 'GET']
        for command, kwargs in [
                (log_command, {'capture_output': True, 'timeout': 180}),
                (log_command + ['--allow-escape-sequences'], {'capture_output': False, 'timeout': 180}),
                (['gh', 'api', f'repos/{REPOSITORY}/git/commits/{SOURCE}', '--method', 'GET', '--allow-escape-sequences'], {'capture_output': True, 'timeout': 180})]:
            with self.subTest(command=command, kwargs=kwargs), self.assertRaises(RuntimeError):
                self.fake_run(command, **kwargs)

    def test_rejects_unavailable_checkout_logs(self):
        self.responses['actions/jobs/1000/logs'] = subprocess.CalledProcessError(
            1, ['gh', 'api'], stderr='HTTP 404: Not Found')
        self.rejects()

    def test_rejects_wrong_source_workflow_or_repository(self):
        for item in self.config['requiredSourceRuns'].values():
            endpoint = f'actions/runs/{item["id"]}'
            for field, value in [('head_sha', 'd' * 40), ('path', '.github/workflows/unqualified.yml'),
                                 ('repository', {'full_name': 'unrelated/repository'})]:
                with self.subTest(workflow=item['workflow'], field=field):
                    original = self.responses[endpoint][field]
                    self.responses[endpoint][field] = value
                    self.rejects()
                    self.responses[endpoint][field] = original

    def test_rejects_missing_qualification_workflow(self):
        for workflow in WORKFLOWS:
            with self.subTest(workflow=workflow):
                item = self.config['requiredSourceRuns'].pop(workflow)
                self.rejects()
                self.config['requiredSourceRuns'][workflow] = item

    def test_rejects_duplicate_qualification_workflow(self):
        self.config['requiredSourceRuns']['duplicate'] = copy.deepcopy(self.config['requiredSourceRuns']['ci.yml'])
        self.rejects()

    def test_rejects_unsuccessful_or_incomplete_workflows(self):
        for workflow in WORKFLOWS:
            item = self.config['requiredSourceRuns'][workflow]
            run = self.responses[f'actions/runs/{item["id"]}']
            for status, conclusion in [('completed', 'failure'), ('completed', 'skipped'),
                                       ('completed', 'cancelled'), ('completed', 'neutral'),
                                       ('in_progress', None)]:
                with self.subTest(workflow=workflow, status=status, conclusion=conclusion):
                    run['status'], run['conclusion'] = status, conclusion
                    self.rejects()
            run['status'], run['conclusion'] = 'completed', 'success'

    def test_rejects_unavailable_workflow_evidence(self):
        self.responses['actions/runs/1'] = subprocess.CalledProcessError(
            1, ['gh', 'api'], stderr='HTTP 404: Not Found')
        self.rejects()

    def test_rejects_missing_extra_duplicate_or_renamed_jobs(self):
        endpoint = 'actions/runs/1/jobs?per_page=100&page=1'
        jobs = self.responses[endpoint]['jobs']
        cases = [jobs[:-1], jobs + [{'name': 'unexpected', 'status': 'completed', 'conclusion': 'success'}],
                 jobs[:-1] + [dict(jobs[0])], [dict(job, name='renamed') for job in jobs]]
        for index, changed in enumerate(cases):
            with self.subTest(case=index):
                self.responses[endpoint]['jobs'] = changed
                self.rejects()

    def test_rejects_failed_skipped_cancelled_or_incomplete_jobs(self):
        for item in self.config['requiredSourceRuns'].values():
            jobs = self.responses[f'actions/runs/{item["id"]}/jobs?per_page=100&page=1']['jobs']
            for index, job in enumerate(jobs):
                for status, conclusion in [('completed', 'failure'), ('completed', 'skipped'),
                                           ('completed', 'cancelled'), ('queued', None)]:
                    with self.subTest(workflow=item['workflow'], job=index, status=status, conclusion=conclusion):
                        job['status'], job['conclusion'] = status, conclusion
                        self.rejects()
                job['status'], job['conclusion'] = 'completed', 'success'


class ReleaseUploadTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='release-upload-test-')
        self.addCleanup(directory.cleanup)
        self.file = Path(directory.name) / 'qualified.zip'
        self.file.write_bytes(b'qualified archive bytes')
        self.digest = 'd' * 64
        self.asset = {'name': self.file.name, 'size': self.file.stat().st_size,
                      'state': 'uploaded', 'digest': 'sha256:' + self.digest}
        self.release = {'id': 123, 'tag_name': 'v1.9.1', 'target_commitish': SOURCE,
                        'draft': True, 'assets': [],
                        'upload_url': f'https://uploads.github.com/repos/{REPOSITORY}/releases/123/assets{{?name,label}}'}
        self.api = Mock(return_value=copy.deepcopy(self.release))
        self.list_assets = Mock(return_value=[])
        self.gh = Mock(return_value=json.dumps(self.asset))
        self.clock = Mock()
        namespace = {'repo': REPOSITORY, 'tag': 'v1.9.1', 'source': SOURCE,
                     'api': self.api, 'release_assets': self.list_assets, 'gh': self.gh, 'time': self.clock,
                     'json': json, 'subprocess': subprocess, 'quote': quote}
        # Isolate the real helper without executing publication or credentials.
        parsed = ast.parse(PUBLISHER.read_text())
        helper = next(node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name == 'upload_asset')
        exec(compile(ast.Module(body=[helper], type_ignores=[]), str(PUBLISHER), 'exec'), namespace)
        self.upload = namespace['upload_asset']

    def run_upload(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return self.upload(self.release, self.file, self.digest)

    def populated(self, asset=None):
        return dict(self.release, assets=[self.asset if asset is None else asset])

    def test_direct_binary_upload_uses_known_release_and_bounded_call(self):
        self.assertEqual(self.run_upload(), self.asset)
        self.api.assert_called_once_with('releases/123')
        self.gh.assert_called_once_with(
            'api', f'https://uploads.github.com/repos/{REPOSITORY}/releases/123/assets?name=qualified.zip',
            '--method', 'POST', '--input', str(self.file),
            '--header', 'Content-Type: application/zip', timeout=180)

    def test_exact_existing_asset_is_reused_without_upload(self):
        self.list_assets.return_value = [self.asset]
        self.assertEqual(self.run_upload(), self.asset)
        self.gh.assert_not_called()

    def test_lost_success_response_is_reconciled_without_reupload(self):
        self.gh.side_effect = subprocess.TimeoutExpired(['gh', 'api'], 180)
        self.list_assets.side_effect = [[], [self.asset]]
        self.assertEqual(self.run_upload(), self.asset)
        self.assertEqual(self.gh.call_count, 1)
        self.assertEqual(self.api.call_count, 2)
        self.clock.sleep.assert_not_called()

    def test_absent_asset_transport_failures_have_bounded_retries(self):
        for failure in [subprocess.TimeoutExpired(['gh', 'api'], 180),
                        subprocess.CalledProcessError(1, ['gh', 'api'], stderr='HTTP 502')]:
            with self.subTest(failure=type(failure).__name__):
                self.gh.reset_mock(side_effect=True)
                self.api.reset_mock()
                self.clock.reset_mock()
                self.gh.side_effect = failure
                with self.assertRaises(type(failure)):
                    self.run_upload()
                self.assertEqual(self.gh.call_count, 3)
                self.assertEqual(self.api.call_count, 6)
                self.assertEqual([call.args for call in self.clock.sleep.call_args_list], [(1,), (2,)])

    def test_existing_conflicting_or_partial_assets_fail_closed(self):
        for changes in [{'digest': 'sha256:' + 'e' * 64}, {'size': 0}, {'state': 'starter'}, {'digest': None}]:
            with self.subTest(changes=changes):
                self.list_assets.return_value = [dict(self.asset, **changes)]
                with self.assertRaises(AssertionError):
                    self.run_upload()
                self.gh.assert_not_called()

    def test_ambiguous_failure_with_conflict_is_not_retried(self):
        self.gh.side_effect = subprocess.TimeoutExpired(['gh', 'api'], 180)
        self.list_assets.side_effect = [[], [dict(self.asset, digest='sha256:' + 'e' * 64)]]
        with self.assertRaises(AssertionError):
            self.run_upload()
        self.assertEqual(self.gh.call_count, 1)
        self.clock.sleep.assert_not_called()

    def test_unexpected_upload_endpoint_is_rejected_before_requests(self):
        for url in ['http://uploads.github.com/repos/test/assets',
                    'https://unrelated.example/upload',
                    f'https://uploads.github.com/repos/{REPOSITORY}/releases/999/assets']:
            with self.subTest(url=url):
                self.release['upload_url'] = url
                with self.assertRaises(AssertionError):
                    self.run_upload()
                self.api.assert_not_called()
                self.gh.assert_not_called()

    def test_draft_identity_changes_and_duplicate_assets_are_rejected(self):
        for changes in [{'id': 999}, {'draft': False}, {'tag_name': 'v0.9.1'},
                        {'target_commitish': 'e' * 40}]:
            with self.subTest(changes=changes):
                self.api.return_value = dict(self.release, **changes)
                with self.assertRaises(AssertionError):
                    self.run_upload()
                self.gh.assert_not_called()

    def test_upload_response_digest_mismatch_is_rejected(self):
        self.gh.return_value = json.dumps(dict(self.asset, digest='sha256:' + 'e' * 64))
        with self.assertRaises(AssertionError):
            self.run_upload()
        self.assertEqual(self.gh.call_count, 1)
        self.clock.sleep.assert_not_called()

    def test_duplicate_assets_from_complete_listing_are_rejected(self):
        self.list_assets.return_value = [self.asset, self.asset]
        with self.assertRaises(AssertionError):
            self.run_upload()
        self.gh.assert_not_called()

    def starter(self):
        # A previous failed attempt can report its declared content length even
        # though no completed asset/digest exists. It may predate repackaging.
        return dict(self.asset, id=456, state='starter', digest=None, size=999)

    def test_failed_starter_hidden_from_release_object_is_removed_before_upload(self):
        starter = self.starter()
        self.list_assets.side_effect = [[starter], []]
        self.api.side_effect = [self.release, starter, self.release]
        self.gh.side_effect = ['', json.dumps(self.asset)]
        self.assertEqual(self.run_upload(), self.asset)
        self.assertEqual(self.gh.call_args_list[0].args,
                         ('api', f'repos/{REPOSITORY}/releases/assets/456', '--method', 'DELETE'))
        self.assertEqual(self.gh.call_args_list[1].args[3], 'POST')
        self.assertEqual(self.gh.call_count, 2)

    def test_starter_completed_after_listing_is_verified_without_deletion(self):
        self.list_assets.return_value = [self.starter()]
        self.api.side_effect = [self.release, dict(self.asset, id=456)]
        self.assertEqual(self.run_upload(), dict(self.asset, id=456))
        self.gh.assert_not_called()

    def test_starter_identity_or_completed_digest_change_is_rejected(self):
        for changes in [{'id': 789}, {'name': 'unrelated.zip'},
                        {'state': 'uploaded', 'digest': 'sha256:' + 'e' * 64},
                        {'state': 'starter', 'digest': 'sha256:' + self.digest}]:
            with self.subTest(changes=changes):
                self.list_assets.return_value = [self.starter()]
                self.api.side_effect = [self.release, dict(self.starter(), **changes)]
                with self.assertRaises(AssertionError):
                    self.run_upload()
                self.gh.assert_not_called()

    def test_draft_published_or_retargeted_before_starter_cleanup_is_rejected(self):
        for changes in [{'draft': False}, {'id': 789}, {'tag_name': 'v0.9.3'},
                        {'target_commitish': 'e' * 40}]:
            with self.subTest(changes=changes):
                self.list_assets.return_value = [self.starter()]
                self.api.side_effect = [self.release, self.starter(), dict(self.release, **changes)]
                with self.assertRaises(AssertionError):
                    self.run_upload()
                self.gh.assert_not_called()

    def test_unconfirmed_starter_cleanup_blocks_another_upload(self):
        self.list_assets.return_value = [self.starter()]
        self.api.side_effect = [self.release, self.starter(), self.release]
        self.gh.return_value = ''
        with self.assertRaises(AssertionError):
            self.run_upload()
        self.assertEqual(self.gh.call_count, 1)
        self.assertEqual(self.gh.call_args.args[-1], 'DELETE')

    def test_502_starter_is_reconciled_before_bounded_retry(self):
        self.list_assets.side_effect = [[], [self.starter()], [], []]
        self.api.side_effect = [self.release, self.release, self.starter(), self.release, self.release]
        self.gh.side_effect = [subprocess.CalledProcessError(1, ['gh', 'api'], stderr='HTTP 502'),
                               '', json.dumps(self.asset)]
        self.assertEqual(self.run_upload(), self.asset)
        self.assertEqual(self.gh.call_count, 3)
        self.assertEqual(self.gh.call_args_list[1].args[-1], 'DELETE')
        self.assertEqual([call.args for call in self.clock.sleep.call_args_list], [(1,)])

    def test_complete_asset_listing_paginates_before_returning(self):
        api = Mock(side_effect=[[{'id': i} for i in range(100)], [self.starter()]])
        namespace = {'api': api}
        parsed = ast.parse(PUBLISHER.read_text())
        helper = next(node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name == 'release_assets')
        exec(compile(ast.Module(body=[helper], type_ignores=[]), str(PUBLISHER), 'exec'), namespace)
        result = namespace['release_assets'](123)
        self.assertEqual(len(result), 101)
        self.assertEqual(result[-1], self.starter())
        self.assertEqual([call.args for call in api.call_args_list],
                         [('releases/123/assets?per_page=100&page=1',),
                          ('releases/123/assets?per_page=100&page=2',)])


if __name__ == '__main__':
    unittest.main()
