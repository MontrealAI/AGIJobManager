"""Publish exact-source qualification after confirmed manual or bounded completion authorization."""
import argparse
import runpy
import hashlib
import json
import os
import pathlib
import re
import subprocess
import time
import tempfile
from urllib.parse import quote
from release_common import REPOSITORY, TAG, TITLE, require, validate_qualification, verify_assets, github_release_notes

root = pathlib.Path(__file__).resolve().parents[2]
meta = root / 'docs/releases' / TAG
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--qualification', type=pathlib.Path, required=True)
parser.add_argument('--assets', type=pathlib.Path, required=True)
parser.add_argument('--publish', action='store_true')
policy = runpy.run_path(str(pathlib.Path(__file__).with_name('package-policy.py')))
policy['add_selection_arguments'](parser)
args = parser.parse_args()
source_policy = policy['select'](args.profile, manifest=args.manifest, manifest_sha256=args.manifest_sha256, verifier_sha256=args.verifier_sha256, schema_sha256=args.schema_sha256, published=True)
profile_args = ['--profile', args.profile]
for option in ('manifest', 'manifest_sha256', 'verifier_sha256', 'schema_sha256'):
    value = getattr(args, option)
    if value is not None:
        profile_args.extend(['--' + option.replace('_', '-'), value])
config = json.loads(args.qualification.read_text())
repo, tag, source = REPOSITORY, TAG, config['sourceCommit']
require(config.get('sourcePolicy') == source_policy, 'Publisher release policy differs from qualification')

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
        if not (obj['type'] == 'tag'): raise AssertionError('Unexpected tag object type.')
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
    if not (upload_url == f'https://uploads.github.com/repos/{repo}/releases/{release["id"]}/assets'): raise AssertionError('Unexpected release upload endpoint.')
    name, size = file.name, file.stat().st_size
    expected_digest = 'sha256:' + digest
    content_type = {'.zip': 'application/zip', '.html': 'text/html',
                    '.json': 'application/json', '.txt': 'text/plain'}[file.suffix]

    def verify_asset(asset):
        if not (asset['name'] == name and asset['size'] == size and asset['state'] == 'uploaded'): raise AssertionError('Uploaded asset identity or state differs.')
        if not (asset.get('digest') == expected_digest): raise AssertionError('Existing asset differs; refusing to replace.')
        return asset

    def require_same_draft():
        current = api(endpoint)
        if not (current['id'] == release['id'] and current['draft']): raise AssertionError('Upload requires the same unpublished draft.')
        if not (current['tag_name'] == tag and current['target_commitish'] == source): raise AssertionError('Draft source identity changed.')

    def find_uploaded():
        require_same_draft()
        matches = [asset for asset in release_assets(release['id']) if asset['name'] == name]
        if not (len(matches) <= 1): raise AssertionError('Duplicate draft asset names.')
        if not matches:
            return None
        asset = matches[0]
        if asset['state'] != 'starter' or asset.get('digest') is not None:
            return verify_asset(asset)
        # GitHub documents starter records after a failed 502 upload as safe to
        # delete. Re-read its exact ID and the draft before this narrow cleanup;
        # a completed upload is reused only if its size and digest match.
        asset_id = asset['id']
        if not (type(asset_id) is int and asset_id > 0): raise AssertionError('Invalid starter asset ID.')
        fresh = api(f'releases/assets/{asset_id}')
        if not (fresh['id'] == asset_id and fresh['name'] == name): raise AssertionError('Starter asset identity changed.')
        if fresh['state'] != 'starter' or fresh.get('digest') is not None:
            return verify_asset(fresh)
        require_same_draft()
        print(f'Removing failed starter from draft {release["id"]}: {name} (asset {asset_id})', flush=True)
        gh('api', f'repos/{repo}/releases/assets/{asset_id}', '--method', 'DELETE')
        remaining = [item for item in release_assets(release['id']) if item['name'] == name]
        if not (not remaining): raise AssertionError('Failed starter cleanup was not confirmed; refusing another upload.')
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


