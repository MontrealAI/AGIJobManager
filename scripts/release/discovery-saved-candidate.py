"""Consume one source-bound saved candidate; execute only its authenticated installed code."""
import argparse
import io
import json
import os
import pathlib
import re
import runpy
import shutil
import stat
import subprocess
import tempfile
import time
import zipfile
from release_common import REPOSITORY, TAG, DISCOVERY_PROFILE, BUILDER_ASSETS, LIMIT, require, sha, verify_assets

ROOT = pathlib.Path(__file__).resolve().parents[2]
MISSION_FILES = {'native-evidence.json', 'original-request.json', 'raw-receipt.json',
                  'receipt-wrapper.json', 'workspace-before.json', 'workspace-after.json',
                  'docket.json', 'docket-reopened.json'}
EVIDENCE_FILES = MISSION_FILES | {'regression/' + name for name in MISSION_FILES}


def candidate_record(api, source):
    """Select the latest original producer on this exact source, never a failed older run."""
    identity = api('actions/workflows/current-state-release.yml')
    require(identity.get('path') == '.github/workflows/current-state-release.yml', 'Candidate workflow differs')
    runs = api(f'actions/workflows/{identity["id"]}/runs?head_sha={source}&per_page=100')['workflow_runs']
    matches = sorted((run for run in runs if run.get('head_sha') == source
        and run.get('event') in ('push', 'pull_request')), key=lambda item: item['id'], reverse=True)
    if not matches:
        return None
    run = matches[0]
    require(run.get('repository', {}).get('full_name') == REPOSITORY
            and run.get('head_repository', {}).get('full_name') == REPOSITORY
            and run.get('workflow_id') == identity['id'], 'Candidate run source repository differs')
    if run.get('status') != 'completed':
        return None
    require(run.get('conclusion') == 'success', 'Original saved candidate producer did not succeed')
    artifacts = []
    for page in range(1, 11):
        batch = api(f'actions/runs/{run["id"]}/artifacts?per_page=100&page={page}')['artifacts']
        artifacts.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise ValueError('Candidate artifact inventory is unbounded')
    matches = [item for item in artifacts if item.get('name') == f'AGIJobManager-{TAG}-candidate-{source}']
    require(len(matches) == 1, 'Saved candidate artifact missing or duplicated')
    artifact = matches[0]
    require(artifact.get('expired') is False and type(artifact.get('id')) is int
            and artifact['id'] > 0 and type(artifact.get('size_in_bytes')) is int
            and 0 < artifact['size_in_bytes'] < LIMIT
            and re.fullmatch('sha256:[0-9a-f]{64}', artifact.get('digest', ''))
            and artifact.get('workflow_run', {}).get('id') == run['id']
            and artifact.get('workflow_run', {}).get('head_sha') == source, 'Candidate artifact source/digest differs')
    return artifact


def candidate_assets(raw, artifact, destination):
    """Authenticate the actual transport ZIP before bounded CRC-checked extraction."""
    require(len(raw) == artifact['size_in_bytes'] and len(raw) < LIMIT
            and 'sha256:' + sha(raw) == artifact['digest'], 'Downloaded candidate artifact differs')
    allowed = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html',
               'RELEASE_MANIFEST.json', 'SHA256SUMS.txt'} | BUILDER_ASSETS
    destination = pathlib.Path(destination)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) == len(allowed) and {item.filename for item in entries} == allowed
                and sum(item.file_size for item in entries) < LIMIT, 'Saved candidate transport inventory differs')
        for item in entries:
            mode = item.external_attr >> 16
            require(not item.is_dir() and stat.S_IFMT(mode) in (0, stat.S_IFREG)
                    and 0 < item.file_size < LIMIT, 'Saved candidate transport has unsupported entry')
            data = archive.read(item)  # ZIP CRC checked before the file becomes an installed input.
            require(len(data) == item.file_size, 'Candidate transport member size differs')
            (destination / item.filename).write_bytes(data)
    return verify_assets(destination)


def extract_installed(assets, source, source_tree, destination):
    """Use the real package inclusion and raw identity checks before installed execution."""
    verifier = runpy.run_path(str(ROOT / 'scripts/release/verify-package.py'))
    manifest_raw = (assets / 'RELEASE_MANIFEST.json').read_bytes()
    manifest = json.loads(manifest_raw)
    require(manifest.get('sourceCommit') == source and manifest.get('sourceTree') == source_tree
            and manifest.get('releaseProfile') == DISCOVERY_PROFILE, 'Saved candidate release identity differs')
    with zipfile.ZipFile(assets / f'AGIJobManager-{TAG}-COMPLETE.zip') as archive:
        prefix = verifier['archive_inventory'](archive, manifest)
        for item in archive.infolist():
            name = item.filename[len(prefix):]
            raw = archive.read(item)
            if name == 'RELEASE_MANIFEST.json':
                require(raw == manifest_raw, 'Saved release embedded manifest differs')
            else:
                metadata = manifest['files'][name]
                require(metadata == {'sha256': sha(raw), 'bytes': len(raw), 'mode': item.external_attr >> 16},
                        'Installed saved release member differs: ' + name)
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if stat.S_ISLNK(item.external_attr >> 16):
                require(name == 'source/hardhat/contracts' and raw == b'../contracts', 'Unsupported saved source symlink')
                target.symlink_to('../contracts', target_is_directory=True)
            else:
                target.write_bytes(raw)
                target.chmod((item.external_attr >> 16) & 0o777)
    policy = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))
    selection = manifest['releasePolicy']
    # Compare with the current source's externally reviewed finite selector before invoking saved code.
    require(selection == policy['select'](manifest=policy['MANIFEST'],
        manifest_sha256=sha((ROOT / policy['MANIFEST']).read_bytes()),
        verifier_sha256=sha((ROOT / policy['VERIFIER']).read_bytes())), 'Saved candidate source policy differs')
    policy['validate_source'](destination / 'source', selection)
    policy['validate_alpha_capsule'](destination / 'source', destination / policy['CAPSULE'])
    return manifest


