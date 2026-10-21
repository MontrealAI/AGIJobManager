"""Adversarial exact-source maintenance gates with inherited native fixtures; no network."""
import copy
import pathlib
import runpy
import unittest
from release_common import sha
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
M=runpy.run_path(str(HERE/'maintenance-qualification.py'))
N=runpy.run_path(str(HERE/'test-transformational-qualification.py'))

class MaintenanceQualification(unittest.TestCase):
    def setUp(self):
        self.native=N['NativeQualificationTests'](); self.native.setUp(); self.addCleanup(self.native.doCleanups)
        self.fixture=self.native.fixture
        self.fixture.config['transformationQualification']=N['m'].source_metadata()
        P=runpy.run_path(str(HERE/'maintenance-profile.py'))
        self.fixture.config['sourcePolicy']=P['select'](manifest=P['MANIFEST'],manifest_sha256=sha((ROOT/P['MANIFEST']).read_bytes()),verifier_sha256=sha((ROOT/P['VERIFIER']).read_bytes()))
        self.job=self.native.jobs['current-state-release.yml']
        self.job['steps'].append({'name':M['STEPS'][1],'status':'completed','conclusion':'success'})
        self.markers={'MAINTENANCE_VERSION':M['VERSION'],'MAINTENANCE_MANIFEST_SHA256':self.fixture.config['sourcePolicy']['manifestSha256'],'MAINTENANCE_VERIFIER_SHA256':self.fixture.config['sourcePolicy']['verifierSha256']}
        self.fixture.logs[self.job['id']]+=''.join(k+'='+v+'\n' for k,v in self.markers.items())
    def verify(self): return M['validate'](self.fixture.config,self.fixture.api,lambda job:self.fixture.logs[job])
    def test_complete_same_snapshot_is_deterministic_and_nonmutating(self):
        old=copy.deepcopy(self.fixture.config); calls=[]; logs=[]
        result=M['validate'](self.fixture.config,lambda ep:(calls.append(ep),self.fixture.api(ep))[1],lambda job:(logs.append(job),self.fixture.logs[job])[1])
        self.assertEqual(result,M['source_metadata']()); self.assertEqual(self.verify(),result);self.assertEqual(old,self.fixture.config)
        self.assertEqual(len(calls),len(set(calls)));self.assertEqual(len(logs),len(set(logs)))
    def test_all_eight_inherited_workflows_remain_mandatory(self):
        for name in list(self.fixture.config['requiredSourceRuns']):
            old=self.fixture.config['requiredSourceRuns'].pop(name)
            with self.subTest(workflow=name),self.assertRaises(ValueError):self.verify()
            self.fixture.config['requiredSourceRuns'][name]=old
    def test_native_ti_record_and_native_job_cannot_be_skipped(self):
        self.fixture.config['transformationQualification']=None
        with self.assertRaises(ValueError):self.verify()
        self.fixture.config['transformationQualification']=N['m'].source_metadata()
        self.native.receiver['steps'][-1]['conclusion']='skipped'
        with self.assertRaises(ValueError):self.verify()
    def test_each_maintenance_gate_is_exactly_once_completed_success(self):
        original=copy.deepcopy(self.job['steps'])
        for name in M['STEPS']:
            row=next(s for s in original if s['name']==name)
            for altered in [None,dict(row,name=name+' stale'),dict(row,conclusion='skipped'),dict(row,conclusion='failure'),dict(row,status='in_progress'),'duplicate']:
                self.job['steps']=[s for s in copy.deepcopy(original) if s['name']!=name]
                if altered=='duplicate':self.job['steps'] += [copy.deepcopy(row),copy.deepcopy(row)]
                elif altered is not None:self.job['steps'].append(altered)
                with self.subTest(name=name,altered=altered),self.assertRaises(ValueError):self.verify()
        self.job['steps']=original
    def test_stale_missing_duplicated_echoed_or_wrong_job_markers_reject(self):
        ident=self.job['id']; original=self.fixture.logs[ident]
        for key,value in self.markers.items():
            line=key+'='+value+'\n'
            for text in [original.replace(line,''),original+line,original.replace(line,key+'=stale\n'),original.replace(line,'echo '+line)]:
                self.fixture.logs[ident]=text
                with self.subTest(marker=key),self.assertRaises(ValueError):self.verify()
            self.fixture.logs[ident]=original.replace(line,''); self.fixture.logs[self.native.receiver['id']]+=line
            with self.assertRaises(ValueError):self.verify()
            self.fixture.logs[self.native.receiver['id']]=self.fixture.logs[self.native.receiver['id']].removesuffix(line)
            self.fixture.logs[ident]=original
    def test_old_unknown_missing_or_extra_policy_selection_rejects(self):
        old=copy.deepcopy(self.fixture.config['sourcePolicy'])
        for altered in [None,{**old,'releaseProfile':'manager-transformational-v1'},{**old,'releaseProfile':'unknown'},{**old,'manifestSha256':'0'*64},{**old,'published':True}]:
            self.fixture.config['sourcePolicy']=altered
            with self.subTest(policy=altered),self.assertRaises(ValueError):self.verify()
        self.fixture.config['sourcePolicy']=old
    def test_current_run_checkout_and_native_markers_still_reject_drift(self):
        original=self.fixture.logs[self.native.receiver['id']]
        self.fixture.logs[self.native.receiver['id']]=original.replace(self.native.markers['TI_NATIVE_ALPHA_COMMIT'],'0'*40)
        with self.assertRaises(ValueError):self.verify()
        self.fixture.logs[self.native.receiver['id']]=original
        self.job['head_sha']='c'*40
        with self.assertRaises(ValueError):self.verify()
    def test_offline_metadata_is_exact_without_claiming_execution(self):
        expected=M['source_metadata'](); self.assertEqual(M['verify_record']({'maintenanceQualification':expected}),expected)
        for key in expected:
            altered=copy.deepcopy(expected);altered.pop(key)
            with self.subTest(key=key),self.assertRaises(ValueError):M['verify_record']({'maintenanceQualification':altered})
        for field in ['executed','releaseQualified','publicationApproved']:
            with self.assertRaises(ValueError):M['verify_record']({'maintenanceQualification':{**expected,field:True}})

if __name__=='__main__':unittest.main()
