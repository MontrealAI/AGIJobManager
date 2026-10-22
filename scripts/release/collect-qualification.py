"""Collect completed final-main-source runs and their immutable candidate artifact."""
import argparse
import runpy
import datetime
import json
import os
import pathlib
import re
import subprocess
import tempfile
import zipfile
from release_common import REPOSITORY, TAG, TITLE, WORKFLOWS, DISCOVERY_PROFILE, qualification_workflows, BUILDER_ASSETS, require, valid_sha, validate_qualification, verify_assets, sha

root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True)
parser.add_argument('--out', type=pathlib.Path, required=True)
policy = runpy.run_path(str(pathlib.Path(__file__).with_name('package-policy.py')))
policy['add_selection_arguments'](parser)
parser.add_argument('--native-source-root')
parser.add_argument('--dependency-root')
args = parser.parse_args()
source_policy = policy['select'](args.profile, manifest=args.manifest, manifest_sha256=args.manifest_sha256, verifier_sha256=args.verifier_sha256, schema_sha256=args.schema_sha256, published=True)
profile_args = ['--profile', args.profile]
if args.native_source_root is not None:
    require(args.profile == DISCOVERY_PROFILE and pathlib.Path(args.native_source_root).is_absolute(), 'Native source root requires explicit Discovery selection')
    profile_args.extend(['--native-source-root', args.native_source_root])
for option in ('manifest', 'manifest_sha256', 'verifier_sha256', 'schema_sha256'):
    value = getattr(args, option)
    if value is not None:
        profile_args.extend(['--' + option.replace('_', '-'), value])
require(valid_sha(args.source), 'Source must be a full commit SHA')
require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY, 'Repository identity differs')

def gh(*command):
    result = subprocess.run(['gh', *command], cwd=root, text=True, capture_output=True, timeout=180)
    require(result.returncode == 0, 'GitHub request failed; check authenticated Actions access (response withheld to protect signed URLs)')
    return result.stdout

def api(endpoint):
    return json.loads(gh('api', f'repos/{REPOSITORY}/{endpoint}', '--method', 'GET'))

runpy.run_path(str(pathlib.Path(__file__).with_name('publication-authorization-discovery.py' if args.profile == DISCOVERY_PROFILE else 'publication-authorization-ti.py' if source_policy and source_policy.get('releaseProfile') in ('manager-transformational-v1', 'manager-dependency-maintenance-v1') else 'publication-authorization.py')))['authorize'](os.environ, args.source, api)
require(api('git/ref/heads/main')['object']['sha'] == args.source, 'Source must be current main')
config = {'repository': REPOSITORY, 'tag': TAG, 'name': TITLE, 'status': 'qualified', 'publicationAuthorized': True,
    'sourceCommit': args.source, 'sourceTree': api(f'git/commits/{args.source}')['tree']['sha'], 'checkoutCommit': args.source,
    'releaseDate': datetime.datetime.now(datetime.timezone.utc).date().isoformat(), 'requiredSourceRuns': {},
    'scope': 'Software qualification. Historical mainnet evidence is separate; no public-chain writes or intake activation.', 'artifactDigests': {}}
if source_policy is not None:
    config['sourcePolicy'] = source_policy
if args.profile == DISCOVERY_PROFILE:
    require(args.native_source_root is not None and args.dependency_root is not None, 'Discovery collector requires installed Alpha and compiler closures')
    policy['checkout'](root, source_policy, None, args.dependency_root, args.source, config['sourceTree'], alpha_root=args.native_source_root)
else:
    require(args.dependency_root is None, 'Compiler source root is only admitted by explicit Discovery collector selection')
for workflow in qualification_workflows(config):
    identity = api(f'actions/workflows/{workflow}')
    runs = api(f'actions/workflows/{identity["id"]}/runs?head_sha={args.source}&event=push&per_page=100')['workflow_runs']
    candidates = sorted((r for r in runs if r['head_sha'] == args.source and r['head_branch'] == 'main'), key=lambda r: r['id'], reverse=True)
    require(bool(candidates), 'Missing final-source run: ' + workflow)
    run = candidates[0]
    config['requiredSourceRuns'][workflow] = {'id': run['id'], 'workflow': workflow, 'workflowId': identity['id'], 'attempt': run['run_attempt'], 'event': run['event'], 'headBranch': run['head_branch']}