def run_saved(raw, artifact, source, source_tree, output):
    output = pathlib.Path(output).resolve()
    require(not output.exists(), 'Native evidence output must be absent')
    node = shutil.which('node')
    require(node is not None, 'The explicitly pinned Node runtime is required')
    with tempfile.TemporaryDirectory(prefix='manager-saved-native-') as folder:
        temporary = pathlib.Path(folder)
        assets, installed = temporary / 'assets', temporary / 'installed'
        assets.mkdir(); installed.mkdir()
        digests = candidate_assets(raw, artifact, assets)
        extract_installed(assets, source, source_tree, installed)
        archive_sha = digests[f'AGIJobManager-{TAG}-COMPLETE.zip']
        policy = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))
        browser_input = policy['validate_browser_capsule'](installed / 'source', installed / 'discovery-browser')
        browser_root = installed / 'discovery-browser/discovery-continuation'
        workspace_path, request_path = browser_root / 'fleet-browser-workspace.json', browser_root / 'fleet-browser-request.json'
        require(sha(workspace_path.read_bytes()) == browser_input['workspaceSha256']
            and sha(request_path.read_bytes()) == browser_input['requestSha256'],
            'Saved candidate does not retain the original Alpha UI bytes')
        context = {'sourceCommit': source, 'sourceTree': source_tree, 'candidateArchiveSha256': archive_sha,
            'browserInput': browser_input}
        context_path = temporary / 'source-context.json'
        context_path.write_text(json.dumps(context) + '\n')
        # The saved runtime uses only owned bytes; no Git, Python, network tool or external checkout is available here.
        environment = {**os.environ, 'PATH': '', 'NODE_OPTIONS': '', 'NODE_PATH': ''}
        result = subprocess.run([node, str(installed / 'source/scripts/integrations/discovery-release-native-test.mjs'),
            '--installed', str(installed / 'discovery-alpha'), str(context_path), str(output),
            str(workspace_path), str(request_path), browser_input['campaignDigest']],
            env=environment, capture_output=True, timeout=180)
        require(result.returncode == 0, 'Actual saved-archive native acceptance failed: ' + result.stderr.decode(errors='replace')[-3000:])
    require({item.relative_to(output).as_posix() for item in output.rglob('*') if item.is_file() or item.is_symlink()} == EVIDENCE_FILES, 'Native evidence file inventory differs')
    files = {}
    for name in sorted(EVIDENCE_FILES):
        item = output / name
        require(item.is_file() and not item.is_symlink() and item.stat().st_size <= 2_000_000, 'Native raw evidence is unbounded')
        data = item.read_bytes(); files[name] = {'bytes': len(data), 'sha256': sha(data)}
    require(sum(item['bytes'] for item in files.values()) <= 16 * 1024 * 1024, 'Native raw evidence expansion is unbounded')
    evidence = json.loads((output / 'native-evidence.json').read_bytes())
    require(evidence['node'] == 'v' + os.environ['DISCOVERY_MATRIX_NODE'], 'Actual saved native runtime differs from its pinned matrix')
    custody = {'schema': 'manager/discovery-saved-native-custody/v1', 'profile': DISCOVERY_PROFILE,
        'sourceCommit': source, 'sourceTree': source_tree, 'node': evidence['node'],
        'runId': int(os.environ['GITHUB_RUN_ID']), 'runAttempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
        'candidateArtifactId': artifact['id'], 'candidateArtifactDigest': artifact['digest'],
        'candidateArchiveSha256': archive_sha, 'browserInput': browser_input, 'files': files}
    (output / 'custody.json').write_text(json.dumps(custody, indent=2) + '\n')
    marker_values = {'ALPHA_COMMIT': evidence['alphaCommit'], 'ALPHA_TREE': evidence['alphaTree'],
        'SOURCE_HASH': evidence['sourceHash'], 'NODE': evidence['node'],
        'ADAPTER_SHA256': sha((ROOT / 'scripts/integrations/discovery-lab-work-request.mjs').read_bytes()),
        'CONTRACT_SHA256': sha((ROOT / 'scripts/integrations/discovery-lab-contract.mjs').read_bytes()),
        'RUNNER_SHA256': sha((ROOT / 'scripts/integrations/discovery-release-native-test.mjs').read_bytes()),
        'EVIDENCE_SHA256': files['native-evidence.json']['sha256']}
    for key, value in marker_values.items():
        print('DISCOVERY_NATIVE_' + key + '=' + value)
    return custody


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    options = parser.parse_args()
    require(re.fullmatch('[0-9a-f]{40}', options.source), 'Exact source commit required')
    def api(endpoint):
        result = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/{endpoint}', '--method', 'GET'],
                                capture_output=True, timeout=60)
        require(result.returncode == 0, 'Saved candidate metadata request failed (response withheld)')
        return json.loads(result.stdout)
    deadline = time.monotonic() + 2700
    while True:
        artifact = candidate_record(api, options.source)
        if artifact is not None:
            break
        require(time.monotonic() + 30 < deadline, 'Original candidate did not finish within the bounded wait')
        print('Waiting for the original exact-source saved candidate.', flush=True)
        time.sleep(30)
    custody = runpy.run_path(str(ROOT / 'scripts/release/discovery-qualification.py'))
    raw = custody['download_native_artifact'](artifact, maximum=LIMIT)
    run_saved(raw, artifact, options.source, api(f'git/commits/{options.source}')['tree']['sha'], options.output)


if __name__ == '__main__':
    main()
