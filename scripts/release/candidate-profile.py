"""Explicit nonpublishing source-package policy; no Git or dependencies on extraction."""
import pathlib
import re
import runpy
import stat
import subprocess
from release_common import require, sha, strict_json, source_path

LEGACY = 'legacy-v114'
PROFILE = 'manager-explicit-governor-v1'
MANIFEST = 'config/explicit-governor-source-v1.json'
SCHEMA = 'schemas/explicit-governor-source-v1.schema.json'
VERIFIER = 'scripts/release/check-explicit-governor-boundaries.py'
DISPATCHER = 'scripts/release/check-source-boundaries.py'
HISTORICAL_RELOCATIONS = {'scripts/successor/preservation.test.mjs': 'test/fixtures/preservation.pre-c174-integration.test.mjs.txt'}
QUALIFICATION = 'Nonpublishing source package only. Checked-out input identity passed; release identity is unselected and release qualification, publication approval and deployment approval are absent.'
CANDIDATE_KEYS = {'candidateProfile', 'sourcePackageOnly', 'sourceBound', 'releaseQualified',
                  'releaseIdentity', 'sourceBoundaryStatus', 'sourceBoundaryPolicy'}
MANIFEST_KEYS = {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree',
                 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain',
                 'exclusions', 'files'} | CANDIDATE_KEYS


def add_selection_arguments(parser):
    parser.add_argument('--profile', choices=(LEGACY, PROFILE), default=LEGACY,
                        help='Explicit source policy; the candidate profile cannot qualify or publish a release')
    parser.add_argument('--manifest')
    parser.add_argument('--manifest-sha256')
    parser.add_argument('--verifier-sha256')
    parser.add_argument('--schema-sha256')


def select(profile=LEGACY, *, manifest=None, manifest_sha256=None, verifier_sha256=None,
           schema_sha256=None, published=False):
    require(profile in (LEGACY, PROFILE), 'Unreviewed package source profile')
    pins = (manifest, manifest_sha256, verifier_sha256, schema_sha256)
    if profile == LEGACY:
        require(not any(value is not None for value in pins), 'Legacy packaging cannot accept candidate policy options')
        return None
    require(not published, 'Candidate source package cannot accept published qualification or release approval')
    require(manifest == MANIFEST, 'Candidate profile requires its exact explicit manifest path')
    require(all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value)
                for value in pins[1:]), 'Candidate profile requires complete externally supplied manifest/verifier/schema SHA256 pins')
    return {'manifestPath': manifest, 'manifestSha256': manifest_sha256,
            'verifierSha256': verifier_sha256, 'schemaSha256': schema_sha256}


def metadata(selection):
    return {'candidateProfile': PROFILE, 'sourcePackageOnly': True, 'sourceBound': True,
            'releaseQualified': False, 'releaseIdentity': {'status': 'unselected', 'version': None},
            'sourceBoundaryStatus': 'CHECKED_OUT_INPUT_BOUNDARIES_PASSED',
            'sourceBoundaryPolicy': dict(selection), 'qualification': QUALIFICATION}


def validate_metadata(manifest, selection):
    if selection is None:
        require(not CANDIDATE_KEYS.intersection(manifest), 'Candidate source package requires explicit profile and external pins')
        return
    require(set(manifest) == MANIFEST_KEYS, 'Candidate package metadata fields differ; release approval is prohibited')
    expected = metadata(selection)
    for key, value in expected.items():
        require(type(manifest.get(key)) is type(value) and manifest[key] == value,
                'Candidate package scope or policy differs: ' + key)
    require(manifest['stage'] == 'source-package' and type(manifest['schemaVersion']) is int
            and manifest['schemaVersion'] == 2, 'Candidate package stage/schema differs')


def policy_bytes(root, name):
    target = pathlib.Path(root) / name
    require(target.is_file() and not target.is_symlink() and target.resolve() == target,
            'Candidate policy must be a regular exact-path file: ' + name)
    return target.read_bytes()


def load_policy(root, selection):
    require(selection is not None, 'Candidate source policy must be explicitly selected')
    require(selection.get('manifestPath') == MANIFEST, 'Candidate source manifest path differs')
    policy = {}
    for key, name in [('manifestSha256', MANIFEST), ('schemaSha256', SCHEMA), ('verifierSha256', VERIFIER)]:
        data = policy_bytes(root, name)
        require(sha(data) == selection[key], 'Candidate archived policy pin differs: ' + name)
        policy[name] = data
    verifier = runpy.run_path(str(root / VERIFIER))
    require(all(verifier[key] == value for key, value in [('PROFILE', PROFILE), ('MANIFEST', MANIFEST),
                ('SCHEMA', SCHEMA), ('VERIFIER', VERIFIER)]), 'Candidate verifier profile identity differs')
    manifest = strict_json(policy[MANIFEST])
    verifier['validate_schema'](manifest, strict_json(policy[SCHEMA]))
    require(manifest['schema'] == 'agijobmanager/explicit-governor-source/v1'
            and manifest['profile'] == PROFILE, 'Candidate source profile/schema differs')
    require(manifest['baseline'] == verifier['BASE'] and manifest['predecessor'] == {
        'commit': verifier['PREDECESSOR'], 'tree': verifier['PREDECESSOR_TREE']}, 'Candidate source predecessor differs')
    require(manifest['releaseIdentity'] == {'status': 'unselected', 'version': None}
            and manifest['claims'] == verifier['CLAIMS'], 'Candidate source claims or release identity differ')
    require(verifier['HISTORICAL_RELOCATIONS'] == HISTORICAL_RELOCATIONS,
            'Candidate historical relocation inventory differs')
    return verifier, manifest


