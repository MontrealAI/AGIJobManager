#!/usr/bin/env python3
"""Offline exact-input boundaries. Byte identity is not review or deployment evidence.

This profile deliberately keeps the historical v114 executable untouched. Staged
mode checks a review candidate against the real predecessor; only bound mode
accepts an externally pinned binding to an observed clean full Git revision.
No compilation, provider, package installation or network operation occurs here.
"""
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

BASE = '191cf3590e5cdc08df1bb0af500ee28a91c8b010'
PREDECESSOR = '3c974ad3cb1d828e5c89464fd8424d8ae853d9dd'
PREDECESSOR_TREE = 'a45070671985671c169c6bfa35c5089b1e9674b4'
PROFILE = 'manager-explicit-governor-v1'
LEGACY_CONTEXTS = {
    '6484d09afbba64d7de24cd18ae4dbd246caffd17': 'fb8d1443f705731cfa5dfc89b065b4ca1bcf2ab0',
    '06add2a669f3ed1eb03019ab95cad1cb2095a2c8': '47123ade3e386481f6de1d5f4830c86c016accd3',
}
MANIFEST = 'config/explicit-governor-source-v1.json'
SCHEMA = 'schemas/explicit-governor-source-v1.schema.json'
VERIFIER = 'scripts/release/check-explicit-governor-boundaries.py'
DISPATCHER = 'scripts/release/check-source-boundaries.py'
TESTS = 'scripts/release/test-source-boundary-dispatch.py'
LEGACY = 'scripts/release/check-v114-boundaries.py'
INVENTORY = 'config/next-deployment-contract-changes.json'
REPAIRS = 'config/v114-dependency-repairs.json'
COMPILER_TRANSITION = 'config/compiler-optimizer-transition-v1.json'
COMPILER_TRANSITION_SHA = 'cea91bbdf10799d0045e763142a33d0f01010743564b17c187c35175cdabeab5'
HISTORICAL_RELOCATIONS = {
    'scripts/successor/preservation.test.mjs': 'test/fixtures/preservation.pre-c174-integration.test.mjs.txt',
}
LEGACY_SHA = 'b0b5f608d08866f5b9f66a6d0381a34fc9c1851282113ddf4de2efb4ead54807'
INVENTORY_SHA = '93f50d12f034ab8bdf6f951c48f71c3dd010fa82ab485d2d9f61c21f97d587d5'
CONTRACT_CHANGES = {
    'contracts/utils/ENSOwnership.sol', 'contracts/test/MockENS.sol',
    'contracts/AGIJobManager.sol', 'contracts/ens/ENSJobPages.sol',
    'contracts/periphery/AGIJobPages.sol',
}
# Exact additive archive bytes and their retention provenance. These are not
# current-source execution passes; the external source commit retained them.
ADDITIVE_HISTORY = {
    "docs/qualification/history/expected-mainnet-cutover-v1.18.0.json": {
        "sha256": "36bc8cfb2d3d8e15b04372ea1fbed3fe407a921c0d70b525d673be4447f63746",
        "externalSourceCommit": "eb6f725e0b40ac81e50a374304e54a5ff6859fcf",
        "externalSourcePath": "docs/qualification/history/expected-mainnet-cutover-v1.18.0.json",
        "externalGitBlob": "88af01706186b52d648330edddd911d3fd42678e",
        "scope": "Retained exact historical bytes; no native operator, distinct final governor, provider/wallet or activation clearance."
    },
    "docs/qualification/history/next-deployment-contract-changes-v1.18.0.json": {
        "sha256": "93f50d12f034ab8bdf6f951c48f71c3dd010fa82ab485d2d9f61c21f97d587d5",
        "externalSourceCommit": "eb6f725e0b40ac81e50a374304e54a5ff6859fcf",
        "externalSourcePath": "docs/qualification/history/next-deployment-contract-changes-v1.18.0.json",
        "externalGitBlob": "60c1a5e75515f6612f87dbe808c0e3ac74d94fe8",
        "scope": "Retained exact historical bytes; no native operator, distinct final governor, provider/wallet or activation clearance."
    },
    "docs/qualification/history/mainnet-cutover-3c974ad3-compatibility.json": {
        "sha256": "34d8d737fd540f83317551bdf3e190c0c8d72d7e7aaef60303d0234f4bbfb0b1",
        "externalSourceCommit": "eb6f725e0b40ac81e50a374304e54a5ff6859fcf",
        "externalSourcePath": "docs/qualification/mainnet-cutover-next-deployment.json",
        "externalGitBlob": "334353dd593d147afd8fc9d44410096776fb00d5",
        "scope": "Retained exact historical bytes; no native operator, distinct final governor, provider/wallet or activation clearance."
    }
}

