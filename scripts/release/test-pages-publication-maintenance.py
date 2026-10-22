"""Inherited Pages negatives at v1.19.5 plus mocked orchestration; no publication."""
import copy
import json
import os
import pathlib
import runpy
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from release_common import sha

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
# Execute every unchanged predecessor assertion against the new guard. Only the
# selected guard filename changes; the original test file remains immutable.
old_test = (HERE / 'test-pages-publication.py').read_text()
assert old_test.count("'pages-publication.py'") == 1
inherited = {'__file__': str(HERE / 'test-pages-publication.py'), '__name__': 'inherited_ti_pages_tests'}
exec(compile(old_test.replace("'pages-publication.py'", "'pages-publication-maintenance.py'"), str(HERE / 'test-pages-publication.py'), 'exec'), inherited)
PublishedPages = inherited['PublishedPages']
P = inherited['P']
SOURCE = inherited['SOURCE']


class PagesOrchestration(unittest.TestCase):
    def setUp(self):
        self.fixture = PublishedPages()
        self.fixture.setUp()
        self.temporary = tempfile.TemporaryDirectory(prefix='manager-ti-pages-test-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = pathlib.Path(self.temporary.name)
        self.event = self.directory / 'event.json'
        self.event.write_text(json.dumps(self.fixture.event))
        self.output = self.directory / 'output'
        self.selection = {
            'releaseProfile': 'manager-dependency-maintenance-v1',
            'manifestPath': 'config/manager-dependency-maintenance-v1.json',
            'manifestSha256': sha((ROOT / 'config/manager-dependency-maintenance-v1.json').read_bytes()),
            'verifierSha256': sha((ROOT / 'scripts/release/maintenance-profile.py').read_bytes()),
        }
        self.native = {'schema': 'synthetic-native-checkpoint-only'}
        self.maintenance = {'schema': 'synthetic-maintenance-checkpoint-only'}
        self.config = {**self.fixture.config, 'sourceCommit': SOURCE,
            'publicationAuthorized': True, 'sourcePolicy': copy.deepcopy(self.selection),
            'transformationQualification': copy.deepcopy(self.native),
            'maintenanceQualification': copy.deepcopy(self.maintenance)}
        self.attestations = []
        self.fail_attestation = False
        self.native_calls = []
        self.qualifications = []
        self.payload = {name: b'x' * 100 for name in self.fixture.expected}

    def api(self, endpoint):
        if endpoint.startswith('releases/tags/'):
            return {**self.fixture.release, 'assets': self.fixture.assets}
        return self.fixture.api(endpoint)

    def command(self, command, **kwargs):
        assert command[0] == 'gh'
        if command[1] == 'api':
            prefix = 'repos/MontrealAI/AGIJobManager/'
            assert command[2].startswith(prefix) and command[3:] == ['--method', 'GET']
            return SimpleNamespace(returncode=0, stdout=json.dumps(self.api(command[2][len(prefix):])).encode())
        if command[1:3] == ['release', 'download']:
            target = pathlib.Path(command[command.index('--dir') + 1])
            for name, raw in self.payload.items():
                (target / name).write_bytes(raw)
            return SimpleNamespace(returncode=0, stdout=b'')
        if command[1:3] == ['attestation', 'verify']:
            self.attestations.append(command)
            assert command[command.index('--signer-digest') + 1] == SOURCE
            assert command[command.index('--source-digest') + 1] == SOURCE
            assert command[command.index('--source-ref') + 1] == 'refs/heads/main'
            assert '--deny-self-hosted-runners' in command
            return SimpleNamespace(returncode=1 if self.fail_attestation else 0, stdout=b'')
        raise AssertionError('Unexpected synthetic command: ' + repr(command))

    def invoke(self):
        raw = json.dumps(self.config).encode()
        self.payload['QUALIFICATION.json'] = raw
        for item in self.fixture.assets:
            item['size'] = len(self.payload[item['name']])
        real_run_path = runpy.run_path

        def selected(path, *args, **kwargs):
            if pathlib.Path(path).name == 'maintenance-qualification.py':
                return {'validate':lambda config,api,logs:self.maintenance}
            if pathlib.Path(path).name == 'transformational-qualification.py':
                def validate(config, api, logs):
                    self.native_calls.append(config)
                    return self.native
                return {'validate': validate}
            return real_run_path(path, *args, **kwargs)

        def qualify(config, api, logs, *, publication=False):
            assert publication is True
            self.qualifications.append(config)

        globals_ = P['main'].__globals__
        with patch.dict(os.environ, {**self.fixture.env, 'GITHUB_EVENT_PATH': str(self.event), 'GITHUB_OUTPUT': str(self.output)}), \
                patch.object(sys, 'argv', ['pages-publication-maintenance.py', '--source', SOURCE]), \
                patch.object(subprocess, 'run', side_effect=self.command), \
                patch.object(subprocess, 'check_output', return_value=SOURCE + '\n'), \
                patch.object(runpy, 'run_path', side_effect=selected), \
                patch.dict(globals_, {'validate_qualification': qualify,
                    'verify_assets': lambda assets, config: self.fixture.expected}):
            P['main']()

    def test_complete_mocked_orchestration_rechecks_every_attestation_and_native_binding(self):
        self.invoke()
        self.assertEqual(self.output.read_text(), 'authorized=true\nsource=' + SOURCE + '\n')
        self.assertEqual(len(self.attestations), len(self.fixture.expected))
        self.assertEqual(len(self.native_calls), 1)
        self.assertEqual(len(self.qualifications), 1)

    def test_wrong_source_policy_or_missing_native_record_refuses_before_authorization(self):
        for key, value in [('sourcePolicy', {**self.selection, 'releaseProfile': 'manager-boundary-corrections-v1'}),
                ('sourcePolicy', {**self.selection, 'manifestSha256': '0' * 64}),
                ('transformationQualification', None), ('maintenanceQualification',None)]:
            old = self.config[key]
            self.config[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.invoke()
            self.assertFalse(self.output.exists())
            self.config[key] = old

    def test_missing_published_asset_cannot_authorize(self):
        self.fixture.assets.pop()
        with self.assertRaises(ValueError):
            self.invoke()
        self.assertFalse(self.output.exists())

    def test_failed_attestation_cannot_authorize(self):
        self.fail_attestation = True
        with self.assertRaises(ValueError):
            self.invoke()
        self.assertTrue(self.attestations)
        self.assertFalse(self.output.exists())

    def test_incomplete_publisher_cannot_authorize(self):
        self.fixture.job['steps'].pop()
        with self.assertRaises(ValueError):
            self.invoke()
        self.assertFalse(self.output.exists())

    def test_old_version_does_not_select_new_automatic_pages_authority(self):
        with patch.dict(P['authorize_event'].__globals__, {'TAG': 'v1.19.5'}), self.assertRaises(ValueError):
            self.fixture.authorize()


if __name__ == '__main__':
    unittest.main()
