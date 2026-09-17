"""Verify release evidence; publish only with --publish from the main push workflow."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import time

root = pathlib.Path(__file__).resolve().parents[2]
meta = root / 'docs/releases/v0.9.0'
config = json.loads((meta / 'release.json').read_text())
repo, tag, source = (config[k] for k in ['repository', 'tag', 'sourceCommit'])
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--publish', action='store_true')
args = parser.parse_args()


def gh(*command, data=None):
    return subprocess.run(['gh', *command], cwd=root, input=data, capture_output=True, text=True, check=True).stdout


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


assert os.environ.get('GITHUB_REPOSITORY') == repo, 'Repository identity mismatch.'
required_workflows = {'ci.yml', 'ui.yml', 'docs.yml', 'security-verification.yml', 'mainnet-fork.yml'}
assert {item['workflow'] for item in config['requiredSourceRuns'].values()} == required_workflows, 'The five application qualification workflows are required.'
assert len(config['requiredSourceRuns']) == len(required_workflows), 'Duplicate source qualification workflows.'
evidence = json.loads((meta / 'SOURCE_CI.json').read_text())
assert evidence['sourceCommit'] == source and evidence['sourceTree'] == config['sourceTree']
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
    print(f'Confirmed source CI evidence: {run["name"]} at {source} ({run["html_url"]})')
if not args.publish:
    raise SystemExit(0)
assert os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires a main push.'
subprocess.run(['git', 'merge-base', '--is-ancestor', source, 'HEAD'], cwd=root, check=True)
changes = subprocess.check_output(['git', 'diff', '--name-only', source, 'HEAD'], cwd=root, text=True).splitlines()
assert changes and all(p.startswith(('docs/releases/v0.9.0/', 'scripts/release/')) or p == '.github/workflows/current-state-release.yml' for p in changes), 'Release preparation must not change the frozen application.'
out = root / 'build/release/v0.9.0'
expected = {}
for line in (out / 'SHA256SUMS.txt').read_text().splitlines():
    digest, name = line.split('  ', 1)
    assert pathlib.Path(name).name == name and name not in expected
    assert hashlib.sha256((out / name).read_bytes()).hexdigest() == digest
    expected[name] = digest
expected['SHA256SUMS.txt'] = hashlib.sha256((out / 'SHA256SUMS.txt').read_bytes()).hexdigest()
assert set(expected) == {'AGIJobManager-v0.9.0-COMPLETE.zip', pathlib.Path(config['primaryUI']).name, 'RELEASE_MANIFEST.json', 'SHA256SUMS.txt'}
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
    assets = {a['name']: a for a in existing['assets']}
    assert not set(assets) - set(expected), 'Unexpected existing draft assets.'
    for name, asset in assets.items():
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
assets = {a['name']: a for a in release['assets']}
for name in expected:
    if name not in assets:
        for attempt in range(6):
            try:
                gh('release', 'upload', tag, str(out / name), '--repo', repo)
                break
            except subprocess.CalledProcessError as error:
                # A just-created draft can briefly be absent from tag lookup.
                if attempt == 5 or not any(t in error.stderr for t in ['HTTP 404', 'release not found']):
                    raise
                time.sleep(2 ** attempt)
wanted = {name: 'sha256:' + digest for name, digest in expected.items()}
wait_for(release_endpoint, lambda r: {a['name']: a.get('digest') for a in r['assets']} == wanted)
api(release_endpoint, 'PATCH', {'draft': False, 'prerelease': False, 'make_latest': 'true'})
release = wait_for(release_endpoint, lambda r: not r['draft'] and not r['prerelease'])
assert tag_target(api(f'git/ref/tags/{tag}')) == source
assert {a['name']: a.get('digest') for a in release['assets']} == wanted
print(release['html_url'])