# A finite review slice, not a mutable baseline or blanket directory exclusion.
REVIEW_PATHS = {
    MANIFEST, SCHEMA, VERIFIER, DISPATCHER, TESTS,
    'hardhat/test/job-pages-deployment.test.cjs',
    'hardhat/test/deployment-preflight.test.cjs',
    'hardhat/test/build-catalog.test.cjs',
    COMPILER_TRANSITION, 'hardhat/compiler-optimizer.cjs',
    'scripts/security/check-forge-optimizer.cjs',
    'scripts/security/test-forge-optimizer.cjs',
    'hardhat/hardhat.config.js', 'foundry.toml',
    'hardhat/scripts/deploy.cjs', 'hardhat/scripts/deploy-job-pages.cjs',
    'hardhat/test/compiler-knowledge-base.test.js',
    'hardhat/test/fixtures/SOL-2026-7/reassigned_reference_memory_alias.sol',
    'hardhat/test/fixtures/SOL-2026-7/reassigned_reference_memory_alias_from_storage_minimal.sol',
    'hardhat/test/fixtures/SOL-2026-7/reassigned_reference_storage_alias.sol',
    'docs/security/sol-2026-7-workaround.md',
    'docs/qualification/expected-mainnet-cutover-sol-2026-7.json',
    'docs/qualification/expected-mainnet-cutover-sol-2026-7-provenance.json',
    # Exact current-source fork comparison/provenance slice; no history exclusion.
    '.github/workflows/mainnet-fork.yml',
    'docs/qualification/mainnet-cutover-f274c6be-provenance.json',
    # Exact PR1595 review/order/gate evidence slice; no directory exclusion.
    '.github/workflows/security-verification.yml',
    'docs/security/pr1586-e1ed502-evidence.json',
    'docs/security/pr1586-e1ed502-review.md',
    'scripts/security/run-slither-deterministic.py',
    'scripts/security/run-slither-extended.sh',
    'scripts/security/slither-reviewed-findings-pr1586-e1ed502.json',
    'scripts/security/test-slither-deterministic.py',
    'scripts/security/test-slither-review.py',
    'scripts/security/verify-slither-review.py',
    'hardhat/.env.example', 'docs/DEPLOYMENT_CONFIGURATION.md',
    'docs/deployment/core-external-signing.md',
    'scripts/docs/generate-repo-map.mjs', 'docs/REPO_MAP.md',
    'hardhat/test/core-session-docs.test.cjs',
    'hardhat/scripts/core-creation-plan.cjs',
    'hardhat/scripts/actor-policy.cjs',
    'hardhat/test/direct-origin-policy.test.cjs',
    'hardhat/test/direct-origin-trace.test.js',
    'docs/deployment/direct-origination-profile.md',
    'docs/deployment/ubuntu-ephemeral-creator.md',
    'hardhat.creator.config.mjs',
    'hardhat/scripts/deploy-core-tty.cjs',
    'hardhat/scripts/deploy-core-tty.js',
    'hardhat/scripts/ephemeral-key.cjs',
    'hardhat/test/deploy-core-tty.test.cjs',
    'hardhat/test/deploy-core-tty.test.js',
    'hardhat/test/conventional-creator.test.cjs',
    'hardhat/test/conventional-creator.test.js',
    'hardhat/test/ephemeral-key.test.cjs',
    'hardhat/test/source-qualification.test.cjs',
    'hardhat/scripts/core-creation-verifier.cjs',
    'hardhat/test/core-preflight-rollover.test.cjs',
    'hardhat/scripts/deployment-session.cjs',
    'hardhat/scripts/core-session.cjs',
    'hardhat/test/core-session.test.js',
    'hardhat/test/core-session-revalidation.test.cjs',
    'hardhat/test/core-session-output.test.cjs',
    'hardhat/scripts/operator-paths.cjs',
    'hardhat/scripts/export-verification-package.cjs',
    'hardhat/test/operator-private-state.regression.test.cjs',
    'forge-test/harness/AGIJobManagerHarness.sol',
    'forge-test/unit/AGIJobManagerSecurityVerification.t.sol',
    'forge-test/unit/AGIJobManagerV091Security.t.sol',
    'scripts/qualification/core-session-native.mjs',
    'hardhat/test/helpers/native-core-rpc.cjs',
    'hardhat/test/native-core-session.test.cjs',
    'scripts/qualification/prepare-core-catalog.mjs',
    'docs/qualification/CORE_SESSION_NATIVE.md',
    # Exact integrated-candidate evidence and nonpublishing package slice.
    '.github/workflows/current-state-release.yml',
    'scripts/successor/preservation.test.mjs',
    'test/fixtures/preservation.pre-c174-integration.test.mjs.txt',
    'docs/qualification/mainnet-cutover-integrated-20261017.json',
    'docs/qualification/mainnet-cutover-integrated-20261017-provenance.json',
    'docs/qualification/INTEGRATED_CANDIDATE_20261017.md',
    'scripts/security/slither-reviewed-findings-c174-integrated-yul.json',
    'hardhat/test/nft-registry-native.test.js',
    'hardhat/test/mainnet-cutover.test.js',
    'scripts/release/package-release.py', 'scripts/release/verify-package.py',
    'scripts/release/candidate-profile.py',
    'scripts/release/test-candidate-package-profile.py',
    'scripts/release/release_common.py', 'scripts/release/test-release-gates.py',
}
REVIEW_PATHS.update(ADDITIVE_HISTORY)
LOCAL_MOUNTS = {'node_modules', 'hardhat/node_modules', 'hardhat/artifacts'}
WORKSPACES = ('', 'hardhat/', 'ui/')
DEP_FIELDS = ('dependencies', 'devDependencies', 'optionalDependencies',
              'peerDependencies', 'overrides', 'engines')
COMPILER_CONFIGS = ('hardhat.config.mjs', 'hardhat/hardhat.config.js',
                    'foundry.toml', 'remappings.txt')