def validate_source(root, selection):
    """Check pinned policy and its complete archived input inventory, offline."""
    root = pathlib.Path(root)
    require(root.is_absolute() and root == root.resolve() and root.is_dir(), 'Candidate extraction root must be exact')
    verifier, manifest = load_policy(root, selection)
    expected = set(manifest['inputs']) | {MANIFEST}
    require(MANIFEST not in manifest['inputs'], 'Candidate input inventory cannot hash itself')
    actual = {str(target.relative_to(root)) for target in root.rglob('*')
              if target.is_file() or target.is_symlink()}
    require(actual == expected, 'Candidate extracted source inventory has missing or extraneous inputs')
    for name, item in manifest['inputs'].items():
        mode, data = verifier['raw_file'](root, name)
        package_mode = stat.S_IFLNK | 0o777 if mode == '120000' else stat.S_IFREG | (0o755 if mode == '100755' else 0o644)
        source_path(name, package_mode)
        require(mode == item['mode'] and sha(data) == item['sha256'], 'Candidate input bytes/mode differ: ' + name)
    for name, item in manifest['protectedHistory'].items():
        retained = HISTORICAL_RELOCATIONS.get(name, name)
        require(item == {'originalCommit': verifier['PREDECESSOR'], 'originalPath': name,
                         'retainedPath': retained, 'sha256': item['sha256']},
                'Candidate protected historical attribution differs: ' + name)
        require(retained in manifest['inputs'] and sha(verifier['raw_file'](root, retained)[1]) == item['sha256'],
                'Candidate protected historical bytes differ: ' + name)
    verifier['verify_additive_history'](root, manifest)
    for name, digest in [(verifier['LEGACY'], verifier['LEGACY_SHA']),
                         (verifier['INVENTORY'], verifier['INVENTORY_SHA'])]:
        require(sha(verifier['raw_file'](root, name)[1]) == digest, 'Candidate inherited policy bytes differ: ' + name)
    transition = {'path': verifier['COMPILER_TRANSITION'], 'sha256': verifier['COMPILER_TRANSITION_SHA']}
    require(manifest['compilerTransition'] == transition
            and sha(verifier['raw_file'](root, transition['path'])[1]) == transition['sha256'],
            'Candidate compiler transition identity differs')
    return {'profile': PROFILE, 'status': 'PACKAGED_INPUT_IDENTITY_PASSED',
            'sourceInputs': len(expected), 'releaseQualified': False}


def checkout(root, selection, object_store, dependency_root, source, tree):
    require(object_store and dependency_root, 'Candidate packaging requires explicit object-store and dependency-root')
    for value in [*object_store, dependency_root]:
        path = pathlib.Path(value)
        require(path.is_absolute() and path == path.resolve() and path.is_dir(), 'Candidate packaging roots must be exact absolute directories')
    verifier, manifest = load_policy(root, selection)
    require(sha(verifier['raw_file'](root, DISPATCHER)[1]) == manifest['inputs'][DISPATCHER]['sha256'],
            'Candidate boundary dispatcher bytes differ')
    command = ['python3', DISPATCHER, '--profile', PROFILE, '--mode', 'checkout', '--source-root', str(root),
               '--dependency-root', str(dependency_root), '--manifest', selection['manifestPath'],
               '--manifest-sha256', selection['manifestSha256'], '--verifier-sha256', selection['verifierSha256'],
               '--schema-sha256', selection['schemaSha256']]
    for store in object_store:
        command.extend(['--object-store', str(store)])
    result = strict_json(subprocess.check_output(command, cwd=root))
    require(result.get('profile') == PROFILE and result.get('mode') == 'checkout'
            and result.get('status') == 'CHECKED_OUT_INPUT_BOUNDARIES_PASSED'
            and result.get('releaseQualified') is False and result.get('externalReviewBound') is False
            and result.get('manifestSha256') == selection['manifestSha256'],
            'Candidate packaging requires checked-out input boundaries without release qualification')
    require(result.get('sourceCommit') == source and result.get('sourceTree') == tree,
            'Candidate boundary result differs from archived source commit/tree')
    return result
