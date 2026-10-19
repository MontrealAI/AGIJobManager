"""Finite source corrections over immutable v1.19.3; qualification is separate."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import runpy
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILE = 'manager-boundary-corrections-v1'
MANIFEST = 'config/manager-boundary-corrections-v1.json'
VERIFIER = 'scripts/release/correction-profile.py'
BASE = 'd0c2cbaf58b594e20d888c3fc744bada06172306'
TREE = '09de3f32ae89416f764b508e0147457ca8b54d9d'
VERSION = '1.19.4'
PREVIOUS_PINS = {
    'scripts/release/release-profile.py': 'e9cf1587c0862b848af5c866ae0254be237461967ce3b9ac5513f59a1fa0d82f',
    'config/explicit-governor-release-v1.json': '8aeecb2c45338ed1a3fd79a8030974ffe2462b038de215b84e2c406ded48d4fa',
    'scripts/release/release_common.py': 'e4ba17be0398e47e2165f76be7ebe650190dc9f93f0807c0d6435485656f2440',
}
for name, digest in PREVIOUS_PINS.items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
        raise ValueError('Immutable previous policy input differs: ' + name)
from release_common import require, sha, strict_json, REPOSITORY, TITLE, valid_sha
PREVIOUS = runpy.run_path(str(ROOT / 'scripts/release/release-profile.py'))
read = PREVIOUS['read']
git = PREVIOUS['git']
HISTORICAL_ONLY = {
    'scripts/release/release-profile.py', 'scripts/release/release_common.py',
    'scripts/release/test-release-profile.py', 'scripts/release/run-inherited-source-tests.py',
    'scripts/release/run-release-preservation.py',
    'config/mainnet/manager-8815-2026-10-17.json',
    'docs/deployments/MAINNET_MANAGER_2026-10-17.md',
    'docs/deployments/MAINNET_USDC_2026-10-10.md',
}
ALLOWED = {name for name in PREVIOUS['ALLOWED'] if name not in HISTORICAL_ONLY
    and not name.startswith(('docs/releases/', 'docs/qualification/', 'scripts/security/slither-reviewed-findings-v'))} | {
    'hardhat/scripts/ephemeral-key.cjs', 'hardhat/test/ephemeral-key.test.cjs',
    'docs/deployment/ubuntu-ephemeral-creator.md',
    'site/assets/successor/jobs.mjs', 'site/assets/successor/missions.mjs', 'site/assets/successor/app.mjs', 'site/successor.mjs',
    'scripts/successor/core.test.mjs', 'scripts/successor/portable.test.mjs',
    'scripts/successor/alpha-project-browser-test.mjs', 'docs/successor/ALPHA_PROJECT_HANDOFF.md',
    'config/successor-builder-source.json', '.github/workflows/alpha-project-handoff.yml',
    'scripts/integrations/four-repo-computer-receipt.mjs',
    'scripts/integrations/four-repo-computer-receipt.test.mjs', 'scripts/integrations/README.md',
    'hardhat/scripts/four-repo-computer-lifecycle.cjs',
    'hardhat/test/four-repo-computer-lifecycle.test.cjs', 'scripts/docs/check-docs.mjs',
    VERIFIER, 'scripts/release/test-correction-profile.py',
    'scripts/release/publication-authorization.py', 'scripts/release/wait-qualification.py',
    'scripts/release/test-publication-authorization.py',
    'scripts/release/run-inherited-release-tests.py', 'scripts/release/run-correction-preservation.py',
    'docs/qualification/mainnet-cutover-v1.19.4-expected.json',
    'docs/qualification/release-v1.19.4-provenance.json',
    'scripts/security/slither-reviewed-findings-v1.19.4.json',
} | {'docs/releases/v1.19.4/' + name + '.md' for name in ('START_HERE', 'RELEASE_NOTES', 'RECOVERY_GUIDE', 'VALIDATION')}
VERSION_ONLY = PREVIOUS['VERSION_ONLY']
UI_LABEL_ONLY = {'agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html',
    'ui/agijobmanager-usdc.html', 'ui/src/generated/deployments.ts', 'ui/scripts/singlefile-template.html'}


def previous_selection():
    return PREVIOUS['select'](manifest=PREVIOUS['MANIFEST'],
        manifest_sha256=PREVIOUS_PINS[PREVIOUS['MANIFEST']],
        verifier_sha256=PREVIOUS_PINS[PREVIOUS['VERIFIER']])


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None, 'Correction policy selection differs')
    require(all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value) for value in (manifest_sha256, verifier_sha256)), 'Correction manifest and verifier pins are mandatory')
    return {'releaseProfile': PROFILE, 'manifestPath': MANIFEST,
        'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256}


def metadata(selection):
    return {'releaseProfile': PROFILE, 'releasePolicy': dict(selection),
        'qualification': 'Finite reviewed source-correction identity only. Exact-final-source qualification and publication must be verified in external QUALIFICATION.json.'}


def validate_metadata(manifest, selection):
    require(set(manifest) == {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files', 'releaseProfile', 'releasePolicy'}, 'Correction release manifest fields differ')
    require(type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 2 and manifest['repository'] == REPOSITORY and manifest['name'] == TITLE, 'Correction release schema/repository/title differs')
    require(valid_sha(manifest['sourceCommit']) and valid_sha(manifest['sourceTree']), 'Correction release identity differs')
    require(manifest['tag'] == 'v' + VERSION and manifest['stage'] == 'source-package', 'Correction release version/stage differs')
    for key, value in metadata(selection).items():
        require(manifest[key] == value, 'Correction release policy metadata differs: ' + key)


def inventory(root, selection):
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Correction verifier pin differs')
    require(sha(read(root, MANIFEST)[1]) == selection['manifestSha256'], 'Correction manifest pin differs')
    for name, digest in PREVIOUS_PINS.items():
        require(sha(read(root, name)[1]) == digest, 'Immutable previous release policy differs: ' + name)
    baseline, _ = PREVIOUS['inventory'](root, previous_selection())
    manifest = strict_json(read(root, MANIFEST)[1])
    require(set(manifest) == {'schema', 'profile', 'baseCommit', 'baseTree', 'version', 'qualification', 'changes'}, 'Correction source inventory fields differ')
    require(manifest['schema'] == 'agijobmanager/source-corrections/v1' and manifest['profile'] == PROFILE and manifest['baseCommit'] == BASE and manifest['baseTree'] == TREE and manifest['version'] == VERSION, 'Correction source baseline differs')
    require(manifest['qualification'] == 'PENDING_FINAL_SOURCE_MAIN_PUSH', 'Correction inventory cannot claim qualification')
    changes = manifest['changes']
    require(isinstance(changes, dict) and changes and set(changes) <= ALLOWED, 'Correction source exceeds finite reviewed paths')
    result = dict(baseline)
    for name, change in changes.items():
        require(set(change) == {'before', 'after', 'reason'} and isinstance(change['reason'], str) and change['reason'].strip(), 'Correction change attribution is missing')
        require(change['before'] == baseline.get(name), 'Correction predecessor bytes differ: ' + name)
        after = change['after']
        require(isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] in ('100644', '100755') and re.fullmatch('[0-9a-f]{64}', after['sha256']), 'Correction source mode/hash differs')
        require(after != change['before'], 'Unchanged correction entry')
        result[name] = after
    result[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    return result, baseline


def validate_source(root, selection, paths=None):
    root = pathlib.Path(root).resolve()
    expected, baseline = inventory(root, selection)
    actual = set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual == set(expected), 'Correction source inventory has missing or extra inputs')
    for name, item in expected.items():
        mode, data = read(root, name)
        require(mode == item['mode'] and sha(data) == item['sha256'], 'Correction source bytes/mode differ: ' + name)
        if name in VERSION_ONLY:
            value = strict_json(data)
            require(value['version'] == VERSION, 'Correction software version differs')
            value['version'] = '1.19.3'
            if name.endswith('package-lock.json'):
                require(value['packages']['']['version'] == VERSION, 'Correction lock version differs')
                value['packages']['']['version'] = '1.19.3'
            require(sha((json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()) == baseline[name]['sha256'], 'Correction changed dependency resolution or transaction configuration: ' + name)
        if name in UI_LABEL_ONLY:
            normalized = data.replace(b'v1.19.4', b'v1.19.3').replace(b'"version":"1.19.4"', b'"version":"1.19.3"').replace(b'"version": "1.19.4"', b'"version": "1.19.3"')
            require(sha(normalized) == baseline[name]['sha256'], 'Correction changed the advanced console beyond version labels: ' + name)
    return {'profile': PROFILE, 'sourceInputs': len(expected), 'qualification': 'PENDING_FINAL_SOURCE_MAIN_PUSH'}


def checkout(root, selection, object_store, dependency_root, source, tree):
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Shallow correction history is prohibited')
    grafts = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = pathlib.Path(root) / grafts
    require(not grafts.exists() and not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'Replaced or grafted correction history is prohibited')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == source and git(root, 'rev-parse', 'HEAD^{tree}').decode().strip() == tree, 'Correction checkout identity differs')
    require(not git(root, 'status', '--porcelain', '--untracked-files=no').strip(), 'Correction tracked checkout is dirty')
    require(git(root, 'rev-parse', BASE + '^{tree}').decode().strip() == TREE, 'Previous release tree differs')
    git(root, 'merge-base', '--is-ancestor', BASE, source)
    entries = {}
    for entry in git(root, 'ls-tree', '-rz', source).split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        require(kind == 'blob', 'Unexpected correction Git object')
        entries[name.decode()] = (mode, oid)
    index = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        require(stage == '0' and name.decode() not in index, 'Unmerged correction index')
        index[name.decode()] = (mode, oid)
    require(index == entries, 'Correction index differs from source tree')
    require(all(not entry or entry.startswith(b'H ') for entry in git(root, 'ls-files', '-v', '-z').split(b'\0')), 'Hidden correction index flags are prohibited')
    for name, (mode, oid) in entries.items():
        actual_mode, data = read(root, name)
        actual_oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(mode == actual_mode and oid == actual_oid, 'Correction raw source differs from Git: ' + name)
    result = validate_source(root, selection, entries)
    if dependency_root is not None:
        verifier = runpy.run_path(str(pathlib.Path(root) / 'scripts/release/check-explicit-governor-boundaries.py'))
        result['compilerSourceUnits'] = verifier['compiler_closure'](pathlib.Path(root), strict_json(read(root, PREVIOUS['BASE_MANIFEST'])[1]), dependency_root)
    return {**result, 'sourceCommit': source, 'sourceTree': tree}


def arguments(root):
    return ['--profile', PROFILE, '--manifest', MANIFEST, '--manifest-sha256', sha(read(root, MANIFEST)[1]), '--verifier-sha256', sha(read(root, VERIFIER)[1])]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dependency-root', required=True)
    args = parser.parse_args()
    opts = arguments(ROOT)
    chosen = select(manifest=MANIFEST, manifest_sha256=opts[5], verifier_sha256=opts[7])
    print(json.dumps(checkout(ROOT, chosen, None, args.dependency_root, git(ROOT, 'rev-parse', 'HEAD').decode().strip(), git(ROOT, 'rev-parse', 'HEAD^{tree}').decode().strip())))
