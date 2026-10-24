"""Authorize Pages only after exact-main publication of the qualified v1.20.2 Discovery release."""
import argparse
import json
import os
import pathlib
import runpy
import re
import subprocess
import tempfile
from release_common import REPOSITORY, TAG, TITLE, RELEASE_ASSET_MAX_BYTES, BUILDER_ASSETS, require, valid_sha, strict_json, sha, run_jobs, qualification_workflows, verify_assets

ROOT = pathlib.Path(__file__).resolve().parents[2]
TRIGGER_PATH = '.github/workflows/publish-discovery-v1.yml'
ASSET_NAMES = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html', 'RELEASE_MANIFEST.json', 'QUALIFICATION.json', 'SHA256SUMS.txt'} | BUILDER_ASSETS
PUBLISH_STEPS = ('Verify publication source checkout', 'Install the exact compiler dependency closure',
    'Capture the exact reviewed Alpha implementation', 'Isolate the installed native source from Manager inputs',
    'Wait for all nine exact-source workflows',
    'Consume completed exact-source runs and immutable candidate artifact', 'Verify complete published download inventory',
    'Attest exact-source release assembly', 'Verify artifact, repository, workflow and source attestation bindings',
    'Validate evidence, create draft, verify assets, then publish')


def authorize_event(environment, source, api, event):
    require(TAG == 'v1.20.2' and valid_sha(source), 'Automatic Pages publication is fixed to the authorized release')
    require(environment.get('GITHUB_EVENT_NAME') == 'workflow_run' and environment.get('GITHUB_REF') == 'refs/heads/main'
        and environment.get('GITHUB_REPOSITORY') == REPOSITORY, 'Pages publication event/repository/ref differs')
    require(event.get('action') == 'completed' and event.get('repository', {}).get('full_name') == REPOSITORY, 'Pages trigger action/repository differs')
    trigger = event.get('workflow_run', {})
    for key in ('id', 'workflow_id', 'run_attempt'):
        require(type(trigger.get(key)) is int and trigger[key] > 0, 'Pages publisher identity/attempt is missing')
    observed = api(f'actions/runs/{trigger["id"]}')
    for run in (trigger, observed):
        require(run.get('path') == TRIGGER_PATH and run.get('event') == 'workflow_dispatch'
            and run.get('head_branch') == 'main' and run.get('head_sha') == source
            and run.get('status') == 'completed' and run.get('conclusion') == 'success', 'Pages publisher source/event/result differs')
        require(run.get('repository', {}).get('full_name') == REPOSITORY and run.get('head_repository', {}).get('full_name') == REPOSITORY, 'Pages publisher repository differs')
        require(all(run.get(key) == trigger[key] for key in ('id', 'workflow_id', 'run_attempt')), 'Pages publisher run/attempt differs')
    identity = api(f'actions/workflows/{trigger["workflow_id"]}')
    require(identity.get('id') == trigger['workflow_id'] and identity.get('path') == TRIGGER_PATH, 'Pages publisher workflow identity differs')
    jobs = run_jobs(api, trigger['id'], trigger['run_attempt'])
    require(len(jobs) == 1 and jobs[0].get('name') == 'publish', 'Pages publisher job inventory differs')
    job = jobs[0]
    require(job.get('status') == 'completed' and job.get('conclusion') == 'success' and job.get('head_sha') == source and job.get('run_id') == trigger['id'], 'Pages publisher did not succeed on exact source')
    for name in PUBLISH_STEPS:
        steps = [step for step in job.get('steps', []) if step.get('name') == name]
        require(len(steps) == 1 and steps[0].get('status') == 'completed' and steps[0].get('conclusion') == 'success', 'Pages publication requires an executed publisher step: ' + name)
    require(api('git/ref/heads/main')['object']['sha'] == source, 'Pages source was superseded')


def validate_published_release(release, source, api, expected, sizes):
    require(type(release.get('id')) is int and release['id'] > 0 and release.get('tag_name') == TAG
        and release.get('target_commitish') == source and release.get('name') == TITLE
        and release.get('draft') is False and release.get('prerelease') is False
        and release.get('published_at'), 'Pages requires the exact published release')
    obj = api(f'git/ref/tags/{TAG}')['object']
    for _ in range(5):
        if obj.get('type') == 'commit': break
        require(obj.get('type') == 'tag' and valid_sha(obj.get('sha')), 'Unexpected Pages release tag object')
        obj = api(f'git/tags/{obj["sha"]}')['object']
    require(obj.get('type') == 'commit' and obj.get('sha') == source, 'Pages release tag points to another source')
    require(set(expected) == ASSET_NAMES and set(sizes) == ASSET_NAMES
        and all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value) for value in expected.values()), 'Pages release expected inventory/digests differ')
    assets = []
    for page in range(1, 11):
        batch = api(f'releases/{release["id"]}/assets?per_page=100&page={page}')
        assets.extend(batch)
        if len(batch) < 100: break
    else: raise ValueError('Pages release inventory is unbounded')
    require(len(assets) == len(expected) and {item.get('name') for item in assets} == set(expected), 'Pages release asset inventory differs')
    for asset in assets:
        name = asset['name']
        require(asset.get('state') == 'uploaded' and asset.get('digest') == 'sha256:' + expected[name]
            and type(asset.get('size')) is int and asset['size'] == sizes[name]
            and 0 < asset['size'] <= RELEASE_ASSET_MAX_BYTES, 'Pages release asset identity differs: ' + name)
    require(api('git/ref/heads/main')['object']['sha'] == source, 'Pages source advanced after release validation')