CLAIMS = {
    'sourceBoundaries': 'INPUT_IDENTITY_ONLY',
    'finalCleanSourceBinding': 'EXTERNAL_BINDING_REQUIRED',
    'generatedBuildInventory': 'PENDING_SEPARATE_SLICE',
    'packageAndRelease': 'BLOCKED_VERSION_UNSELECTED',
    'candidateCompatibility': 'HISTORICAL_SCOPED_EXECUTION_WORKFLOW_FAILED',
    'distinctGovernorFork': 'NOT_QUALIFIED',
    'nativeSession': 'REQUIRES_SEPARATELY_BOUND_EXECUTION',
    'providerTransportHardware': 'NOT_QUALIFIED',
    'governorConfigurationAndActivation': 'NOT_PERFORMED',
    'independentAudit': 'OMITTED_OWNER_ACCEPTED',
    'sepolia': 'OMITTED_OWNER_ACCEPTED',
}
HEX40 = re.compile(r'[0-9a-f]{40}\Z')
HEX64 = re.compile(r'[0-9a-f]{64}\Z')


class BoundaryError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise BoundaryError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON key: ' + key)
            result[key] = value
        return result
    def invalid(value):
        raise BoundaryError('Non-finite JSON number: ' + value)
    return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)


def path_name(name):
    require(isinstance(name, str) and name and '\\' not in name
            and not any(ord(c) < 32 for c in name), 'Unsafe source path')
    p = pathlib.PurePosixPath(name)
    require(not p.is_absolute() and str(p) == name and
            all(part not in ('.', '..', '.git') for part in p.parts),
            'Unsafe source path: ' + name)
    return name


def exact_root(value):
    p = pathlib.Path(value)
    require(p.is_absolute() and p == p.resolve() and p.is_dir(),
            'Use an exact existing absolute root without symlink aliases')
    return p


def raw_file(root, name):
    path_name(name)
    p = root / name
    for parent in p.parents:
        if parent == root:
            break
        require(not parent.is_symlink(), 'Symlink source ancestor: ' + name)
    try:
        mode = p.lstat().st_mode
    except FileNotFoundError as exc:
        raise BoundaryError('Missing source input: ' + name) from exc
    if stat.S_ISLNK(mode):
        require(name == 'hardhat/contracts' and os.readlink(p) == '../contracts',
                'Unsupported source symlink: ' + name)
        return '120000', b'../contracts'
    require(stat.S_ISREG(mode), 'Source is not a regular file: ' + name)
    return ('100755' if mode & 0o111 else '100644'), p.read_bytes()


def git_env():
    env = {key: value for key, value in os.environ.items()
           if not key.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_SYSTEM='/dev/null',
               GIT_CONFIG_GLOBAL='/dev/null', GIT_NO_REPLACE_OBJECTS='1',
               GIT_TERMINAL_PROMPT='0', GIT_NO_LAZY_FETCH='1',
               GIT_CONFIG_COUNT='3', GIT_CONFIG_KEY_0='protocol.allow', GIT_CONFIG_VALUE_0='never',
               GIT_CONFIG_KEY_1='core.hooksPath', GIT_CONFIG_VALUE_1='/dev/null',
               GIT_CONFIG_KEY_2='core.fsmonitor', GIT_CONFIG_VALUE_2='false')
    return env


