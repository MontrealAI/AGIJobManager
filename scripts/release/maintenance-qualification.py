"""Add maintenance source/audit gates to every inherited exact-source/native TI gate."""
import copy
import pathlib
import re
import runpy
from release_common import require, run_jobs, sha

ROOT=pathlib.Path(__file__).resolve().parents[2]
PROFILE='manager-dependency-maintenance-v1'
VERSION='1.19.6'
MANIFEST='config/manager-dependency-maintenance-v1.json'
VERIFIER='scripts/release/maintenance-profile.py'
SCHEMA='agijobmanager/maintenance-qualification/v1'
STEPS=('Source and dependency compatibility boundaries','Run root and Hardhat audits at low threshold','Native transformation profile and inherited release tests')


def source_metadata():
    return {'schema':SCHEMA,'version':VERSION,'profile':PROFILE,
            'manifestSha256':sha((ROOT/MANIFEST).read_bytes()),
            'verifierSha256':sha((ROOT/VERIFIER).read_bytes()),
            'baseCommit':'4d4c32685eebf23b0aa35dbb45abe23ac8a261cb',
            'baseTree':'3676cb41be9c5c5110cc266e0ff6f7c20bfbec86',
            'scope':'Exact-source maintenance and audit gates; no independent security audit or deployment approval.'}


def validate(config,api,logs):
    expected=source_metadata(); responses={}; retained={}
    def observed_api(endpoint):
        if endpoint not in responses: responses[endpoint]=copy.deepcopy(api(endpoint))
        return copy.deepcopy(responses[endpoint])
    def observed_logs(job):
        if job not in retained: retained[job]=logs(job)
        return retained[job]
    native=runpy.run_path(str(ROOT/'scripts/release/transformational-qualification.py'))
    require(config.get('transformationQualification')==native['validate'](config,observed_api,observed_logs),'Maintenance retains every native transformation gate and record')
    policy=runpy.run_path(str(ROOT/'scripts/release/maintenance-profile.py'))
    selection=policy['select'](manifest=MANIFEST,manifest_sha256=expected['manifestSha256'],verifier_sha256=expected['verifierSha256'])
    require(config.get('sourcePolicy')==selection,'Maintenance source-policy record differs')
    item=config['requiredSourceRuns']['current-state-release.yml']
    jobs=[j for j in run_jobs(observed_api,item['id'],item['attempt']) if j.get('name')=='qualify']
    require(len(jobs)==1,'Maintenance qualification job is missing or duplicated')
    job=jobs[0]
    for name in STEPS:
        steps=[s for s in job.get('steps',[]) if s.get('name')==name]
        require(len(steps)==1 and steps[0].get('status')=='completed' and steps[0].get('conclusion')=='success','Maintenance gate did not execute exactly once successfully: '+name)
    text=observed_logs(job['id'])
    for name,value in {'MAINTENANCE_VERSION':VERSION,'MAINTENANCE_MANIFEST_SHA256':expected['manifestSha256'],'MAINTENANCE_VERIFIER_SHA256':expected['verifierSha256']}.items():
        matches=re.findall(r'^(?:\d{4}-\d{2}-\d{2}T\S+[ \t]+)?'+re.escape(name)+r'=([^\r\n]*?)[ \t]*\r?$',text,re.MULTILINE)
        require(matches==[value],'Maintenance source marker is missing, duplicated or stale: '+name)
    return expected


def verify_record(config):
    """Check offline metadata only; this does not establish hosted execution."""
    expected=source_metadata()
    require(isinstance(config,dict) and config.get('maintenanceQualification')==expected,'Maintenance qualification record differs')
    return expected
