"""Mocked-API and inert Git custody checks; these fixtures prove no native execution."""
import copy
import importlib.util
import io
import json
import pathlib
import runpy
import subprocess
import tempfile
import unittest
import zipfile
from unittest.mock import patch
from release_common import (DISCOVERY_PROFILE, DISCOVERY_WORKFLOW, DISCOVERY_JOBS,
                            REQUIRED_STEPS, qualification_workflows)

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('discovery_qualification', HERE / 'discovery-qualification.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE = runpy.run_path(str(HERE / 'test-release-gates.py'))
TI = runpy.run_path(str(HERE / 'transformational-qualification.py'))
SOURCE = BASE['SOURCE']


# These inert records exercise custody/reconciliation only; no module is evaluated.
def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def _regression_fixture(config, expected, node, run):
    cases = ['accepted-' + stage for stage in ('learn', 'think', 'design', 'strategise', 'execute', 'evolve')]
    cases += ['missing-inspection-reserve', 'rehashed-invalid-measurement', 'stronger-successor']
    source = {'repository': config['repository'], 'commit': config['sourceCommit'], 'tree': config['sourceTree'],
        'adapterSha256': expected['managerFiles'][m.MANAGER_FILES[0]],
        'contractSha256': expected['managerFiles'][m.MANAGER_FILES[1]]}
    mission = 'capability-00000000-0000-4000-8000-000000000001'
    outcomes, wrappers, proof_receipts = [], [], []
    for index, case in enumerate(cases):
        request = {'schema': 'inert-custody-request-fixture/v1', 'missionId': mission,
            'stage': case.removeprefix('accepted-'),
            'commission': {'id': 'lab-fixture', 'branch': 'lab-fixture-usdc', 'route': 'manager-usdc',
                'currency': 'USDC6', 'capBaseUnits': '0'}, 'resourceLimits': {'checking': 100000 + index}}
        original = encode(request).decode()
        used = {'acquisitions': index + 1, 'search': 2, 'checking': 20000, 'storageBytes': 128,
            'installations': 0, 'workerCapacity': 1, 'memoryBytes': 1024, 'elapsedMs': 1}
        receipt = {'schema': 'agijobmanager/discovery-lab-admission/v1',
            'original': original, 'requestSha256': m.sha(original.encode()), 'commission': request['commission'],
            'source': {key: source[key] for key in ('adapterSha256', 'contractSha256')},
            'state': 'inconclusive' if case == 'missing-inspection-reserve'
                else 'local-rejected' if case == 'rehashed-invalid-measurement' else 'local-checked',
            'resources': {'checkerUsed': used, 'totalUsed': used}, 'authority': 'none',
            'lifecycle': {'commission': 'DRAFT_NOT_SUBMITTED', 'reservedBaseUnits': '0',
                'execution': 'unprovisioned', 'review': 'separate-review-required', 'settlement': 'not-connected'}}
        raw = encode(receipt).decode(); wrapper = {'raw': raw, 'source': source}
        native_work = {key: used[key] for key in ('acquisitions', 'search', 'checking', 'storageBytes', 'installations', 'workerCapacity')}
        identity = m.sha(m.canonical({'schema': 'discovery-lab-receipt-identity/v3', 'request': request,
            'receiptSchema': receipt['schema'], 'source': receipt['source'],
            'receiverAdmissionChecks': 10000, 'nativeWork': native_work}))
        outcomes.append({'case': case, 'receipt': receipt}); wrappers.append(wrapper)
        proof_receipts.append({'receiptId': identity, 'receiptDigest': m.sha(raw.encode()),
            'commission': request['commission'], 'resources': used})
    primary, receipt = wrappers[5], outcomes[5]['receipt']
    before = {'schema': 'successor-capability-workspace/v2', 'missionId': mission,
        'revision': 0, 'events': [{'sequence': 0, 'kind': 'inert-original-event', 'previous': None,
            'payload': {}, 'digest': '0' * 64}], 'authority': [], 'paymentRoute': 'none'}
    payload = {'kind': 'receiver-receipt', 'record': primary,
        'campaignDigest': 'c' * 64, 'recordDigest': m.sha(m.canonical(primary))}
    event = {'sequence': 1, 'kind': 'lab-evidence-attached', 'previous': '0' * 64, 'payload': payload}
    event['digest'] = m.sha(b'successor-omega/v1:capability-event\0' + m.canonical({'missionId': mission, **event}))
    after = {**before, 'revision': 1, 'events': [*before['events'], event]}
    admitted_proofs = [item for index, item in enumerate(proof_receipts) if index != 7]
    route_total = {key: max(item['resources'][key] for item in admitted_proofs)
        if key in ('memoryBytes', 'workerCapacity') else sum(item['resources'][key] for item in admitted_proofs)
        for key in used}
    docket_files = {name: 'Inert custody fixture; no execution claim.\n' for name in m.DOCKET_PATHS}
    docket_files['05_agialpha_runs/run.json'] = encode({'workspace': after,
        'attachments': {'receipts': [value for index, value in enumerate(wrappers) if index not in (5, 7)]}}).decode()
    docket_files['06_proof_bundles/capability.json'] = encode({'receiverReceipts': admitted_proofs}).decode()
    docket_files['08_cost_ledgers/costs.json'] = encode({'totalComplete': False, 'currenciesCombined': False,
        'receiverInspectionByRoute': {'manager-usdc': route_total}}).decode()
    docket = {'schema': 'successor-discovery-evidence-docket/v1', 'format': 'bounded-canonical-file-map',
        'files': docket_files, 'checksums': {name: m.sha(value.encode()) for name, value in docket_files.items()}}
    files = {'original-request.json': receipt['original'].encode(), 'raw-receipt.json': primary['raw'].encode(),
        'receipt-wrapper.json': encode(primary), 'workspace-before.json': encode(before),
        'workspace-after.json': encode(after), 'docket.json': encode(docket), 'docket-reopened.json': encode(docket)}
    evidence = {'schema': 'successor/discovery-release-native-evidence/v1',
        'sourceCommit': config['sourceCommit'], 'sourceTree': config['sourceTree'],
        'alphaCommit': expected['alphaCommit'], 'alphaTree': expected['alphaTree'],
        'sourceHash': expected['alphaSourceHash'], 'node': node,
        'candidateArchiveSha256': config['artifactDigests'][m.ARCHIVE_NAME], 'authority': 'none',
        'externalExecution': 'unprovisioned', 'currencyCapBaseUnits': '0', 'missionId': mission,
        'campaignDigest': 'c' * 64, 'receiptId': proof_receipts[5]['receiptId'], 'outcomes': outcomes,
        'retainedWorkspace': after, 'workspaceDigest': m.sha(m.canonical(after)),
        'installedOperator': {'path': m.MANAGER_FILES[3], 'sha256': expected['managerFiles'][m.MANAGER_FILES[3]],
            'docketSha256': 'd' * 64, 'reopenedDocketSha256': 'd' * 64,
            'sourceCustody': {'scope': 'Inert custody fixture; no execution claim.'}},
        'qualificationRefusals': [{'case': 'rehashed-invalid-measurement', 'rawReceipt': wrappers[7]['raw'],
            'resourceUsed': outcomes[7]['receipt']['resources']['totalUsed'], 'admittedToMission': False,
            'totalComplete': False, 'authority': 'none',
            'scope': 'Negative qualification-test observation outside the admitted mission receipt ledger.'}],
        'sameHistory': {'prefixPreserved': True, 'appendedEvents': 1, 'duplicateRefused': True,
            'refusalPreserved': True, 'reopenByteIdentical': True, 'docketSections': 13}}
    for field, name in {'requestSha256': 'original-request.json', 'receiptSha256': 'raw-receipt.json',
            'workspaceBeforeSha256': 'workspace-before.json', 'workspaceAfterSha256': 'workspace-after.json',
            'docketSha256': 'docket.json', 'reopenedDocketSha256': 'docket-reopened.json'}.items():
        evidence[field] = m.sha(files[name])
    evidence.update({'inputWorkspace': 'constructed-independent-regression', 'primaryCase': 'accepted-evolve'})
    files['native-evidence.json'] = encode(evidence)
    return files



def native_archive_fixture(config, expected, node, run):
    regression = _regression_fixture(config, expected, node, run)
    regression_evidence = json.loads(regression['native-evidence.json'])
    source = json.loads(regression['receipt-wrapper.json'])['source']
    mission = 'capability-00000000-0000-4000-8000-000000000002'
    receipt = json.loads(regression['raw-receipt.json'])
    request = json.loads(receipt['original']); request['missionId'] = mission
    receipt['original'] = encode(request).decode(); receipt['requestSha256'] = m.sha(receipt['original'].encode())
    raw_receipt = encode(receipt).decode(); wrapper = {'raw': raw_receipt, 'source': source}
    receipt_id = m.semantic_receipt_id(receipt)
    before = {'schema': 'successor-capability-workspace/v2', 'missionId': mission,
        'revision': 0, 'events': [{'sequence': 0, 'kind': 'inert-original-event', 'previous': None,
            'payload': {}, 'digest': 'f' * 64}], 'authority': [], 'paymentRoute': 'none'}
    payload = {'kind': 'receiver-receipt', 'record': wrapper, 'campaignDigest': 'd' * 64,
        'recordDigest': m.sha(m.canonical(wrapper))}
    event = {'sequence': 1, 'kind': 'lab-evidence-attached', 'previous': 'f' * 64, 'payload': payload}
    event['digest'] = m.sha(b'successor-omega/v1:capability-event\0' + m.canonical({'missionId': mission, **event}))
    after = {**before, 'revision': 1, 'events': [*before['events'], event]}
    docket = json.loads(regression['docket.json'])
    docket['files']['05_agialpha_runs/run.json'] = encode({'workspace': after, 'attachments': {'receipts': []}}).decode()
    docket['files']['06_proof_bundles/capability.json'] = encode({'receiverReceipts': [{'receiptId': receipt_id,
        'receiptDigest': m.sha(raw_receipt.encode()), 'commission': receipt['commission'],
        'resources': receipt['resources']['totalUsed']}]}).decode()
    docket['files']['08_cost_ledgers/costs.json'] = encode({'totalComplete': False, 'currenciesCombined': False,
        'receiverInspectionByRoute': {'manager-usdc': receipt['resources']['totalUsed']}}).decode()
    docket['checksums'] = {name: m.sha(raw.encode()) for name, raw in docket['files'].items()}
    files = {'original-request.json': receipt['original'].encode(), 'raw-receipt.json': raw_receipt.encode(),
        'receipt-wrapper.json': encode(wrapper), 'workspace-before.json': encode(before),
        'workspace-after.json': encode(after), 'docket.json': encode(docket), 'docket-reopened.json': encode(docket)}
    expected['browserInput'].update({'missionId': mission, 'campaignDigest': 'd' * 64,
        'workspaceSha256': m.sha(files['workspace-before.json']), 'requestSha256': m.sha(files['original-request.json'])})
    evidence = {key: value for key, value in regression_evidence.items() if key not in ('outcomes', 'qualificationRefusals')}
    evidence.update({'inputWorkspace': 'authenticated-original-browser-workspace', 'primaryCase': 'original-browser-usdc',
        'browserInput': copy.deepcopy(expected['browserInput']), 'missionId': mission, 'campaignDigest': 'd' * 64,
        'receiptId': receipt_id, 'retainedWorkspace': after, 'workspaceDigest': m.sha(m.canonical(after)),
        'primaryObservation': {'receiptId': receipt_id, 'receiptSha256': m.sha(raw_receipt.encode()),
            'resourceUsed': receipt['resources']['totalUsed'], 'totalComplete': False, 'authority': 'none'},
        'regression': {'scope': 'constructed-independent-mission', 'nativeEvidenceSha256': m.sha(regression['native-evidence.json']),
            'missionId': regression_evidence['missionId'], 'campaignDigest': regression_evidence['campaignDigest'],
            'receiptId': regression_evidence['receiptId'], 'validReceiptCount': 8, 'invalidQualificationCount': 1}})
    for field, name in {'requestSha256': 'original-request.json', 'receiptSha256': 'raw-receipt.json',
            'workspaceBeforeSha256': 'workspace-before.json', 'workspaceAfterSha256': 'workspace-after.json',
            'docketSha256': 'docket.json', 'reopenedDocketSha256': 'docket-reopened.json'}.items():
        evidence[field] = m.sha(files[name])
    evidence['installedOperator'] = {**evidence['installedOperator'],
        'docketSha256': m.sha(files['docket.json']), 'reopenedDocketSha256': m.sha(files['docket-reopened.json'])}
    files['native-evidence.json'] = encode(evidence)
    files.update({'regression/' + name: raw for name, raw in regression.items()})
    custody = {'schema': 'manager/discovery-saved-native-custody/v1',
        'sourceCommit': config['sourceCommit'], 'sourceTree': config['sourceTree'],
        'profile': DISCOVERY_PROFILE, 'node': node, 'runId': run['id'], 'runAttempt': run['attempt'],
        'candidateArtifactId': config['candidateArtifact']['id'], 'candidateArtifactDigest': config['candidateArtifact']['digest'],
        'candidateArchiveSha256': config['artifactDigests'][m.ARCHIVE_NAME],
        'browserInput': copy.deepcopy(expected['browserInput']),
        'files': {name: {'bytes': len(raw), 'sha256': m.sha(raw)} for name, raw in files.items()}}
    files['custody.json'] = encode(custody)
    return files


def zip_fixture(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, raw in files.items(): archive.writestr(name, raw)
    return output.getvalue()


class DiscoveryQualificationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = BASE['ReleaseGateTests']()
        self.fixture.setUp()
        self.config = self.fixture.config
        self.config['sourcePolicy'] = {'releaseProfile': DISCOVERY_PROFILE}
        self.config['candidateArtifact'] = {'id': 700, 'digest': 'sha256:' + '7' * 64}
        self.config['artifactDigests'] = {m.ARCHIVE_NAME: 'a' * 64}
        self.downloads = {}
        self.expected = {'schema': m.SCHEMA, 'profile': DISCOVERY_PROFILE,
            'alphaRepository': 'MontrealAI/AGI-Alpha-Agent-v0', 'alphaCommit': '1' * 40,
            'alphaTree': '2' * 40, 'alphaSourceHash': '3' * 64, 'catalogSha256': '4' * 64,
            'sourcePinSha256': '5' * 64, 'sourceFiles': 37, 'browserInput': {},
            'managerFiles': {name: str(index) * 64 for index, name in enumerate(m.MANAGER_FILES, 6)},
            'nodes': list(m.NODES), 'authority': 'none', 'scope': 'Mocked metadata fixture; no execution claim.'}
        patched = patch.object(m, 'source_metadata', lambda: copy.deepcopy(self.expected))
        patched.start(); self.addCleanup(patched.stop)
        browser = patch.object(m, 'authenticate_browser_input', lambda *args: None)
        browser.start(); self.addCleanup(browser.stop)
        self.config['transformationQualification'] = TI['source_metadata']()
        for workflow, (name, step) in TI['NATIVE_STEPS'].items():
            job = next(job for job in self.jobs(workflow) if job['name'] == name)
            job['steps'].append({'name': step, 'status': 'completed', 'conclusion': 'success'})
        ti = self.config['transformationQualification']
        self.fixture.logs[self.jobs('alpha-project-handoff.yml')[0]['id']] += ''.join(
            f'{key}={value}\n' for key, value in {'TI_NATIVE_ALPHA_COMMIT': ti['alphaCommit'],
            'TI_NATIVE_FIXTURE_SHA256': ti['fixtureSha256'], 'TI_NATIVE_BOUNDARY': ti['boundary']}.items())
        prep = self.jobs('current-state-release.yml')[0]
        for step in m.PREP_STEPS:
            if not any(item['name'] == step for item in prep['steps']):
                prep['steps'].append({'name': step, 'status': 'completed', 'conclusion': 'success'})
        self.config['requiredSourceRuns'][DISCOVERY_WORKFLOW] = {'id': 9, 'workflow': DISCOVERY_WORKFLOW,
            'workflowId': 109, 'attempt': 1, 'event': 'push', 'headBranch': 'main'}
        self.fixture.responses['actions/workflows/109'] = {'id': 109, 'path': '.github/workflows/' + DISCOVERY_WORKFLOW}
        self.fixture.responses['actions/runs/9'] = {'id': 9, 'workflow_id': 109, 'run_attempt': 1,
            'repository': {'full_name': self.config['repository']}, 'head_repository': {'full_name': self.config['repository']},
            'head_sha': SOURCE, 'head_branch': 'main', 'path': '.github/workflows/' + DISCOVERY_WORKFLOW,
            'event': 'push', 'status': 'completed', 'conclusion': 'success'}
        jobs, artifacts = [], []
        for index, (node, name) in enumerate(zip(m.NODES, DISCOVERY_JOBS)):
            job = {'id': 900 + index, 'name': name, 'head_sha': SOURCE, 'run_id': 9,
                'status': 'completed', 'conclusion': 'success', 'steps': [{'name': step,
                'status': 'completed', 'conclusion': 'success'} for step in ['Verify qualified source checkout', *REQUIRED_STEPS[DISCOVERY_WORKFLOW]]]}
            jobs.append(job)
            markers = {'QUALIFIED_SOURCE_COMMIT': SOURCE, 'DISCOVERY_NATIVE_ALPHA_COMMIT': self.expected['alphaCommit'],
                'DISCOVERY_NATIVE_ALPHA_TREE': self.expected['alphaTree'], 'DISCOVERY_NATIVE_SOURCE_HASH': self.expected['alphaSourceHash'],
                'DISCOVERY_NATIVE_NODE': node, 'DISCOVERY_NATIVE_ADAPTER_SHA256': self.expected['managerFiles'][m.MANAGER_FILES[0]],
                'DISCOVERY_NATIVE_CONTRACT_SHA256': self.expected['managerFiles'][m.MANAGER_FILES[1]],
                'DISCOVERY_NATIVE_RUNNER_SHA256': self.expected['managerFiles'][m.MANAGER_FILES[2]],
                'DISCOVERY_NATIVE_EVIDENCE_SHA256': 'fixture-pending'}
            files = native_archive_fixture(self.config, self.expected, node,
                self.config['requiredSourceRuns'][DISCOVERY_WORKFLOW])
            raw = zip_fixture(files)
            self.downloads[800 + index] = raw
            markers['DISCOVERY_NATIVE_EVIDENCE_SHA256'] = m.sha(files['native-evidence.json'])
            self.fixture.logs[job['id']] = ''.join(f'{key}={value}\n' for key, value in markers.items())
            artifacts.append({'id': 800 + index, 'name': f'discovery-lab-policy-{node[1:]}-{SOURCE}-9-1',
                'expired': False, 'size_in_bytes': len(raw), 'digest': 'sha256:' + m.sha(raw),
                'workflow_run': {'id': 9, 'head_sha': SOURCE}})
        self.fixture.responses['actions/runs/9/attempts/1/jobs?per_page=100&page=1'] = {'jobs': jobs}
        self.fixture.responses['actions/runs/9/artifacts?per_page=100&page=1'] = {'artifacts': artifacts}

    def jobs(self, workflow):
        item = self.config['requiredSourceRuns'][workflow]
        return self.fixture.responses[f'actions/runs/{item["id"]}/attempts/{item["attempt"]}/jobs?per_page=100&page=1']['jobs']

    def verify(self):
        return m.validate(self.config, self.fixture.api, lambda job: self.fixture.logs[job],
            lambda artifact: self.downloads[artifact['id']])

    def test_nine_gates_and_both_runtime_evidence_are_required(self):
        record = self.verify()
        self.assertEqual(record['nodes'], ['v22.23.2', 'v24.21.0'])
        self.assertEqual([entry['jobId'] for entry in record['nativeEvidence']], [900, 901])
        self.assertEqual([entry['artifactId'] for entry in record['nativeEvidence']], [800, 801])
        self.assertEqual(len(qualification_workflows(self.config)), 9)
        for workflow in list(self.config['requiredSourceRuns']):
            removed = self.config['requiredSourceRuns'].pop(workflow)
            with self.subTest(workflow=workflow), self.assertRaisesRegex(ValueError, 'All 9 qualification workflows'):
                self.verify()
            self.config['requiredSourceRuns'][workflow] = removed

    def test_legacy_workflow_mapping_remains_eight_and_detached(self):
        legacy = qualification_workflows()
        self.assertEqual(len(legacy), 8)
        legacy['ci.yml'].append('forged')
        self.assertNotIn('forged', qualification_workflows()['ci.yml'])

    def test_new_matrix_job_step_runtime_and_source_cannot_be_substituted(self):
        jobs = self.jobs(DISCOVERY_WORKFLOW)
        for key, value in [('head_sha', 'f' * 40), ('conclusion', 'skipped'), ('name', 'another runtime')]:
            previous = jobs[0][key]; jobs[0][key] = value
            with self.subTest(field=key), self.assertRaises(ValueError): self.verify()
            jobs[0][key] = previous
        for step in jobs[0]['steps']:
            step['conclusion'] = 'skipped'
            with self.subTest(step=step['name']), self.assertRaises(ValueError): self.verify()
            step['conclusion'] = 'success'

    def test_missing_duplicate_echoed_stale_and_wrong_runtime_markers_reject(self):
        job = self.jobs(DISCOVERY_WORKFLOW)[1]['id']
        original = self.fixture.logs[job]
        for line in original.splitlines(True):
            if not line.startswith('DISCOVERY_NATIVE_'): continue
            for changed in [original.replace(line, ''), original + line, original.replace(line, 'echo ' + line),
                            original.replace(line, line.split('=')[0] + '=stale\n')]:
                self.fixture.logs[job] = changed
                with self.subTest(marker=line), self.assertRaises(ValueError): self.verify()
        self.fixture.logs[job] = original

    def test_inherited_ti_audit_and_profile_steps_cannot_be_skipped(self):
        prep = self.jobs('current-state-release.yml')[0]
        for step in prep['steps']:
            if step['name'] not in m.PREP_STEPS: continue
            step['conclusion'] = 'skipped'
            with self.subTest(step=step['name']), self.assertRaises(ValueError): self.verify()
            step['conclusion'] = 'success'
        receiver = self.jobs('alpha-project-handoff.yml')[0]
        receiver['steps'][-1]['conclusion'] = 'failure'
        with self.assertRaises(ValueError): self.verify()

    def test_artifact_omission_duplicate_expiry_source_and_digest_reject(self):
        endpoint = 'actions/runs/9/artifacts?per_page=100&page=1'
        original = copy.deepcopy(self.fixture.responses[endpoint]['artifacts'])
        variants = [original[:1], original + [original[0]]]
        reused = copy.deepcopy(original); reused[1]['id'] = reused[0]['id']; variants.append(reused)
        for key, value in [('expired', True), ('digest', 'unhashed'), ('size_in_bytes', 0),
                           ('workflow_run', {'id': 9, 'head_sha': 'e' * 40})]:
            changed = copy.deepcopy(original); changed[0][key] = value; variants.append(changed)
        for changed in variants:
            self.fixture.responses[endpoint]['artifacts'] = changed
            with self.subTest(artifacts=changed), self.assertRaises(ValueError): self.verify()
        self.fixture.responses[endpoint]['artifacts'] = original

    def test_offline_records_are_exact_metadata_and_cannot_promote_authority(self):
        record = self.verify()
        config = {**self.config, 'discoveryQualification': record}
        self.assertEqual(m.verify_record(config), record)
        for altered in [dict(record, nativeExecutionQualified=True), dict(record, authority='execute'),
                        dict(record, nativeEvidence=record['nativeEvidence'][:1]), dict(record, alphaCommit='f' * 40)]:
            with self.assertRaises(ValueError): m.verify_record({**config, 'discoveryQualification': altered})
        reused = copy.deepcopy(record)
        reused['nativeEvidence'][1]['artifactId'] = reused['nativeEvidence'][0]['artifactId']
        with self.assertRaisesRegex(ValueError, 'evidence identity'):
            m.verify_record({**config, 'discoveryQualification': reused})
        with self.assertRaisesRegex(ValueError, 'explicit release source policy'):
            m.verify_record({**config, 'sourcePolicy': {}})


class DownloadedNativeCustodyTests(unittest.TestCase):
    def setUp(self):
        self.fixture = DiscoveryQualificationTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.config, self.expected = self.fixture.config, self.fixture.expected
        self.node, self.run = m.NODES[0], self.config['requiredSourceRuns'][DISCOVERY_WORKFLOW]
        self.files = native_archive_fixture(self.config, self.expected, self.node, self.run)

    def check(self, files=None, *, zip_transform=None):
        files = copy.deepcopy(self.files if files is None else files)
        raw = zip_fixture(files)
        if zip_transform: raw = zip_transform(raw)
        artifact = {'id': 800, 'size_in_bytes': len(raw), 'digest': 'sha256:' + m.sha(raw)}
        return m.validate_native_archive(raw, artifact, config=self.config, expected=self.expected,
            node=self.node, run=self.run, evidence_sha256=m.sha(files['native-evidence.json']))

    def reframe(self, change, *, same_reopened=True):
        files = copy.deepcopy(self.files)
        change(files)
        if same_reopened: files['docket-reopened.json'] = files['docket.json']
        for prefix in ('regression/', ''):
            evidence = json.loads(files[prefix + 'native-evidence.json'])
            for field, name in {'requestSha256': 'original-request.json', 'receiptSha256': 'raw-receipt.json',
                    'workspaceBeforeSha256': 'workspace-before.json', 'workspaceAfterSha256': 'workspace-after.json',
                    'docketSha256': 'docket.json', 'reopenedDocketSha256': 'docket-reopened.json'}.items():
                evidence[field] = m.sha(files[prefix + name])
            if not prefix:
                evidence['regression']['nativeEvidenceSha256'] = m.sha(files['regression/native-evidence.json'])
            files[prefix + 'native-evidence.json'] = encode(evidence)
        custody = json.loads(files['custody.json'])
        custody['files'] = {name: {'bytes': len(raw), 'sha256': m.sha(raw)}
            for name, raw in files.items() if name != 'custody.json'}
        files['custody.json'] = encode(custody)
        return files

    @staticmethod
    def document(files, name, change):
        value = json.loads(files[name]); change(value); files[name] = encode(value)

    @staticmethod
    def docket_section(files, name, change):
        docket = json.loads(files['docket.json'])
        value = json.loads(docket['files'][name]); change(value)
        docket['files'][name] = encode(value).decode()
        docket['checksums'][name] = m.sha(docket['files'][name].encode())
        files['docket.json'] = encode(docket)

    def test_downloaded_fixture_retains_separate_primary_and_nine_regression_cases_with_independent_dockets(self):
        result = self.check()
        self.assertEqual(result['memberCount'], 17)
        self.assertEqual(set(result['files']), m.NATIVE_MEMBERS)
        self.assertEqual(result['candidateArtifactId'], 700)
        self.assertEqual(result['candidateArchiveSha256'], 'a' * 64)

    def test_download_is_mandatory_and_outer_bytes_cannot_be_substituted(self):
        with self.assertRaises(ValueError):
            m.validate(self.config, self.fixture.fixture.api,
                lambda job: self.fixture.fixture.logs[job], None)
        original = self.fixture.downloads[800]
        self.fixture.downloads[800] = original[:-1] + bytes([original[-1] ^ 1])
        with self.assertRaisesRegex(ValueError, 'bytes/digest'):
            self.fixture.verify()

    def test_rehashed_custody_cannot_change_source_runtime_attempt_candidate_or_file_inventory(self):
        for key, value in [('sourceCommit', 'f' * 40), ('sourceTree', 'f' * 40), ('node', m.NODES[1]),
                ('runId', 99), ('runAttempt', 2), ('candidateArtifactId', 701),
                ('candidateArtifactDigest', 'sha256:' + 'b' * 64), ('candidateArchiveSha256', 'b' * 64),
                ('profile', 'manager-dependency-maintenance-v1')]:
            with self.subTest(field=key):
                files = self.reframe(lambda files: self.document(files, 'custody.json',
                    lambda value_: value_.update({key: value})))
                with self.assertRaisesRegex(ValueError, 'custody'): self.check(files)
        files = copy.deepcopy(self.files)
        custody = json.loads(files['custody.json']); custody['files'].pop('original-request.json')
        files['custody.json'] = encode(custody)
        with self.assertRaisesRegex(ValueError, 'custody'): self.check(files)

    def test_rehashed_native_claims_cannot_hide_missing_execution_cases_or_approval_changes(self):
        for key, value in [('node', m.NODES[1]), ('sourceCommit', 'f' * 40), ('alphaTree', 'f' * 40),
                ('candidateArchiveSha256', 'b' * 64), ('authority', 'execute'),
                ('currencyCapBaseUnits', '1'), ('externalExecution', 'complete'), ('outcomes', [])]:
            files = self.reframe(lambda files: self.document(files, 'native-evidence.json',
                lambda value_: value_.update({key: value})))
            with self.subTest(field=key), self.assertRaises(ValueError): self.check(files)
        files = self.reframe(lambda files: self.document(files, 'native-evidence.json',
            lambda value_: value_['sameHistory'].update({'duplicateRefused': False})))
        with self.assertRaisesRegex(ValueError, 'same-history'): self.check(files)

    def test_installed_operator_source_and_its_own_docket_reopen_are_required(self):
        for change in [lambda value: value.pop('installedOperator'),
                lambda value: value['installedOperator'].update({'sha256': 'f' * 64}),
                lambda value: value['installedOperator'].update({'path': 'scripts/other.mjs'}),
                lambda value: value['installedOperator'].update({'reopenedDocketSha256': 'f' * 64})]:
            files = self.reframe(lambda files: self.document(files, 'native-evidence.json', change))
            with self.assertRaisesRegex(ValueError, 'installed operator'): self.check(files)

    def test_invalid_payload_qualification_costs_remain_raw_but_cannot_be_credited_as_mission_work(self):
        for change in [lambda value: value.update({'qualificationRefusals': []}),
                lambda value: value['qualificationRefusals'][0].update({'admittedToMission': True}),
                lambda value: value['qualificationRefusals'][0].update({'rawReceipt': '{}'}),
                lambda value: value['qualificationRefusals'][0]['resourceUsed'].update({'checking': 0}),
                lambda value: value['qualificationRefusals'][0].update({'totalComplete': True})]:
            files = self.reframe(lambda files: self.document(files, 'regression/native-evidence.json', change))
            with self.assertRaises(ValueError): self.check(files)
        evidence = json.loads(self.files['regression/native-evidence.json'])
        wrapper = {'raw': evidence['qualificationRefusals'][0]['rawReceipt'],
            'source': json.loads(self.files['receipt-wrapper.json'])['source']}
        files = self.reframe(lambda files: self.docket_section(files, '05_agialpha_runs/run.json',
            lambda value: value['attachments']['receipts'].append(wrapper)))
        with self.assertRaises(ValueError): self.check(files)

    def test_offline_raw_custody_cannot_be_modified_or_silently_discarded(self):
        record = self.fixture.verify()
        config = {**self.config, 'discoveryQualification': record}
        self.assertEqual(m.verify_record(config), record)
        for change in [lambda value: value['nativeEvidence'][0]['downloadedCustody'].pop('rawFiles'),
                lambda value: value['nativeEvidence'][0]['downloadedCustody']['rawFiles'].update({'raw-receipt.json': '{}'}),
                lambda value: value['nativeEvidence'][0]['downloadedCustody'].update({'candidateArchiveSha256': 'b' * 64}),
                lambda value: value['nativeEvidence'][0]['downloadedCustody'].update({'executionApproved': True})]:
            changed = copy.deepcopy(record); change(changed)
            with self.assertRaises(ValueError):
                m.verify_record({**config, 'discoveryQualification': changed})
        with patch.object(m, 'MAX_QUALIFICATION_BYTES', 1), self.assertRaises(ValueError):
            m.verify_record(config)

    def test_original_and_regression_missions_and_costs_cannot_be_conflated(self):
        original = json.loads(self.files['native-evidence.json'])
        regression = json.loads(self.files['regression/native-evidence.json'])
        self.assertNotEqual(original['missionId'], regression['missionId'])
        self.assertEqual(len(regression['outcomes']), 9)
        self.assertNotIn('outcomes', original)
        for change in [lambda value: value['regression'].update({'missionId': original['missionId']}),
                lambda value: value['regression'].update({'validReceiptCount': 9}),
                lambda value: value.update({'outcomes': regression['outcomes']}),
                lambda value: value['primaryObservation'].update({'resourceUsed': {'checking': 0}})]:
            changed = self.reframe(lambda files: self.document(files, 'native-evidence.json', change))
            with self.assertRaises(ValueError): self.check(changed)

    def test_original_workspace_and_request_bytes_cannot_be_reanchored_or_reencoded(self):
        for name in ('workspace-before.json', 'original-request.json'):
            changed = self.reframe(lambda files: files.update({name: files[name] + b' '}))
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'original browser'): self.check(changed)
        changed = self.reframe(lambda files: self.document(files, 'regression/native-evidence.json',
            lambda value: value.update({'browserInput': self.expected['browserInput']})))
        with self.assertRaisesRegex(ValueError, 'independent'): self.check(changed)

    def test_separate_regression_raw_cases_and_costs_remain_audited_after_outer_rehash(self):
        changed = self.reframe(lambda files: self.document(files, 'regression/native-evidence.json',
            lambda value: value['outcomes'].pop()))
        with self.assertRaisesRegex(ValueError, 'drops an original'): self.check(changed)
        def change_docket(files, section, mutate):
            regression = {name.removeprefix('regression/'): raw for name, raw in files.items()
                if name.startswith('regression/')}
            self.docket_section(regression, section, mutate)
            files['regression/docket.json'] = regression['docket.json']
            files['regression/docket-reopened.json'] = regression['docket.json']
        changed = self.reframe(lambda files: change_docket(files, '05_agialpha_runs/run.json',
            lambda value: value['attachments']['receipts'].pop(0)))
        with self.assertRaisesRegex(ValueError, 'omits or duplicates admitted work'): self.check(changed)
        changed = self.reframe(lambda files: change_docket(files, '08_cost_ledgers/costs.json',
            lambda value: value['receiverInspectionByRoute']['manager-usdc'].update({'checking': 0})))
        with self.assertRaisesRegex(ValueError, 'receiver costs differ'): self.check(changed)
        for name in m.NATIVE_MEMBERS:
            if name.startswith('regression/'):
                files = copy.deepcopy(self.files); files.pop(name)
                with self.subTest(missing=name), self.assertRaisesRegex(ValueError, 'inventory'): self.check(files)

    def test_bounded_binary_downloader_refuses_truncation_oversize_failure_and_invalid_limits(self):
        from types import SimpleNamespace
        class Process:
            def __init__(self, raw, code=0):
                self.stdout = io.BytesIO(raw); self.code = code; self.returncode = None; self.killed = False
            def wait(self, **kwargs): self.returncode = self.code; return self.code
            def poll(self): return self.returncode
            def kill(self): self.killed = True; self.returncode = -9
        class Selector:
            def register(self, *args): pass
            def select(self, *args): return [SimpleNamespace()]
            def close(self): pass
        artifact = {'id': 800, 'size_in_bytes': 4}
        def invoke(process, **options):
            with patch('subprocess.Popen', return_value=process), patch('selectors.DefaultSelector', return_value=Selector()):
                return m.download_native_artifact(artifact, **options)
        self.assertEqual(invoke(Process(b'1234')), b'1234')
        for raw, code in [(b'123', 0), (b'12345', 0), (b'1234', 1)]:
            process = Process(raw, code)
            with self.subTest(bytes=len(raw), code=code), self.assertRaises(ValueError): invoke(process)
            self.assertIsNotNone(process.poll())
        for maximum in [0, True, 450000001, 3]:
            with self.subTest(maximum=maximum), self.assertRaises(ValueError): invoke(Process(b'1234'), maximum=maximum)

    def test_rehashed_request_receipt_and_wrapper_cannot_change_original_bytes_or_source(self):
        changes = [
            lambda files: self.document(files, 'original-request.json',
                lambda value: value['commission'].update({'currency': 'AGIALPHA18'})),
            lambda files: self.document(files, 'raw-receipt.json', lambda value: value.update({'original': '{}'})),
            lambda files: self.document(files, 'raw-receipt.json', lambda value: value.update({'authority': 'execute'})),
            lambda files: self.document(files, 'receipt-wrapper.json', lambda value: value.update({'raw': '{}'})),
            lambda files: self.document(files, 'receipt-wrapper.json',
                lambda value: value['source'].update({'commit': 'f' * 40}))]
        for index, change in enumerate(changes):
            with self.subTest(case=index), self.assertRaises(ValueError): self.check(self.reframe(change))

    def test_rehashed_workspace_cannot_drop_prefix_change_mission_or_reframe_the_receipt_event(self):
        changes = [
            lambda value: value.update({'missionId': 'capability-other'}),
            lambda value: value['events'].__setitem__(0, {'digest': 'f' * 64}),
            lambda value: value['events'][-1]['payload'].update({'kind': 'real-task-contract'}),
            lambda value: value['events'][-1].update({'digest': 'f' * 64}),
            lambda value: value.update({'authority': ['publish']})]
        for index, change in enumerate(changes):
            files = self.reframe(lambda files: self.document(files, 'workspace-after.json', change))
            with self.subTest(case=index), self.assertRaises(ValueError): self.check(files)

    def test_rehashed_docket_cannot_omit_sections_use_other_history_or_drop_duplicate_or_discount_raw_work(self):
        def remove_section(files):
            self.document(files, 'docket.json', lambda value: value['files'].pop('01_claims_matrix.md'))
        changes = [remove_section,
            lambda files: self.docket_section(files, '05_agialpha_runs/run.json',
                lambda value: value['workspace'].update({'missionId': 'capability-other'})),
            lambda files: self.docket_section(files, '05_agialpha_runs/run.json',
                lambda value: value['attachments']['receipts'].append({'raw': '{}', 'source': {}})),
            lambda files: self.docket_section(files, '06_proof_bundles/capability.json',
                lambda value: value['receiverReceipts'].append(value['receiverReceipts'][0])),
            lambda files: self.docket_section(files, '08_cost_ledgers/costs.json',
                lambda value: value['receiverInspectionByRoute']['manager-usdc'].update({'checking': 1})),
            lambda files: self.docket_section(files, '08_cost_ledgers/costs.json',
                lambda value: value.update({'totalComplete': True, 'currenciesCombined': True}))]
        for index, change in enumerate(changes):
            with self.subTest(case=index), self.assertRaises(ValueError): self.check(self.reframe(change))

    def test_docket_proof_cannot_discount_actual_raw_receipt_resources_or_reclassify_manager_as_fleet(self):
        def discount(files):
            self.docket_section(files, '06_proof_bundles/capability.json',
                lambda value: value['receiverReceipts'][0]['resources'].update({'checking': 0}))
            self.docket_section(files, '08_cost_ledgers/costs.json',
                lambda value: value['receiverInspectionByRoute']['manager-usdc'].update({'checking': 140000}))
        def omit_dimension(files):
            self.docket_section(files, '08_cost_ledgers/costs.json',
                lambda value: value['receiverInspectionByRoute']['manager-usdc'].pop('checking'))
        def fake_fleet(files):
            self.docket_section(files, '06_proof_bundles/capability.json',
                lambda value: value['receiverReceipts'][0].update({'inspectionKind': 'fleet-local-review'}))
        for change in (discount, omit_dimension, fake_fleet):
            with self.assertRaises(ValueError): self.check(self.reframe(change))

    def test_reopened_docket_must_have_identical_raw_bytes_not_only_equal_json(self):
        files = self.reframe(lambda files: files.update({'docket-reopened.json':
            json.dumps(json.loads(files['docket.json']), indent=1).encode()}), same_reopened=False)
        with self.assertRaises(ValueError): self.check(files)

    def test_duplicate_extra_nonregular_oversized_and_bad_crc_members_are_refused_before_use(self):
        for change in [lambda files: files.pop('receipt-wrapper.json'),
                lambda files: files.update({'../outside.json': b'{}'})]:
            files = copy.deepcopy(self.files); change(files)
            with self.assertRaisesRegex(ValueError, 'inventory'): self.check(files)
        raw = zip_fixture(self.files)
        output = io.BytesIO(raw)
        with zipfile.ZipFile(output, 'a') as archive:
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore'); archive.writestr('raw-receipt.json', b'{}')
        duplicate = output.getvalue()
        with self.assertRaisesRegex(ValueError, 'inventory'):
            self.check(zip_transform=lambda _: duplicate)
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as archive:
            for name, value in self.files.items():
                info = zipfile.ZipInfo(name)
                info.external_attr = (0o120777 if name == 'raw-receipt.json' else 0o100644) << 16
                archive.writestr(info, value)
        with self.assertRaisesRegex(ValueError, 'nonregular'):
            self.check(zip_transform=lambda _: output.getvalue())
        with patch.object(m, 'MAX_NATIVE_MEMBER_BYTES', 1), self.assertRaisesRegex(ValueError, 'oversized'):
            self.check()
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
            for name, value in self.files.items(): archive.writestr(name, value)
        raw = output.getvalue(); offset = raw.index(self.files['raw-receipt.json'])
        corrupt = raw[:offset] + bytes([raw[offset] ^ 1]) + raw[offset + 1:]
        with self.assertRaises(zipfile.BadZipFile): self.check(zip_transform=lambda _: corrupt)


# Inert Alpha artifact fixtures; these APIs and ZIPs never invoke a browser or source module.
def browser_artifact_fixture(*, source_count=1):
    import base64
    producer = {'runId': 71, 'runAttempt': 2, 'workflowId': 72, 'event': 'pull_request',
        'headBranch': 'reviewed-input', 'headCommit': '1' * 40, 'checkoutCommit': '2' * 40,
        'checkoutTree': '3' * 40, 'checkoutParents': ['4' * 40, '1' * 40]}
    mission, campaign = 'capability-00000000-0000-4000-8000-000000000001', 'c' * 64
    workspace = {'schema': 'successor-capability-workspace/v2', 'missionId': mission, 'revision': 0,
        'events': [{'digest': 'e' * 64}], 'authority': [], 'paymentRoute': 'none'}
    request = {'schema': 'inert-ui-request/v1', 'missionId': mission, 'campaignDigest': campaign,
        'commission': {'id': 'inert-commission', 'branch': 'usdc', 'route': 'manager-usdc',
            'currency': 'USDC6', 'capBaseUnits': '0'}}
    jobs_request = {**request, 'commission': {**request['commission'], 'branch': 'agialpha',
        'route': 'jobs-agialpha', 'currency': 'AGIALPHA18'}}
    source_inputs = {('examples/inert-source.mjs' if index == 0 else 'examples/inert-source-' + str(index) + '.mjs'):
        ('// Inert bytes ' + str(index) + ': never imported.\n').encode() for index in range(source_count)}
    sources = {name: m.sha(raw) for name, raw in source_inputs.items()}
    catalog = {'schema': 'successor-capability-source/v1', 'sourceHash': m.sha(m.canonical(sources)), 'sources': sources}
    prefix = m.BROWSER_PREFIX
    files = {prefix + 'served/index.html': b'<!doctype html><title>inert</title>',
        prefix + 'served/sources.json': encode(catalog), prefix + 'fleet-browser-workspace.json': encode(workspace),
        prefix + 'jobs-browser-workspace.json': encode(workspace), prefix + 'fleet-browser-request.json': encode(request),
        prefix + 'jobs-browser-request.json': encode(jobs_request),
        'source.json': encode({'commit': producer['checkoutCommit'], 'source': catalog, 'trackedDiff': ''}),
        'exact-checkout.json': encode({'commit': producer['checkoutCommit'], 'tree': producer['checkoutTree'],
            'source': catalog, 'files': sources})}
    workspace_sha, request_sha = (m.sha(files[prefix + name]) for name in
        ('fleet-browser-workspace.json', 'fleet-browser-request.json'))
    page_sha = m.sha(files[prefix + 'served/index.html'])
    exports = {'schema': 'actual-browser-native-request-exports/v1', 'missionId': mission,
        'campaignDigest': campaign, 'sourceHash': catalog['sourceHash'], 'pageSha256': page_sha,
        'workspace': {'file': 'fleet-browser-workspace.json', 'sha256': workspace_sha,
            'jobsFile': 'jobs-browser-workspace.json', 'jobsSha256': workspace_sha,
            'revision': 0, 'eventPrefix': ['e' * 64], 'head': 'e' * 64},
        'requests': {'manager-usdc': {'file': 'fleet-browser-request.json', 'sha256': request_sha, 'currency': 'USDC6'},
            'jobs-agialpha': {'file': 'jobs-browser-request.json',
                'sha256': m.sha(files[prefix + 'jobs-browser-request.json']), 'currency': 'AGIALPHA18'}},
        'scope': 'Actual UI downloads from one unchanged pre-Fleet mission; alternative unsubmitted zero-cap drafts'}
    files[prefix + 'browser-native-requests.json'] = encode(exports)
    files[prefix + 'fleet-native/native-proof.json'] = encode({'schema': 'actual-browser-fleet-native-return/v1',
        'alphaCommit': producer['checkoutCommit'], 'alphaTree': producer['checkoutTree'],
        'campaignDigest': campaign, 'sourceHash': catalog['sourceHash'],
        'workspaceSha256': workspace_sha, 'requestSha256': request_sha})
    files[prefix + 'journey.json'] = encode({'passed': True, 'pageErrors': [], 'checks': m.BROWSER_CHECKS,
        'pageSha256': page_sha, 'source': catalog, 'fleetLocalReview': {'requestExports': exports}})
    inventory = {name: {'bytes': len(raw), 'sha256': m.sha(raw)} for name, raw in files.items()}
    raw = zip_fixture(files)
    pin = {'schema': m.BROWSER_SCHEMA, 'state': 'REVIEWED_AUTHENTICATED_ALPHA_ARTIFACT',
        'repository': m.ALPHA_REPOSITORY, 'workflowPath': m.BROWSER_WORKFLOW, 'producer': producer,
        'artifact': {'id': 73, 'name': 'successor-capability-' + producer['checkoutCommit'],
            'digest': 'sha256:' + m.sha(raw), 'sizeInBytes': len(raw)},
        'sourceHash': catalog['sourceHash'], 'pageSha256': page_sha,
        'catalogSha256': m.sha(files[prefix + 'served/sources.json']), 'inventorySha256': m.sha(m.canonical(inventory)),
        'members': inventory, 'campaignDigest': campaign, 'missionId': mission,
        'workspaceSha256': workspace_sha, 'requestSha256': request_sha,
        'transport': {'repository': m.ALPHA_REPOSITORY, 'commit': 'a' * 40, 'tree': 'b' * 40,
            'path': 'evidence/discovery-browser-inputs-v1/' + producer['headCommit'],
            'custodySha256': 'a' * 64, 'custodyBytes': 1, 'custodyGitBlob': 'b' * 40}}
    artifact = {'id': 73, 'name': pin['artifact']['name'], 'digest': pin['artifact']['digest'],
        'size_in_bytes': len(raw), 'expired': False, 'workflow_run': {'id': 71, 'head_sha': producer['headCommit']}}
    responses = {'actions/workflows/72': {'id': 72, 'path': m.BROWSER_WORKFLOW},
        'actions/runs/71': {'id': 71, 'run_attempt': 2, 'workflow_id': 72, 'head_sha': producer['headCommit'],
            'head_branch': producer['headBranch'], 'event': 'pull_request', 'path': m.BROWSER_WORKFLOW,
            'status': 'completed', 'conclusion': 'success', 'repository': {'full_name': m.ALPHA_REPOSITORY},
            'head_repository': {'full_name': m.ALPHA_REPOSITORY}},
        'actions/runs/71/attempts/2/jobs?per_page=100&page=1': {'total_count': 1, 'jobs': [{'id': 74, 'name': 'capability',
            'status': 'completed', 'conclusion': 'success', 'head_sha': producer['headCommit'],
            'steps': [{'name': name, 'status': 'completed', 'conclusion': 'success'} for name in (
                'Bind retained evidence to exact source', 'Saved future-task protocol, docket and real-task boundary acceptance',
                'Retain exact-source screenshots and journey evidence')]}]},
        'git/commits/' + producer['checkoutCommit']: {'sha': producer['checkoutCommit'],
            'tree': {'sha': producer['checkoutTree']}, 'parents': [{'sha': value} for value in producer['checkoutParents']]},
        'actions/artifacts/73': artifact}
    source_inputs['docs/successor/capabilities/sources.json'] = files[prefix + 'served/sources.json']
    tree = []
    for index, (name, data) in enumerate(source_inputs.items()):
        import hashlib
        blob_sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        tree.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': blob_sha, 'size': len(data)})
        responses['git/blobs/' + blob_sha] = {'sha': blob_sha, 'encoding': 'base64', 'size': len(data),
            'content': base64.b64encode(data).decode() + '\n'}
    responses['git/trees/' + producer['checkoutTree'] + '?recursive=1'] = {
        'sha': producer['checkoutTree'], 'truncated': False, 'tree': tree}
    return pin, files, raw, responses



def public_packet_fixture(*, served_catalog_prefix=b'', source_count=1):
    import base64
    import hashlib
    pin, files, raw, responses = browser_artifact_fixture(source_count=source_count)
    producer = pin['producer']
    old_checkout = producer['checkoutCommit']
    producer.update(event='push', headBranch='main', checkoutCommit=producer['headCommit'], checkoutParents=['4' * 40])
    for name in ('source.json', 'exact-checkout.json'):
        value = json.loads(files[name]); value['commit'] = producer['checkoutCommit']; files[name] = encode(value)
    name = m.BROWSER_PREFIX + 'fleet-native/native-proof.json'
    value = json.loads(files[name]); value['alphaCommit'] = producer['checkoutCommit']; files[name] = encode(value)
    catalog_name = m.BROWSER_PREFIX + 'served/sources.json'
    files[catalog_name] = served_catalog_prefix + files[catalog_name]
    pin['catalogSha256'] = m.sha(files[catalog_name])
    pin['members'] = {name: {'bytes': len(raw), 'sha256': m.sha(raw)} for name, raw in files.items()}
    pin['inventorySha256'] = m.sha(m.canonical(pin['members']))
    raw = zip_fixture(files)
    pin['artifact'].update(name='successor-capability-' + producer['checkoutCommit'],
        digest='sha256:' + m.sha(raw), sizeInBytes=len(raw))
    responses['actions/runs/71'].update(event='push', head_branch='main')
    checkout = responses.pop('git/commits/' + old_checkout)
    checkout.update(sha=producer['checkoutCommit'], parents=[{'sha': '4' * 40}])
    responses['git/commits/' + producer['checkoutCommit']] = checkout
    responses['actions/artifacts/73'].update(name=pin['artifact']['name'], digest=pin['artifact']['digest'], size_in_bytes=len(raw))
    job = responses['actions/runs/71/attempts/2/jobs?per_page=100&page=1']['jobs'][0]; job['run_id'] = 71
    responses['actions/runs/71/artifacts?per_page=100&page=1'] = {
        'total_count': 1, 'artifacts': [responses['actions/artifacts/73']]}
    responses['actions/runs/71'].update(display_title='Recorded exact-source journey', run_number=1,
        actor={'login': 'recorded-actor'}, triggering_actor={'login': 'recorded-trigger'})
    for index, step in enumerate(job['steps'], 1): step['number'] = index
    jobs_response = responses['actions/runs/71/attempts/2/jobs?per_page=100&page=1']
    jobs_response['jobs'].append({'id': 75, 'name': 'paper-scope', 'run_id': 71,
        'head_sha': producer['headCommit'], 'status': 'completed', 'conclusion': 'success',
        'labels': ['ubuntu-latest'], 'steps': [{'name': 'Scope', 'number': 1, 'status': 'completed', 'conclusion': 'success'}]})
    jobs_response['total_count'] = 2
    artifacts_response = responses['actions/runs/71/artifacts?per_page=100&page=1']
    artifacts_response['artifacts'].append({'id': 76, 'name': 'ancillary-evidence',
        'created_at': '2026-10-01T00:00:00Z', 'size_in_bytes': 1})
    artifacts_response['total_count'] = 2
    checkout.update(message='Recorded source commit', author={'name': 'Recorded Author'},
        committer={'name': 'Recorded Committer'}, verification={'verified': False, 'reason': 'unsigned'})
    metadata = {'run': responses['actions/runs/71'],
        'jobs': responses['actions/runs/71/attempts/2/jobs?per_page=100&page=1'],
        'artifacts': responses['actions/runs/71/artifacts?per_page=100&page=1'],
        'checkout-commit': checkout, 'public-commit': checkout}
    custody = {'schema': 'successor/discovery-browser-artifact-custody/v1',
        **{key: pin[key] for key in ('repository', 'workflowPath', 'producer', 'artifact',
                                   'sourceHash', 'pageSha256', 'catalogSha256', 'members')}, 'inventory': pin['members']}
    packet_files = {**files, 'CUSTODY.json': encode(custody),
        **{'metadata/' + name + '.json': encode(value) for name, value in metadata.items()}}
    packet_tree = []
    for name, data in packet_files.items():
        digest = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        packet_tree.append({'path': pin['transport']['path'] + '/' + name, 'mode': '100644', 'type': 'blob', 'sha': digest,
            'size': len(data)})
        responses['git/blobs/' + digest] = {'sha': digest, 'encoding': 'base64', 'size': len(data),
            'content': base64.b64encode(data).decode()}
        if name == 'CUSTODY.json':
            pin['transport'].update(custodySha256=m.sha(data), custodyBytes=len(data), custodyGitBlob=digest)
    responses['git/commits/' + pin['transport']['commit']] = {'sha': pin['transport']['commit'],
        'tree': {'sha': pin['transport']['tree']}}
    responses['git/trees/' + pin['transport']['tree'] + '?recursive=1'] = {
        'sha': pin['transport']['tree'], 'truncated': False, 'tree': packet_tree}
    return pin, files, raw, responses


class AlphaBrowserArtifactTests(unittest.TestCase):
    def setUp(self):
        self.pin, self.files, self.raw, self.responses = public_packet_fixture()
        self.expected = {'alphaCommit': self.pin['producer']['headCommit'], 'alphaTree': self.pin['producer']['checkoutTree'], 'alphaSourceHash': self.pin['sourceHash'],
            'catalogSha256': self.pin['catalogSha256']}
        self.downloads = []
        self.raw_downloads = []

    def live(self, *, raw_body=None):
        def api(key):
            self.downloads.append(key)
            self.assertFalse(key.startswith(('git/blobs/', 'contents/')) or key.endswith('/zip'))
            return copy.deepcopy(self.responses[key])
        def fixture_raw(commit, name, maximum):
            import base64
            self.raw_downloads.append((commit, name, maximum))
            tree = self.responses['git/commits/' + commit]['tree']['sha']
            entry = next(item for item in self.responses['git/trees/' + tree + '?recursive=1']['tree']
                if item['path'] == name)
            return base64.b64decode(self.responses['git/blobs/' + entry['sha']]['content'])
        return m.authenticate_browser_input(self.pin, api, self.expected, raw_body=raw_body or fixture_raw)

    def rehash_metadata_sidecar(self, name, change, *, alternate_format=False):
        """Model a newly pinned public packet with valid Git hashes but changed retained metadata."""
        import base64
        import hashlib
        transport = self.pin['transport']
        old_commit, old_tree = transport['commit'], transport['tree']
        tree = copy.deepcopy(self.responses['git/trees/' + old_tree + '?recursive=1'])
        entry = next(item for item in tree['tree']
            if item['path'] == transport['path'] + '/metadata/' + name + '.json')
        original_raw = base64.b64decode(self.responses['git/blobs/' + entry['sha']]['content'])
        original = json.loads(original_raw)
        value = copy.deepcopy(original); changed = change(value)
        if changed is not None: value = changed
        raw = (json.dumps(value, indent=1) + '\n\n').encode() if alternate_format else encode(value)
        digest = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        entry.update(sha=digest, size=len(raw))
        self.responses['git/blobs/' + digest] = {'sha': digest, 'size': len(raw), 'encoding': 'base64',
            'content': base64.b64encode(raw).decode()}
        # The in-memory API fixture models the newly reviewed immutable packet tree and commit identities.
        tree_sha = hashlib.sha1(m.canonical(tree['tree'])).hexdigest()
        commit_sha = hashlib.sha1(m.canonical({'tree': tree_sha, 'previous': old_commit})).hexdigest()
        tree['sha'] = tree_sha
        commit = copy.deepcopy(self.responses['git/commits/' + old_commit])
        commit.update(sha=commit_sha, tree={'sha': tree_sha})
        self.responses['git/trees/' + tree_sha + '?recursive=1'] = tree
        self.responses['git/commits/' + commit_sha] = commit
        transport.update(commit=commit_sha, tree=tree_sha)
        return original, value, original_raw, raw

    def rebind_files(self):
        self.raw = zip_fixture(self.files)
        self.pin['members'] = {name: {'bytes': len(raw), 'sha256': m.sha(raw)} for name, raw in self.files.items()}
        self.pin['inventorySha256'] = m.sha(m.canonical(self.pin['members']))
        self.pin['artifact'].update(sizeInBytes=len(self.raw), digest='sha256:' + m.sha(self.raw))

    def test_public_main_packet_and_all_raw_originals_are_retained_without_actions_zip(self):
        result = self.live()
        self.assertEqual(self.pin['producer']['headCommit'], self.pin['producer']['checkoutCommit'])
        self.assertEqual(result['files'], self.files)
        self.assertEqual(result['workspace'], self.files[m.BROWSER_PREFIX + 'fleet-browser-workspace.json'])
        self.assertEqual(result['request'], self.files[m.BROWSER_PREFIX + 'fleet-browser-request.json'])
        self.assertFalse(any('/zip' in key for key in self.downloads))
        self.assertIn('git/commits/' + self.pin['transport']['commit'], self.downloads)
        self.assertIn('actions/runs/71/artifacts?per_page=100&page=1', self.downloads)
        self.assertNotIn('actions/artifacts/73', self.downloads)
        self.assertEqual(result['rawTransport']['restReads'], 8)
        self.assertEqual(len(self.downloads), 8)
        self.assertEqual(result['rawTransport']['immutableObjects'], len(self.raw_downloads))

    def test_full_forty_one_source_packet_uses_eight_rest_reads_and_only_immutable_raw_bodies(self):
        self.pin, self.files, self.raw, self.responses = public_packet_fixture(source_count=41)
        self.expected.update(alphaSourceHash=self.pin['sourceHash'], catalogSha256=self.pin['catalogSha256'])
        result = self.live()
        self.assertEqual(len(result['catalog']['sources']), 41)
        self.assertEqual(len(self.downloads), 8)
        self.assertLessEqual(len(self.downloads), 12)
        self.assertEqual(result['rawTransport']['restReads'], 8)
        self.assertEqual(result['rawTransport']['immutableObjects'], len(self.raw_downloads))
        # Repeated workspaces, source catalog and commit metadata are identical Git objects.
        self.assertLess(len(self.raw_downloads), 17 + 41 + 1)
        self.assertTrue(all(m.valid_sha(commit) and m.raw_path(name) and 0 < maximum <= m.MAX_BROWSER_MEMBER_BYTES
            for commit, name, maximum in self.raw_downloads))

    def test_authentication_caches_nothing_across_fresh_final_mutable_observations(self):
        first = self.live(); reads = len(self.raw_downloads)
        second = self.live()
        self.assertEqual(first['rawTransport'], second['rawTransport'])
        self.assertEqual(len(self.downloads), 16)
        self.assertEqual(len(self.raw_downloads), 2 * reads)
        self.responses['actions/runs/71']['conclusion'] = 'failure'
        with self.assertRaisesRegex(ValueError, 'workflow/run/source'): self.live()
        self.assertEqual(self.downloads.count('actions/runs/71'), 3)
        self.assertEqual(len(self.raw_downloads), 2 * reads)

    def test_all_five_rehashed_metadata_sidecars_must_match_the_complete_fresh_snapshots(self):
        changes = {
            'run': lambda value: value['actor'].update(login='substituted-actor'),
            'jobs': lambda value: value['jobs'][1]['labels'].append('substituted-label'),
            'artifacts': lambda value: value['artifacts'][1].update(created_at='2026-10-02T00:00:00Z'),
            'checkout-commit': lambda value: value.update(message='Substituted source message'),
            'public-commit': lambda value: value['verification'].update(reason='substituted-reason')}
        for name, change in changes.items():
            self.pin, self.files, self.raw, self.responses = public_packet_fixture()
            self.downloads, self.raw_downloads = [], []
            original, changed, _, _ = self.rehash_metadata_sidecar(name, change)
            self.assertNotEqual(m.canonical(original), m.canonical(changed))
            with self.subTest(sidecar=name), self.assertRaisesRegex(ValueError, 'complete metadata snapshot differs: ' + name):
                self.live()
            self.assertLessEqual(len(self.downloads), 12)

    def test_metadata_semantics_preserve_json_types_but_ignore_object_order_and_raw_framing(self):
        for name, change in [
            ('run', lambda value: value.update(run_number=True)),
            ('run', lambda value: value.update(run_number=1.0)),
            ('public-commit', lambda value: value['verification'].update(verified=0))]:
            self.pin, self.files, self.raw, self.responses = public_packet_fixture()
            original, changed, _, _ = self.rehash_metadata_sidecar(name, change)
            self.assertEqual(original, changed)  # Python equality alone would incorrectly accept these rewrites.
            with self.subTest(sidecar=name), self.assertRaisesRegex(ValueError, 'complete metadata snapshot differs: ' + name):
                self.live()
        self.pin, self.files, self.raw, self.responses = public_packet_fixture()
        original, changed, original_raw, raw = self.rehash_metadata_sidecar('run',
            lambda value: dict(reversed(list(value.items()))), alternate_format=True)
        self.assertEqual(m.canonical(original), m.canonical(changed))
        self.assertNotEqual(original_raw, raw)
        self.downloads, self.raw_downloads = [], []
        self.assertEqual(self.live()['rawTransport']['restReads'], 8)

    def test_fresh_mutable_ancillary_observations_are_not_cached_between_authentications(self):
        self.live()
        self.responses['actions/runs/71']['display_title'] = 'Changed live ancillary title'
        with self.assertRaisesRegex(ValueError, 'complete metadata snapshot differs: run'): self.live()
        self.assertEqual(self.downloads.count('actions/runs/71'), 2)
        self.assertEqual(self.downloads.count('actions/runs/71/attempts/2/jobs?per_page=100&page=1'), 2)
        self.assertEqual(self.downloads.count('actions/runs/71/artifacts?per_page=100&page=1'), 2)
        self.assertEqual(len(self.downloads), 15)  # Second authentication refuses before its final source-tree read.

    def test_both_full_live_collection_envelopes_are_complete_unique_and_bounded(self):
        for field, endpoint in [('jobs', 'actions/runs/71/attempts/2/jobs?per_page=100&page=1'),
                                ('artifacts', 'actions/runs/71/artifacts?per_page=100&page=1')]:
            for change in [lambda value: value.update(total_count=3),
                    lambda value: value.update(total_count=101),
                    lambda value: value.update(total_count=True),
                    lambda value: value[field][1].update(id=value[field][0]['id'])]:
                self.pin, self.files, self.raw, self.responses = public_packet_fixture()
                self.downloads, self.raw_downloads = [], []
                change(self.responses[endpoint])
                with self.subTest(collection=field), self.assertRaisesRegex(ValueError, 'inventory.*' + field): self.live()
                self.assertEqual(self.raw_downloads, [])
                self.assertLessEqual(len(self.downloads), 12)

    def test_raw_permission_or_rate_failure_has_one_attempt_without_api_body_fallback(self):
        for status in (403, 429):
            reader = unittest.mock.Mock(side_effect=ValueError('Immutable public raw body refused: HTTP ' + str(status)))
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, 'HTTP ' + str(status)):
                self.live(raw_body=reader)
            self.assertEqual(reader.call_count, 1)
        self.assertFalse(any(route.startswith(('git/blobs/', 'contents/')) or route.endswith('/zip') for route in self.downloads))

    def test_incomplete_metadata_collection_is_refused_without_pagination_or_raw_fallback(self):
        calls = []
        def api(endpoint):
            calls.append(endpoint)
            if endpoint.startswith('actions/runs/71/attempts/2/jobs?'):
                return {'total_count': 101, 'jobs': [{'id': index + 1, 'name': 'inert-page'} for index in range(100)]}
            return copy.deepcopy(self.responses[endpoint])
        reader = unittest.mock.Mock(side_effect=AssertionError('No body before metadata qualification'))
        with self.assertRaisesRegex(ValueError, 'inventory.*jobs'):
            m.authenticate_browser_input(self.pin, api, self.expected, raw_body=reader)
        self.assertEqual(len(calls), 3)
        self.assertLessEqual(len(calls), 12)
        reader.assert_not_called()

    def test_full_tree_raw_entry_type_mode_size_and_git_identity_are_required(self):
        for field, value in [('mode', '120000'), ('type', 'tree'), ('size', 0), ('size', True),
                ('size', m.MAX_NATIVE_MEMBER_BYTES + 1), ('sha', 'f' * 40)]:
            self.pin, self.files, self.raw, self.responses = public_packet_fixture()
            entries = self.responses['git/trees/' + self.pin['transport']['tree'] + '?recursive=1']['tree']
            entry = next(item for item in entries if item['path'].endswith('/CUSTODY.json'))
            entry[field] = value
            with self.subTest(field=field, value=value), self.assertRaises((ValueError, KeyError)):
                self.live()

    def test_public_packet_requires_the_canonical_seventeen_paths_without_metadata_aliases(self):
        tree = self.responses['git/trees/' + self.pin['transport']['tree'] + '?recursive=1']['tree']
        prefix = self.pin['transport']['path'] + '/'
        observed = {item['path'][len(prefix):] for item in tree}
        self.assertEqual(len(observed), 17)
        self.assertEqual(m.BROWSER_METADATA, {'metadata/' + name + '.json' for name in
            ('run', 'jobs', 'artifacts', 'checkout-commit', 'public-commit')})
        self.assertEqual(observed, m.BROWSER_MEMBERS | m.BROWSER_METADATA | {'CUSTODY.json'})
        entry = next(item for item in tree if item['path'] == prefix + 'metadata/run.json')
        entry['path'] = prefix + 'supplementarymetadata/run.json'
        with self.assertRaisesRegex(ValueError, 'inventory'): self.live()

    def test_served_catalog_must_match_raw_git_bytes_even_when_equal_json_and_packet_rebound(self):
        original = self.files[m.BROWSER_PREFIX + 'served/sources.json']
        self.pin, self.files, self.raw, self.responses = public_packet_fixture(served_catalog_prefix=b'\n')
        self.expected['catalogSha256'] = self.pin['catalogSha256']
        reframed = self.files[m.BROWSER_PREFIX + 'served/sources.json']
        self.assertEqual(json.loads(original), json.loads(reframed))
        self.assertNotEqual(original, reframed)
        with self.assertRaisesRegex(ValueError, 'served catalog.*raw Git catalog bytes'): self.live()

    def test_unset_pin_cannot_capture_or_verify_and_pure_offline_preserves_exact_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); (root / 'config').mkdir()
            path = root / m.BROWSER_PIN
            unset = copy.deepcopy(self.pin); unset['state'] = 'UNSET_PENDING_AUTHENTICATED_ALPHA_ARTIFACT'
            path.write_bytes(encode(unset))
            with self.assertRaisesRegex(ValueError, 'UNSET'): m.verify_browser_files(root, self.files)
            path.write_bytes(encode(self.pin))
            result = m.verify_browser_files(root, self.files)
            self.assertEqual(result['workspaceSha256'], self.pin['workspaceSha256'])
            self.assertEqual(result['pinSha256'], m.sha(path.read_bytes()))
            changed = copy.deepcopy(self.files); changed[m.BROWSER_PREFIX + 'fleet-browser-workspace.json'] += b' '
            with self.assertRaisesRegex(ValueError, 'digests'): m.verify_browser_files(root, changed)

    def test_run_attempt_workflow_job_step_and_artifact_fail_closed_before_any_download(self):
        changes = [('actions/runs/71', 'run_attempt', 3), ('actions/runs/71', 'head_sha', 'f' * 40),
            ('actions/workflows/72', 'path', '.github/workflows/other.yml'),
            ('actions/artifacts/73', 'expired', True), ('actions/artifacts/73', 'digest', 'sha256:' + 'f' * 64)]
        for endpoint, key, value in changes:
            old = self.responses[endpoint][key]; self.responses[endpoint][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): self.live()
            self.responses[endpoint][key] = old
        job = self.responses['actions/runs/71/attempts/2/jobs?per_page=100&page=1']['jobs'][0]
        for key in ('conclusion',):
            job[key] = 'skipped'
            with self.assertRaises(ValueError): self.live()
            job[key] = 'success'
        job['steps'][1]['conclusion'] = 'failure'
        with self.assertRaises(ValueError): self.live()
        self.assertFalse(any(key.startswith('git/blobs/') for key in self.downloads))

    def test_synthetic_parents_full_tree_and_actual_raw_git_source_inputs_are_authenticated(self):
        endpoint = 'git/commits/' + self.pin['producer']['checkoutCommit']
        self.responses[endpoint]['parents'][0]['sha'] = 'f' * 40
        with self.assertRaisesRegex(ValueError, 'parents'): self.live()
        self.responses[endpoint]['parents'][0]['sha'] = '4' * 40
        tree = self.responses['git/trees/' + self.pin['producer']['checkoutTree'] + '?recursive=1']
        tree['truncated'] = True
        with self.assertRaisesRegex(ValueError, 'full tree'): self.live()
        tree['truncated'] = False
        source_blob = tree['tree'][0]['sha']
        self.responses['git/blobs/' + source_blob]['content'] = 'ZmFrZQ=='
        with self.assertRaisesRegex(ValueError, 'blob bytes'): self.live()

    def test_changed_page_catalog_source_journal_request_or_history_is_refused_even_after_outer_rehash(self):
        for name, change in [
            ('browser-native-requests.json', lambda value: value.update({'campaignDigest': 'f' * 64})),
            ('journey.json', lambda value: value.update({'passed': False})),
            ('fleet-native/native-proof.json', lambda value: value.update({'alphaCommit': 'f' * 40})),
            ('jobs-browser-workspace.json', lambda value: value.update({'revision': 1})),
            ('fleet-browser-request.json', lambda value: value['commission'].update({'capBaseUnits': '1'}))]:
            self.pin, self.files, self.raw, self.responses = public_packet_fixture()
            path = m.BROWSER_PREFIX + name
            value = json.loads(self.files[path]); change(value); self.files[path] = encode(value)
            self.rebind_files()
            with self.subTest(member=name), self.assertRaises(ValueError): m.validate_browser_archive(self.raw, self.pin)

    def test_missing_duplicate_unsafe_nonregular_and_crc_damaged_members_are_refused(self):
        for extra in ('../outside.json', '/absolute.json', 'a\\outside.json'):
            files = {**self.files, extra: b'{}'}; raw = zip_fixture(files)
            pin = copy.deepcopy(self.pin); pin['artifact'].update(digest='sha256:' + m.sha(raw), sizeInBytes=len(raw))
            with self.subTest(name=extra), self.assertRaises(ValueError): m.validate_browser_archive(raw, pin)
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED) as archive:
            for name, raw in self.files.items(): archive.writestr(name, raw)
        raw = stream.getvalue(); damaged = bytearray(raw); at = raw.index(self.files['source.json']); damaged[at] ^= 1
        raw = bytes(damaged); pin = copy.deepcopy(self.pin)
        pin['artifact'].update(digest='sha256:' + m.sha(raw), sizeInBytes=len(raw))
        with self.assertRaises(zipfile.BadZipFile): m.validate_browser_archive(raw, pin)

    def test_public_packet_commit_custody_raw_blob_and_exact_inventory_cannot_be_substituted(self):
        self.pin['transport']['tree'] = 'f' * 40
        with self.assertRaisesRegex(ValueError, 'commit/tree'): self.live()
        self.pin, self.files, self.raw, self.responses = public_packet_fixture()
        tree = self.responses['git/trees/' + self.pin['transport']['tree'] + '?recursive=1']
        tree['tree'].append({'path': self.pin['transport']['path'] + '/extra.json', 'type': 'blob'})
        with self.assertRaisesRegex(ValueError, 'inventory'): self.live()
        tree['tree'].pop()
        custody = self.responses['git/blobs/' + self.pin['transport']['custodyGitBlob']]
        custody['content'] = 'e30='
        with self.assertRaisesRegex(ValueError, 'blob bytes'): self.live()

    def test_public_capture_cannot_use_a_pr_synthetic_checkout_or_a_partial_metadata_inventory(self):
        self.pin['producer'].update(event='pull_request', checkoutCommit='2' * 40, checkoutParents=['4' * 40, '1' * 40])
        self.pin['artifact']['name'] = 'successor-capability-' + '2' * 40
        with self.assertRaisesRegex(ValueError, 'shipping source'): self.live()
        self.pin, self.files, self.raw, self.responses = public_packet_fixture()
        self.responses['actions/runs/71']['run_attempt'] = 3
        with self.assertRaisesRegex(ValueError, 'workflow/run/source'): self.live()

    def test_artifact_live_callbacks_are_mandatory_and_source_cannot_be_substituted(self):
        with self.assertRaises(ValueError): m.authenticate_browser_input(self.pin, None, self.expected)
        self.expected['alphaCommit'] = 'f' * 40
        with self.assertRaisesRegex(ValueError, 'shipping source'): self.live()

