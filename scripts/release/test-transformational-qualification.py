#!/usr/bin/env python3
"""Adversarial native qualification gates using mocked GitHub; no networking."""
import copy
import importlib.util
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('native_qualification', HERE / 'transformational-qualification.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
# Reuse the inherited fixture rather than defining a weaker duplicate gate.
INHERITED = runpy.run_path(str(HERE / 'test-release-gates.py'))
SOURCE = INHERITED['SOURCE']
SOURCE_CONFIG = {
    'schema': m.SOURCE_SCHEMA,
    'repository': m.ALPHA_REPOSITORY,
    'commit': '7283b4d4d2a51ff674e6078f5940691900aae5a1',
    'tree': '13fcbc6a0a7696036f9b590fc9b7048563e184d2',
    'fixturePath': m.FIXTURE_PATH,
    'files': {
        'docs/assets/successor/engine.mjs': '38c4f38978bf9fc29f207bae3adee0755bc6530d04502a36c491cc430787e488',
        m.FIXTURE_PATH: 'fa5f570e89c20cffd0df844869047a7c0594c5460c3e95df5ada44592ea4fd20',
        'examples/transformational-intelligence/inspector.mjs': 'b5f8e704aaab345f9d6503c854d38910ddfabbf98fe674c48b051097812b07f4',
    },
}


class NativeQualificationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = INHERITED['ReleaseGateTests']()
        self.fixture.setUp()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / 'source.json'
        self.source.write_text(json.dumps(SOURCE_CONFIG))
        selected = patch.object(m, 'SOURCE_CONFIG', self.source)
        selected.start()
        self.addCleanup(selected.stop)
        self.jobs = {}
        for workflow, (_, step_name) in m.NATIVE_STEPS.items():
            item = self.fixture.config['requiredSourceRuns'][workflow]
            job = self.fixture.responses[f'actions/runs/{item["id"]}/attempts/{item["attempt"]}/jobs?per_page=100&page=1']['jobs'][0]
            job['steps'].append({'name': step_name, 'status': 'completed', 'conclusion': 'success'})
            self.jobs[workflow] = job
        self.receiver = self.jobs['alpha-project-handoff.yml']
        self.markers = {
            'TI_NATIVE_ALPHA_COMMIT': SOURCE_CONFIG['commit'],
            'TI_NATIVE_FIXTURE_SHA256': SOURCE_CONFIG['files'][m.FIXTURE_PATH],
            'TI_NATIVE_BOUNDARY': m.BOUNDARY,
        }
        self.marker_log = ''.join(f'{key}={value}\n' for key, value in self.markers.items())
        self.fixture.logs[self.receiver['id']] += self.marker_log

    def verify(self):
        return m.validate(self.fixture.config, self.fixture.api, lambda job: self.fixture.logs[job])

    def test_success_returns_exact_deterministic_metadata_without_mutation(self):
        before = copy.deepcopy(self.fixture.config)
        expected = {
            'schema': 'agijobmanager/transformation-qualification/v1',
            'alphaRepository': SOURCE_CONFIG['repository'], 'alphaCommit': SOURCE_CONFIG['commit'],
            'alphaTree': SOURCE_CONFIG['tree'], 'fixturePath': m.FIXTURE_PATH,
            'fixtureSha256': SOURCE_CONFIG['files'][m.FIXTURE_PATH],
            'boundary': 'free-inspection-positive-payment-refused',
        }
        self.assertEqual(self.verify(), expected)
        self.assertEqual(self.verify(), expected)
        self.assertEqual(self.fixture.config, before)

    def test_inherited_success_alone_cannot_qualify_missing_native_steps(self):
        for workflow in m.NATIVE_STEPS:
            self.jobs[workflow]['steps'].pop()
        self.assertEqual(m.validate_qualification(
            self.fixture.config, self.fixture.api, lambda job: self.fixture.logs[job]), SOURCE)
        with self.assertRaisesRegex(ValueError, 'Native transformation step'):
            self.verify()

    def test_native_steps_missing_renamed_duplicated_skipped_failed_or_pending_reject(self):
        for workflow, (_, name) in m.NATIVE_STEPS.items():
            job = self.jobs[workflow]
            original = copy.deepcopy(job['steps'])
            current = original[-1]
            variations = [original[:-1], original + [current],
                          original[:-1] + [dict(current, name=name + ' stale')]]
            variations += [original[:-1] + [dict(current, conclusion=value)]
                           for value in ['skipped', 'failure', 'cancelled', None]]
            variations += [original[:-1] + [dict(current, status=value)]
                           for value in ['queued', 'in_progress']]
            for steps in variations:
                with self.subTest(workflow=workflow, steps=steps[-2:]):
                    job['steps'] = steps
                    with self.assertRaisesRegex(ValueError, 'Native transformation step'):
                        self.verify()
            job['steps'] = original

    def test_native_steps_cannot_move_to_the_other_successful_job(self):
        first, second = self.jobs.values()
        first['steps'][-1], second['steps'][-1] = second['steps'][-1], first['steps'][-1]
        with self.assertRaisesRegex(ValueError, 'Native transformation step'):
            self.verify()

    def test_missing_stale_duplicate_or_only_echoed_receiver_markers_reject(self):
        job_id = self.receiver['id']
        original = self.fixture.logs[job_id]
        for key, value in self.markers.items():
            marker = f'{key}={value}\n'
            for log in [original.replace(marker, ''), original + marker,
                        original.replace(marker, f'{key}=stale\n'),
                        original + f'{key}=malformed\n',
                        original.replace(marker, f'echo {key}={value}\n')]:
                with self.subTest(marker=key, log=log):
                    self.fixture.logs[job_id] = log
                    with self.assertRaisesRegex(ValueError, 'Native transformation marker'):
                        self.verify()
            self.fixture.logs[job_id] = original

    def test_markers_in_another_successful_job_do_not_qualify_receiver(self):
        log = self.fixture.logs[self.receiver['id']]
        self.fixture.logs[self.receiver['id']] = log.replace(self.marker_log, '')
        other = self.jobs['current-state-release.yml']['id']
        self.fixture.logs[other] += self.marker_log
        with self.assertRaisesRegex(ValueError, 'Native transformation marker'):
            self.verify()

    def test_timestamped_crlf_markers_are_accepted(self):
        job_id = self.receiver['id']
        self.fixture.logs[job_id] = ''.join(
            ('2026-10-19T12:00:00.000Z ' if line.startswith('TI_NATIVE_') else '') + line + '\r\n'
            for line in self.fixture.logs[job_id].splitlines())
        self.assertEqual(self.verify(), m.source_metadata())

    def test_old_workflow_and_step_gates_still_reject(self):
        removed = self.fixture.config['requiredSourceRuns'].pop('security-verification.yml')
        with self.assertRaisesRegex(ValueError, 'All 8 qualification workflows'):
            self.verify()
        self.fixture.config['requiredSourceRuns']['security-verification.yml'] = removed
        self.receiver['steps'][1]['conclusion'] = 'skipped'
        with self.assertRaisesRegex(ValueError, 'Required step did not execute successfully'):
            self.verify()

    def test_stale_run_job_and_checkout_marker_cannot_qualify_new_steps(self):
        job = self.receiver
        for key, value in [('head_sha', 'c' * 40), ('run_id', 999), ('conclusion', 'failure')]:
            original = job[key]
            job[key] = value
            with self.subTest(field=key), self.assertRaises(ValueError):
                self.verify()
            job[key] = original
        self.fixture.logs[job['id']] = self.fixture.logs[job['id']].replace(SOURCE, 'c' * 40)
        with self.assertRaisesRegex(ValueError, 'checkout log evidence'):
            self.verify()

    def test_live_observations_are_not_refetched_for_additional_constraints(self):
        requests, logs = [], []
        def api(endpoint):
            requests.append(endpoint)
            return self.fixture.api(endpoint)
        def retained(job_id):
            logs.append(job_id)
            return self.fixture.logs[job_id]
        self.assertEqual(m.validate(self.fixture.config, api, retained), m.source_metadata())
        self.assertEqual(len(requests), len(set(requests)))
        self.assertEqual(len(logs), len(set(logs)))

    def test_offline_record_is_exact_and_makes_no_api_request(self):
        expected = m.source_metadata()
        config = {'transformationQualification': copy.deepcopy(expected)}
        self.assertEqual(m.verify_record(config), expected)
        for name in expected:
            for operation in ['missing', 'stale']:
                altered = copy.deepcopy(expected)
                if operation == 'missing':
                    del altered[name]
                else:
                    altered[name] = 'stale'
                with self.subTest(field=name, operation=operation), self.assertRaisesRegex(ValueError, 'record differs'):
                    m.verify_record({'transformationQualification': altered})
        for altered in [None, {}, dict(expected, liveQualification=True), []]:
            with self.assertRaises(ValueError):
                m.verify_record({'transformationQualification': altered})
        with self.assertRaises(ValueError):
            m.verify_record({})

    def test_offline_record_rejects_a_changed_valid_source_context(self):
        record = {'transformationQualification': m.source_metadata()}
        for field in ['commit', 'tree', 'fixture']:
            source = copy.deepcopy(SOURCE_CONFIG)
            if field == 'fixture':
                source['files'][m.FIXTURE_PATH] = 'd' * 64
            else:
                source[field] = 'd' * 40
            self.source.write_text(json.dumps(source))
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'record differs'):
                m.verify_record(record)

    def test_source_config_shape_source_pins_and_fixture_identity_are_bounded(self):
        variations = [dict(SOURCE_CONFIG, extra=True), dict(SOURCE_CONFIG, schema='stale'),
                      dict(SOURCE_CONFIG, repository='other/repo'), dict(SOURCE_CONFIG, commit='c' * 39),
                      dict(SOURCE_CONFIG, tree='D' * 40), dict(SOURCE_CONFIG, fixturePath='../campaign.json'),
                      dict(SOURCE_CONFIG, files={}),
                      dict(SOURCE_CONFIG, files={**SOURCE_CONFIG['files'], m.FIXTURE_PATH: 'bad'})]
        for value in variations:
            self.source.write_text(json.dumps(value))
            with self.subTest(value=value), self.assertRaises(ValueError):
                m.source_metadata()
        self.source.write_text('{"schema":"duplicate",' + json.dumps(SOURCE_CONFIG)[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON field'):
            m.source_metadata()
        self.source.write_text(' ' * 100_001)
        with self.assertRaisesRegex(ValueError, 'bounded regular file'):
            m.source_metadata()

    def test_source_config_symlink_is_not_an_installed_pin(self):
        target = self.source.with_name('target.json')
        self.source.rename(target)
        self.source.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'bounded regular file'):
            m.source_metadata()


if __name__ == '__main__':
    unittest.main()
