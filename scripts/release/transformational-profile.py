"""Finite native-transformation additions over immutable v1.19.4; qualification is separate."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import runpy
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILE = 'manager-transformational-v1'
MANIFEST = 'config/manager-transformational-v1.json'
VERIFIER = 'scripts/release/transformational-profile.py'
BASE = 'f4a50134ba8d3a5ded9650565cbdb737a00c1189'
TREE = '0e7e3577d1476cbf5135c7cb42dc1e25eef7c44b'
VERSION = '1.19.5'
PREVIOUS_PINS = {'scripts/release/correction-profile.py': '9f24e5c12ce6652b54043c0d03d58fe885183d5b53a74dbdb685177e0430eab6', 'config/manager-boundary-corrections-v1.json': '0475bdcf1e6c2a1c5b593a4de4a2c2c63cad16757931c1badb5c6c802df9a9ef', 'scripts/release/test-correction-profile.py': '59cd824c0fcfe795a0fca66434b2bcbb6e8355dd01d35872d6069ada0e94e066', 'scripts/release/publication-authorization.py': '57eb5696e7927a1aadb5fd74eb3d61782bc733402e441d521605dda1105ba63e', 'scripts/release/test-publication-authorization.py': 'dc460963017a883bffc7b6fe0fc9cf41d3084cef740ea31816701df6bc18c9b5', 'scripts/release/run-correction-preservation.py': 'a76644c45e7fc1d0f911188e7ce26e55eaee7ff560a99c6cb02f77c5e659dd97', 'scripts/release/release_common.py': 'e4ba17be0398e47e2165f76be7ebe650190dc9f93f0807c0d6435485656f2440', 'scripts/release/pages-publication.py': '3f802a61a51ce958e1e447d3a428c03f0df1f71dc9d28671b608ac33d675b1f1', 'scripts/release/test-pages-publication.py': '3d26b831c5cb529d79f66341a8300e99962939b5031e0cc97d7922159a296f1e'}
for name, digest in PREVIOUS_PINS.items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
        raise ValueError('Immutable previous policy input differs: ' + name)
from release_common import require, sha, strict_json, REPOSITORY, TITLE, valid_sha
PREVIOUS = runpy.run_path(str(ROOT / 'scripts/release/correction-profile.py'))
read = PREVIOUS['read']
git = PREVIOUS['git']
# This explicit delta extends the immutable v1.19.4 inventory.
# Its old verifier, manifest, tests, contracts and compiler inputs stay exact.
ALLOWED = {
    '.github/workflows/alpha-project-handoff.yml',
    '.github/workflows/current-state-release.yml',
    '.github/workflows/mainnet-fork.yml',
    '.github/workflows/pages.yml',
    '.github/workflows/publish-v114.yml',
    'README.md',
    'agijobmanager.html',
    'config/companion-releases.json',
    'config/transformational-alpha-source.json',
    'config/usdc-deployment.json',
    'docs/MAINNET_READINESS.md',
    'docs/OPERATIONS/PRIVATE_FLEET.md',
    'docs/REFERENCE/VERSIONS.md',
    'docs/RELEASE_GUIDE.md',
    'docs/START_HERE.md',
    'docs/V1_RELEASE_SCOPE.md',
    'docs/qualification/mainnet-cutover-v1.19.5-expected.json',
    'docs/qualification/release-v1.19.5-provenance.json',
    'docs/releases/v1.19.5/RECOVERY_GUIDE.md',
    'docs/releases/v1.19.5/RELEASE_NOTES.md',
    'docs/releases/v1.19.5/START_HERE.md',
    'docs/releases/v1.19.5/VALIDATION.md',
    'docs/successor/TRANSFORMATIONAL_WORK.md',
    'docs/ui/DEPLOYMENT_MAINNET.md',
    'docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md',
    'hardhat/package-lock.json',
    'hardhat/package.json',
    'package-lock.json',
    'package.json',
    'scripts/docs/templates/PRIVATE_FLEET.md.tpl',
    'scripts/docs/templates/README.md.tpl',
    'scripts/docs/templates/V1_RELEASE_SCOPE.md.tpl',
    'scripts/integrations/transformational-native-test.mjs',
    'scripts/integrations/transformational-native-source.test.mjs',
    'scripts/integrations/transformational-work-request.mjs',
    'scripts/integrations/transformational-work-request.test.mjs',
    'scripts/release/collect-qualification.py',
    'scripts/release/package-policy.py',
    'scripts/release/pages-publication-ti.py',
    'scripts/release/publication-authorization-ti.py',
    'scripts/release/publish-release.py',
    'scripts/release/run-transformational-inherited-tests.py',
    'scripts/release/run-transformational-preservation.py',
    'scripts/release/test-pages-publication-ti.py',
    'scripts/release/test-publication-authorization-ti.py',
    'scripts/release/test-transformational-profile.py',
    'scripts/release/test-transformational-qualification.py',
    'scripts/release/transformational-profile.py',
    'scripts/release/transformational-qualification.py',
    'scripts/release/verify-package.py',
    'scripts/security/slither-reviewed-findings-v1.19.5.json',
    'scripts/security/verify-slither-review.py',
    'ui/README.md',
    'ui/agijobmanager-usdc.html',
    'ui/dist-ipfs/agijobmanager.html',
    'ui/package-lock.json',
    'ui/package.json',
    'ui/scripts/singlefile-template.html',
    'ui/src/generated/deployments.ts',
}

VERSION_ONLY = PREVIOUS['VERSION_ONLY']
UI_LABEL_ONLY = {'agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html',
    'ui/agijobmanager-usdc.html', 'ui/src/generated/deployments.ts', 'ui/scripts/singlefile-template.html'}


def previous_selection():
    return PREVIOUS['select'](manifest=PREVIOUS['MANIFEST'],
        manifest_sha256=PREVIOUS_PINS[PREVIOUS['MANIFEST']],
        verifier_sha256=PREVIOUS_PINS[PREVIOUS['VERIFIER']])


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None, 'Transformation policy selection differs')
    require(all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value) for value in (manifest_sha256, verifier_sha256)), 'Transformation manifest and verifier pins are mandatory')
    return {'releaseProfile': PROFILE, 'manifestPath': MANIFEST,
        'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256}


def metadata(selection):
    return {'releaseProfile': PROFILE, 'releasePolicy': dict(selection),
        'qualification': 'Finite reviewed native-transformation source identity only. Exact-final-source qualification and publication must be verified in external QUALIFICATION.json.'}


def validate_metadata(manifest, selection):
    require(set(manifest) == {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files', 'releaseProfile', 'releasePolicy'}, 'Transformation release manifest fields differ')
    require(type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 2 and manifest['repository'] == REPOSITORY and manifest['name'] == TITLE, 'Transformation release schema/repository/title differs')
    require(valid_sha(manifest['sourceCommit']) and valid_sha(manifest['sourceTree']), 'Transformation release identity differs')
    require(manifest['tag'] == 'v' + VERSION and manifest['stage'] == 'source-package', 'Transformation release version/stage differs')
    for key, value in metadata(selection).items():
        require(manifest[key] == value, 'Transformation release policy metadata differs: ' + key)


def inventory(root, selection):
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Transformation verifier pin differs')
    require(sha(read(root, MANIFEST)[1]) == selection['manifestSha256'], 'Transformation manifest pin differs')
    for name, digest in PREVIOUS_PINS.items():
        require(sha(read(root, name)[1]) == digest, 'Immutable previous release policy differs: ' + name)
    baseline, _ = PREVIOUS['inventory'](root, previous_selection())
    manifest = strict_json(read(root, MANIFEST)[1])
    require(set(manifest) == {'schema', 'profile', 'baseCommit', 'baseTree', 'version', 'qualification', 'changes'}, 'Transformation source inventory fields differ')
    require(manifest['schema'] == 'agijobmanager/transformational-source/v1' and manifest['profile'] == PROFILE and manifest['baseCommit'] == BASE and manifest['baseTree'] == TREE and manifest['version'] == VERSION, 'Transformation source baseline differs')
    require(manifest['qualification'] == 'PENDING_FINAL_SOURCE_MAIN_PUSH', 'Transformation inventory cannot claim qualification')
    changes = manifest['changes']
    require(isinstance(changes, dict) and changes and set(changes) == ALLOWED, 'Transformation source differs from finite reviewed paths')
    result = dict(baseline)
    for name, change in changes.items():
        require(set(change) == {'before', 'after', 'reason'} and isinstance(change['reason'], str) and change['reason'].strip(), 'Transformation change attribution is missing')
        require(change['before'] == baseline.get(name), 'Transformation predecessor bytes differ: ' + name)
        after = change['after']
        require(isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] in ('100644', '100755') and re.fullmatch('[0-9a-f]{64}', after['sha256']), 'Transformation source mode/hash differs')
        require(after != change['before'], 'Unchanged correction entry')
        result[name] = after
    result[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    return result, baseline


def validate_source(root, selection, paths=None):
    root = pathlib.Path(root).resolve()
    expected, baseline = inventory(root, selection)
    actual = set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual == set(expected), 'Transformation source inventory has missing or extra inputs')
    for name, item in expected.items():
        mode, data = read(root, name)
        require(mode == item['mode'] and sha(data) == item['sha256'], 'Transformation source bytes/mode differ: ' + name)
        if name in VERSION_ONLY:
            value = strict_json(data)
            require(value['version'] == VERSION, 'Transformation software version differs')
            value['version'] = '1.19.4'
            if name.endswith('package-lock.json'):
                require(value['packages']['']['version'] == VERSION, 'Transformation lock version differs')
                value['packages']['']['version'] = '1.19.4'
            require(sha((json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()) == baseline[name]['sha256'], 'Transformation changed dependency resolution or transaction configuration: ' + name)
        if name in UI_LABEL_ONLY:
            normalized = data.replace(b'v1.19.5', b'v1.19.4').replace(b'"version":"1.19.5"', b'"version":"1.19.4"').replace(b'"version": "1.19.5"', b'"version": "1.19.4"')
            require(sha(normalized) == baseline[name]['sha256'], 'Transformation changed the advanced console beyond version labels: ' + name)
    validate_plumbing(root, baseline)
    validate_comparison_inputs(root)
    return {'profile': PROFILE, 'sourceInputs': len(expected), 'qualification': 'PENDING_FINAL_SOURCE_MAIN_PUSH'}


def validate_plumbing(root, baseline):
    """Normalize only the explicit new selection and additive native test steps."""
    native = '''      - name: Fetch the exact reviewed transformation inspector
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803
        with:
          repository: MontrealAI/AGI-Alpha-Agent-v0
          ref: 7283b4d4d2a51ff674e6078f5940691900aae5a1
          path: build/alpha-ti-source
          persist-credentials: false
      - name: Validate native transformation campaign boundary
        run: |
          node --test scripts/integrations/transformational-work-request.test.mjs scripts/integrations/transformational-native-source.test.mjs
          node scripts/integrations/transformational-native-test.mjs "$GITHUB_WORKSPACE/build/alpha-ti-source"
'''
    tests = '''      - name: Native transformation profile and inherited release tests
        run: |
          python3 scripts/release/test-transformational-profile.py
          python3 scripts/release/test-transformational-qualification.py
          python3 scripts/release/test-publication-authorization-ti.py
          python3 scripts/release/test-pages-publication-ti.py
          python3 scripts/release/run-transformational-inherited-tests.py
'''
    for name in ('.github/workflows/alpha-project-handoff.yml', '.github/workflows/current-state-release.yml',
            '.github/workflows/mainnet-fork.yml', '.github/workflows/pages.yml',
            '.github/workflows/publish-v114.yml', 'scripts/security/verify-slither-review.py'):
        text = read(root, name)[1].decode('utf8')
        if name.endswith('alpha-project-handoff.yml'):
            require(text.count(native) == 1, 'Exact pinned native Alpha test step is required')
            text = text.replace(native, '')
        elif name.endswith('current-state-release.yml'):
            require(text.count(tests) == 1, 'New profile and unchanged inherited tests are required')
            text = text.replace(tests, '')
            anchor = '      - name: Resolve candidate identity from package metadata'
            require(text.count(anchor) == 1, 'Candidate selection step differs')
            text = text.replace(anchor, '          python3 scripts/release/test-correction-profile.py\n          python3 scripts/release/test-publication-authorization.py\n          python3 scripts/release/test-pages-publication.py\n' + anchor)
            text = text.replace('manager-transformational-v1', 'manager-boundary-corrections-v1').replace('transformational-profile.py', 'correction-profile.py')
        elif name.endswith('pages.yml'):
            text = text.replace('run-transformational-preservation.py', 'run-correction-preservation.py').replace('pages-publication-ti.py', 'pages-publication.py')
        else:
            text = text.replace('v1.19.5', 'v1.19.4').replace('manager-transformational-v1', 'manager-boundary-corrections-v1').replace('transformational-profile.py', 'correction-profile.py')
        require(sha(text.encode()) == baseline[name]['sha256'], 'Prior workflow or security gate changed beyond explicit TI additions: ' + name)
    guard = read(root, 'scripts/release/pages-publication-ti.py')[1].decode('utf8')
    native_pages = "        native = runpy.run_path(str(ROOT / 'scripts/release/transformational-qualification.py'))\n        require(config.get('transformationQualification') == native['validate'](config, api, lambda job_id: gh('api', f'repos/{REPOSITORY}/actions/jobs/{job_id}/logs', '--method', 'GET', '--allow-escape-sequences').decode()), 'Pages native transformation qualification binding differs')\n"
    require(guard.count(native_pages) == 1, 'Additional live native Pages qualification is required')
    guard = guard.replace(native_pages, '').replace('v1.19.5', 'v1.19.4').replace('manager-transformational-v1', 'manager-boundary-corrections-v1').replace('transformational-profile.py', 'correction-profile.py')
    require(sha(guard.encode()) == baseline['scripts/release/pages-publication.py']['sha256'], 'Prior Pages publisher gates changed beyond explicit TI selection and additive native qualification')
    source = strict_json(read(root, 'config/transformational-alpha-source.json')[1])
    require(source == {
        'schema': 'agijobmanager/transformational-alpha-source/v1', 'repository': 'MontrealAI/AGI-Alpha-Agent-v0',
        'commit': '7283b4d4d2a51ff674e6078f5940691900aae5a1', 'tree': '13fcbc6a0a7696036f9b590fc9b7048563e184d2',
        'fixturePath': 'examples/transformational-intelligence/campaign.json', 'files': {
            'docs/assets/successor/engine.mjs': '38c4f38978bf9fc29f207bae3adee0755bc6530d04502a36c491cc430787e488',
            'examples/transformational-intelligence/campaign.json': 'fa5f570e89c20cffd0df844869047a7c0594c5460c3e95df5ada44592ea4fd20',
            'examples/transformational-intelligence/inspector.mjs': 'b5f8e704aaab345f9d6503c854d38910ddfabbf98fe674c48b051097812b07f4'}}, 'Native source closure differs from reviewed free-only contract')


def validate_comparison_inputs(root):
    """A version-label update cannot alter old observations or scanner findings."""
    provenance = {'schema': 'agijobmanager/release-comparison-inputs/v1',
        'status': 'EXPECTED_ONLY_PENDING_FINAL_SOURCE_EXECUTION', 'baseCommit': BASE,
        'baseTree': TREE, 'version': VERSION, 'executed': False}
    cases = (
        ('fork', 'docs/qualification/mainnet-cutover-v1.19.4-expected.json',
            'docs/qualification/mainnet-cutover-v1.19.5-expected.json', 'sourceSha256',
            ['hardhat/package-lock.json', 'hardhat/package.json', 'package-lock.json', 'package.json'], 'observationsChanged'),
        ('staticAnalysis', 'scripts/security/slither-reviewed-findings-v1.19.4.json',
            'scripts/security/slither-reviewed-findings-v1.19.5.json', 'source_sha256',
            ['hardhat/package-lock.json', 'package-lock.json'], 'findingsOrDispositionsChanged'))
    for kind, old_path, new_path, hashes, changed, unchanged_field in cases:
        old_bytes, new_bytes = read(root, old_path)[1], read(root, new_path)[1]
        old, new = strict_json(old_bytes), strict_json(new_bytes)
        before, after = old.pop(hashes), new.pop(hashes)
        if kind == 'staticAnalysis':
            old.pop('scope'); scope = new.pop('scope')
            require(scope == 'v1.19.5 native-transformation source comparison input; final-source scanning remains pending. Finding IDs, descriptions and dispositions are retained from immutable v1.19.4 and original integrated8815 evidence. Only root/Hardhat lockfile software-version hashes change among analyzer inputs; contracts, compiler settings, dependency resolutions and scanner configuration remain unchanged. Nested integrated qualification is historical evidence for its original source, not a scan of this addition. No execution, audit, release or deployment approval is claimed.', 'Static comparison scope differs')
        require(old == new, 'Historical observations or findings were changed: ' + kind)
        require(set(before) == set(after) and sorted(name for name in before if before[name] != after[name]) == changed, 'Comparison source change set differs: ' + kind)
        for name in before:
            require(after[name] == sha(read(root, name)[1]), 'Comparison source hash differs: ' + name)
        provenance[kind] = {'previousPath': old_path, 'previousSha256': sha(old_bytes),
            'expectedPath': new_path, 'expectedSha256': sha(new_bytes), 'changedSourceHashes': changed, unchanged_field: False}
    provenance['scope'] = 'Only package/lock software-version hashes change within these comparison input sets. The finite addition exposes inert native free-only transformation inspection and separately bounded USDC proposal policy; none is promoted into chain or scanner evidence. Fresh exact-final-source hosted execution remains mandatory.'
    require(strict_json(read(root, 'docs/qualification/release-v1.19.5-provenance.json')[1]) == provenance, 'Comparison provenance cannot claim execution or alter scope')


def checkout(root, selection, object_store, dependency_root, source, tree):
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Shallow correction history is prohibited')
    grafts = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = pathlib.Path(root) / grafts
    require(not grafts.exists() and not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'Replaced or grafted correction history is prohibited')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == source and git(root, 'rev-parse', 'HEAD^{tree}').decode().strip() == tree, 'Transformation checkout identity differs')
    require(not git(root, 'status', '--porcelain', '--untracked-files=no').strip(), 'Transformation tracked checkout is dirty')
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
    require(index == entries, 'Transformation index differs from source tree')
    require(all(not entry or entry.startswith(b'H ') for entry in git(root, 'ls-files', '-v', '-z').split(b'\0')), 'Hidden correction index flags are prohibited')
    for name, (mode, oid) in entries.items():
        actual_mode, data = read(root, name)
        actual_oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(mode == actual_mode and oid == actual_oid, 'Transformation raw source differs from Git: ' + name)
    result = validate_source(root, selection, entries)
    if dependency_root is not None:
        verifier = runpy.run_path(str(pathlib.Path(root) / 'scripts/release/check-explicit-governor-boundaries.py'))
        result['compilerSourceUnits'] = verifier['compiler_closure'](pathlib.Path(root), strict_json(read(root, PREVIOUS['PREVIOUS']['BASE_MANIFEST'])[1]), dependency_root)
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