class PublicRawHttpTests(unittest.TestCase):
    """Only in-memory HTTP responses are used; no network request is issued."""

    class Response(io.BytesIO):
        def __init__(self, raw, url, headers=None, status=200):
            super().__init__(raw); self.status = status; self.url = url; self.headers = headers or {}
        def geturl(self): return self.url

    def setUp(self):
        self.commit, self.name = 'a' * 40, 'evidence/inert-source.json'
        self.url = 'https://raw.githubusercontent.com/' + m.ALPHA_REPOSITORY + '/' + self.commit + '/' + self.name

    def test_raw_reader_uses_only_fixed_full_commit_url_without_ambient_authorization(self):
        response = self.Response(b'bytes', self.url, {'Content-Length': '5'})
        opener = unittest.mock.Mock(); opener.open.return_value = response
        with patch.dict('os.environ', {'GH_TOKEN': 'inert-unused-token', 'GITHUB_TOKEN': 'inert-unused-token'}), \
                patch('urllib.request.build_opener', return_value=opener):
            self.assertEqual(m.public_raw_body(self.commit, self.name, 5), b'bytes')
        self.assertEqual(opener.open.call_count, 1)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, self.url); self.assertEqual(request.get_method(), 'GET')
        self.assertEqual(opener.open.call_args.kwargs['timeout'], 30)
        self.assertFalse(any(name.lower() in ('authorization', 'cookie') for name, _ in request.header_items()))
        self.assertTrue(response.closed)

    def test_public_metadata_reader_is_also_unauthenticated_and_refuses_body_fallback_routes(self):
        url = 'https://api.github.com/repos/' + m.ALPHA_REPOSITORY + '/actions/runs/71'
        opener = unittest.mock.Mock(); opener.open.return_value = self.Response(b'{"id":71}', url)
        with patch('urllib.request.build_opener', return_value=opener):
            self.assertEqual(m.github_read_api(m.ALPHA_REPOSITORY, 'actions/runs/71'), {'id': 71})
        request = opener.open.call_args.args[0]
        self.assertFalse(any(name.lower() == 'authorization' for name, _ in request.header_items()))
        with patch('urllib.request.build_opener') as build:
            for endpoint in ('git/blobs/' + 'a' * 40, 'contents/inert.json', 'actions/artifacts/7/zip'):
                with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                    m.github_read_api(m.ALPHA_REPOSITORY, endpoint)
            build.assert_not_called()

    def test_invalid_commit_and_noncanonical_paths_fail_before_any_http_request(self):
        with patch('urllib.request.build_opener') as build:
            for commit, name in [('main', self.name), (self.commit, '../inert'), (self.commit, '/absolute'),
                    (self.commit, 'a//b'), (self.commit, 'a?query'), (self.commit, 'a%2fb'), (self.commit, 'a\\b')]:
                with self.subTest(commit=commit, path=name), self.assertRaises(ValueError):
                    m.public_raw_body(commit, name, 8)
            build.assert_not_called()

    def test_redirect_rate_and_permission_errors_stop_without_retry_or_fallback(self):
        import urllib.error
        import urllib.request
        for status in (403, 429):
            opener = unittest.mock.Mock()
            opener.open.side_effect = urllib.error.HTTPError(self.url, status, 'Inert refusal', {}, None)
            with patch('urllib.request.build_opener', return_value=opener), self.subTest(status=status), \
                    self.assertRaisesRegex(ValueError, 'HTTP ' + str(status)):
                m.public_raw_body(self.commit, self.name, 8)
            self.assertEqual(opener.open.call_count, 1)
        def build(handler):
            self.assertIsInstance(handler, urllib.request.HTTPRedirectHandler)
            opener = unittest.mock.Mock()
            opener.open.side_effect = lambda request, **options: handler.redirect_request(
                request, None, 302, 'Inert redirect', {}, 'https://unavailable.invalid/never-requested')
            return opener
        with patch('urllib.request.build_opener', side_effect=build), self.assertRaisesRegex(ValueError, 'redirect refused'):
            m.public_raw_body(self.commit, self.name, 8)

    def test_declared_expanded_truncated_encoded_and_wrong_identity_responses_are_bounded(self):
        for raw, headers, url, maximum in [(b'12345', {'Content-Length': '5'}, self.url, 4),
                (b'12345', {}, self.url, 4), (b'123', {'Content-Length': '4'}, self.url, 4),
                (b'1234', {'Content-Encoding': 'gzip'}, self.url, 4),
                (b'1234', {}, self.url + '?changed', 4)]:
            response = self.Response(raw, url, headers)
            opener = unittest.mock.Mock(); opener.open.return_value = response
            with self.subTest(headers=headers, bytes=len(raw), url=url), \
                    patch('urllib.request.build_opener', return_value=opener), self.assertRaises(ValueError):
                m.public_raw_body(self.commit, self.name, maximum)
            self.assertTrue(response.closed)


