"""Original-run metadata controls only; no browser, native source or packet is produced."""
import copy
import importlib.util
import json
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('alpha141_discovery_qualification', HERE / 'discovery-qualification.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ORIGINALS = json.loads((HERE / 'fixtures/alpha141-original-browser-producer.json').read_bytes())


class SourceMetadataStageReached(RuntimeError):
    """Stop before immutable source reads, public packet custody or execution."""


class OriginalAlpha141ProducerTests(unittest.TestCase):
    def test_selected_public_packet_matches_current031b_pin_and_original_producer(self):
        root = HERE.parents[1]
        binding = m.browser_pin(root)
        expected = m.source_metadata(root)
        self.assertEqual(expected['alphaCommit'], '031bdb5d055c8bad896daa076baea2b5e17b242c')
        self.assertEqual(expected['alphaTree'], '330e0e58268ed32990f04278fc543c71db45fd46')
        self.assertEqual(expected['alphaCommit'], binding['producer']['checkoutCommit'])
        self.assertEqual(expected['alphaTree'], binding['producer']['checkoutTree'])
        self.assertEqual(expected['alphaSourceHash'], binding['sourceHash'])
        self.assertEqual(expected['catalogSha256'], binding['catalogSha256'])
        self.assertEqual(binding['producer'], ORIGINALS['alpha141']['binding']['producer'])
        self.assertEqual(binding['artifact'], ORIGINALS['alpha141']['binding']['artifact'])
        self.assertEqual(binding['members'], ORIGINALS['alpha141']['binding']['members'])
        self.assertEqual(binding['transport']['commit'], 'f995b97ae9beef118b7705b31b73bfc9ce65c316')
        self.assertEqual(m.browser_producer_profile(binding),
            ('.github/workflows/agent-release.yml', 'successor-capability / capability', 120821426397))

    def metadata_stage(self, change=None):
        original = copy.deepcopy(ORIGINALS['alpha141'])
        binding, run, job = original['binding'], original['run'], original['job']
        # Mock only the outer reviewed-selection framing to reach the actual metadata validators.
        # This does not assert that a genuine source review or a public17 transport exists.
        binding.update(schema=m.BROWSER_SCHEMA, state='REVIEWED_AUTHENTICATED_ALPHA_ARTIFACT',
            transport=copy.deepcopy(ORIGINALS['legacy615']['binding']['transport']))
        binding['transport']['path'] = 'evidence/discovery-browser-inputs-v1/' + binding['producer']['headCommit']
        workflow = {'id': run['workflow_id'], 'path': run['path']}  # Inert API stub, not a new live observation.
        if change:
            change(binding, run, job, workflow)
        p = binding['producer']
        expected = {'alphaCommit': p['headCommit'], 'alphaTree': p['checkoutTree'],
            'alphaSourceHash': binding['sourceHash'], 'catalogSha256': binding['catalogSha256']}
        self.calls = []
        def api(endpoint):
            self.calls.append(endpoint)
            if endpoint == 'git/commits/' + p['checkoutCommit']:
                raise SourceMetadataStageReached('Exact original producer metadata accepted; source stage not run')
            responses = {'actions/workflows/' + str(p['workflowId']): workflow,
                'actions/runs/' + str(p['runId']): run,
                'actions/runs/' + str(p['runId']) + '/attempts/' + str(p['runAttempt']): run,
                'actions/runs/' + str(p['runId']) + '/attempts/' + str(p['runAttempt'])
                    + '/jobs?per_page=100&page=1': {'total_count': 1, 'jobs': [job]}}
            return copy.deepcopy(responses[endpoint])
        def no_body(*_):
            self.fail('No raw source, packet or supplied code is read by these metadata controls')
        return m.authenticate_browser_input(binding, api, expected, raw_body=no_body)

    def test_retained615_e31_profile_and_binding_are_unchanged(self):
        binding = ORIGINALS['legacy615']['binding']
        self.assertEqual(binding['producer']['checkoutCommit'], '61532fb82621a065e668fd11e57289dcfb65c67b')
        self.assertEqual(binding['transport']['commit'], 'e31e74d1a5144973e6a22006dbe29ea628a80386')
        self.assertEqual(m.browser_producer_profile(binding), (m.BROWSER_WORKFLOW, 'capability', None))
        m.validate_browser_binding(binding)

    def test_original031b_metadata_reaches_source_stage_without_any_packet_or_qualification(self):
        original = ORIGINALS['alpha141']
        self.assertEqual(m.browser_producer_profile(original['binding']),
            ('.github/workflows/agent-release.yml', 'successor-capability / capability', 120821426397))
        self.assertEqual(m.browser_capability_jobs([original['job']], original['binding']), [original['job']])
        with self.assertRaises(SourceMetadataStageReached):
            self.metadata_stage()
        self.assertEqual(len(self.calls), 5)
        for key in ('heldBehaviorQualified', 'publicationApproved', 'installedCompatibilityAccepted'):
            self.assertIs(ORIGINALS[key], False)
        self.assertEqual(ORIGINALS['externalExecution'], 'unprovisioned')
        with self.assertRaises(ValueError):
            m.validate_browser_binding(original['binding'])

    def test_finite_binding_rejects_mixed_unknown_and_changed_source_run_or_artifact(self):
        original = ORIGINALS['alpha141']['binding']
        changes = [('workflowPath', m.BROWSER_WORKFLOW), ('workflowPath', '.github/workflows/unknown.yml'),
            *[(key, '0' * 64) for key in ('sourceHash', 'catalogSha256')],
            *[('producer.' + key, original['producer'][key] + 1) for key in ('runId', 'runAttempt', 'workflowId')],
            ('producer.runAttempt', True), ('producer.event', 'pull_request'), ('producer.headBranch', 'another-branch'),
            *[('producer.' + key, '0' * 40) for key in ('headCommit', 'checkoutCommit', 'checkoutTree')],
            ('producer.checkoutParents', list(reversed(original['producer']['checkoutParents']))),
            ('artifact.id', original['artifact']['id'] + 1), ('artifact.name', 'successor-capability-unknown'),
            ('artifact.digest', 'sha256:' + '0' * 64), ('artifact.sizeInBytes', original['artifact']['sizeInBytes'] + 1)]
        for name, value in changes:
            binding = copy.deepcopy(original)
            parts = name.split('.')
            (binding if len(parts) == 1 else binding[parts[0]])[parts[-1]] = value
            with self.subTest(name=name), self.assertRaises(ValueError):
                m.browser_producer_profile(binding)
        binding = copy.deepcopy(original)
        for key in ('producer', 'artifact'):
            binding[key] = copy.deepcopy(ORIGINALS['legacy615']['binding'][key])
        with self.assertRaises(ValueError):
            m.browser_producer_profile(binding)

    def test_namespaced_original_job_cannot_be_relabelled_duplicated_or_substituted(self):
        original = ORIGINALS['alpha141']
        for name, value in [('id', original['job']['id'] + 1), ('run_id', original['job']['run_id'] + 1),
            ('name', 'capability'), ('name', 'other / capability')]:
            job = {**original['job'], name: value}
            with self.subTest(name=name), self.assertRaises(ValueError):
                m.browser_capability_jobs([job], original['binding'])
        with self.assertRaises(ValueError):
            m.browser_capability_jobs([original['job'], copy.deepcopy(original['job'])], original['binding'])

    def test_live_workflow_run_job_and_each_required_step_remain_fail_closed(self):
        changes = [('workflow', 'id', 391067735), ('workflow', 'path', m.BROWSER_WORKFLOW),
            ('run', 'id', 1), ('run', 'run_attempt', 2), ('run', 'workflow_id', 391067735),
            ('run', 'head_sha', '0' * 40), ('run', 'head_branch', 'later-main'), ('run', 'event', 'pull_request'),
            ('run', 'path', m.BROWSER_WORKFLOW), ('run', 'status', 'queued'), ('run', 'conclusion', 'failure'),
            ('job', 'id', 1), ('job', 'run_id', 1), ('job', 'name', 'capability'), ('job', 'head_sha', '0' * 40),
            ('job', 'status', 'queued'), ('job', 'conclusion', 'failure')]
        for record, key, value in changes:
            def change(binding, run, job, workflow):
                {'run': run, 'job': job, 'workflow': workflow}[record][key] = value
            with self.subTest(record=record, key=key), self.assertRaises(ValueError):
                self.metadata_stage(change)
        for name in ('Bind retained evidence to exact source',
            'Saved future-task protocol, docket and real-task boundary acceptance',
            'Retain exact-source screenshots and journey evidence'):
            def change(binding, run, job, workflow):
                next(step for step in job['steps'] if step['name'] == name)['conclusion'] = 'skipped'
            with self.subTest(step=name), self.assertRaises(ValueError):
                self.metadata_stage(change)


if __name__ == '__main__':
    unittest.main()
