"""Adversarial release wrapper tests. Fixtures do not qualify a release."""
import copy
import hashlib
import json
import pathlib
import runpy
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from release_common import sha, REPOSITORY, TITLE
ROOT = pathlib.Path(__file__).resolve().parents[2]
P = runpy.run_path(str(ROOT / 'scripts/release/release-profile.py'))
C = runpy.run_path(str(ROOT / 'scripts/release/candidate-profile.py'))
D = runpy.run_path(str(ROOT / 'scripts/release/package-policy.py'))

class ReleaseProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='release-profile-tests-')
        cls.root = pathlib.Path(cls.tmp.name) / 'source'
        cls.root.mkdir()
        cls.options = dict(profile=P['PROFILE'], manifest=P['MANIFEST'], manifest_sha256=sha((ROOT / P['MANIFEST']).read_bytes()), verifier_sha256=sha((ROOT / P['VERIFIER']).read_bytes()))
        cls.selection = P['select'](**cls.options)
        cls.inventory, _ = P['inventory'](ROOT, cls.selection)
        for name, item in cls.inventory.items():
            mode, data = P['read'](ROOT, name)
            target = cls.root / name; target.parent.mkdir(parents=True, exist_ok=True)
            if mode == '120000': target.symlink_to('../contracts')
            else:
                target.write_bytes(data); target.chmod(0o755 if mode == '100755' else 0o644)
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def verify(self, selection=None): return P['validate_source'](self.root, selection or self.selection)
    def mutate(self, name, value, check):
        target=self.root/name; old=target.read_bytes()
        try: target.write_bytes(value); check()
        finally: target.write_bytes(old)
    def rejects(self, selection=None):
        with self.assertRaises((ValueError, FileNotFoundError)): self.verify(selection)
    def repin_delta(self, change):
        m=json.loads((self.root/P['MANIFEST']).read_bytes());change(m)
        data=(json.dumps(m,indent=2)+'\n').encode();s={**self.selection,'manifestSha256':sha(data)}
        self.mutate(P['MANIFEST'],data,lambda:self.rejects(s))
    def test_exact_static_closure_has_no_release_approval(self):
        with patch('subprocess.check_output',side_effect=AssertionError('Offline verification must not execute Git')):
            result=self.verify()
        self.assertEqual(result['qualification'],'PENDING_FINAL_SOURCE_MAIN_PUSH')
        self.assertNotIn('releaseQualified',result)
    def test_every_external_pin_is_required(self):
        for key in ('manifest','manifest_sha256','verifier_sha256'):
            args=dict(self.options);args.pop(key)
            with self.subTest(key=key),self.assertRaises(ValueError):P['select'](**args)
    def test_wrong_external_pins_fail(self):
        for key in ('manifestSha256','verifierSha256'):
            self.rejects({**self.selection,key:'0'*64})
    def test_candidate_profile_remains_nonpublishing(self):
        options={'profile':C['PROFILE'],'manifest':C['MANIFEST'],'manifest_sha256':'a'*64,'verifier_sha256':'b'*64,'schema_sha256':'c'*64,'published':True}
        with self.assertRaises(ValueError):C['select'](**options)
        with self.assertRaises(ValueError):D['select'](**options)
        self.assertEqual(C['metadata']({})['releaseQualified'],False)
    def test_unknown_and_legacy_profiles_cannot_accept_release_pins(self):
        for profile in ('unreviewed',C['LEGACY']):
            with self.subTest(profile=profile),self.assertRaises(ValueError):D['select'](**{**self.options,'profile':profile})
    def test_changed_contract_compiler_and_history_are_rejected(self):
        for name in ('contracts/AGIJobManager.sol','hardhat/compiler-optimizer.cjs','scripts/release/candidate-profile.py','scripts/release/check-v114-boundaries.py','docs/releases/v1.18.0/RELEASE_NOTES.md'):
            with self.subTest(name=name):self.mutate(name,(self.root/name).read_bytes()+b'\n',self.rejects)
    def test_repinning_runtime_delta_is_rejected(self):
        name='contracts/AGIJobManager.sol';old=self.inventory[name]
        self.repin_delta(lambda m:m['changes'].update({name:{'before':old,'after':{'mode':'100644','sha256':'0'*64},'reason':'unreviewed runtime'}}))
    def test_repinning_dependency_change_is_rejected(self):
        name='package.json';data=json.loads((self.root/name).read_bytes());data['dependencies']['@openzeppelin/contracts']='4.9.5';raw=(json.dumps(data,indent=2)+'\n').encode()
        self.mutate(name,raw,lambda:self.repin_delta(lambda m:m['changes'][name].update(after={'mode':'100644','sha256':sha(raw)})))
    def test_repinning_ui_runtime_change_is_rejected(self):
        for name in ('ui/agijobmanager-usdc.html', 'agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html', 'ui/src/generated/deployments.ts'):
            raw=(self.root/name).read_bytes()+b'\n// unexpected executable change\n'
            with self.subTest(name=name):
                self.mutate(name,raw,lambda:self.repin_delta(lambda m:m['changes'][name].update(after={'mode':'100644','sha256':sha(raw)})))
    def test_comparison_inputs_preserve_all_historical_observations(self):
        before=json.loads((ROOT/'docs/qualification/mainnet-cutover-integrated-20261017.json').read_bytes())
        after=json.loads((ROOT/'docs/qualification/mainnet-cutover-v1.19.1-expected.json').read_bytes())
        b=before.pop('sourceSha256');a=after.pop('sourceSha256')
        self.assertEqual(before,after)
        self.assertEqual({n for n in a if a[n]!=b[n]}, {'package.json','package-lock.json','hardhat/package.json','hardhat/package-lock.json'})
        before=json.loads((ROOT/'scripts/security/slither-reviewed-findings-c174-integrated-yul.json').read_bytes())
        after=json.loads((ROOT/'scripts/security/slither-reviewed-findings-v1.19.1.json').read_bytes())
        b=before.pop('source_sha256');a=after.pop('source_sha256')
        before.pop('scope');after.pop('scope')
        self.assertEqual(before,after)
        self.assertEqual({n for n in a if a[n]!=b[n]}, {'package-lock.json','hardhat/package-lock.json'})
    def test_false_predecessor_and_qualification_are_rejected(self):
        self.repin_delta(lambda m:m.update(baseCommit='0'*40))
        self.repin_delta(lambda m:m.update(qualification='qualified'))
        self.repin_delta(lambda m:m['changes']['package.json'].update(before=None))
    def test_missing_extra_and_mode_changes_are_rejected(self):
        p=self.root/'README.md';old=p.read_bytes();p.unlink()
        try:self.rejects()
        finally:p.write_bytes(old)
        p=self.root/'unreviewed.txt';p.write_text('extra')
        try:self.rejects()
        finally:p.unlink()
        p=self.root/'package.json';p.chmod(0o755)
        try:self.rejects()
        finally:p.chmod(0o644)
    def test_manifest_never_accepts_embedded_approval_or_candidate_flags(self):
        m={k:None for k in ('schemaVersion','repository','tag','name','sourceCommit','sourceTree','builderSource','stage','qualification','archiveLimitBytes','toolchain','exclusions','files')}
        m.update(P['metadata'](self.selection),tag='v1.19.1',stage='source-package',schemaVersion=2,repository=REPOSITORY,name=TITLE,sourceCommit='a'*40,sourceTree='b'*40)
        P['validate_metadata'](m,self.selection)
        for k,v in [('schemaVersion', None), ('repository', 'wrong/repo'), ('name', None), ('sourceCommit', 'not-a-sha')]:
            with self.subTest(k=k),self.assertRaises(ValueError):P['validate_metadata']({**m,k:v},self.selection)
        for k,v in [('publicationAuthorized',True),('releaseQualified',True),('candidateProfile',C['PROFILE']),('sourcePackageOnly',False)]:
            with self.subTest(k=k),self.assertRaises(ValueError):P['validate_metadata']({**m,k:v},self.selection)
    def test_latest_deployment_record_retains_evidence_boundaries(self):
        record=json.loads((ROOT/'config/mainnet/manager-8815-2026-10-17.json').read_bytes())
        self.assertTrue(record['notLiveState']);self.assertTrue(record['notDefaultConfiguration'])
        self.assertFalse(record['provenance']['independentlyReobservedForThisRecord'])
        self.assertEqual(record['source']['commit'],P['BASE']);self.assertEqual(record['source']['tree'],P['TREE'])
        self.assertEqual(record['source']['planSha256'],'2c63e5b3969a7081b8d65a08eb42d12207df5df204752c3a62b2dfab57a0abf8')
        contracts=record['contracts'];self.assertEqual(len(contracts),9)
        self.assertEqual({c['index'] for c in contracts},set(range(9)))
        self.assertEqual(len({c['address'] for c in contracts}),9)
        self.assertEqual(len({c['deploymentTransactionHash'] for c in contracts}),9)
        self.assertTrue(all(c['reportedFinalized'] for c in contracts))
        exact=[c for c in contracts if c['explorerMatchStatus']=='EXACT_MATCH']
        similar=[c for c in contracts if c['explorerMatchStatus']=='SIMILAR_MATCH_SKIPPED']
        self.assertEqual(len(exact),6);self.assertEqual({c['name'] for c in similar},{'BondMath','ReputationMath','ENSOwnership'})
        self.assertTrue(all(not c['verificationSubmissionAttempted'] and not c['explorerAcceptedSubmission'] and c['publishedBundleComparison']=='NOT_EVALUATED_FOR_SKIPPED_SIMILAR_MATCH' for c in similar))
        self.assertEqual(contracts[8]['address'],record['manager'])
        state=record['reportedAuthoritySnapshot']
        self.assertEqual(state['blockNumber'],26214525)
        self.assertEqual(state['blockHash'],'0xcf2dd7ad97c9499d813206a1c87bc492ae78b3ac0eb6ad4ce30bd3b5bb87cde1')
        self.assertTrue(state['intakePaused']);self.assertFalse(state['identityLocked'])
        self.assertEqual(state['exactNftCount'],0);self.assertFalse(state['agentNftRequired']);self.assertNotIn('nftUriMode',state)
        self.assertTrue(state['moderator']['enabled']);self.assertEqual(state['moderator']['grantStatus'],'FINALIZED_SUCCESS')
        self.assertFalse(any(record['boundaries'].values()))
        defaults=json.loads((ROOT/'config/usdc-deployment.json').read_bytes())
        self.assertEqual(defaults['managerAddress'],'');self.assertEqual(defaults['finalOwner'],'')
    def test_workflow_keeps_all_final_source_gates_and_dependency_check(self):
        w=(ROOT/'.github/workflows/current-state-release.yml').read_text()
        self.assertIn('release-profile.py --dependency-root "$(realpath node_modules)"',w)
        self.assertIn('run-inherited-source-tests.py --dependency-root',w)
        self.assertIn('test-release-profile.py',w)
        pub=(ROOT/'.github/workflows/publish-v114.yml').read_text()
        self.assertIn('PUBLISH_v1.19.1',pub)
        self.assertEqual(pub.count('--profile manager-explicit-governor-release-v1'),3)
        from release_common import WORKFLOWS
        self.assertEqual(len(WORKFLOWS),8)
    def test_checkout_binds_raw_git_bytes_and_rejects_hidden_index_flags(self):
        target=pathlib.Path(self.tmp.name)/'checkout'
        subprocess.run(['git','clone','--quiet','--shared',str(ROOT),str(target)],check=True)
        try:
            source=P['git'](target,'rev-parse','HEAD').decode().strip();tree=P['git'](target,'rev-parse','HEAD^{tree}').decode().strip()
            P['checkout'](target,self.selection,None,None,source,tree)
            P['git'](target,'update-index','--assume-unchanged','README.md')
            with self.assertRaisesRegex(ValueError,'Hidden release index'):P['checkout'](target,self.selection,None,None,source,tree)
            P['git'](target,'update-index','--no-assume-unchanged','README.md')
            with self.assertRaises(ValueError):P['checkout'](target,self.selection,None,None,'0'*40,tree)
        finally:shutil.rmtree(target)

    def test_preservation_runner_rejects_current_mutations_with_clean_historical_fixture(self):
        runner=runpy.run_path(str(ROOT/'scripts/release/run-release-preservation.py'))
        target=pathlib.Path(self.tmp.name)/'preservation-checkout'
        subprocess.run(['git','clone','--quiet','--shared',str(ROOT),str(target)],check=True)
        try:
            runner['validate_current'](target,P)
            runner['validate_fixture_tree'](P['git'](target,'rev-parse',P['BASE']+'^{tree}').decode().strip(),P)
            for name in ('ui/agijobmanager-usdc.html','package-lock.json','scripts/successor/preservation.test.mjs'):
                path=target/name;old=path.read_bytes()
                try:
                    path.write_bytes(old+b'\nmalicious mutation\n')
                    with self.subTest(name=name),self.assertRaises(ValueError):runner['validate_current'](target,P)
                finally:path.write_bytes(old)
            with self.assertRaisesRegex(ValueError,'fixture tree identity'):runner['validate_fixture_tree']('0'*40,P)
            with patch.dict(runner['main'].__globals__, ROOT=pathlib.Path(self.tmp.name)/'missing-release'):
                with self.assertRaisesRegex(ValueError,'manifest is required'):runner['main']()
        finally:shutil.rmtree(target)
    def test_preservation_runner_rejects_missing_corrupt_or_misbound_current_pages(self):
        runner=runpy.run_path(str(ROOT/'scripts/release/run-release-preservation.py'))
        pages=pathlib.Path(self.tmp.name)/'pages-test'
        pages.mkdir()
        baseline=json.loads((ROOT/'docs/successor/PRESERVATION_BASELINE.json').read_bytes())
        routes=set(baseline['routes']+['successor/index.html','fr/successor/index.html']) - {'build-info.json'}
        files={}
        for name in routes:
            path=pages/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'fixture')
            files[name]={'bytes':7,'sha256':sha(b'fixture')}
        (pages/'.nojekyll').write_bytes(b'')
        info={'sourceCommit':'a'*40,'sourceVersion':'1.19.1','files':files,'buildOnlyFiles':{'.nojekyll':{'bytes':0,'sha256':sha(b'')}}}
        (pages/'build-info.json').write_text(json.dumps(info))
        try:
            runner['validate_pages'](ROOT,pages,'a'*40)
            with self.assertRaisesRegex(ValueError,'source identity'):runner['validate_pages'](ROOT,pages,'b'*40)
            path=pages/next(iter(routes));path.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'asset differs'):runner['validate_pages'](ROOT,pages,'a'*40)
            path.unlink()
            with self.assertRaisesRegex(ValueError,'inventory differs'):runner['validate_pages'](ROOT,pages,'a'*40)
            with self.assertRaisesRegex(ValueError,'missing or indirect'):runner['validate_pages'](ROOT,pages/'missing','a'*40)
        finally:shutil.rmtree(pages)

if __name__=='__main__':unittest.main(verbosity=2)
