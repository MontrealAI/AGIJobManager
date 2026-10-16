#!/usr/bin/env python3
"""Adversarial release gates and publication integration with mocked GitHub; no credentials."""
import ast
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import runpy
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import Mock, patch
from urllib.parse import quote
from release_common import REPOSITORY, TAG, TITLE, WORKFLOWS, REQUIRED_STEPS, BUILDER_ASSETS, BUILDER_ARCHIVE_ONLY_ASSETS, LIMIT, source_path, validate_qualification, verify_assets, sha, packaged_guide, require_builder_outputs, verify_builder_rebuild, builder_archive_context, verified_builder_context, verify_builder_context_outputs

PUBLISHER = Path(__file__).with_name('publish-release.py')
SOURCE = 'a' * 40
TREE = 'b' * 40

class ReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.config = {'repository': REPOSITORY, 'tag': TAG, 'name': TITLE, 'status': 'qualified', 'publicationAuthorized': True,
            'sourceCommit': SOURCE, 'sourceTree': TREE, 'checkoutCommit': SOURCE, 'releaseDate': '2026-10-10', 'requiredSourceRuns': {}}
        self.responses = {f'git/commits/{SOURCE}': {'tree': {'sha': TREE}}, 'git/ref/heads/main': {'object': {'sha': SOURCE}}}
        self.logs = {}
        for index, (workflow, names) in enumerate(WORKFLOWS.items(), 1):
            item = {'id': index, 'workflow': workflow, 'workflowId': index + 100, 'attempt': 1, 'event': 'push', 'headBranch': 'main'}
            self.config['requiredSourceRuns'][workflow] = item
            self.responses[f'actions/workflows/{index+100}'] = {'id': index+100, 'path': '.github/workflows/' + workflow}
            self.responses[f'actions/runs/{index}'] = {'id': index, 'workflow_id': index+100, 'run_attempt': 1, 'repository': {'full_name': REPOSITORY}, 'head_repository': {'full_name': REPOSITORY}, 'head_sha': SOURCE, 'head_branch': 'main', 'path': '.github/workflows/' + workflow, 'event': 'push', 'status': 'completed', 'conclusion': 'success'}
            jobs = []
            for j, name in enumerate(names):
                job_id = index*100+j
                steps = ['Verify qualified source checkout', *REQUIRED_STEPS[workflow]]
                if workflow == 'ci.yml' and name == 'build (0)':
                    steps += ['Released USDC console browser checks', 'Simulation accounting regression checks', 'UI smoke test']
                jobs.append({'id': job_id, 'name': name, 'head_sha': SOURCE, 'run_id': index, 'status': 'completed', 'conclusion': 'success', 'steps': [{'name': n, 'status': 'completed', 'conclusion': 'success'} for n in steps]})
                self.logs[job_id] = f'2026-10-10T12:00:00Z QUALIFIED_SOURCE_COMMIT={SOURCE}\n'
            if workflow == 'pages.yml':
                jobs.append({'id': index*100+1, 'name': 'Publish GitHub Pages', 'status': 'completed', 'conclusion': 'skipped', 'steps': []})
            self.responses[f'actions/runs/{index}/attempts/1/jobs?per_page=100&page=1'] = {'jobs': jobs}
    def api(self, endpoint):
        return self.responses[endpoint]
    def verify(self):
        return validate_qualification(self.config, self.api, lambda job: self.logs[job], publication=True)
    def test_complete_eight_workflow_success(self):
        self.assertEqual(len(WORKFLOWS), 8)
        self.assertEqual(self.verify(), SOURCE)
    def test_alpha_handoff_is_required_on_exact_final_source(self):
        self.assertEqual(WORKFLOWS['alpha-project-handoff.yml'], ['receiver-validation'])
        del self.config['requiredSourceRuns']['alpha-project-handoff.yml']
        with self.assertRaisesRegex(ValueError, 'All 8 qualification workflows'):
            self.verify()
    def test_alpha_handoff_wrong_head_or_failed_run_is_rejected(self):
        run_id = self.config['requiredSourceRuns']['alpha-project-handoff.yml']['id']
        run = self.responses[f'actions/runs/{run_id}']
        for key, value in [('head_sha', 'c' * 40), ('conclusion', 'failure'), ('conclusion', 'cancelled'), ('conclusion', 'skipped'), ('status', 'queued')]:
            with self.subTest(key=key, value=value):
                original = run[key]; run[key] = value
                with self.assertRaises(ValueError): self.verify()
                run[key] = original
    def test_alpha_handoff_source_marker_and_receiver_steps_are_required(self):
        run_id = self.config['requiredSourceRuns']['alpha-project-handoff.yml']['id']
        job = self.responses[f'actions/runs/{run_id}/attempts/1/jobs?per_page=100&page=1']['jobs'][0]
        for step in job['steps']:
            with self.subTest(step=step['name']):
                step['conclusion'] = 'skipped'
                with self.assertRaises(ValueError): self.verify()
                step['conclusion'] = 'success'
        for log in ['', f'QUALIFIED_SOURCE_COMMIT={"c" * 40}\n']:
            self.logs[job['id']] = log
            with self.assertRaises(ValueError): self.verify()
    def test_alpha_handoff_triggers_and_checkout_match_release_policy(self):
        workflow = (PUBLISHER.parents[2] / '.github/workflows/alpha-project-handoff.yml').read_text()
        self.assertIn('  pull_request:\n    branches: [main]\n', workflow)
        self.assertIn('  push:\n    branches: [main]\n', workflow)
        self.assertNotIn('paths:', workflow)
        self.assertNotIn('paths-ignore:', workflow)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha || github.sha }}', workflow)
        self.assertIn('test "$(git rev-parse HEAD)" = "$QUALIFICATION_SOURCE"', workflow)
        self.assertIn("printf 'QUALIFIED_SOURCE_COMMIT=%s\\n'", workflow)
        for name in ['Verify qualified source checkout', *REQUIRED_STEPS['alpha-project-handoff.yml']]:
            self.assertIn('- name: ' + name, workflow)
        self.assertIn('fetch-depth: 0', workflow)
        self.assertIn('scripts/successor/source-identity.test.mjs', workflow)
        pages = (PUBLISHER.parents[2] / '.github/workflows/pages.yml').read_text()
        self.assertIn('  pull_request:\n    branches: [main]\n', pages)
        self.assertIn('  push:\n    branches: [main]\n', pages)
        self.assertNotIn('paths:', pages)
        self.assertNotIn('paths-ignore:', pages)
    def test_missing_workflow(self):
        for workflow in WORKFLOWS:
            item=self.config['requiredSourceRuns'].pop(workflow)
            with self.assertRaises(ValueError): self.verify()
            self.config['requiredSourceRuns'][workflow]=item
    def test_wrong_release_identity(self):
        for key,value in [('repository','wrong/repo'),('tag','v1.13.0'),('status','prepared'),('sourceTree','c'*40),('checkoutCommit','c'*40)]:
            previous=self.config[key]; self.config[key]=value
            with self.assertRaises(ValueError): self.verify()
            self.config[key]=previous
    def test_wrong_stale_incomplete_failed_or_skipped_runs(self):
        for i in range(1,len(WORKFLOWS)+1):
            run=self.responses[f'actions/runs/{i}']
            for key,value in [('head_sha','c'*40),('event','workflow_dispatch'),('event','pull_request'),('head_branch','bootstrap/transport'),('path','.github/workflows/other.yml'),('workflow_id',999),('run_attempt',2),('status','in_progress'),('conclusion','failure'),('conclusion','cancelled'),('conclusion','skipped'),('repository',{'full_name':'wrong/repo'}),('head_repository',{'full_name':'wrong/repo'})]:
                previous=run[key];run[key]=value
                with self.subTest(run=i,key=key,value=value),self.assertRaises(ValueError):self.verify()
                run[key]=previous
    def test_workflow_id_path_binding(self):
        self.responses['actions/workflows/101']['path']='.github/workflows/other.yml'
        with self.assertRaises(ValueError):self.verify()
    def test_required_job_failures_and_duplicates(self):
        for i in range(1,len(WORKFLOWS)+1):
            endpoint=f'actions/runs/{i}/attempts/1/jobs?per_page=100&page=1';original=self.responses[endpoint]['jobs']
            for altered in [[],original+original,[dict(j,conclusion='skipped') for j in original],[dict(j,status='in_progress') for j in original],[dict(j,head_sha='c'*40) for j in original],[dict(j,name='renamed') for j in original]]:
                self.responses[endpoint]['jobs']=altered
                with self.assertRaises(ValueError):self.verify()
            self.responses[endpoint]['jobs']=original
    def test_each_required_step_must_execute(self):
        for i in range(1,len(WORKFLOWS)+1):
            for job in self.responses[f'actions/runs/{i}/attempts/1/jobs?per_page=100&page=1']['jobs']:
                for step in job['steps']:
                    step['conclusion']='skipped'
                    with self.assertRaises(ValueError):self.verify()
                    step['conclusion']='success'
    def test_checkout_log_evidence(self):
        original=self.logs[100]
        for text in ['',original+original,original.replace(SOURCE,'c'*40),f'echo QUALIFIED_SOURCE_COMMIT={SOURCE}\n']:
            self.logs[100]=text
            with self.assertRaises(ValueError):self.verify()
        self.logs[100]=original.replace('\n','\r\n');self.verify()
    def test_path_policy(self):
        for name in ['../secret','/secret','contracts/../secret','scripts\\secret','.env','hardhat/.env.mainnet','ui/node_modules/a','source.zip','scripts/key.pem','.v114-bootstrap.py','.github/workflows/v114-preparation-bootstrap.yml','unreviewed/file']:
            with self.subTest(name=name),self.assertRaises(ValueError):source_path(name,stat.S_IFREG|0o644)
        with self.assertRaises(ValueError):source_path('README.md',stat.S_IFLNK|0o777)
        source_path('.env.example',stat.S_IFREG|0o644)

    def test_site_sources_keep_archive_exclusions(self):
        for name in ['site/assets/app.mjs', 'site/assets/style.css', 'site/assets/mark.svg', 'site/content/en.json', 'site/content/fr.json', 'site/template.mjs']:
            source_path(name, stat.S_IFREG | 0o644)
        for name in ['site/.env', 'site/.env.production', 'site/key.pem', 'site/key.key', 'site/build/index.html', 'site/node_modules/a', 'site/../secret', 'site/.git/config']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                source_path(name, stat.S_IFREG | 0o644)
        with self.assertRaises(ValueError):
            source_path('site/assets/link', stat.S_IFLNK | 0o777)

