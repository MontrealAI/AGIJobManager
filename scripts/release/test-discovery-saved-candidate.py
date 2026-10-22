"""Inert saved-candidate transport checks; no supplied module is executed."""
import copy
import contextlib
import io
import json
import pathlib
import os
import runpy
import tempfile
import unittest
import zipfile
from unittest.mock import patch
from types import SimpleNamespace

ROOT = pathlib.Path(__file__).resolve().parents[2]
P = runpy.run_path(str(ROOT / 'scripts/release/discovery-saved-candidate.py'))
SOURCE = '1' * 40


class SavedCandidateTransport(unittest.TestCase):
    def setUp(self):
        self.run = {'id': 10, 'workflow_id': 20, 'head_sha': SOURCE, 'status': 'completed',
                    'conclusion': 'success', 'event': 'push', 'repository': {'full_name': P['REPOSITORY']},
                    'head_repository': {'full_name': P['REPOSITORY']}}
        self.artifact = {'id': 30, 'name': f'AGIJobManager-{P["TAG"]}-candidate-{SOURCE}',
                         'expired': False, 'digest': 'sha256:' + '2' * 64, 'size_in_bytes': 100,
                         'workflow_run': {'id': 10, 'head_sha': SOURCE}}
        self.responses = {'actions/workflows/current-state-release.yml': {'id': 20,
            'path': '.github/workflows/current-state-release.yml'},
            f'actions/workflows/20/runs?head_sha={SOURCE}&per_page=100': {'workflow_runs': [self.run]},
            'actions/runs/10/artifacts?per_page=100&page=1': {'artifacts': [self.artifact]}}

    def candidate(self):
        return P['candidate_record'](lambda endpoint: copy.deepcopy(self.responses[endpoint]), SOURCE)

    def test_completed_exact_source_producer_and_candidate_are_required(self):
        self.assertEqual(self.candidate(), self.artifact)
        self.run['status'] = 'in_progress'
        self.assertIsNone(self.candidate())
        self.run['status'] = 'completed'; self.run['conclusion'] = 'failure'
        with self.assertRaisesRegex(ValueError, 'did not succeed'): self.candidate()

    def test_latest_failed_original_cannot_fall_back_to_an_older_success(self):
        newer = copy.deepcopy(self.run); newer.update(id=11, conclusion='cancelled')
        self.responses[f'actions/workflows/20/runs?head_sha={SOURCE}&per_page=100']['workflow_runs'].append(newer)
        with self.assertRaisesRegex(ValueError, 'did not succeed'): self.candidate()

    def test_missing_duplicate_expired_or_wrong_source_artifact_is_refused(self):
        endpoint = 'actions/runs/10/artifacts?per_page=100&page=1'
        for entries in ([], [self.artifact, self.artifact], [{**self.artifact, 'expired': True}],
                        [{**self.artifact, 'workflow_run': {'id': 10, 'head_sha': 'f' * 40}}]):
            self.responses[endpoint]['artifacts'] = entries
            with self.subTest(entries=len(entries)), self.assertRaises(ValueError): self.candidate()

    def transport(self, *, duplicate=False):
        files = {name: ('ordinary inert transport ' + name).encode() for name in P['BUILDER_ASSETS'] | {
            f'AGIJobManager-{P["TAG"]}-COMPLETE.zip', 'agijobmanager-usdc.html'}}
        files['RELEASE_MANIFEST.json'] = json.dumps({'sourceCommit': SOURCE, 'sourceTree': '3' * 40}).encode()
        files['SHA256SUMS.txt'] = ''.join(P['sha'](raw) + '  ' + name + '\n'
            for name, raw in sorted(files.items())).encode()
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED) as archive:
            for name, raw in files.items(): archive.writestr(name, raw)
            if duplicate: archive.writestr('SHA256SUMS.txt', files['SHA256SUMS.txt'])
        raw = stream.getvalue()
        return raw, {**self.artifact, 'size_in_bytes': len(raw), 'digest': 'sha256:' + P['sha'](raw)}

    def test_actual_outer_bytes_and_inner_checksum_inventory_are_reconciled(self):
        raw, artifact = self.transport()
        with tempfile.TemporaryDirectory() as folder:
            result = P['candidate_assets'](raw, artifact, pathlib.Path(folder))
        self.assertIn(f'AGIJobManager-{P["TAG"]}-COMPLETE.zip', result)

    def test_changed_outer_size_digest_and_duplicate_member_are_refused(self):
        raw, artifact = self.transport()
        for value, record in ((raw + b'x', artifact), (raw, {**artifact, 'digest': 'sha256:' + '0' * 64})):
            with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
                P['candidate_assets'](value, record, pathlib.Path(folder))
        raw, artifact = self.transport(duplicate=True)
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            P['candidate_assets'](raw, artifact, pathlib.Path(folder))

    def test_rehashed_transport_with_corrupted_member_crc_is_refused(self):
        raw, artifact = self.transport()
        damaged = bytearray(raw)
        at = damaged.index(b'ordinary inert transport ')
        damaged[at] ^= 1
        damaged = bytes(damaged)
        artifact.update(digest='sha256:' + P['sha'](damaged))
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(zipfile.BadZipFile):
            P['candidate_assets'](damaged, artifact, pathlib.Path(folder))


