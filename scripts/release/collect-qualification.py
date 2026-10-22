"""Collect completed final-main-source runs and their immutable candidate artifact."""
import argparse
import runpy
import datetime
import json
import hashlib
import stat
import os
import pathlib
import re
import subprocess
import tempfile
import zipfile
from release_common import REPOSITORY, TAG, TITLE, WORKFLOWS, DISCOVERY_PROFILE, qualification_workflows, BUILDER_ASSETS, require, valid_sha, validate_qualification, verify_assets, sha, LIMIT, file_sha, _file_snapshot, _open_bounded_file


def collect_candidate_assets(downloaded, artifact, destination):
    """Stream one resource-bounded saved candidate; hosted eligibility is separate."""
    downloaded, destination = pathlib.Path(downloaded), pathlib.Path(destination)
    require(type(artifact.get('size_in_bytes')) is int and 0 < artifact['size_in_bytes'] < LIMIT,
            'Candidate artifact transport size differs')
    allowed = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html',
               'RELEASE_MANIFEST.json', 'SHA256SUMS.txt'} | BUILDER_ASSETS
    copied = {}
    with _open_bounded_file(downloaded, LIMIT - 1) as (stream, before):
        require(before.st_size == artifact['size_in_bytes'], 'Candidate artifact transport size differs')
        total, result = 0, hashlib.sha256()
        while True:
            block = stream.read(min(1024 * 1024, before.st_size - total + 1))
            if not block:
                break
            total += len(block)
            require(total <= before.st_size, 'Candidate artifact grew during hashing')
            result.update(block)
        require(total == before.st_size and 'sha256:' + result.hexdigest() == artifact['digest']
                and _file_snapshot(os.fstat(stream.fileno())) == _file_snapshot(before)
                and _file_snapshot(downloaded.stat(follow_symlinks=False)) == _file_snapshot(before),
                'Candidate artifact download/digest mismatch')
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            require(len(entries) == len(allowed) and {item.filename for item in entries} == allowed
                    and sum(item.file_size for item in entries) < LIMIT,
                    'Candidate artifact transport inventory differs')
            for item in entries:
                require(not item.is_dir() and stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG)
                        and not item.flag_bits & 1 and 0 < item.file_size < LIMIT,
                        'Candidate artifact transport has unsupported entry')
            for item in entries:
                total, result = 0, hashlib.sha256()
                with archive.open(item) as source, (destination / item.filename).open('xb') as target:
                    while True:
                        block = source.read(min(1024 * 1024, item.file_size - total + 1))
                        if not block:
                            break
                        total += len(block)
                        require(total <= item.file_size, 'Candidate transport member grew')
                        result.update(block)
                        target.write(block)
                require(total == item.file_size, 'Candidate transport member size differs')
                copied[item.filename] = result.hexdigest()
    digests, manifest, manifest_raw = verify_assets(destination, return_manifest=True)
    require(copied == digests, 'Candidate transport copied bytes differ')
    return digests, manifest, manifest_raw

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
require(type(artifact.get('size_in_bytes')) is int and 0 < artifact['size_in_bytes'] < LIMIT,
        'Candidate artifact transport size differs')
require(not args.out.exists(), 'Output must be new')
args.out.mkdir(parents=True)
with tempfile.TemporaryDirectory(prefix='v114-artifact-') as temp:
    downloaded = pathlib.Path(temp) / 'artifact.zip'
    with downloaded.open('wb') as stream:
        result = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/actions/artifacts/{artifact["id"]}/zip'], cwd=root, stdout=stream, stderr=subprocess.PIPE, timeout=180)
    require(result.returncode == 0, 'Candidate artifact download failed')
    digests, manifest, manifest_raw = collect_candidate_assets(downloaded, artifact, args.out)
config['candidateArtifact'] = {k: artifact[k] for k in ['id', 'name', 'digest', 'size_in_bytes']}
config['artifactDigests'] = {n: d for n, d in digests.items() if n != 'SHA256SUMS.txt'}
require(manifest['sourceCommit'] == args.source and manifest['sourceTree'] == config['sourceTree'], 'Candidate manifest source differs')
if args.profile == DISCOVERY_PROFILE:
    discovery = runpy.run_path(str(pathlib.Path(__file__).with_name('discovery-qualification.py')))
    config['discoveryQualification'] = discovery['validate'](config, api, lambda job: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', '--method', 'GET', '--allow-escape-sequences'), discovery['download_native_artifact'], alpha_api=lambda endpoint: discovery['github_read_api'](discovery['ALPHA_REPOSITORY'], endpoint))
subprocess.run(['python3', 'scripts/release/verify-package.py', str(args.out.resolve()), *profile_args], cwd=root, check=True)
qualification_raw = (json.dumps(config, indent=2, ensure_ascii=False) + '\n').encode()
if args.profile == DISCOVERY_PROFILE:
    require(len(qualification_raw) <= discovery['MAX_QUALIFICATION_BYTES'], 'Discovery qualification exceeds its complete encoded byte bound')
(args.out / 'QUALIFICATION.json').write_bytes(qualification_raw)
(args.out / 'SHA256SUMS.txt').write_text(''.join(f'{file_sha(f)}  {f.name}\n' for f in sorted(args.out.iterdir()) if f.name != 'SHA256SUMS.txt'))
verify_assets(args.out, config)
print(f'Final-source qualification retained for {args.source}. No release or tag was created.')