def validate_candidate(config, source, api):
    candidate = config.get('candidateArtifact', {})
    require(type(candidate.get('id')) is int and candidate['id'] > 0, 'Pages candidate artifact identity is missing')
    artifact = api(f'actions/artifacts/{candidate["id"]}')
    require(all(artifact.get(key) == candidate.get(key) for key in ('id', 'name', 'digest', 'size_in_bytes'))
        and artifact.get('expired') is False and artifact.get('name') == f'AGIJobManager-{TAG}-candidate-{source}'
        and artifact.get('workflow_run', {}).get('id') == config['requiredSourceRuns']['current-state-release.yml']['id']
        and artifact.get('workflow_run', {}).get('head_sha') == source, 'Pages candidate artifact source/digest differs')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    def gh(*command, timeout=180):
        result = subprocess.run(['gh', *command], capture_output=True, timeout=timeout)
        require(result.returncode == 0, 'Pages published evidence request/verification failed (response withheld)')
        return result.stdout
    api = lambda endpoint: json.loads(gh('api', f'repos/{REPOSITORY}/{endpoint}', '--method', 'GET'))
    event_path = pathlib.Path(os.environ['GITHUB_EVENT_PATH'])
    require(event_path.is_file() and not event_path.is_symlink() and event_path.stat().st_size <= 2_000_000, 'Invalid Pages trigger file')
    event = strict_json(event_path.read_bytes())
    authorize_event(os.environ, args.source, api, event)
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip() == args.source, 'Pages checkout is not published source')
    release = api(f'releases/tags/{TAG}')
    supplied_assets = release.get('assets', [])
    require(isinstance(supplied_assets, list) and len(supplied_assets) == len(ASSET_NAMES) and {asset.get('name') for asset in supplied_assets} == ASSET_NAMES, 'Published Pages release asset metadata is incomplete')
    validate_published_release(release, args.source, api,
        {asset['name']: str(asset.get('digest', '')).removeprefix('sha256:') for asset in supplied_assets},
        {asset['name']: asset.get('size') for asset in supplied_assets})
    with tempfile.TemporaryDirectory(prefix='manager-published-pages-') as tmp:
        assets = pathlib.Path(tmp)
        gh('release', 'download', TAG, '--repo', REPOSITORY, '--dir', str(assets), timeout=300)
        qualification = assets / 'QUALIFICATION.json'
        require(qualification.is_file() and not qualification.is_symlink()
            and qualification.stat().st_size <= 64 * 1024 * 1024, 'Published Discovery qualification exceeds its byte bound')
        config = strict_json(qualification.read_bytes())
        require(config.get('sourceCommit') == args.source and config.get('publicationAuthorized') is True, 'Pages qualification source/authorization differs')
        policy = runpy.run_path(str(ROOT / 'scripts/release/package-policy.py'))
        selection = policy['select']('manager-discovery-release-v1', manifest='config/manager-discovery-release-v1.json',
            manifest_sha256=sha((ROOT / 'config/manager-discovery-release-v1.json').read_bytes()),
            verifier_sha256=sha((ROOT / 'scripts/release/discovery-release-profile.py').read_bytes()), published=True)
        require(config.get('sourcePolicy') == selection, 'Pages qualification policy differs from published checkout')
        require(len(qualification_workflows(config)) == 9
            and set(config.get('requiredSourceRuns', {})) == set(qualification_workflows(config)),
            'Pages requires the explicit complete nine-workflow Discovery selection')
        discovery = runpy.run_path(str(ROOT / 'scripts/release/discovery-qualification.py'))
        require(config.get('discoveryQualification') == discovery['validate'](config, api,
            lambda job_id: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job_id}/logs', '--method', 'GET', '--allow-escape-sequences').decode(), discovery['download_native_artifact'], alpha_api=lambda endpoint: discovery['github_read_api'](discovery['ALPHA_REPOSITORY'], endpoint)),
            'Pages Discovery/native/inherited qualification binding differs')
        validate_candidate(config, args.source, api)
        expected = verify_assets(assets, config)
        validate_published_release(release, args.source, api, expected, {name: (assets / name).stat().st_size for name in expected})
        for name in expected:
            gh('attestation', 'verify', str(assets / name), '--repo', REPOSITORY,
                '--signer-workflow', REPOSITORY + '/' + TRIGGER_PATH,
                '--signer-digest', args.source, '--source-digest', args.source, '--source-ref', 'refs/heads/main', '--deny-self-hosted-runners')
    require(api('git/ref/heads/main')['object']['sha'] == args.source, 'Pages source advanced before build')
    with pathlib.Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
        output.write('authorized=true\nsource=' + args.source + '\n')
    print('Published release, exact source, all nine qualification workflows and complete attested asset inventory authenticated for Pages.')


if __name__ == '__main__': main()