validate_qualification(config, api, lambda job: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', '--method', 'GET', '--allow-escape-sequences'), publication=True)
if source_policy and source_policy.get('releaseProfile') in ('manager-transformational-v1', 'manager-dependency-maintenance-v1', DISCOVERY_PROFILE):
    config['transformationQualification'] = runpy.run_path(str(pathlib.Path(__file__).with_name('transformational-qualification.py')))['validate'](config, api, lambda job: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', '--method', 'GET', '--allow-escape-sequences'))
if source_policy and source_policy.get('releaseProfile') == 'manager-dependency-maintenance-v1':
    config['maintenanceQualification'] = runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance-qualification.py')))['validate'](config, api, lambda job: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', '--method', 'GET', '--allow-escape-sequences'))
run_id = config['requiredSourceRuns']['current-state-release.yml']['id']
artifacts, page = [], 1
while True:
    batch = api(f'actions/runs/{run_id}/artifacts?per_page=100&page={page}')['artifacts']
    artifacts.extend(batch)
    if len(batch) < 100:
        break
    page += 1
matches = [a for a in artifacts if a['name'] == f'AGIJobManager-{TAG}-candidate-{args.source}']
require(len(matches) == 1 and not matches[0]['expired'] and re.fullmatch('sha256:[0-9a-f]{64}', matches[0].get('digest', '')), 'Missing or ambiguous immutable candidate artifact')
artifact = matches[0]
require(artifact['workflow_run']['head_sha'] == args.source, 'Artifact source differs')
require(not args.out.exists(), 'Output must be new')
args.out.mkdir(parents=True)
with tempfile.TemporaryDirectory(prefix='v114-artifact-') as temp:
    downloaded = pathlib.Path(temp) / 'artifact.zip'
    with downloaded.open('wb') as stream:
        result = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/actions/artifacts/{artifact["id"]}/zip'], cwd=root, stdout=stream, stderr=subprocess.PIPE, timeout=180)
    require(result.returncode == 0 and 'sha256:' + sha(downloaded.read_bytes()) == artifact['digest'], 'Candidate artifact download/digest mismatch')
    with zipfile.ZipFile(downloaded) as archive:
        allowed = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html', 'RELEASE_MANIFEST.json', 'SHA256SUMS.txt'} | BUILDER_ASSETS
        require(set(archive.namelist()) == allowed and len(archive.infolist()) == len(allowed), 'Unexpected artifact contents')
        for name in allowed:
            (args.out / name).write_bytes(archive.read(name))
config['candidateArtifact'] = {k: artifact[k] for k in ['id', 'name', 'digest', 'size_in_bytes']}
digests = verify_assets(args.out)
config['artifactDigests'] = {n: d for n, d in digests.items() if n != 'SHA256SUMS.txt'}
manifest = json.loads((args.out / 'RELEASE_MANIFEST.json').read_text())
require(manifest['sourceCommit'] == args.source and manifest['sourceTree'] == config['sourceTree'], 'Candidate manifest source differs')
if args.profile == DISCOVERY_PROFILE:
    discovery = runpy.run_path(str(pathlib.Path(__file__).with_name('discovery-qualification.py')))
    config['discoveryQualification'] = discovery['validate'](config, api, lambda job: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', '--method', 'GET', '--allow-escape-sequences'), discovery['download_native_artifact'], alpha_api=lambda endpoint: discovery['github_read_api'](discovery['ALPHA_REPOSITORY'], endpoint))
subprocess.run(['python3', 'scripts/release/verify-package.py', str(args.out.resolve()), *profile_args], cwd=root, check=True)
qualification_raw = (json.dumps(config, indent=2, ensure_ascii=False) + '\n').encode()
if args.profile == DISCOVERY_PROFILE:
    require(len(qualification_raw) <= discovery['MAX_QUALIFICATION_BYTES'], 'Discovery qualification exceeds its complete encoded byte bound')
(args.out / 'QUALIFICATION.json').write_bytes(qualification_raw)
(args.out / 'SHA256SUMS.txt').write_text(''.join(f'{sha(f.read_bytes())}  {f.name}\n' for f in sorted(args.out.iterdir()) if f.name != 'SHA256SUMS.txt'))
verify_assets(args.out, config)
print(f'Final-source qualification retained for {args.source}. No release or tag was created.')