class PublicationIntegrationTests(ReleaseGateTests):
    def setUp(self):
        super().setUp()
        directory=tempfile.TemporaryDirectory();self.addCleanup(directory.cleanup);self.root=Path(directory.name)
        self.script=self.root/'scripts/release/publish-release.py';self.script.parent.mkdir(parents=True);self.script.write_text(PUBLISHER.read_text())
        meta=self.root/'docs/releases'/TAG;meta.mkdir(parents=True);(meta/'RELEASE_NOTES.md').write_text('Reviewed release notes')
        self.out=self.root/'assets';self.out.mkdir()
        (self.out/f'AGIJobManager-{TAG}-COMPLETE.zip').write_bytes(b'mocked qualified package')
        (self.out/'agijobmanager-usdc.html').write_text('mocked console')
        (self.out/'RELEASE_MANIFEST.json').write_text(json.dumps({'sourceCommit':SOURCE,'sourceTree':TREE}))
        for name in BUILDER_ASSETS: (self.out/name).write_bytes(('mocked builder '+name).encode())
        self.config['artifactDigests']={p.name:sha(p.read_bytes()) for p in self.out.iterdir()}
        self.release={'id':999,'draft':True,'tag_name':TAG,'target_commitish':SOURCE,'name':TITLE,'body':'Reviewed release notes','assets':[],'prerelease':False,'html_url':'https://github.invalid/release','upload_url':f'https://uploads.github.com/repos/{REPOSITORY}/releases/999/assets{{?name,label}}'}
        self.config['candidateArtifact']={'id':77,'name':f'AGIJobManager-{TAG}-candidate-{SOURCE}','digest':'sha256:'+'e'*64,'size_in_bytes':123}
        self.responses['actions/artifacts/77']={**self.config['candidateArtifact'],'expired':False,'workflow_run':{'id':6,'head_sha':SOURCE}}
        self.original_assets={p.name:p.read_bytes() for p in self.out.iterdir()}
        self.mutations=[]
        self.env={'GITHUB_REPOSITORY':REPOSITORY,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':'refs/heads/main','RELEASE_PUBLISH_CONFIRMATION':'PUBLISH_'+TAG}
    def fake_run(self,command,**kwargs):
        if command[:2]==['python3','scripts/release/package-release.py']:
            target=Path(command[3]);target.mkdir()
            for name,data in self.original_assets.items():(target/name).write_bytes(data)
            (target/'SHA256SUMS.txt').write_text(''.join(f'{sha(data)}  {name}\n' for name,data in sorted(self.original_assets.items())))
            return subprocess.CompletedProcess(command,0)
        self.assertEqual(command[:2],['gh','api']);endpoint=command[2];method=command[command.index('--method')+1]
        if endpoint.startswith(f'repos/{REPOSITORY}/'):endpoint=endpoint[len(f'repos/{REPOSITORY}/'):]
        if method!='GET':self.mutations.append((method,endpoint))
        data=json.loads(kwargs['input']) if kwargs.get('input') else None
        if method=='GET':
            if endpoint in self.responses:value=self.responses[endpoint]
            elif endpoint.startswith('actions/jobs/'):return subprocess.CompletedProcess(command,0,stdout=self.logs[int(endpoint.split('/')[2])])
            elif endpoint.startswith('releases?'):value=[]
            elif endpoint=='git/ref/tags/'+TAG:raise subprocess.CalledProcessError(1,command,stderr='HTTP 404')
            elif endpoint=='releases/999':value=self.release
            elif endpoint.startswith('releases/999/assets?'):value=self.release['assets']
            else:raise AssertionError('Unexpected read: '+endpoint)
        elif endpoint=='git/tags':value={'sha':'d'*40}
        elif endpoint=='git/refs':
            self.responses['git/ref/tags/'+TAG]={'object':{'type':'commit','sha':SOURCE}};value={}
        elif endpoint=='releases':value=self.release
        elif endpoint.startswith('https://uploads.github.com/'):
            p=Path(command[command.index('--input')+1]);value={'name':p.name,'size':p.stat().st_size,'state':'uploaded','digest':'sha256:'+sha(p.read_bytes())};self.release['assets'].append(value)
        elif endpoint=='releases/999' and method=='PATCH':self.release.update(data);value=self.release
        else:raise AssertionError('Unexpected write: '+endpoint)
        return subprocess.CompletedProcess(command,0,stdout=json.dumps(value),stderr='')
    def local_read(self,command,**kwargs):
        if command==['git','rev-parse','HEAD']:return SOURCE+'\n'
        if command==['git','rev-parse','HEAD^{tree}']:return TREE+'\n'
        if command==['git','status','--porcelain','--untracked-files=no']:return b''
        raise AssertionError('Unexpected local command')
    def publish(self,publish=True):
        qualification=self.out/'QUALIFICATION.json';qualification.write_text(json.dumps(self.config))
        (self.out/'SHA256SUMS.txt').write_text(''.join(f'{sha(p.read_bytes())}  {p.name}\n' for p in sorted(self.out.iterdir()) if p.name!='SHA256SUMS.txt'))
        argv=[str(self.script),'--qualification',str(qualification),'--assets',str(self.out)]+(['--publish'] if publish else [])
        with patch.dict(os.environ,self.env,clear=True),patch.object(sys,'argv',argv),patch('subprocess.run',side_effect=self.fake_run),patch('subprocess.check_output',side_effect=self.local_read),contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(self.script),run_name='__main__')
    def test_successful_explicit_publication_path(self):
        self.publish();self.assertFalse(self.release['draft']);self.assertEqual(len(self.release['assets']),9)
        self.assertEqual(self.responses['git/ref/tags/'+TAG]['object']['sha'],SOURCE)
    def test_collect_candidate_then_publish_preserves_every_asset_digest(self):
        collector = self.script.with_name('collect-qualification.py')
        collector.write_text(PUBLISHER.with_name('collect-qualification.py').read_text())
        candidate_files = dict(self.original_assets)
        candidate_files['SHA256SUMS.txt'] = ''.join(
            f'{sha(data)}  {name}\n' for name, data in sorted(self.original_assets.items())).encode()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            for name, data in candidate_files.items():
                archive.writestr(name, data)
        artifact_bytes = buffer.getvalue()
        artifact = self.responses['actions/artifacts/77']
        artifact.update(digest='sha256:' + sha(artifact_bytes), size_in_bytes=len(artifact_bytes))
        self.responses['actions/runs/6/artifacts?per_page=100&page=1'] = {'artifacts': [artifact]}
        for index, workflow in enumerate(WORKFLOWS, 1):
            self.responses[f'actions/workflows/{workflow}'] = self.responses[f'actions/workflows/{index+100}']
            self.responses[f'actions/workflows/{index+100}/runs?head_sha={SOURCE}&event=push&per_page=100'] = {
                'workflow_runs': [self.responses[f'actions/runs/{index}']]}
        collected = self.root / 'collected'
        package_checks = []
        def collect_run(command, **kwargs):
            if command == ['gh', 'api', f'repos/{REPOSITORY}/actions/artifacts/77/zip']:
                kwargs['stdout'].write(artifact_bytes)
                return subprocess.CompletedProcess(command, 0)
            if command[:2] == ['python3', 'scripts/release/verify-package.py']:
                self.assertEqual(command[2], str(collected.resolve()))
                verify_assets(collected)
                package_checks.append(command[2])
                return subprocess.CompletedProcess(command, 0)
            return self.fake_run(command, **kwargs)
        argv = [str(collector), '--source', SOURCE, '--out', str(collected)]
        with patch.dict(os.environ, self.env, clear=True), patch.object(sys, 'argv', argv), \
                patch('subprocess.run', side_effect=collect_run), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(collector), run_name='__main__')
        self.assertEqual(package_checks, [str(collected.resolve())])
        self.assertEqual(self.mutations, [])
        self.config = json.loads((collected / 'QUALIFICATION.json').read_text())
        self.assertEqual(self.config['artifactDigests'], {
            name: sha(data) for name, data in self.original_assets.items()})
        self.assertEqual(set(verify_assets(collected, self.config)),
                         set(candidate_files) | {'QUALIFICATION.json'})
        self.out = collected
        self.publish()
        self.assertFalse(self.release['draft'])
        self.assertEqual({asset['name'] for asset in self.release['assets']},
                         set(candidate_files) | {'QUALIFICATION.json'})
    def test_dry_run_cannot_mutate(self):
        with self.assertRaises(SystemExit) as result:self.publish(False)
        self.assertEqual(result.exception.code,0);self.assertEqual(self.mutations,[])
    def test_authority_and_context_fail_before_mutation(self):
        for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_REF','refs/heads/branch'),('RELEASE_PUBLISH_CONFIRMATION','wrong')]:
            previous=self.env[key];self.env[key]=value
            with self.assertRaises(ValueError):self.publish()
            self.assertEqual(self.mutations,[]);self.env[key]=previous
        self.config['publicationAuthorized']=False
        with self.assertRaises(ValueError):self.publish()
        self.assertEqual(self.mutations,[])
    def test_advanced_main_blocks_publication(self):
        self.responses['git/ref/heads/main']['object']['sha']='c'*40
        with self.assertRaises(ValueError):self.publish()
        self.assertEqual(self.mutations,[])
    def test_missing_wrong_head_or_failed_alpha_handoff_blocks_before_mutation(self):
        original_config, original_responses = copy.deepcopy(self.config), copy.deepcopy(self.responses)
        for scenario in ['missing', 'wrong-head', 'failure']:
            with self.subTest(scenario=scenario):
                self.config, self.responses = copy.deepcopy(original_config), copy.deepcopy(original_responses)
                item = self.config['requiredSourceRuns']['alpha-project-handoff.yml']
                if scenario == 'missing':
                    del self.config['requiredSourceRuns']['alpha-project-handoff.yml']
                else:
                    run = self.responses[f'actions/runs/{item["id"]}']
                    run['head_sha' if scenario == 'wrong-head' else 'conclusion'] = 'c' * 40 if scenario == 'wrong-head' else 'failure'
                with self.assertRaises(ValueError): self.publish()
                self.assertEqual(self.mutations, [])
    def test_conflicting_tag_never_moves(self):
        self.responses['git/ref/tags/'+TAG]={'object':{'type':'commit','sha':'c'*40}}
        with self.assertRaises(AssertionError):self.publish()
        self.assertEqual(self.mutations,[])
    def test_self_consistent_substitute_package_is_rejected(self):
        (self.out/f'AGIJobManager-{TAG}-COMPLETE.zip').write_bytes(b'changed package')
        self.config['artifactDigests'][f'AGIJobManager-{TAG}-COMPLETE.zip']=sha(b'changed package')
        with self.assertRaises(ValueError):self.publish()
        self.assertEqual(self.mutations,[])
    def test_wrong_or_expired_candidate_artifact_is_rejected(self):
        self.responses['actions/artifacts/77']['expired']=True
        with self.assertRaises(ValueError):self.publish()
        self.assertEqual(self.mutations,[])
    def test_optimized_python_retains_conflicting_tag_guard(self):
        result=subprocess.run([sys.executable,'-O',str(Path(__file__).resolve()),'PublicationIntegrationTests.test_conflicting_tag_never_moves'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_tag_retarget_during_upload_is_rejected_before_publication(self):
        original=self.fake_run
        def changed(command,**kwargs):
            result=original(command,**kwargs)
            if len(command)>2 and command[2].startswith('https://uploads.github.com/'):
                self.responses['git/ref/tags/'+TAG]={'object':{'type':'commit','sha':'c'*40}}
            return result
        self.fake_run=changed
        with self.assertRaises(ValueError):self.publish()
        self.assertTrue(self.release['draft'])
        self.assertNotIn(('PATCH','releases/999'),self.mutations)
    def test_asset_substitution_is_rejected(self):
        (self.out/'agijobmanager-usdc.html').write_text('substituted')
        with self.assertRaises(ValueError):self.publish()
        self.assertEqual(self.mutations,[])

class ReleaseUploadTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='release-upload-test-')
        self.addCleanup(directory.cleanup)
        self.file = Path(directory.name) / 'qualified.zip'
        self.file.write_bytes(b'qualified archive bytes')
        self.digest = 'd' * 64
        self.asset = {'name': self.file.name, 'size': self.file.stat().st_size,
                      'state': 'uploaded', 'digest': 'sha256:' + self.digest}
        self.release = {'id': 123, 'tag_name': 'v1.14.0', 'target_commitish': SOURCE,
                        'draft': True, 'assets': [],
                        'upload_url': f'https://uploads.github.com/repos/{REPOSITORY}/releases/123/assets{{?name,label}}'}
        self.api = Mock(return_value=copy.deepcopy(self.release))
        self.list_assets = Mock(return_value=[])
        self.gh = Mock(return_value=json.dumps(self.asset))
        self.clock = Mock()
        namespace = {'repo': REPOSITORY, 'tag': 'v1.14.0', 'source': SOURCE,
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


class PackageVerificationTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        self.out = Path(directory.name)
        self.verifier = runpy.run_path(str(PUBLISHER.with_name('verify-package.py')))
        self.manifest = {'sourceCommit': SOURCE, 'sourceTree': TREE, 'files': {}}
        for name in {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html'} | BUILDER_ASSETS:
            (self.out / name).write_bytes(('fixture ' + name).encode())
        (self.out / 'RELEASE_MANIFEST.json').write_text(json.dumps(self.manifest))
        self.config = {'repository': REPOSITORY, 'tag': TAG, 'name': TITLE, 'status': 'qualified',
                       'sourceCommit': SOURCE, 'sourceTree': TREE, 'checkoutCommit': SOURCE,
                       'requiredSourceRuns': {name: {} for name in WORKFLOWS},
                       'artifactDigests': {p.name: sha(p.read_bytes()) for p in self.out.iterdir()}}
        self.checksums()

    def checksums(self):
        (self.out / 'SHA256SUMS.txt').write_text(''.join(
            f'{sha(p.read_bytes())}  {p.name}\n' for p in sorted(self.out.iterdir()) if p.name != 'SHA256SUMS.txt'))

    def published(self):
        (self.out / 'QUALIFICATION.json').write_text(json.dumps(self.config)); self.checksums()

    def test_candidate_and_published_inventory_require_their_exact_mode(self):
        verify = self.verifier['package_inventory']
        self.assertEqual(verify(self.out)[0], self.manifest)
        with self.assertRaises(ValueError): verify(self.out, published=True)
        self.published()
        with self.assertRaises(ValueError): verify(self.out)
        self.assertEqual(verify(self.out, published=True)[0], self.manifest)

    def test_published_identity_source_and_workflow_bindings(self):
        for key, value in [('tag', 'v0.0.0'), ('repository', 'other/repo'), ('status', 'prepared'),
                           ('sourceCommit', 'c' * 40), ('sourceTree', 'c' * 40), ('checkoutCommit', 'c' * 40),
                           ('requiredSourceRuns', {})]:
            original = self.config[key]; self.config[key] = value; self.published()
            with self.subTest(key=key), self.assertRaises(ValueError): self.verifier['package_inventory'](self.out, published=True)
            self.config[key] = original

    def test_historical_seven_workflow_inventory_cannot_qualify_current_assets(self):
        del self.config['requiredSourceRuns']['alpha-project-handoff.yml']
        self.published()
        with self.assertRaisesRegex(ValueError, 'all 8 workflows'):
            self.verifier['package_inventory'](self.out, published=True)

    def test_duplicate_manifest_context_field_is_rejected_before_extraction(self):
        manifest = json.dumps(self.manifest)
        manifest = '{"builderSource":null,"builderSource":{},' + manifest[1:]
        (self.out / 'RELEASE_MANIFEST.json').write_text(manifest); self.checksums()
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON field: builderSource'):
            self.verifier['package_inventory'](self.out)

    def test_recomputed_checksums_do_not_override_qualified_asset_bindings(self):
        self.published(); (self.out / 'My-SUCCESSOR-Omega-en.html').write_text('substituted'); self.checksums()
        with self.assertRaisesRegex(ValueError, 'Qualification asset binding'): self.verifier['package_inventory'](self.out, published=True)

    def test_qualification_symlink_is_rejected(self):
        target = self.out / 'outside.json'; target.write_text(json.dumps(self.config))
        (self.out / 'QUALIFICATION.json').symlink_to(target)
        with self.assertRaises(ValueError): self.verifier['package_inventory'](self.out, published=True)

    def test_zip_expansion_is_bounded_before_any_entry_is_read(self):
        manifest = {'files': {'source/README.md': {}, 'source/LICENSE': {}}}
        entries = []
        for name in [*manifest['files'], 'RELEASE_MANIFEST.json']:
            item = zipfile.ZipInfo(f'AGIJobManager-{TAG}/' + name)
            item.external_attr = (stat.S_IFREG | 0o644) << 16
            item.file_size = LIMIT // 2
            entries.append(item)
        archive = Mock(); archive.infolist.return_value = entries
        with self.assertRaisesRegex(ValueError, 'expanded size'): self.verifier['archive_inventory'](archive, manifest)
        archive.read.assert_not_called()

    def test_duplicate_or_unsafe_zip_entries_are_rejected_before_read(self):
        for name in ['source/../outside', 'source/hardhat/contracts/AGIJobManager.sol', 'README.md/', 'source/README.md']:
            item = zipfile.ZipInfo(f'AGIJobManager-{TAG}/' + name); item.external_attr = (stat.S_IFREG | 0o644) << 16
            embedded = zipfile.ZipInfo(f'AGIJobManager-{TAG}/RELEASE_MANIFEST.json'); embedded.external_attr = item.external_attr
            archive = Mock(); archive.infolist.return_value = [item, embedded] + ([item] if name.endswith('README.md') else [])
            with self.subTest(name=name), self.assertRaises(ValueError): self.verifier['archive_inventory'](archive, {'files': {name: {}}})
            archive.read.assert_not_called()



class BuilderOutputInventoryTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for name in BUILDER_ASSETS | BUILDER_ARCHIVE_ONLY_ASSETS:
            (self.root / name).write_text('generated fixture ' + name)

    def test_context_is_required_in_archive_without_expanding_standalone_assets(self):
        self.assertEqual(len(BUILDER_ASSETS), 4)
        self.assertEqual(BUILDER_ARCHIVE_ONLY_ASSETS, {'MANAGER_CONTEXT.json'})
        require_builder_outputs(self.root)

    def test_missing_context_is_rejected(self):
        (self.root / 'MANAGER_CONTEXT.json').unlink()
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            require_builder_outputs(self.root)

    def test_unreviewed_extra_output_is_rejected(self):
        (self.root / 'UNREVIEWED.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            require_builder_outputs(self.root)

    def test_context_directory_or_symlink_is_rejected(self):
        context = self.root / 'MANAGER_CONTEXT.json'; context.unlink(); context.mkdir()
        with self.assertRaisesRegex(ValueError, 'regular files'):
            require_builder_outputs(self.root)
        context.rmdir(); context.symlink_to(self.root / 'SOURCE_MANIFEST.json')
        with self.assertRaisesRegex(ValueError, 'regular files'):
            require_builder_outputs(self.root)

    def test_rebuild_rejects_wrong_or_missing_archived_context(self):
        with tempfile.TemporaryDirectory() as temp:
            extracted = Path(temp)
            for item in self.root.iterdir():
                (extracted / item.name).write_bytes(item.read_bytes())
            verify_builder_rebuild(self.root, self.root, extracted)
            context = extracted / 'MANAGER_CONTEXT.json'
            context.write_text('substituted source context')
            with self.assertRaisesRegex(ValueError, 'archive rebuild differs: MANAGER_CONTEXT.json'):
                verify_builder_rebuild(self.root, self.root, extracted)
            context.unlink()
            with self.assertRaisesRegex(ValueError, 'Missing regular Builder archive output: MANAGER_CONTEXT.json'):
                verify_builder_rebuild(self.root, self.root, extracted)


class BuilderSourceContextTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / 'config').mkdir(); (self.root / 'scripts').mkdir()
        (self.root / 'LICENSE').write_text('MIT\n')
        (self.root / 'scripts/engine.mjs').write_text('export const fixed = true;\n')
        (self.root / 'package.json').write_text(json.dumps({'version': TAG[1:]}))
        self.files = [{'path': name, 'sha256': sha((self.root / name).read_bytes())} for name in ['LICENSE', 'scripts/engine.mjs']]
        self.engine = sha(json.dumps(self.files, sort_keys=True, separators=(',', ':')).encode())
        self.selector = {'schema': 'agijobmanager/successor-builder-source/v1', 'repository': REPOSITORY, 'commit': 'c' * 40, 'tree': 'd' * 40, 'version': TAG[1:], 'engineSha256': self.engine}
        self.write_selector()
        self.context = {'schema': 'agijobmanager/successor-editable-source/v2', 'commit': 'c' * 40, 'tree': 'd' * 40, 'version': TAG[1:], 'packageSha256': sha((self.root / 'package.json').read_bytes()), 'sourceManifest': {'repository': REPOSITORY, 'commit': 'c' * 40, 'engineSha256': self.engine, 'files': self.files, 'license': 'MIT'}}

    def write_selector(self):
        (self.root / 'config/successor-builder-source.json').write_text(json.dumps(self.selector))

    def test_selected_context_remains_distinct_from_wrapper_source(self):
        encoded = builder_archive_context(self.root, self.context)
        self.assertEqual(json.loads(encoded), self.context)
        self.assertNotEqual(self.context['commit'], SOURCE)
        self.assertNotEqual(self.context['tree'], TREE)

    def test_missing_legacy_malformed_or_unexpected_context_is_rejected(self):
        for value in [None, {}, {'commit': SOURCE, 'version': TAG[1:]}, [], {**self.context, 'unexpected': True}]:
            with self.subTest(value=value), self.assertRaises(ValueError): builder_archive_context(self.root, value)
        for key, value in [('schema', 'legacy'), ('commit', 'not-a-sha'), ('tree', 'not-a-tree')]:
            altered = {**self.context, key: value}
            with self.subTest(key=key), self.assertRaises(ValueError): builder_archive_context(self.root, altered)

    def test_relabelled_context_cannot_substitute_wrapper_or_another_selected_source(self):
        for key, value in [('commit', SOURCE), ('tree', TREE), ('version', '0.0.0')]:
            altered = copy.deepcopy(self.context); altered[key] = value
            if key == 'commit': altered['sourceManifest']['commit'] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'selected-source binding'): builder_archive_context(self.root, altered)

    def test_selected_package_bytes_and_version_are_bound(self):
        for value in ['wrong checksum', '0' * 64]:
            altered = {**self.context, 'packageSha256': value}
            with self.assertRaisesRegex(ValueError, 'selected package'): builder_archive_context(self.root, altered)
        (self.root / 'package.json').write_text(json.dumps({'version': '0.0.0'}))
        with self.assertRaisesRegex(ValueError, 'selected package'): builder_archive_context(self.root, self.context)

    def test_missing_substituted_or_symlinked_selected_source_is_rejected(self):
        target = self.root / 'scripts/engine.mjs'; original = target.read_bytes()
        target.write_text('substitution')
        with self.assertRaisesRegex(ValueError, 'source bytes differ'): builder_archive_context(self.root, self.context)
        target.unlink()
        with self.assertRaisesRegex(ValueError, 'regular file'): builder_archive_context(self.root, self.context)
        target.symlink_to(self.root / 'LICENSE')
        with self.assertRaisesRegex(ValueError, 'regular file'): builder_archive_context(self.root, self.context)

    def test_selector_is_required_exact_regular_and_unambiguous(self):
        selector = self.root / 'config/successor-builder-source.json'
        selector.write_text(selector.read_text().replace('"schema":', '"commit":"forged","schema":', 1))
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON'): builder_archive_context(self.root, self.context)
        selector.unlink()
        with self.assertRaisesRegex(ValueError, 'regular file'): builder_archive_context(self.root, self.context)
        self.selector['extra'] = True; self.write_selector()
        with self.assertRaisesRegex(ValueError, 'selector fields'): builder_archive_context(self.root, self.context)

    def test_manifest_fields_identity_and_order_are_bound(self):
        for change in [lambda m: m.update(extra=True), lambda m: m.update(repository='wrong/repo'), lambda m: m.update(commit=SOURCE), lambda m: m.update(license='unknown'), lambda m: m['files'].reverse(), lambda m: m['files'].pop(), lambda m: m['files'].append(m['files'][0])]:
            altered = copy.deepcopy(self.context); change(altered['sourceManifest'])
            with self.assertRaises(ValueError): builder_archive_context(self.root, altered)

    def test_existing_strict_reader_checks_complete_ordered_closure(self):
        resolver = PUBLISHER.parents[2] / 'scripts/successor/source-identity.mjs'
        program = "import { resolveBuilderSource } from " + json.dumps(resolver.as_uri()) + "; resolveBuilderSource(process.argv[1], ['LICENSE', 'scripts/engine.mjs']);"
        (self.root / 'SOURCE.json').write_bytes(builder_archive_context(self.root, self.context))
        subprocess.run(['node', '--input-type=module', '-e', program, str(self.root)], check=True, capture_output=True)
        for files in [list(reversed(self.files)), self.files[:1], self.files + [{'path': 'scripts/extra.mjs', 'sha256': sha(b'extra')}]]:
            altered = copy.deepcopy(self.context); altered['sourceManifest']['files'] = files
            digest = sha(json.dumps(files, sort_keys=True, separators=(',', ':')).encode())
            altered['sourceManifest']['engineSha256'] = digest
            self.selector['engineSha256'] = digest; self.write_selector()
            (self.root / 'scripts/extra.mjs').write_bytes(b'extra')
            # Even an internally consistent supplied inventory cannot change the reader's closure.
            (self.root / 'SOURCE.json').write_bytes(builder_archive_context(self.root, altered))
            result = subprocess.run(['node', '--input-type=module', '-e', program, str(self.root)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'SOURCE_ARCHIVE_CHANGED', result.stderr)

    def test_assembly_requires_normal_git_pin_and_actual_wrapper_checkout(self):
        response = {'checkoutCommit': SOURCE, 'context': self.context}
        with patch('release_common.subprocess.check_output', return_value=json.dumps(response).encode()) as command:
            self.assertEqual(verified_builder_context(self.root, self.root, SOURCE), self.context)
            args = command.call_args.args[0]
            self.assertIn("identity.verification.mode !== 'git-object-pin'", args[3])
            self.assertIn('resolveBuilderSource(repository, SOURCE_FILES)', args[3])
            self.assertNotIn('bootstrap:', args[3])
        response['checkoutCommit'] = 'e' * 40
        with patch('release_common.subprocess.check_output', return_value=json.dumps(response).encode()), self.assertRaisesRegex(ValueError, 'qualification checkout'):
            verified_builder_context(self.root, self.root, SOURCE)

    def test_source_and_manager_context_outputs_cannot_relabel_the_selected_source(self):
        for name in ['SOURCE_MANIFEST.json', 'MANAGER_CONTEXT.json']:
            value = self.context['sourceManifest'] if name == 'SOURCE_MANIFEST.json' else {'sourceManifest': self.context['sourceManifest'], 'managerSource': {}}
            (self.root / name).write_text(json.dumps(value))
        verify_builder_context_outputs(self.context, self.root)
        for name in ['SOURCE_MANIFEST.json', 'MANAGER_CONTEXT.json']:
            target = self.root / name; original = target.read_bytes()
            target.write_bytes(original.replace(('c' * 40).encode(), SOURCE.encode()))
            with self.assertRaisesRegex(ValueError, 'retained source manifest differs'): verify_builder_context_outputs(self.context, self.root)
            target.write_bytes(original); target.unlink()
            with self.assertRaisesRegex(ValueError, 'Missing regular'): verify_builder_context_outputs(self.context, self.root)
            target.write_bytes(original)

    def test_wrapper_git_reads_disable_replacement_and_inherited_redirection(self):
        packager = runpy.run_path(str(PUBLISHER.with_name('package-release.py')), run_name='package_test')
        with patch.dict(os.environ, {'GIT_DIR': '/untrusted', 'GIT_WORK_TREE': '/wrong', 'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'core.worktree', 'GIT_CONFIG_VALUE_0': '/wrong'}), patch('subprocess.check_output', return_value=b'qualified') as command:
            self.assertEqual(packager['git']('rev-parse', 'HEAD'), b'qualified')
            args, kwargs = command.call_args
            self.assertIn('--no-replace-objects', args[0])
            self.assertEqual(kwargs['env']['GIT_NO_REPLACE_OBJECTS'], '1')
            for name in ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']:
                self.assertNotIn(name, kwargs['env'])


class PackagedGuideTests(unittest.TestCase):
    source = f'docs/releases/{TAG}/START_HERE.md'
    sibling = f'docs/releases/{TAG}/VALIDATION.md'

    def render(self, text, available=None):
        available = available or {'source/docs/DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md', 'source/hardhat/README.md', 'source/' + self.sibling}
        return packaged_guide(text.encode(), self.source, available, {self.source: 'START_HERE.md', self.sibling: 'VALIDATION.md'}).decode()

    def test_parent_links_resolve_within_archive(self):
        self.assertEqual(self.render('[router](../../DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md) [setup](../../../hardhat/README.md)'), '[router](source/docs/DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md) [setup](source/hardhat/README.md)')

    def test_sibling_guides_remain_at_archive_root(self):
        self.assertEqual(self.render('[validation](VALIDATION.md)'), '[validation](VALIDATION.md)')

    def test_external_links_and_local_fragments_are_unchanged(self):
        text = '[web](https://example.com/a) [email](mailto:help@example.com) [anchor](#steps)'
        self.assertEqual(self.render(text), text)

    def test_queries_and_fragments_are_preserved(self):
        self.assertEqual(self.render('[guide](../../../hardhat/README.md?plain=1#setup)'), '[guide](source/hardhat/README.md?plain=1#setup)')

    def test_missing_or_escaping_targets_fail_closed(self):
        for href in ['../../MISSING.md', '../../../../outside.md', '/absolute.md']:
            with self.subTest(href=href), self.assertRaises(ValueError):
                self.render('[bad](' + href + ')')

    def test_current_release_root_guide_links_resolve(self):
        root = Path(__file__).resolve().parents[2]
        guides = {f'docs/releases/{TAG}/{name}': name for name in ['START_HERE.md', 'RELEASE_NOTES.md', 'RECOVERY_GUIDE.md', 'VALIDATION.md']}
        available = {'source/' + str(p.relative_to(root)) for p in (root / 'docs').rglob('*') if p.is_file()}
        available.add('source/hardhat/README.md')
        for source_name in guides:
            original = (root / source_name).read_bytes()
            rendered = packaged_guide(original, source_name, available, guides)
            self.assertNotIn(b'](../', rendered)
            self.assertEqual((root / source_name).read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