class SavedOriginalInputPlumbing(unittest.TestCase):
    """Mock the native invocation; verify exact original-byte arguments and17-file custody."""
    def setUp(self):
        self.fixture = runpy.run_path(str(ROOT / 'scripts/release/test-discovery-qualification.py'))
        self.config = {'repository': P['REPOSITORY'], 'sourceCommit': SOURCE, 'sourceTree': '2' * 40,
            'candidateArtifact': {'id': 30, 'digest': 'sha256:' + '3' * 64},
            'artifactDigests': {f'AGIJobManager-{P["TAG"]}-COMPLETE.zip': '4' * 64}}
        self.expected = {'alphaCommit': '5' * 40, 'alphaTree': '6' * 40, 'alphaSourceHash': '7' * 64,
            'managerFiles': {name: '8' * 64 for name in self.fixture['m'].MANAGER_FILES}, 'browserInput': {}}
        self.files = self.fixture['native_archive_fixture'](self.config, self.expected, 'v22.23.2', {'id': 10, 'attempt': 1})
        self.binding = self.expected['browserInput']

    def invoke(self, *, wrong_workspace=False):
        namespace = P['run_saved'].__globals__
        binding = copy.deepcopy(self.binding)
        if wrong_workspace: binding['workspaceSha256'] = 'f' * 64
        def extract(assets, source, tree, installed):
            root = installed / 'discovery-browser/discovery-continuation'; root.mkdir(parents=True)
            (root / 'fleet-browser-workspace.json').write_bytes(self.files['workspace-before.json'])
            (root / 'fleet-browser-request.json').write_bytes(self.files['original-request.json'])
        def native(command, **options):
            self.assertEqual(command[2], '--installed')
            self.assertEqual(len(command), 9)
            self.assertEqual(pathlib.Path(command[6]).read_bytes(), self.files['workspace-before.json'])
            self.assertEqual(pathlib.Path(command[7]).read_bytes(), self.files['original-request.json'])
            self.assertEqual(command[8], binding['campaignDigest'])
            context = json.loads(pathlib.Path(command[4]).read_bytes())
            self.assertEqual(context['browserInput'], binding)
            self.assertEqual(options['env']['PATH'], '')
            output = pathlib.Path(command[5]); output.mkdir()
            for name, raw in self.files.items():
                if name == 'custody.json': continue
                target = output / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
            return SimpleNamespace(returncode=0, stderr=b'')
        policy = SimpleNamespace(run_path=lambda path: {'validate_browser_capsule': lambda *args: binding})
        with tempfile.TemporaryDirectory() as folder, \
                patch.dict(namespace, {'candidate_assets': lambda *args: self.config['artifactDigests'],
                    'extract_installed': extract, 'runpy': policy}), \
                patch('shutil.which', return_value='/pinned/node'), \
                patch('subprocess.run', side_effect=native) as executed, \
                patch.dict(os.environ, {'DISCOVERY_MATRIX_NODE': '22.23.2', 'GITHUB_RUN_ID': '10', 'GITHUB_RUN_ATTEMPT': '1'}), \
                contextlib.redirect_stdout(io.StringIO()):
            output = pathlib.Path(folder) / 'native'
            if wrong_workspace:
                with self.assertRaisesRegex(ValueError, 'original Alpha UI bytes'):
                    P['run_saved'](b'inert transport', self.config['candidateArtifact'], SOURCE, '2' * 40, output)
                self.assertFalse(executed.called)
                return
            custody = P['run_saved'](b'inert transport', self.config['candidateArtifact'], SOURCE, '2' * 40, output)
            self.assertEqual(len(custody['files']), 16)
            self.assertEqual(custody['browserInput'], binding)
            self.assertEqual({item.relative_to(output).as_posix() for item in output.rglob('*') if item.is_file()},
                set(self.files))
            self.assertEqual(executed.call_count, 1)

    def test_saved_candidate_passes_identical_original_ui_bytes_and_retains_both_missions(self):
        self.invoke()

    def test_changed_saved_original_bytes_are_refused_before_the_native_invocation(self):
        self.invoke(wrong_workspace=True)


if __name__ == '__main__':
    unittest.main()
