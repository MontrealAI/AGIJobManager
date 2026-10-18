"""Release-only wrapper over immutable 8815 inputs. Identity is not qualification."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import runpy
import stat
import subprocess
from release_common import require, sha, strict_json, REPOSITORY, TITLE, valid_sha

PROFILE = 'manager-explicit-governor-release-v1'
MANIFEST = 'config/explicit-governor-release-v1.json'
VERIFIER = 'scripts/release/release-profile.py'
BASE = '8815ed3181778664595f951befd672afbd7a9352'
TREE = '913e49d65263bc53026916f7fc3b4cbfb93549f8'
BASE_MANIFEST = 'config/explicit-governor-source-v1.json'
BASE_MANIFEST_SHA = '83cd0976000a74d8c8ac3b5fd21c90ba48068c5ef87582dd6ba926e2b62c01e2'
VERSION = '1.19.1'
VERSION_ONLY = {p + n for p in ('', 'hardhat/', 'ui/') for n in ('package.json', 'package-lock.json')} | {'config/usdc-deployment.json'}
# Finite release delta. No contract, compiler, dependency or deployment script is mutable.
ALLOWED = VERSION_ONLY | {
    'config/mainnet/manager-8815-2026-10-17.json', 'docs/deployments/MAINNET_MANAGER_2026-10-17.md', 'docs/DEPLOYMENT/SECOND_MAINNET_RELEASE.md', 'config/companion-releases.json', 'agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html', 'ui/README.md', 'docs/START_HERE.md', 'docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md', 'ui/src/generated/deployments.ts',
    'README.md', 'docs/OPERATIONS/PRIVATE_FLEET.md', 'docs/V1_RELEASE_SCOPE.md',
    'docs/RELEASE_GUIDE.md', 'docs/REFERENCE/VERSIONS.md', 'docs/ui/DEPLOYMENT_MAINNET.md', 'scripts/docs/release-alignment.mjs',
    'docs/MAINNET_READINESS.md', 'scripts/docs/templates/V1_RELEASE_SCOPE.md.tpl', 'docs/REPO_MAP.md', 'scripts/docs/templates/README.md.tpl', 'ui/agijobmanager-usdc.html',
    '.github/workflows/current-state-release.yml', '.github/workflows/publish-v114.yml',
    '.github/workflows/pages.yml', 'scripts/release/run-release-preservation.py', '.github/workflows/mainnet-fork.yml', '.github/workflows/security-verification.yml',
    'scripts/release/release_common.py', 'scripts/release/package-release.py',
    'scripts/release/verify-package.py', 'scripts/release/collect-qualification.py',
    'scripts/release/publish-release.py', VERIFIER, 'scripts/release/package-policy.py',
    'scripts/release/test-release-profile.py', 'scripts/release/test-release-gates.py', 'ui/scripts/generate-deployment-docs.mjs', 'ui/scripts/docs-check.mjs', 'scripts/release/run-inherited-source-tests.py',
    'docs/qualification/mainnet-cutover-v1.19.0-expected.json', 'docs/qualification/mainnet-cutover-v1.19.1-expected.json',
    'docs/qualification/release-v1.19.0-provenance.json', 'docs/qualification/release-v1.19.1-provenance.json',
    'scripts/security/slither-reviewed-findings-v1.19.0.json', 'scripts/security/slither-reviewed-findings-v1.19.1.json',
    'scripts/security/verify-slither-review.py',
} | {'docs/releases/' + tag + '/' + n + '.md' for tag in ('v1.19.0', 'v1.19.1') for n in ('START_HERE', 'RELEASE_NOTES', 'RECOVERY_GUIDE', 'VALIDATION')}


def read(root, name):
    p = pathlib.PurePosixPath(name)
    require(p.as_posix() == name and not p.is_absolute() and '..' not in p.parts and '\\' not in name, 'Unsafe release input path')
    target = pathlib.Path(root) / name
    if target.is_symlink():
        require(name == 'hardhat/contracts' and os.readlink(target) == '../contracts', 'Unexpected release symlink')
        return '120000', b'../contracts'
    require(target.is_file() and target.resolve() == target, 'Missing or indirect release input: ' + name)
    return ('100755' if target.stat().st_mode & 0o111 else '100644'), target.read_bytes()


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None, 'Release policy selection differs')
    require(all(isinstance(p, str) and re.fullmatch('[0-9a-f]{64}', p) for p in (manifest_sha256, verifier_sha256)), 'Release manifest and verifier pins are mandatory')
    return {'releaseProfile': PROFILE, 'manifestPath': MANIFEST, 'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256}


def metadata(selection):
    return {'releaseProfile': PROFILE, 'releasePolicy': dict(selection),
            'qualification': 'Release wrapper source identity only. Final exact-main-push qualification and publication authorization must be verified in the external QUALIFICATION.json.'}


def validate_metadata(manifest, selection):
    require(set(manifest) == {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files', 'releaseProfile', 'releasePolicy'}, 'Release manifest fields differ; embedded approval is prohibited')
    require(type(manifest.get('schemaVersion')) is int and manifest['schemaVersion'] == 2 and manifest.get('repository') == REPOSITORY and manifest.get('name') == TITLE, 'Release manifest schema/repository/name differs')
    require(valid_sha(manifest.get('sourceCommit')) and valid_sha(manifest.get('sourceTree')), 'Release manifest source identity differs')
    require(not {'candidateProfile', 'sourcePackageOnly', 'releaseQualified', 'releaseIdentity'} & set(manifest), 'Candidate or fabricated qualification metadata is prohibited')
    for k, v in metadata(selection).items():
        require(manifest.get(k) == v, 'Release policy metadata differs: ' + k)
    require(manifest.get('tag') == 'v' + VERSION and manifest.get('stage') == 'source-package', 'Release wrapper identity differs')


def inventory(root, selection):
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Release verifier pin differs')
    require(sha(read(root, MANIFEST)[1]) == selection['manifestSha256'], 'Release manifest pin differs')
    inherited = read(root, BASE_MANIFEST)[1]
    require(sha(inherited) == BASE_MANIFEST_SHA, 'Immutable 8815 inventory differs')
    baseline = {name: {'mode': v['mode'], 'sha256': v['sha256']} for name, v in strict_json(inherited)['inputs'].items()}
    baseline[BASE_MANIFEST] = {'mode': '100644', 'sha256': BASE_MANIFEST_SHA}
    m = strict_json(read(root, MANIFEST)[1])
    require(set(m) == {'schema', 'profile', 'baseCommit', 'baseTree', 'version', 'qualification', 'changes'}, 'Release delta fields differ')
    require(m['schema'] == 'agijobmanager/release-delta/v1' and m['profile'] == PROFILE and m['baseCommit'] == BASE and m['baseTree'] == TREE and m['version'] == VERSION, 'Release delta identity differs')
    require(m['qualification'] == 'PENDING_FINAL_SOURCE_MAIN_PUSH', 'Source delta cannot claim release qualification')
    require(isinstance(m['changes'], dict) and m['changes'] and set(m['changes']) <= ALLOWED, 'Release delta exceeds finite allowed paths')
    result = dict(baseline)
    for name, item in m['changes'].items():
        require(set(item) == {'before', 'after', 'reason'} and isinstance(item['reason'], str) and item['reason'].strip(), 'Missing exact release delta attribution')
        require(item['before'] == baseline.get(name), 'Release predecessor bytes differ: ' + name)
        after = item['after']
        require(isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] in ('100644', '100755') and re.fullmatch('[0-9a-f]{64}', after['sha256']), 'Invalid release delta identity')
        require(after != item['before'], 'Unchanged release delta entry')
        result[name] = after
    result[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    return result, baseline



def validate_ui_metadata(root, baseline):
    """Preserve executable UI bytes; only exact embedded release documents may vary."""
    bundle_pattern = '(<script id="agijobmanager-runtime-bundle">window.__AGI_RUNTIME_BUNDLE__=)(.*?)(;window.__AGI_CONTRACT_ABI_REGISTRY__=)'
    allowed = {'README.md': 'README.md', 'config/usdc-deployment.json': 'config/usdc-deployment.json', 'docs/ui/DEPLOYMENT_MAINNET.md': 'docs/ui/DEPLOYMENT_MAINNET.md', 'src/generated/deployments.ts': 'ui/src/generated/deployments.ts'}
    def mask(text):
        text = re.sub(bundle_pattern, lambda m: m.group(1) + 'METADATA' + m.group(3), text, flags=re.S)
        return re.sub(r'const OFFICIAL=(.*?);\n', lambda m: 'const OFFICIAL=' + json.dumps({**strict_json(m.group(1)), 'version': 'MASKED'}, sort_keys=True) + ';\n', text)
    for name in ('agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html'):
        text = read(root, name)[1].decode()
        matches = list(re.finditer(bundle_pattern, text, re.S))
        require(len(matches) == 1, 'UI embedded source bundle is ambiguous')
        bundle = strict_json(matches[0].group(2))
        sources = bundle['sources']
        require(bundle['sourcesSha256'] == sha(json.dumps(sources, ensure_ascii=False, separators=(',', ':')).encode()), 'UI source digest differs')
        for key, path in allowed.items():
            require(sources[key] == read(root, path)[1].decode(), 'UI embedded release document differs: ' + key)
        bundle['sources'] = {k:v for k,v in sources.items() if k not in allowed}
        bundle.pop('sourcesSha256')
        require(sha(json.dumps(bundle, sort_keys=True).encode()) == 'e7145de7bdb25b9a8cc9dbb1092a9b08d9b0d0ab47a3b00650ae51f0dea0c967', 'UI runtime sources or bundle metadata changed')
        require(sha(mask(text).encode()) == '3ea55ef04511d8d5355574582481437fba60e536db0b3252c1db40985c641641', 'UI executable bytes changed')
        official = list(re.finditer(r'const OFFICIAL=(.*?);\n', text))
        require(len(official) == 1 and strict_json(official[0].group(1))['version'] == VERSION, 'UI software version differs')
    require(read(root, 'agijobmanager.html')[1] == read(root, 'ui/dist-ipfs/agijobmanager.html')[1], 'Standalone UI copies differ')
    name = 'ui/agijobmanager-usdc.html'
    data = read(root, name)[1]
    require(data.count(b'v1.19.1') == 6 and sha(data.replace(b'v1.19.1', b'v1.18.0')) == baseline[name]['sha256'], 'USDC console changed beyond six release display labels')
    name = 'ui/src/generated/deployments.ts'
    data = read(root, name)[1]
    require(sha(data.replace(b'"version": "1.19.1"', b'"version": "1.18.0"', 1)) == baseline[name]['sha256'], 'Generated deployment configuration changed beyond software version')


def validate_source(root, selection, paths=None):
    root = pathlib.Path(root).resolve()
    expected, baseline = inventory(root, selection)
    actual = set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual == set(expected), 'Release source inventory has missing or extra inputs')
    for name, item in expected.items():
        mode, data = read(root, name)
        require(mode == item['mode'] and sha(data) == item['sha256'], 'Release source bytes/mode differ: ' + name)
        if name in VERSION_ONLY:
            value = strict_json(data)
            require(value['version'] == VERSION, 'Workspace software version differs')
            value['version'] = '1.18.0'
            if name.endswith('package-lock.json'):
                require(value['packages']['']['version'] == VERSION, 'Lock software version differs')
                value['packages']['']['version'] = '1.18.0'
            require(sha((json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()) == baseline[name]['sha256'], 'Version label change altered dependencies or deployment configuration: ' + name)
    validate_ui_metadata(root, baseline)
    return {'profile': PROFILE, 'sourceInputs': len(expected), 'qualification': 'PENDING_FINAL_SOURCE_MAIN_PUSH'}


def git(root, *args):
    env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_NO_REPLACE_OBJECTS='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0')
    return subprocess.check_output(['git', '--no-replace-objects', '-c', 'protocol.allow=never', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', *args], cwd=root, env=env)


def checkout(root, selection, object_store, dependency_root, source, tree):
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Shallow release history is prohibited')
    grafts = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = pathlib.Path(root) / grafts
    require(not grafts.exists(), 'Grafted release history is prohibited')
    require(not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'Replacement release refs are prohibited')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == source and git(root, 'rev-parse', 'HEAD^{tree}').decode().strip() == tree, 'Release checkout identity differs')
    require(not git(root, 'status', '--porcelain', '--untracked-files=no').strip(), 'Release tracked checkout is dirty')
    require(git(root, 'rev-parse', BASE + '^{tree}').decode().strip() == TREE, 'Inherited source tree differs')
    git(root, 'merge-base', '--is-ancestor', BASE, source)
    entries = {}
    for entry in git(root, 'ls-tree', '-rz', source).split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        require(kind == 'blob', 'Unexpected release Git object')
        entries[name.decode()] = (mode, oid)
    index = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        require(stage == '0' and name.decode() not in index, 'Unmerged release index')
        index[name.decode()] = (mode, oid)
    require(index == entries, 'Release index differs from source tree')
    require(all(not entry or entry.startswith(b'H ') for entry in git(root, 'ls-files', '-v', '-z').split(b'\0')), 'Hidden release index flags are prohibited')
    for name, (mode, oid) in entries.items():
        actual_mode, data = read(root, name)
        actual_oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(mode == actual_mode and oid == actual_oid, 'Release raw bytes differ from source Git blob: ' + name)
    result = validate_source(root, selection, entries)
    if dependency_root is not None:
        verifier = runpy.run_path(str(pathlib.Path(root) / 'scripts/release/check-explicit-governor-boundaries.py'))
        result['compilerSourceUnits'] = verifier['compiler_closure'](pathlib.Path(root), strict_json(read(root, BASE_MANIFEST)[1]), dependency_root)
    return {**result, 'sourceCommit': source, 'sourceTree': tree}


def arguments(root):
    root = pathlib.Path(root)
    return ['--profile', PROFILE, '--manifest', MANIFEST, '--manifest-sha256', sha(read(root, MANIFEST)[1]), '--verifier-sha256', sha(read(root, VERIFIER)[1])]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dependency-root', required=True)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[2]
    opts = arguments(root)
    chosen = select(manifest=MANIFEST, manifest_sha256=opts[5], verifier_sha256=opts[7])
    print(json.dumps(checkout(root, chosen, None, args.dependency_root, git(root, 'rev-parse', 'HEAD').decode().strip(), git(root, 'rev-parse', 'HEAD^{tree}').decode().strip())))