class NativeSourceCustodyTests(unittest.TestCase):
    def assert_refused(self, root, message):
        runner = (HERE.parents[1] / 'scripts/integrations/discovery-release-native-test.mjs').as_uri()
        program = ('import assert from "node:assert/strict";'
                   'import {capturePinnedAlpha} from ' + json.dumps(runner) + ';'
                   'assert.throws(()=>capturePinnedAlpha(process.argv[1]),new RegExp(process.argv[2]));')
        subprocess.run(['node', '--input-type=module', '-e', program, str(root), message],
                       check=True, capture_output=True, text=True)

    def test_native_runner_rejects_nested_git_copy_before_source_pin(self):
        with tempfile.TemporaryDirectory(prefix='discovery-native-nested-') as directory:
            root = pathlib.Path(directory)
            subprocess.run(['git', 'init', '--quiet', str(root)], check=True)
            nested = root / 'nested'; nested.mkdir()
            self.assert_refused(nested, 'not the actual Git worktree root')

    def test_native_runner_rejects_inert_git_configuration_before_source_pin(self):
        for key, value in [('filter.fixture.required', 'true'), ('include.path', 'unused'),
                           ('includeIf.gitdir:unused.path', 'unused'),
                           ('core.attributesFile', 'unused'), ('extensions.worktreeConfig', 'true'),
                           ('extensions.partialClone', 'origin'), ('remote.origin.promisor', 'true'),
                           ('remote.origin.uploadpack', 'unavailable-program'),
                           ('protocol.file.allow', 'always')]:
            with self.subTest(key=key), tempfile.TemporaryDirectory(prefix='discovery-native-config-') as directory:
                root = pathlib.Path(directory)
                subprocess.run(['git', 'init', '--quiet', str(root)], check=True)
                subprocess.run(['git', '-C', str(root), 'config', '--local', key, value], check=True)
                expected = ('configuration is prohibited|executable, included, transport and redirected configuration')
                self.assert_refused(root, expected)


if __name__ == '__main__': unittest.main()