require(os.environ.get('GITHUB_REPOSITORY') == repo, 'Repository identity mismatch')
validate_qualification(config, api, lambda job_id: gh('api', f'repos/{repo}/actions/jobs/{job_id}/logs', '--method', 'GET', '--allow-escape-sequences'), publication=True)
out = args.assets.resolve()
require((out / 'QUALIFICATION.json').read_bytes() == args.qualification.read_bytes(), 'Asset qualification differs')
expected = verify_assets(out, config)
require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() == source, 'Publisher must execute exact qualified source')
require(subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=root, text=True).strip() == config['sourceTree'], 'Publisher tree differs')
require(not subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root).strip(), 'Publisher tracked source is dirty')
candidate = config.get('candidateArtifact', {})
require(type(candidate.get('id')) is int and candidate['id'] > 0, 'Missing candidate artifact identity')
artifact = api(f'actions/artifacts/{candidate["id"]}')
require(all(artifact.get(k) == candidate.get(k) for k in ['id', 'name', 'digest', 'size_in_bytes']), 'Candidate artifact identity/digest differs')
require(not artifact['expired'] and artifact['name'] == f'AGIJobManager-{tag}-candidate-{source}', 'Candidate artifact is unavailable or wrongly named')
require(artifact['workflow_run']['id'] == config['requiredSourceRuns']['current-state-release.yml']['id'] and artifact['workflow_run']['head_sha'] == source, 'Candidate artifact is from another run/source')
with tempfile.TemporaryDirectory(prefix='v114-publication-rebuild-') as temp:
    rebuilt = pathlib.Path(temp) / 'assets'
    subprocess.run(['python3', 'scripts/release/package-release.py', '--out', str(rebuilt), *profile_args], cwd=root, check=True)
    actual = verify_assets(rebuilt)
    require(config['artifactDigests'] == {n: d for n, d in actual.items() if n != 'SHA256SUMS.txt'}, 'Candidate bytes differ from deterministic exact-source rebuild')
if not args.publish:
    raise SystemExit(0)
runpy.run_path(str(pathlib.Path(__file__).with_name('publication-authorization.py')))['authorize'](os.environ, source, api)
require(config.get('publicationAuthorized') is True, 'Publication authorization is missing')
require(api('git/ref/heads/main')['object']['sha'] == source, 'Main advanced since qualification; requalify before publishing')
matches = []
page = 1
while True:
    releases = api(f'releases?per_page=100&page={page}')
    matches.extend(r for r in releases if r['tag_name'] == tag)
    if len(releases) < 100:
        break
    page += 1
if not (len(matches) <= 1): raise AssertionError('Multiple releases have this tag.')
manifest = json.loads((out / 'RELEASE_MANIFEST.json').read_text())
notes = github_release_notes((meta / 'RELEASE_NOTES.md').read_bytes(), f'docs/releases/{tag}/RELEASE_NOTES.md', manifest['files'])
if matches:
    existing = matches[0]
    if not (existing['draft']): raise AssertionError('Published releases are immutable by policy; refusing to edit.')
    if not (existing['name'] == config['name'] and existing['target_commitish'] == source): raise AssertionError('Release invariant failed')
    if not (existing['body'].strip() == notes.strip()): raise AssertionError('Release invariant failed')
    existing['assets'] = release_assets(existing['id'])
    assets = {a['name']: a for a in existing['assets']}
    if not (len(assets) == len(existing['assets'])): raise AssertionError('Duplicate existing draft assets.')
    if not (not set(assets) - set(expected)): raise AssertionError('Unexpected existing draft assets.')
    for name, asset in assets.items():
        if asset['state'] == 'starter' and asset.get('digest') is None:
            continue  # The upload helper verifies and removes only this failed state.
        if not (asset.get('digest') == 'sha256:' + expected[name]): raise AssertionError('Existing asset differs; refusing to replace.')
ref = optional_get(f'git/ref/tags/{tag}')
if ref:
    if not (tag_target(ref) == source): raise AssertionError('Existing tag differs; refusing to move it.')
else:
    if not (not matches): raise AssertionError('Existing draft has no pinned tag.')
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
if not (release['draft'] and release['tag_name'] == tag): raise AssertionError('Release invariant failed')
for name in expected:
    upload_asset(release, out / name, expected[name])
wanted = {name: 'sha256:' + digest for name, digest in expected.items()}
wait_for(release_endpoint, lambda r: {a['name']: a.get('digest') for a in r['assets']} == wanted)
# Check mutable remote identities once more immediately before public visibility.
require(tag_target(api(f'git/ref/tags/{tag}')) == source, 'Tag changed during upload; refusing publication')
fresh = api(release_endpoint)
require(fresh['id'] == release['id'] and fresh['draft'] and fresh['tag_name'] == tag and fresh['target_commitish'] == source and fresh['name'] == TITLE and fresh['body'].strip() == notes.strip(), 'Draft changed during upload; refusing publication')
fresh_assets = release_assets(release['id'])
require(len(fresh_assets) == len(wanted) and {a['name']: a.get('digest') for a in fresh_assets} == wanted, 'Draft assets changed before publication')
require(api('git/ref/heads/main')['object']['sha'] == source, 'Main advanced during publication')
validate_qualification(config, api, lambda job_id: gh('api', f'repos/{repo}/actions/jobs/{job_id}/logs', '--method', 'GET', '--allow-escape-sequences'), publication=True)
api(release_endpoint, 'PATCH', {'draft': False, 'prerelease': False, 'make_latest': 'true'})
release = wait_for(release_endpoint, lambda r: not r['draft'] and not r['prerelease'])
if not (tag_target(api(f'git/ref/tags/{tag}')) == source): raise AssertionError('Release invariant failed')
if not ({a['name']: a.get('digest') for a in release['assets']} == wanted): raise AssertionError('Release invariant failed')
print(release['html_url'])