class Git:
    def __init__(self, root, fallbacks=()):
        self.fallbacks = tuple(fallbacks)
        self.root = exact_root(root)
        require(self.run('rev-parse', '--show-toplevel').decode().strip() == str(self.root),
                'Git worktree root differs')
        require(not self.run('for-each-ref', '--format=%(refname)', 'refs/replace/').strip(),
                'Git replacement refs are prohibited')
        config = self.run('config', '--local', '--no-includes', '--list').decode()
        require(not re.search(r'(?mi)^(filter\.|include\.|includeif\.|core\.(worktree|attributesfile)=)', config),
                'Git worktree/filter configuration is prohibited')

    def run(self, *args, input=None):
        result = subprocess.run([
            'git', '--no-replace-objects', '-c', 'core.fsmonitor=false',
            '-c', 'core.hooksPath=/dev/null', '-c', 'core.attributesFile=/dev/null',
            '-c', 'protocol.allow=never',
            *args], cwd=self.root, env=git_env(), input=input,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        require(result.returncode == 0,
                'Required Git object/operation unavailable: ' + ' '.join(args[:3]) +
                ': ' + result.stderr.decode(errors='replace').strip())
        return result.stdout

    def tree(self, revision):
        require(bool(HEX40.fullmatch(revision)), 'Git revision must be a full object identity')
        result = {}
        for entry in self.run('ls-tree', '-rz', revision).split(b'\0'):
            if not entry:
                continue
            metadata, name = entry.split(b'\t', 1)
            mode, kind, oid = metadata.decode().split()
            name = path_name(name.decode())
            require(kind == 'blob' and mode in ('100644', '100755', '120000'),
                    'Unsupported tree object: ' + name)
            require(name not in result, 'Duplicate Git tree path')
            result[name] = {'mode': mode, 'gitBlob': oid}
        return result

    def blobs(self, entries, require_all=True):
        ids = sorted({item['gitBlob'] for item in entries.values()})
        data = self.run('cat-file', '--batch', input=('\n'.join(ids) + '\n').encode())
        offset, result = 0, {}
        for expected in ids:
            end = data.index(b'\n', offset)
            header = data[offset:end].decode().split()
            if header == [expected, 'missing']:
                offset = end + 1
                continue
            require(len(header) == 3, 'Malformed raw Git blob response')
            oid, kind, length = header
            require(oid == expected and kind == 'blob', 'Wrong raw Git blob response')
            length = int(length)
            blob = data[end + 1:end + 1 + length]
            require(len(blob) == length and data[end + 1 + length:end + 2 + length] == b'\n',
                    'Truncated raw Git blob')
            require(hashlib.sha1(b'blob ' + str(length).encode() + b'\0' + blob).hexdigest() == oid,
                    'Raw Git blob identity mismatch')
            result[oid] = blob
            offset = end + 2 + length
        require(offset == len(data), 'Unexpected raw Git blob trailer')
        for fallback in self.fallbacks:
            missing = {n: item for n, item in entries.items() if item['gitBlob'] not in result}
            if missing:
                result.update(fallback.blobs(missing, require_all=False))
        if require_all:
            missing = [n for n, item in entries.items() if item['gitBlob'] not in result]
            require(not missing, 'Required original blobs unavailable offline: ' + ', '.join(missing[:5]))
        return result

    def index(self):
        tags = self.run('ls-files', '-v', '-z').split(b'\0')
        require(all(not item or item[:2] == b'H ' for item in tags),
                'Hidden assume-unchanged/skip-worktree index state')
        result = {}
        for item in self.run('ls-files', '--stage', '-z').split(b'\0'):
            if not item:
                continue
            metadata, name = item.split(b'\t', 1)
            mode, oid, stage = metadata.decode().split()
            name = path_name(name.decode())
            require(stage == '0' and name not in result, 'Unmerged/duplicate index input')
            result[name] = {'mode': mode, 'gitBlob': oid}
        return result


def validate_schema(value, spec, root=None, location='$'):
    """Small fail-closed JSON Schema subset; requires no installed Python package."""
    root = spec if root is None else root
    if '$ref' in spec:
        require(set(spec) == {'$ref'}, 'Unsupported schema reference siblings')
        ref = spec['$ref']
        require(ref.startswith('#/$defs/') and ref.count('/') == 2, 'Unsupported schema reference')
        return validate_schema(value, root['$defs'][ref.split('/')[-1]], root, location)
    allowed = {'$schema', '$id', 'title', 'description', '$defs', 'type', 'const',
               'enum', 'required', 'properties', 'additionalProperties', 'patternProperties',
               'items', 'minItems', 'uniqueItems', 'minProperties', 'minLength', 'pattern'}
    require(set(spec) <= allowed, 'Unsupported schema keyword')
    types = {'object': lambda x: isinstance(x, dict), 'array': lambda x: isinstance(x, list),
             'string': lambda x: isinstance(x, str), 'null': lambda x: x is None,
             'integer': lambda x: isinstance(x, int) and not isinstance(x, bool),
             'boolean': lambda x: isinstance(x, bool)}
    if 'type' in spec:
        wanted = spec['type'] if isinstance(spec['type'], list) else [spec['type']]
        require(all(t in types for t in wanted) and any(types[t](value) for t in wanted),
                'Schema type mismatch: ' + location)
    if 'const' in spec:
        require(json.dumps(value, sort_keys=True, separators=(',', ':')) ==
                json.dumps(spec['const'], sort_keys=True, separators=(',', ':')),
                'Schema constant mismatch: ' + location)
    if 'enum' in spec:
        require(value in spec['enum'], 'Schema enum mismatch: ' + location)
    if isinstance(value, dict):
        require(set(spec.get('required', [])) <= set(value), 'Missing schema field: ' + location)
        require(len(value) >= spec.get('minProperties', 0), 'Empty schema inventory: ' + location)
        for key, item in value.items():
            found = False
            if key in spec.get('properties', {}):
                validate_schema(item, spec['properties'][key], root, location + '.' + key)
                found = True
            for pattern, definition in spec.get('patternProperties', {}).items():
                if re.search(pattern, key):
                    validate_schema(item, definition, root, location + '.' + key)
                    found = True
            if not found:
                extra = spec.get('additionalProperties', True)
                require(extra is not False, 'Unknown schema field: ' + location + '.' + key)
                if isinstance(extra, dict):
                    validate_schema(item, extra, root, location + '.' + key)
    if isinstance(value, list):
        require(len(value) >= spec.get('minItems', 0), 'Schema array too short: ' + location)
        if spec.get('uniqueItems'):
            require(len({json.dumps(x, sort_keys=True) for x in value}) == len(value),
                    'Duplicate schema array entry: ' + location)
        for index, item in enumerate(value):
            validate_schema(item, spec.get('items', {}), root, location + '[' + str(index) + ']')
    if isinstance(value, str):
        require(len(value) >= spec.get('minLength', 0), 'Schema string too short: ' + location)
        if 'pattern' in spec:
            require(re.search(spec['pattern'], value) is not None, 'Schema pattern mismatch: ' + location)


def compiler_transition(root, baseline, blobs):
    """One exact reviewed optimizer transition; never a general compiler waiver."""
    mode, data = raw_file(root, COMPILER_TRANSITION)
    require(mode == '100644' and sha(data) == COMPILER_TRANSITION_SHA,
            'Compiler transition record differs from independently reviewed bytes')
    review = strict_json(data)
    require(review['schema'] == 'agijobmanager/compiler-optimizer-transition/v1' and
            review['historicalBaseline'] == BASE and
            set(review['configs']) == {'hardhat/hardhat.config.js', 'foundry.toml'},
            'Compiler transition scope differs')
    for name in COMPILER_CONFIGS:
        if name in review['configs']:
            item = review['configs'][name]
            require(name in baseline and item['beforeGitBlob'] == baseline[name]['gitBlob'] and
                    item['beforeSha256'] == sha(blobs[baseline[name]['gitBlob']]) and
                    item['mode'] == baseline[name]['mode'],
                    'Compiler transition historical identity differs: ' + name)
            current_mode, current = raw_file(root, name)
            require(current_mode == item['mode'] and sha(current) == item['afterSha256'],
                    'Compiler transition candidate identity differs: ' + name)
        elif name in baseline:
            require(raw_file(root, name) == (baseline[name]['mode'], blobs[baseline[name]['gitBlob']]),
                    'Compiler configuration changed: ' + name)
        else:
            require(not (root / name).exists(), 'Previously absent compiler configuration appeared: ' + name)
    require(set(review['helpers']) == {'hardhat/compiler-optimizer.cjs'},
            'Compiler transition helper scope differs')
    for name, item in review['helpers'].items():
        current_mode, current = raw_file(root, name)
        require(current_mode == item['mode'] and sha(current) == item['sha256'],
                'Compiler optimizer helper differs: ' + name)
    return review


def dependency_boundaries(root, objects, *, reviewed_compiler_transition=False):
    """Repeat every inherited invariant, never rewrite inputs to run the old checker."""
    baseline = objects.tree(BASE)
    wanted = {n: baseline[n] for d in WORKSPACES
              for n in (d + 'package.json', d + 'package-lock.json')}
    wanted.update({n: baseline[n] for n in COMPILER_CONFIGS if n in baseline})
    blobs = objects.blobs(wanted)
    def read(name):
        return strict_json(raw_file(root, name)[1])
    def original(name):
        return strict_json(blobs[baseline[name]['gitBlob']])
    def digest(value):
        return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())
    repairs = read(REPAIRS)
    require(repairs['baseline'] == BASE, 'Dependency repair baseline differs')
    actual_vendor = set()
    for path in (root / 'ui/vendor/braces').rglob('*'):
        if path.is_file() or path.is_symlink():
            name = str(path.relative_to(root))
            actual_vendor.add(name)
            require(name in repairs['vendoredFiles'] and
                    sha(raw_file(root, name)[1]) == repairs['vendoredFiles'][name],
                    'Reviewed vendored repair changed: ' + name)
    require(actual_vendor == set(repairs['vendoredFiles']), 'Vendored repair membership differs')
    version = read('package.json')['version']
    for directory in WORKSPACES:
        pkg, old = read(directory + 'package.json'), original(directory + 'package.json')
        require(pkg['version'] == version, 'Workspace release versions differ')
        if directory == 'ui/':
            old['dependencies']['next'] = '15.5.27'
            old['devDependencies'].update({'eslint-config-next': '15.5.27', 'braces': 'file:vendor/braces'})
            old['overrides'].update({'postcss-selector-parser': '7.1.6', 'sharp': '0.35.5',
                                     'source-map-js': '1.2.2', 'braces': '$braces'})
        for field in DEP_FIELDS:
            require(pkg.get(field) == old.get(field), 'Dependency/toolchain field changed: ' + directory + field)
        lock, prior = read(directory + 'package-lock.json'), original(directory + 'package-lock.json')
        require(lock['version'] == lock['packages']['']['version'] == version,
                'Workspace lock release versions differ')
        lock['version'], lock['packages']['']['version'] = prior['version'], prior['packages']['']['version']
        if directory == 'ui/':
            for field in ('dependencies', 'devDependencies'):
                require(lock['packages'][''][field] == old[field], 'UI lock root differs from repairs')
                lock['packages'][''][field] = prior['packages'][''][field]
        changes = repairs['lockChanges'].get(directory + 'package-lock.json', {})
        actual = {name for name in lock['packages'].keys() | prior['packages'].keys()
                  if lock['packages'].get(name) != prior['packages'].get(name)}
        require(actual == set(changes), 'Dependency repair inventory differs: ' + directory)
        for name, review in changes.items():
            require(digest(prior['packages'].get(name)) == review['beforeDigest'] and
                    digest(lock['packages'].get(name)) == review['afterDigest'],
                    'Dependency repair bytes differ: ' + directory + name)
            if name in prior['packages']:
                lock['packages'][name] = prior['packages'][name]
            else:
                lock['packages'].pop(name)
        require(lock == prior, 'Dependency resolution changed: ' + directory)
    require(read('config/usdc-deployment.json')['version'] == version, 'Deployment release version differs')
    if reviewed_compiler_transition:
        compiler_transition(root, baseline, blobs)
    else:
        for name in COMPILER_CONFIGS:
            if name in baseline:
                require(raw_file(root, name) == (baseline[name]['mode'], blobs[baseline[name]['gitBlob']]),
                        'Compiler configuration changed: ' + name)
            else:
                require(not (root / name).exists(), 'Previously absent compiler configuration appeared: ' + name)
    historical = objects.blobs({'ens': baseline['contracts/utils/ENSOwnership.sol']})
    require(raw_file(root, 'test/fixtures/ENSOwnership.pre-revocation.sol.txt')[1] ==
            historical[baseline['contracts/utils/ENSOwnership.sol']['gitBlob']],
            'Historical ENS source fixture differs')
    for name in ('reverify:mainnet', 'reverify:sepolia', 'check:readiness', 'check:readiness:sepolia'):
        require('--no-compile' in read('hardhat/package.json')['scripts'][name],
                name + ' must preserve saved artifacts')
    readiness = raw_file(root, 'hardhat/scripts/check-readiness.cjs')[1].decode()
    require('readRegistrySnapshot' in readiness and 'await checkNftPolicy(' not in readiness,
            'Registry readiness invariant differs')
    require(not list(root.glob('.v114-bootstrap*')), 'Bootstrap material must not ship')


