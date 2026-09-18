"""Verify release evidence; publish only with --publish from the main push workflow."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import time
from urllib.parse import quote

root = pathlib.Path(__file__).resolve().parents[2]
meta = root / 'docs/releases/v1.0.0'
config = json.loads((meta / 'release.json').read_text())
repo, tag, source = (config[k] for k in ['repository', 'tag', 'sourceCommit'])
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--publish', action='store_true')
args = parser.parse_args()


def gh(*command, data=None, timeout=180):
    try:
        return subprocess.run(['gh', *command], cwd=root, input=data, capture_output=True, text=True, check=True, timeout=timeout).stdout
    except subprocess.TimeoutExpired:
        print(f'GitHub request timed out after {timeout} seconds.', flush=True)
        raise
    except subprocess.CalledProcessError as error:
        # Keep the HTTP failure visible without exposing redirected signed URLs.
        detail = re.sub(r'https?://\S+', '[URL]', error.stderr or '')
        print(f'GitHub request failed (exit {error.returncode}): {detail.strip()[:800]}', flush=True)
        raise


def api(endpoint, method='GET', body=None):
    command = ['api', f'repos/{repo}/{endpoint}', '--method', method]
    if body is not None:
        command += ['--input', '-']
    return json.loads(gh(*command, data=json.dumps(body) if body is not None else None))


def optional_get(endpoint):
    try:
        return api(endpoint)
    except subprocess.CalledProcessError as error:
        if 'HTTP 404' in error.stderr:
            return None
        raise


def wait_for(endpoint, predicate):
    # Read by ID, never rediscover a newly created draft through the release list.
    for attempt in range(6):
        value = optional_get(endpoint)
        if value is not None and predicate(value):
            return value
        if attempt < 5:
            time.sleep(2 ** attempt)
    raise RuntimeError(f'GitHub did not confirm the expected state: {endpoint}')


def tag_target(ref):
    obj = ref['object']
    for _ in range(5):
        if obj['type'] == 'commit':
            return obj['sha']
        assert obj['type'] == 'tag', 'Unexpected tag object type.'
        obj = api(f'git/tags/{obj["sha"]}')['object']
    raise RuntimeError('Unexpected nested tag depth.')


def release_assets(release_id):
    # The release object's assets field can omit failed starter records.
    assets, page = [], 1
    while True:
        batch = api(f'releases/{release_id}/assets?per_page=100&page={page}')
        assets.extend(batch)
        if len(batch) < 100:
            return assets
        page += 1


def upload_asset(release, file, digest):
    """Upload by known draft ID; reconcile ambiguous responses before retrying."""
    endpoint = f'releases/{release["id"]}'
    upload_url = release['upload_url'].split('{', 1)[0]
    assert upload_url == f'https://uploads.github.com/repos/{repo}/releases/{release["id"]}/assets', 'Unexpected release upload endpoint.'
    name, size = file.name, file.stat().st_size
    expected_digest = 'sha256:' + digest
    content_type = {'.zip': 'application/zip', '.html': 'text/html',
                    '.json': 'application/json', '.txt': 'text/plain'}[file.suffix]

    def verify_asset(asset):
        assert asset['name'] == name and asset['size'] == size and asset['state'] == 'uploaded', 'Uploaded asset identity or state differs.'
        assert asset.get('digest') == expected_digest, 'Existing asset differs; refusing to replace.'
        return asset

    def require_same_draft():
        current = api(endpoint)
        assert current['id'] == release['id'] and current['draft'], 'Upload requires the same unpublished draft.'
        assert current['tag_name'] == tag and current['target_commitish'] == source, 'Draft source identity changed.'

    def find_uploaded():
        require_same_draft()
        matches = [asset for asset in release_assets(release['id']) if asset['name'] == name]
        assert len(matches) <= 1, 'Duplicate draft asset names.'
        if not matches:
            return None
        asset = matches[0]
        if asset['state'] != 'starter' or asset.get('digest') is not None:
            return verify_asset(asset)
        # GitHub documents starter records after a failed 502 upload as safe to
        # delete. Re-read its exact ID and the draft before this narrow cleanup;
        # a completed upload is reused only if its size and digest match.
        asset_id = asset['id']
        assert type(asset_id) is int and asset_id > 0, 'Invalid starter asset ID.'
        fresh = api(f'releases/assets/{asset_id}')
        assert fresh['id'] == asset_id and fresh['name'] == name, 'Starter asset identity changed.'
        if fresh['state'] != 'starter' or fresh.get('digest') is not None:
            return verify_asset(fresh)
        require_same_draft()
        print(f'Removing failed starter from draft {release["id"]}: {name} (asset {asset_id})', flush=True)
        gh('api', f'repos/{repo}/releases/assets/{asset_id}', '--method', 'DELETE')
        remaining = [item for item in release_assets(release['id']) if item['name'] == name]
        assert not remaining, 'Failed starter cleanup was not confirmed; refusing another upload.'
        return None

    for attempt in range(3):
        existing = find_uploaded()
        if existing is not None:
            print(f'Confirmed existing asset: {name} ({size} bytes)', flush=True)
            return existing
        print(f'Uploading asset: {name} ({size} bytes; attempt {attempt + 1}/3)', flush=True)
        try:
            uploaded = json.loads(gh('api', upload_url + '?name=' + quote(name, safe=''),
                                     '--method', 'POST', '--input', str(file),
                                     '--header', 'Content-Type: ' + content_type, timeout=180))
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            # A lost response can follow a successful upload. Never repeat the
            # POST until the exact draft has been inspected for that asset.
            existing = find_uploaded()
            if existing is not None:
                print(f'Confirmed uploaded asset after transport failure: {name} ({size} bytes)', flush=True)
                return existing
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
            continue
        return verify_asset(uploaded)
    raise RuntimeError('Release asset upload exhausted its attempts.')


assert os.environ.get('GITHUB_REPOSITORY') == repo, 'Repository identity mismatch.'
required_workflows = {'ci.yml', 'ui.yml', 'docs.yml', 'security-verification.yml', 'mainnet-fork.yml'}
assert {item['workflow'] for item in config['requiredSourceRuns'].values()} == required_workflows, 'The five application qualification workflows are required.'
assert len(config['requiredSourceRuns']) == len(required_workflows), 'Duplicate source qualification workflows.'
evidence = json.loads((meta / 'SOURCE_CI.json').read_text())
assert evidence['sourceCommit'] == source and evidence['sourceTree'] == config['sourceTree']
assert evidence['checkoutCommit'] == source, 'Qualification must check out the frozen source commit itself.'
checkout = api(f'git/commits/{evidence["checkoutCommit"]}')
assert checkout['tree']['sha'] == config['sourceTree'], 'CI checkout tree differs from the frozen application.'
for item in config['requiredSourceRuns'].values():
    run = api(f'actions/runs/{item["id"]}')
    assert run['repository']['full_name'] == repo
    assert run['head_sha'] == source
    assert run['path'] == '.github/workflows/' + item['workflow']
    assert run['status'] == 'completed' and run['conclusion'] == 'success'
    jobs = []
    page = 1
    while True:
        batch = api(f'actions/runs/{item["id"]}/jobs?per_page=100&page={page}')['jobs']
        jobs.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    assert {job['name'] for job in jobs} == set(item['requiredJobs']), 'Required source jobs differ.'
    assert len(jobs) == len(item['requiredJobs']) and all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs), 'Every required source job must succeed.'
    for job in jobs:
        checks = [step for step in job.get('steps', []) if step['name'] == 'Verify qualified source checkout']
        assert len(checks) == 1 and checks[0]['status'] == 'completed' and checks[0]['conclusion'] == 'success', 'Every source job must verify its actual checkout.'
        # The dedicated step prints git rev-parse HEAD after checking the expected
        # source. Anchor the emitted line so echoed shell commands cannot qualify.
        # Actions logs contain ANSI escapes. Permit them only in this captured
        # response for parsing; never render the raw log content to a terminal.
        logs = gh('api', f'repos/{repo}/actions/jobs/{job["id"]}/logs', '--method', 'GET', '--allow-escape-sequences')
        observed = re.findall(r'^(?:\d{4}-\d{2}-\d{2}T\S+[ \t]+)?QUALIFIED_SOURCE_COMMIT=([0-9a-f]{40})[ \t]*\r?$', logs, re.MULTILINE)
        assert observed == [source], f'Checkout log evidence differs or is missing for job {job["name"]}.'
    print(f'Confirmed source CI evidence: {run["name"]} at {source} ({run["html_url"]})')
if not args.publish:
    raise SystemExit(0)
assert os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires a main push.'
subprocess.run(['git', 'merge-base', '--is-ancestor', source, 'HEAD'], cwd=root, check=True)
changes = subprocess.check_output(['git', 'diff', '--name-only', source, 'HEAD'], cwd=root, text=True).splitlines()
assert changes and all(p.startswith(('docs/releases/v1.0.0/', 'scripts/release/')) or p == '.github/workflows/current-state-release.yml' for p in changes), 'Release preparation must not change the frozen application.'
out = root / 'build/release/v1.0.0'
expected = {}
for line in (out / 'SHA256SUMS.txt').read_text().splitlines():
    digest, name = line.split('  ', 1)
    assert pathlib.Path(name).name == name and name not in expected
    assert hashlib.sha256((out / name).read_bytes()).hexdigest() == digest
    expected[name] = digest
expected['SHA256SUMS.txt'] = hashlib.sha256((out / 'SHA256SUMS.txt').read_bytes()).hexdigest()
assert set(expected) == {'AGIJobManager-v1.0.0-COMPLETE.zip', pathlib.Path(config['primaryUI']).name, 'RELEASE_MANIFEST.json', 'SHA256SUMS.txt'}
assert {p.name for p in out.iterdir()} == set(expected), 'Unexpected local release assets.'
matches = []
page = 1
while True:
    releases = api(f'releases?per_page=100&page={page}')
    matches.extend(r for r in releases if r['tag_name'] == tag)
    if len(releases) < 100:
        break
    page += 1
assert len(matches) <= 1, 'Multiple releases have this tag.'
notes = (meta / 'RELEASE_NOTES.md').read_text()
if matches:
    existing = matches[0]
    assert existing['draft'], 'Published releases are immutable by policy; refusing to edit.'
    assert existing['name'] == config['name'] and existing['target_commitish'] == source
    assert existing['body'].strip() == notes.strip()
    existing['assets'] = release_assets(existing['id'])
    assets = {a['name']: a for a in existing['assets']}
    assert len(assets) == len(existing['assets']), 'Duplicate existing draft assets.'
    assert not set(assets) - set(expected), 'Unexpected existing draft assets.'
    for name, asset in assets.items():
        if asset['state'] == 'starter' and asset.get('digest') is None:
            continue  # The upload helper verifies and removes only this failed state.
        assert asset.get('digest') == 'sha256:' + expected[name], 'Existing asset differs; refusing to replace.'
ref = optional_get(f'git/ref/tags/{tag}')
if ref:
    assert tag_target(ref) == source, 'Existing tag differs; refusing to move it.'
else:
    assert not matches, 'Existing draft has no pinned tag.'
    annotation = api('git/tags', 'POST', {
        'tag': tag, 'message': config['name'] + '\n\nFrozen application commit: ' + source,
        'object': source, 'type': 'commit',
        'tagger': {'name': 'github-actions[bot]', 'email': '41898282+github-actions[bot]@users.noreply.github.com', 'date': config['releaseDate'] + 'T00:00:00Z'}
    })
    api('git/refs', 'POST', {'ref': f'refs/tags/{tag}', 'sha': annotation['sha']})
if matches:
    release = matches[0]
else:
    release = api('releases', 'POST', {'tag_name': tag, 'target_commitish': source, 'name': config['name'], 'body': notes, 'draft': True, 'prerelease': False, 'make_latest': 'false'})
release_endpoint = f'releases/{release["id"]}'
assert release['draft'] and release['tag_name'] == tag
for name in expected:
    upload_asset(release, out / name, expected[name])
wanted = {name: 'sha256:' + digest for name, digest in expected.items()}
wait_for(release_endpoint, lambda r: {a['name']: a.get('digest') for a in r['assets']} == wanted)
api(release_endpoint, 'PATCH', {'draft': False, 'prerelease': False, 'make_latest': 'true'})
release = wait_for(release_endpoint, lambda r: not r['draft'] and not r['prerelease'])
assert tag_target(api(f'git/ref/tags/{tag}')) == source
assert {a['name']: a.get('digest') for a in release['assets']} == wanted
print(release['html_url'])
