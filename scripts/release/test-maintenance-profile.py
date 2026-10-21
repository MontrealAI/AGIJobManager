"""Adversarial finite maintenance source scope; fixtures do not qualify a release."""
import copy
import json
import os
import pathlib
import runpy
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from release_common import sha
ROOT=pathlib.Path(__file__).resolve().parents[2]
P=runpy.run_path(str(ROOT/'scripts/release/maintenance-profile.py'))
class MaintenanceProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='manager-maintenance-policy-');cls.root=pathlib.Path(cls.temp.name)
        cls.options=dict(manifest=P['MANIFEST'],manifest_sha256=sha((ROOT/P['MANIFEST']).read_bytes()),verifier_sha256=sha((ROOT/P['VERIFIER']).read_bytes()))
        cls.selection=P['select'](**cls.options);cls.expected,cls.old=P['inventory'](ROOT,cls.selection)
        for name,item in cls.expected.items():
            mode,raw=P['read'](ROOT,name);target=cls.root/name;target.parent.mkdir(parents=True,exist_ok=True)
            if mode=='120000':target.symlink_to('../contracts')
            else:target.write_bytes(raw);target.chmod(0o755 if mode=='100755' else 0o644)
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def verify(self,selection=None):return P['validate_source'](self.root,selection or self.selection)
    def rejects(self,selection=None):
        with self.assertRaises((ValueError,FileNotFoundError)):self.verify(selection)
    def mutate(self,name,raw,check):
        path=self.root/name;old=path.read_bytes()
        try:path.write_bytes(raw);check()
        finally:path.write_bytes(old)
    def repin(self,name,raw):
        manifest=json.loads((self.root/P['MANIFEST']).read_bytes());before=manifest['changes'].get(name,{}).get('before',self.old['entries'].get(name))
        manifest['changes'][name]={'before':before,'after':{'mode':'100644','sha256':sha(raw)},'reason':'Adversarial supplied repin'}
        raw_manifest=(json.dumps(manifest,indent=2)+'\n').encode()
        self.mutate(P['MANIFEST'],raw_manifest,lambda:self.rejects({**self.selection,'manifestSha256':sha(raw_manifest)}))
    def test_exact_complete_offline_closure_is_pending_only(self):
        with patch('subprocess.check_output',side_effect=AssertionError('Offline source validation must not invoke Git')):result=self.verify()
        self.assertEqual(result['qualification'],'PENDING_EXACT_FINAL_SOURCE_HOSTED_EXECUTION')
        for key in ['releaseQualified','publicationApproved','executed']:self.assertIs(result[key],False)
    def test_external_pins_profile_version_and_modes_are_mandatory(self):
        for key in self.options:
            options=dict(self.options);options.pop(key)
            with self.subTest(key=key),self.assertRaises(ValueError):P['select'](**options)
        for key in ['manifestSha256','verifierSha256']:self.rejects({**self.selection,key:'0'*64})
        for changes in [{'schema_sha256':'0'*64},{'manifest':'other.json'},{'profile':'unknown'},{'published':'true'}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):P['select'](**{**self.options,**changes})
    def test_every_immutable_previous_policy_contract_compiler_and_receipt_repin_rejects(self):
        names=['contracts/AGIJobManager.sol','hardhat/compiler-optimizer.cjs','scripts/release/release_common.py','scripts/release/transformational-profile.py','config/manager-transformational-v1.json','scripts/release/test-transformational-profile.py','scripts/release/correction-profile.py','config/manager-boundary-corrections-v1.json','scripts/release/check-v114-boundaries.py','config/v114-dependency-repairs.json','docs/releases/v1.19.5/VALIDATION.md','config/mainnet/manager-8815-2026-10-17.json','config/transformational-alpha-source.json']
        for name in names:
            raw=(self.root/name).read_bytes()+b'\n'
            with self.subTest(name=name):self.mutate(name,raw,lambda:self.repin(name,raw))
    def test_even_allowed_executable_selector_workflow_and_new_qualification_repins_reject(self):
        names=list(P['PROJECTIONS'])+['scripts/release/maintenance-qualification.py','scripts/release/pages-publication-maintenance.py','scripts/release/run-maintenance-inherited-tests.py']
        for name in names:
            raw=(self.root/name).read_bytes()+b'\n# broadened scope\n'
            with self.subTest(name=name):self.mutate(name,raw,lambda:self.repin(name,raw))
    def test_other_dependency_pin_integrity_engine_command_and_record_changes_reject(self):
        cases=[('package.json',lambda v:v['devDependencies'].__setitem__('solc','0.8.38')),('hardhat/package-lock.json',lambda v:v['packages']['node_modules/ethers'].__setitem__('version','6.17.1')),('ui/package.json',lambda v:v['dependencies'].__setitem__('next','15.5.28')),('ui/package.json',lambda v:v['scripts'].__setitem__('test','true')),('package-lock.json',lambda v:v['packages']['node_modules/follow-redirects'].__setitem__('integrity','sha512-forged')),('ui/package-lock.json',lambda v:v['packages']['node_modules/hono'].__setitem__('version','4.13.13')),('ui/package.json',lambda v:v['devDependencies'].__setitem__('vitest','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['']['devDependencies'].__setitem__('vitest','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/@vitest/mocker'].__setitem__('version','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/vitest']['dependencies'].__setitem__('@vitest/mocker','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/chai'].__setitem__('version','6.3.0')),('ui/package-lock.json',lambda v:v['packages']['node_modules/tinyrainbow'].__setitem__('version','3.2.0'))]
        for name,change in cases:
            value=json.loads((self.root/name).read_bytes());change(value);raw=(json.dumps(value,indent=2)+'\n').encode()
            with self.subTest(name=name):self.mutate(name,raw,lambda:self.repin(name,raw))
    def test_version_normalization_does_not_accept_old_or_future_version(self):
        for version in ['1.19.5','1.19.7','1.20.0']:
            name='package.json';raw=(self.root/name).read_bytes().replace(b'"version": "1.19.6"',('"version": "'+version+'"').encode())
            self.mutate(name,raw,lambda:self.repin(name,raw))
    def test_vitest_patch_closure_restores_exact_predecessor_and_rejects_mixed_or_extra_updates(self):
        P['validate_packages'](self.root,self.old)
        cases=[('ui/package.json',lambda v:v['devDependencies'].__setitem__('vitest','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['']['devDependencies'].__setitem__('vitest','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/@vitest/mocker'].__setitem__('version','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/vitest']['dependencies'].__setitem__('@vitest/mocker','4.1.11')),('ui/package-lock.json',lambda v:v['packages']['node_modules/chai'].__setitem__('version','6.3.0')),('ui/package-lock.json',lambda v:v['packages']['node_modules/tinyrainbow'].__setitem__('version','3.2.0'))]
        def reject():
            with self.assertRaises(ValueError):P['validate_packages'](self.root,self.old)
        for name,change in cases:
            value=json.loads((self.root/name).read_bytes());change(value)
            with self.subTest(name=name):self.mutate(name,(json.dumps(value,indent=2)+'\n').encode(),reject)
    def test_copied_observations_findings_and_execution_claims_cannot_be_repinned(self):
        for name in ['docs/qualification/mainnet-cutover-v1.19.6-expected.json','scripts/security/slither-reviewed-findings-v1.19.6.json','docs/qualification/release-v1.19.6-provenance.json']:
            value=json.loads((self.root/name).read_bytes());value['executed']=True;raw=(json.dumps(value,indent=2)+'\n').encode()
            with self.subTest(name=name):self.mutate(name,raw,lambda:self.repin(name,raw))
    def test_extra_missing_renamed_symlink_mode_and_baseline_tree_changes_reject(self):
        extra=self.root/'docs/Unreviewed.md';extra.write_text('unreviewed')
        try:self.rejects()
        finally:extra.unlink()
        target=self.root/'README.md';old=target.read_bytes();target.unlink()
        try:self.rejects()
        finally:target.write_bytes(old)
        target.chmod(0o755)
        try:self.rejects()
        finally:target.chmod(0o644)
        target.unlink();target.symlink_to('/etc/hosts')
        try:self.rejects()
        finally:target.unlink();target.write_bytes(old)
        value=json.loads((self.root/P['BASELINE']).read_bytes());value['entries']['contracts/AGIJobManager.sol']['blob']='0'*40
        self.mutate(P['BASELINE'],(json.dumps(value)+'\n').encode(),self.rejects)
    def test_manifest_cannot_drop_change_add_directory_exception_or_claim_execution(self):
        original=json.loads((self.root/P['MANIFEST']).read_bytes())
        for mutation in ['drop','directory','claim']:
            v=copy.deepcopy(original)
            if mutation=='drop':v['changes'].pop(next(iter(v['changes'])))
            elif mutation=='directory':v['changes']['scripts/release/*']={'before':None,'after':{'mode':'100644','sha256':'0'*64},'reason':'Broad permission'}
            else:v['qualification']='qualified'
            raw=(json.dumps(v)+'\n').encode()
            self.mutate(P['MANIFEST'],raw,lambda:self.rejects({**self.selection,'manifestSha256':sha(raw)}))
    def test_duplicate_json_and_package_metadata_claims_reject(self):
        raw=(self.root/P['MANIFEST']).read_bytes().replace(b'{',b'{"version":"1.19.6",',1)
        self.mutate(P['MANIFEST'],raw,lambda:self.rejects({**self.selection,'manifestSha256':sha(raw)}))
        manifest={key:None for key in ['schemaVersion','repository','tag','name','sourceCommit','sourceTree','builderSource','stage','qualification','archiveLimitBytes','toolchain','exclusions','files']}
        manifest.update(P['metadata'](self.selection));manifest.update(schemaVersion=2,repository='MontrealAI/AGIJobManager',tag='v1.19.6',name='v1.19.6 — Operator guidance and deployment evidence',sourceCommit='a'*40,sourceTree='b'*40,stage='source-package')
        P['validate_metadata'](manifest,self.selection)
        for key,value in [('tag','v1.19.5'),('stage','qualified'),('releaseProfile','manager-transformational-v1'),('qualification','qualified')]:
            with self.subTest(key=key),self.assertRaises(ValueError):P['validate_metadata']({**manifest,key:value},self.selection)


class CheckoutIdentity(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='maintenance-checkout-');self.addCleanup(self.temp.cleanup)
        self.root=pathlib.Path(self.temp.name)/'source'
        subprocess.run(['git','clone','--quiet','--shared','--no-checkout',str(ROOT),str(self.root)],check=True)
        self.source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        subprocess.run(['git','reset','--hard',self.source],cwd=self.root,check=True,stdout=subprocess.DEVNULL)
        self.tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=self.root,text=True).strip()
        self.selection=P['select'](manifest=P['MANIFEST'],manifest_sha256=sha((self.root/P['MANIFEST']).read_bytes()),verifier_sha256=sha((self.root/P['VERIFIER']).read_bytes()))
    def verify(self,root=None):return P['checkout'](root or self.root,self.selection,None,None,self.source,self.tree)
    def test_real_git_directory_and_linked_worktree_are_accepted(self):
        self.assertEqual(self.verify()['sourceCommit'],self.source)
        linked=pathlib.Path(self.temp.name)/'linked'
        subprocess.run(['git','worktree','add','--quiet','--detach',str(linked),self.source],cwd=self.root,check=True)
        self.assertTrue((linked/'.git').is_file());self.assertEqual(self.verify(linked)['sourceTree'],self.tree)
    def test_untracked_nonignored_config_or_script_is_rejected_and_ignored_build_is_allowed(self):
        ignored=self.root/'build/probe.txt';ignored.parent.mkdir();ignored.write_text('Normal ignored output')
        self.verify()
        for name in ['config/rogue.json','scripts/rogue.cjs']:
            p=self.root/name;p.write_text('Unreviewed input')
            try:
                with self.subTest(path=name),self.assertRaisesRegex(ValueError,'untracked nonignored'):self.verify()
            finally:p.unlink()
    def test_copied_nested_source_cannot_inherit_parent_git_identity_even_with_environment_override(self):
        nested=self.root/'build/copied-source';nested.mkdir(parents=True)
        for row in subprocess.check_output(['git','ls-files','-z'],cwd=self.root).split(b'\0'):
            if not row:continue
            name=row.decode();a=self.root/name;b=nested/name;b.parent.mkdir(parents=True,exist_ok=True)
            if a.is_symlink():b.symlink_to(os.readlink(a))
            else:b.write_bytes(a.read_bytes());b.chmod(a.stat().st_mode & 0o777)
        with patch.dict(os.environ,{'GIT_WORK_TREE':str(nested),'GIT_DIR':str(self.root/'.git')}):
            with self.assertRaisesRegex(ValueError,'actual Git worktree root'):self.verify(nested)
        self.verify()

if __name__=='__main__':unittest.main()