def verify_additive_history(root, manifest):
    require(manifest.get('additiveHistory') == ADDITIVE_HISTORY,
            'Additive history membership/provenance differs')
    for name, item in ADDITIVE_HISTORY.items():
        mode, data = raw_file(root, name)
        oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(mode == '100644' and sha(data) == item['sha256'] and oid == item['externalGitBlob'],
                'Additive historical bytes/mode/Git identity differ: ' + name)


def source_inventory(root, objects, manifest, mode):
    predecessor = objects.tree(PREDECESSOR)
    require(objects.run('rev-parse', PREDECESSOR + '^{tree}').decode().strip() == PREDECESSOR_TREE,
            'Predecessor commit/tree differs')
    old_blobs = objects.blobs(predecessor)
    entries = manifest['inputs']
    require(set(predecessor) <= set(entries), 'Missing predecessor source inventory entries')
    require(set(entries) - set(predecessor) <= REVIEW_PATHS - {MANIFEST},
            'Unreviewed source input additions')
    require(MANIFEST not in entries, 'Manifest cannot hash itself')
    changed = set()
    for name, entry in entries.items():
        path_name(name)
        current_mode, data = raw_file(root, name)
        require(current_mode == entry['mode'] and sha(data) == entry['sha256'],
                'Input bytes/mode differ: ' + name)
        before = predecessor.get(name)
        require(entry['predecessorGitBlob'] == (before['gitBlob'] if before else None),
                'Input predecessor object differs: ' + name)
        prior_sha = sha(old_blobs[before['gitBlob']]) if before else None
        require(entry['predecessorSha256'] == prior_sha, 'Input predecessor digest differs: ' + name)
        if before is None or prior_sha != entry['sha256'] or before['mode'] != entry['mode']:
            changed.add(name)
            require(name in REVIEW_PATHS and entry['reviewReason'], 'Change outside bounded reviewed slice: ' + name)
        else:
            require(entry['reviewReason'] is None, 'Unchanged input falsely marked changed: ' + name)
    require(set(manifest['reviewedInputChanges']) == changed, 'Reviewed input change membership differs')
    # Historical records are independently tied to predecessor bytes, not just a mutable digest.
    protected = {n for n in predecessor if n.startswith(('docs/releases/', 'docs/qualification/history/'))}
    protected.update({LEGACY, INVENTORY, REPAIRS, 'config/successor-builder-source.json',
                      'scripts/successor/preservation.test.mjs',
                      'docs/qualification/mainnet-cutover-next-deployment.json'})
    require(set(manifest['protectedHistory']) == protected, 'Protected history membership differs')
    for name, item in manifest['protectedHistory'].items():
        retained = HISTORICAL_RELOCATIONS.get(name, name)
        require(item == {'originalCommit': PREDECESSOR, 'originalPath': name,
                         'retainedPath': retained, 'sha256': sha(old_blobs[predecessor[name]['gitBlob']])},
                'Historical attribution differs: ' + name)
        require(raw_file(root, retained) == (predecessor[name]['mode'], old_blobs[predecessor[name]['gitBlob']]),
                'Protected historical bytes changed: ' + name)
    require(sha(raw_file(root, LEGACY)[1]) == LEGACY_SHA and
            sha(raw_file(root, INVENTORY)[1]) == INVENTORY_SHA, 'Inherited v114 policy bytes changed')
    verify_additive_history(root, manifest)
    local = Git(root)
    expected_index = predecessor if mode == 'staged' else local.tree(
        local.run('rev-parse', 'HEAD').decode().strip())
    require(local.index() == expected_index, 'Raw index does not match selected source tree')
    untracked = {n.decode() for n in local.run('ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if n}
    mounts = untracked & LOCAL_MOUNTS if mode == 'staged' else set()
    for name in mounts:
        require((root / name).is_symlink(), 'Staged dependency/artifact mount is not a symlink')
    expected_paths = set(entries) | {MANIFEST}
    require(set(expected_index) | (untracked - mounts) == expected_paths,
            'Missing/extra source inventory or untracked source input')
    # Ignore rules cannot conceal added compiler/operator/test inputs. No
    # generated-output or release/package exclusions are changed by this gate.
    for directory in ('contracts', 'hardhat/scripts', 'hardhat/test', 'migrations',
                      'scripts', 'config', 'schemas', 'test', 'forge-test', 'lib',
                      'docs/qualification/history', 'docs/releases'):
        actual = set()
        if (root / directory).exists():
            for path in (root / directory).rglob('*'):
                require(not path.is_symlink(), 'Input subtree symlink is prohibited: ' + str(path))
                if path.is_file():
                    actual.add(str(path.relative_to(root)))
        expected = {n for n in expected_paths if n.startswith(directory + '/')}
        require(actual == expected, 'Extra, missing or ignored source input: ' + directory)
    if mode in ('checkout', 'bound'):
        blobs = local.blobs(expected_index)
        require(not untracked, 'Final source has untracked inputs')
        for name, item in expected_index.items():
            require(raw_file(root, name) == (item['mode'], blobs[item['gitBlob']]),
                    'Final raw worktree/index bytes differ: ' + name)
    return {'inputs': len(entries), 'reviewedChanges': sorted(changed),
            'localUnqualifiedMounts': sorted(mounts)}


def contract_boundaries(root, objects, manifest):
    baseline = {n: e for n, e in objects.tree(BASE).items() if n.startswith('contracts/')}
    old = objects.blobs(baseline)
    current = {n for n in manifest['inputs'] if n.startswith('contracts/')}
    require(current == set(baseline), 'Contract membership differs from original baseline')
    changes = manifest['changedContracts']
    require(set(changes) == CONTRACT_CHANGES, 'Exact five-contract change inventory required')
    actual = set()
    for name, before in baseline.items():
        mode, data = raw_file(root, name)
        if (mode, data) != (before['mode'], old[before['gitBlob']]):
            actual.add(name)
        if name in changes:
            review = changes[name]
            require(review['originalGitBlob'] == before['gitBlob'] and
                    review['beforeSha256'] == sha(old[before['gitBlob']]) and
                    review['afterSha256'] == sha(data) and review['mode'] == mode == before['mode']
                    and review['reason'], 'Contract delta bytes/mode differ: ' + name)
    require(actual == CONTRACT_CHANGES, 'Contract delta membership differs from original baseline')


def compiler_closure(root, manifest, dependency_root):
    """Enumerate every contracts entrypoint and recursively resolve exact Solidity imports."""
    dependency_root = exact_root(dependency_root)
    pending = sorted(n for n in manifest['inputs'] if n.startswith('contracts/') and n.endswith('.sol'))
    closure = {}
    while pending:
        name = pending.pop()
        if name in closure:
            continue
        path_name(name)
        if name.startswith('contracts/'):
            data = raw_file(root, name)[1]
        else:
            require(name.startswith('@openzeppelin/contracts/'), 'Unreviewed compiler import: ' + name)
            # dependency_root is explicit and may be an existing resolved install;
            # no package code is loaded or executed.
            data = raw_file(dependency_root, name)[1]
        closure[name] = sha(data)
        source = re.sub(r'/\*.*?\*/|//[^\n]*', '', data.decode(), flags=re.S)
        for imported in re.findall(r'\bimport\s+(?:[^;]*?\bfrom\s+)?[\"\']([^\"\']+)[\"\']\s*;', source):
            if imported.startswith('.'):
                parts = list(pathlib.PurePosixPath(name).parent.parts)
                for part in pathlib.PurePosixPath(imported).parts:
                    if part == '..':
                        require(parts, 'Compiler import escapes source root')
                        parts.pop()
                    elif part != '.':
                        parts.append(part)
                imported = '/'.join(parts)
            path_name(imported)
            pending.append(imported)
    require(closure == manifest['compilerSourceClosure'], 'Compiler source closure membership/bytes differ')
    require(set(manifest['compilerInstall']) == {'solc/package.json', 'solc/soljson.js',
            '@openzeppelin/contracts/package.json'}, 'Compiler install inventory differs')
    for name, digest in manifest['compilerInstall'].items():
        require(sha(raw_file(dependency_root, name)[1]) == digest, 'Compiler install bytes differ: ' + name)
    require(strict_json(raw_file(dependency_root, 'solc/package.json')[1])['version'] == '0.8.37',
            'Installed compiler version differs')
    require(strict_json(raw_file(dependency_root, '@openzeppelin/contracts/package.json')[1])['version'] == '4.9.6',
            'Installed compiler dependency version differs')
    patches = strict_json(raw_file(root, 'scripts/security/openzeppelin-compiler-patches.json')[1])
    for name, patch in patches['files'].items():
        require(sha(raw_file(dependency_root, '@openzeppelin/contracts/' + name)[1]) == patch['patched'],
                'Pinned compiler compatibility patch differs: ' + name)
    return len(closure)


def check_binding(root, manifest, args):
    require(args.review_binding and args.review_binding_sha256, 'Final clean source requires external review binding')
    path = pathlib.Path(args.review_binding)
    require(path.is_absolute() and path == path.resolve() and root not in path.parents,
            'Review binding must be an external exact path')
    data = path.read_bytes()
    require(sha(data) == args.review_binding_sha256, 'Unreviewed external binding hash')
    binding = strict_json(data)
    keys = {'schema', 'profile', 'sourceCommit', 'sourceTree', 'manifestPath', 'manifestSha256',
            'dispatcherSha256', 'verifierSha256', 'schemaSha256', 'lockSha256', 'disposition'}
    require(isinstance(binding, dict) and set(binding) == keys, 'External binding fields differ')
    require(binding['schema'] == 'agijobmanager/source-review-binding/v1' and
            binding['profile'] == PROFILE and binding['manifestPath'] == MANIFEST and
            binding['disposition'] == 'SOURCE_BOUNDARIES_ONLY_NOT_RELEASE_QUALIFICATION',
            'External binding scope differs')
    git = Git(root)
    require(bool(HEX40.fullmatch(binding['sourceCommit'])) and bool(HEX40.fullmatch(binding['sourceTree'])),
            'External binding requires complete commit/tree identities')
    require(git.run('rev-parse', 'HEAD').decode().strip() == binding['sourceCommit'] and
            git.run('rev-parse', 'HEAD^{tree}').decode().strip() == binding['sourceTree'],
            'Final source revision differs from external review binding')
    require(binding['sourceCommit'] != PREDECESSOR, 'Predecessor cannot be the final source revision')
    for key, name in [('manifestSha256', MANIFEST), ('dispatcherSha256', DISPATCHER),
                      ('verifierSha256', VERIFIER), ('schemaSha256', SCHEMA)]:
        require(binding[key] == sha(raw_file(root, name)[1]), 'External binding digest differs: ' + key)
    require(binding['manifestSha256'] == args.manifest_sha256 and
            binding['verifierSha256'] == args.verifier_sha256 and binding['schemaSha256'] == args.schema_sha256,
            'Conflicting externally pinned policy identities')
    require(binding['lockSha256'] == {d + 'package-lock.json': sha(raw_file(root, d + 'package-lock.json')[1])
                                    for d in WORKSPACES}, 'External binding lock inventory differs')
    return {'sourceCommit': binding['sourceCommit'], 'sourceTree': binding['sourceTree']}


def verify_explicit(args):
    require(args.mode in ('staged', 'checkout', 'bound'), 'Unsupported explicit source mode')
    root = exact_root(args.source_root)
    stores = args.object_store or [str(root)]
    objects = Git(stores[0], [Git(p) for p in stores[1:]] + [Git(root)])
    require(args.manifest == MANIFEST, 'Explicit profile requires its exact manifest path')
    data = raw_file(root, MANIFEST)[1]
    require(sha(data) == args.manifest_sha256, 'Unreviewed manifest hash')
    schema_data = raw_file(root, SCHEMA)[1]
    require(sha(schema_data) == args.schema_sha256, 'Unreviewed schema hash')
    require(sha(raw_file(root, VERIFIER)[1]) == args.verifier_sha256,
            'Selected source verifier differs from executed verifier pin')
    manifest, schema = strict_json(data), strict_json(schema_data)
    validate_schema(manifest, schema)
    require(manifest['schema'] == 'agijobmanager/explicit-governor-source/v1' and manifest['profile'] == PROFILE,
            'Conflicting profile/schema selection')
    require(manifest['baseline'] == BASE and manifest['predecessor'] == {
        'commit': PREDECESSOR, 'tree': PREDECESSOR_TREE}, 'Wrong source baseline/predecessor')
    require(manifest['releaseIdentity'] == {'status': 'unselected', 'version': None}, 'Release selection is outside slice A')
    require(manifest['claims'] == CLAIMS, 'Claim scope or omission state changed')
    require(manifest['compilerTransition'] == {'path': COMPILER_TRANSITION, 'sha256': COMPILER_TRANSITION_SHA},
            'Compiler transition manifest identity differs')
    dependency_boundaries(root, objects, reviewed_compiler_transition=True)
    observed = source_inventory(root, objects, manifest, args.mode)
    contract_boundaries(root, objects, manifest)
    observed['compilerSourceUnits'] = compiler_closure(root, manifest, args.dependency_root or str((root / 'node_modules').resolve()))
    if args.mode == 'bound':
        observed.update(check_binding(root, manifest, args))
    else:
        require(not args.review_binding and not args.review_binding_sha256,
                'Input-identity checks cannot claim an external final binding')
        if args.mode == 'checkout':
            git = Git(root)
            observed.update(sourceCommit=git.run('rev-parse', 'HEAD').decode().strip(),
                            sourceTree=git.run('rev-parse', 'HEAD^{tree}').decode().strip())
    statuses = {'staged': 'STAGED_INPUT_BOUNDARIES_PASSED',
                'checkout': 'CHECKED_OUT_INPUT_BOUNDARIES_PASSED',
                'bound': 'CLEAN_SOURCE_BOUNDARIES_PASSED'}
    return {'profile': PROFILE, 'status': statuses[args.mode], 'releaseQualified': False,
            'externalReviewBound': args.mode == 'bound',
            'mode': args.mode, 'manifestSha256': sha(data), **observed}


def verify_legacy(args):
    require(args.mode == 'bound', 'Legacy execution requires its original clean source context')
    require(not any((args.manifest, args.manifest_sha256, args.schema_sha256,
                     args.review_binding, args.review_binding_sha256, args.dependency_root)),
            'Conflicting explicit-profile options on legacy route')
    require(args.source_commit and args.source_tree and HEX40.fullmatch(args.source_commit)
            and HEX40.fullmatch(args.source_tree), 'Legacy route requires exact original source commit/tree')
    require(LEGACY_CONTEXTS.get(args.source_commit) == args.source_tree,
            'Legacy route requires an explicitly retained original context')
    root, git = exact_root(args.source_root), Git(args.source_root)
    require(git.run('rev-parse', 'HEAD').decode().strip() == args.source_commit and
            git.run('rev-parse', 'HEAD^{tree}').decode().strip() == args.source_tree,
            'Legacy source revision mismatch')
    entries = git.tree(args.source_commit)
    require(git.index() == entries, 'Legacy index differs from original source')
    require(not git.run('ls-files', '--others', '--exclude-standard').strip(), 'Legacy source contains untracked files')
    blobs = git.blobs(entries)
    for name, item in entries.items():
        require(raw_file(root, name) == (item['mode'], blobs[item['gitBlob']]), 'Legacy raw source differs: ' + name)
    require(sha(raw_file(root, LEGACY)[1]) == LEGACY_SHA and
            sha(raw_file(root, INVENTORY)[1]) == INVENTORY_SHA, 'Original v114 checker/inventory bytes required')
    # Run exactly the historical executable in its own source context. No fallback.
    result = subprocess.run(['python3', str(root / LEGACY)], cwd=root, env=git_env(),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    require(result.returncode == 0, 'Original v114 checker failed: ' + (result.stderr or result.stdout).strip())
    return {'profile': 'legacy-v114', 'status': 'ORIGINAL_SOURCE_BOUNDARIES_PASSED',
            'sourceCommit': args.source_commit, 'sourceTree': args.source_tree,
            'releaseQualified': False, 'historicalOutput': result.stdout.strip()}
