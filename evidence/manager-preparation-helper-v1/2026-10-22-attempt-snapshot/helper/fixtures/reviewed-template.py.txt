"""Finite v1.20.0 Discovery release source identity; hosted qualification is separate."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
REPOSITORY = 'MontrealAI/AGIJobManager'
PROFILE = 'manager-discovery-release-v1'
VERSION = '1.20.0'
TITLE = 'v1.20.0 — Discovery Lab admission'
BASE_COMMIT = '900bb4b46cb7de7f6f69f553a5687866f978a413'
BASE_TREE = 'bc42f0b295a649900667dcb1c487122726df7a02'
FEATURE_COMMIT = '68d1d3cae2e6f2d46c21e8e73311d309b2b307fd'
FEATURE_TREE = 'c96140e3e0db9e47a68cab5883bb900ce9670912'
MANIFEST = 'config/manager-discovery-release-v1.json'
BASELINE = 'config/discovery-release-baseline-v1.json'
VERIFIER = 'scripts/release/discovery-release-profile.py'
NATIVE_PIN = 'config/discovery-release-alpha-source-v1.json'
ADAPTER_FILES = ('scripts/integrations/discovery-lab-work-request.mjs',
                 'scripts/integrations/discovery-lab-contract.mjs',
                 'scripts/integrations/discovery-release-native-test.mjs',
                 'scripts/integrations/discovery-release-module-closure.mjs',
                 'scripts/integrations/discovery-installed-operator.mjs',
                 'scripts/integrations/discovery-installed-runtime.mjs')
COMPILER_MANIFEST = 'config/explicit-governor-source-v1.json'
COMPILER_MANIFEST_SHA256 = '83cd0976000a74d8c8ac3b5fd21c90ba48068c5ef87582dd6ba926e2b62c01e2'
QUALIFICATION = 'PENDING_EXACT_FINAL_SOURCE_HOSTED_EXECUTION'
ALPHA_REPOSITORY = 'MontrealAI/AGI-Alpha-Agent-v0'
CATALOG = 'docs/successor/capabilities/sources.json'
INSPECTOR = 'examples/successor-capability/discovery-lab-inspector.mjs'
CAPSULE = 'discovery-alpha'
CAPSULE_MANIFEST = 'DISCOVERY_ALPHA_CAPSULE.json'
BROWSER_CAPSULE = 'discovery-browser'
BROWSER_MANIFEST = 'DISCOVERY_BROWSER_INPUT.json'
APACHE_LICENSE_SHA256 = 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4'
REQUIRED_ALPHA_SOURCES = {
    'examples/successor-capability/discovery-lab.mjs',
    'examples/successor-capability/discovery-lab-checker.mjs',
    'examples/successor-capability/discovery-lab-contract.mjs',
    'examples/successor-capability/discovery-lab-history.mjs',
    'examples/successor-capability/discovery-lab-artifacts.mjs',
    'examples/successor-capability/workspace.mjs',
}
PACKAGE_FILES = ('package.json', 'package-lock.json', 'hardhat/package.json',
                 'hardhat/package-lock.json', 'ui/package.json', 'ui/package-lock.json')
NEXT_PATCH_INTEGRITIES = {'node_modules/@next/env': 'sha512-xxW5EBI8fMPuVTPBW7LL980IRbuDXlbkUAwp9DDhtb4Lnich3nJ13uYpvrX4VE74hWPf6AvHHAMmGCidcHjbfg==',
 'node_modules/@next/eslint-plugin-next': 'sha512-EsR/G+skBFfu8Z35P6V/yuu4IV8zkZXIssGOgIRD0ZXqB4CTEuEHQC1ySOQi31u4xjmgHVAdG1RT3QAasRmcZA==',
 'node_modules/@next/swc-darwin-arm64': 'sha512-dPoQYXcfSIqx5o+TOXVXO7kONK5qbtNRDeiTfII0bT3puGIT6VF5e0QwmxNZfEZ5Zety5f3m9P/p4xqwfiLlPg==',
 'node_modules/@next/swc-darwin-x64': 'sha512-RgCJ7buBivTH+6sddqaVm+/v8kwMHlFkobvdt3DfETutws5HrxnToMIWSN9X3MZ3aAi7BbKrGZZWUDQLEycXqw==',
 'node_modules/@next/swc-linux-arm64-gnu': 'sha512-OHXQe13olE59aKe++zHavGcJPh5SLHXi6Anret3BBeq1+qhSuOJDNAli/EDDfxs6UTqA4Qddo4uyYry2slyjiQ==',
 'node_modules/@next/swc-linux-arm64-musl': 'sha512-nTB7bB6vfn4ezCJNYP43ukt2o8L3+WxKF/sTcTxepdXsJh3SM9RhlU7wrZYbH7L4HO5M87dqDTwm8587vAkCiw==',
 'node_modules/@next/swc-linux-x64-gnu': 'sha512-WXCfVI32rW3xCusoUX1RpZKtyChWU2Zwe27JUDmM3KrXwcDNc9vV4zEq0GKFAURnuQ/Ouo/XqPvB0yh445XZCg==',
 'node_modules/@next/swc-linux-x64-musl': 'sha512-Miq+NDb/HWsXuxseYxMM6fuEOQXgTziarkKIRpVKCn8W69cEfhQaQr+90pO+u4q2CbJR2wzXmUuCFyZaJs/Nng==',
 'node_modules/@next/swc-win32-arm64-msvc': 'sha512-5LR79lemgDlgxvG7MQJ+zHCkVcrUoQuO7CiIvq3I58vNW4goSOE2b+19Z6FujRWMouvni4gvudYFuFuNxolGWA==',
 'node_modules/@next/swc-win32-x64-msvc': 'sha512-GNipvXUYROSTf4PXEyH95FrWImIB5zdaK6uEOg0RP1/X2drnvoMwiBkJ0VWdzX7w3iiBm3y5g2TxkKDGVTOQcg==',
 'node_modules/eslint-config-next': 'sha512-FQkDceHNJVfMa2rKbBQKyVILq7nG/zd2TxKsjecJAIv/dOcqaZynK5shwQCt6qrZFFae/EukOFggSP0jtNSLAA==',
 'node_modules/next': 'sha512-JjhLBBY1PNnuwPtcZ7t8yxVeJVYvD2Jyp633J+gRCNbzSt7N0E+xqCf6uQiff3+3qmUkwcF/ksfSsK1xsZ76Tw=='}
# These literals are generated only after the complete finite delta is reviewed.
# BEGIN FROZEN DISCOVERY DELTA
BASELINE_SHA256 = ''
MODIFIED = {}
ADDITIONS = {}
PROJECTIONS = {}
PROTECTED = {}
# END FROZEN DISCOVERY DELTA


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def valid_sha(value, length=40):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{' + str(length) + '}', value) is not None


def same(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(right, sort_keys=True, separators=(',', ':'), allow_nan=False)


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate Discovery JSON key')
            result[key] = value
        return result
    def constant(value):
        raise ValueError('Nonfinite Discovery JSON number: ' + value)
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def safe_path(name):
    return isinstance(name, str) and name and not name.startswith('/') and '\\' not in name and not any(ord(character) < 32 for character in name) and all(part and part not in ('.', '..', '.git') for part in name.split('/'))


def read(root, name, *, regular=False, limit=32_000_000):
    require(safe_path(name), 'Unsafe Discovery source path')
    root = pathlib.Path(root)
    target = root / name
    parent = target.parent
    while parent != root:
        require(not parent.is_symlink(), 'Indirect Discovery source ancestor')
        parent = parent.parent
    if target.is_symlink():
        require(not regular and name == 'hardhat/contracts' and os.readlink(target) == '../contracts', 'Unexpected Discovery source symlink')
        return '120000', b'../contracts'
    descriptor = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(descriptor)
        require(stat.S_ISREG(before.st_mode) and before.st_size <= limit, 'Discovery source is not a bounded regular file')
        with os.fdopen(descriptor, 'rb', closefd=False) as stream:
            raw = stream.read(limit + 1)
        after = os.fstat(descriptor)
        require(len(raw) == before.st_size and all(getattr(before, key) == getattr(after, key) for key in ('st_dev', 'st_ino', 'st_mode', 'st_size', 'st_mtime_ns', 'st_ctime_ns')), 'Discovery source changed during capture')
        current = target.stat(follow_symlinks=False)
        require(current.st_dev == before.st_dev and current.st_ino == before.st_ino and current.st_mode == before.st_mode, 'Discovery source identity changed during capture')
        return ('100755' if before.st_mode & 0o111 else '100644'), raw
    finally:
        os.close(descriptor)


def tree_digest(entries):
    tree = {}
    for name, item in entries.items():
        require(safe_path(name) and isinstance(item, dict) and set(item) == {'mode', 'blob'} and item['mode'] in ('100644', '100755', '120000') and valid_sha(item['blob']), 'Invalid Discovery baseline Git entry')
        node = tree
        parts = name.split('/')
        for part in parts[:-1]:
            node = node.setdefault(part, {})
            require(isinstance(node, dict) and 'blob' not in node, 'Discovery baseline path collision')
        require(parts[-1] not in node, 'Discovery baseline path collision')
        node[parts[-1]] = item
    def encode(node):
        raw = b''
        for name in sorted(node, key=lambda key: key.encode() + (b'/' if 'blob' not in node[key] else b'')):
            item = node[name]
            leaf = 'blob' in item
            mode, digest = (item['mode'], item['blob']) if leaf else ('40000', encode(item))
            raw += mode.encode() + b' ' + name.encode() + b'\0' + bytes.fromhex(digest)
        return hashlib.sha1(b'tree ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    return encode(tree)


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None and type(published) is bool, 'Discovery release selection differs')
    require(valid_sha(manifest_sha256, 64) and valid_sha(verifier_sha256, 64), 'Externally reviewed Discovery manifest and verifier pins are mandatory')
    return {'releaseProfile': PROFILE, 'manifestPath': MANIFEST, 'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256}


def baseline(root):
    raw = read(root, BASELINE)[1]
    require(valid_sha(BASELINE_SHA256, 64) and sha(raw) == BASELINE_SHA256, 'Immutable published Discovery baseline bytes differ')
    previous = strict_json(raw)
    require(isinstance(previous, dict) and set(previous) == {'repository', 'commit', 'tree', 'entries', 'originals'} and previous['repository'] == REPOSITORY and previous['commit'] == BASE_COMMIT and previous['tree'] == BASE_TREE and tree_digest(previous['entries']) == BASE_TREE, 'Published v1.19.6 baseline identity differs')
    require(set(previous['originals']) == set(MODIFIED), 'Discovery inverse projection inventory differs')
    for name, text in previous['originals'].items():
        require(isinstance(text, str) and blob(text.encode()) == previous['entries'][name]['blob'], 'Discovery original baseline bytes differ: ' + name)
    return previous


def inventory(root, selection):
    require(same(selection, select(manifest=selection.get('manifestPath'), manifest_sha256=selection.get('manifestSha256'), verifier_sha256=selection.get('verifierSha256'))), 'Discovery release selection fields differ')
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Discovery release verifier pin differs')
    raw = read(root, MANIFEST)[1]
    require(sha(raw) == selection['manifestSha256'], 'Discovery release manifest pin differs')
    previous = baseline(root)
    manifest = strict_json(raw)
    require(isinstance(manifest, dict) and set(manifest) == {'schema', 'repository', 'profile', 'version', 'baseCommit', 'baseTree', 'qualification', 'changes'} and manifest['schema'] == 'agijobmanager/discovery-release-profile/v1' and manifest['repository'] == REPOSITORY and manifest['profile'] == PROFILE and manifest['version'] == VERSION and manifest['baseCommit'] == BASE_COMMIT and manifest['baseTree'] == BASE_TREE and manifest['qualification'] == QUALIFICATION, 'Discovery release manifest identity or qualification differs')
    require(not (set(PROTECTED) & set(MODIFIED)), 'Historical Discovery or maintenance controls cannot be selected for modification')
    for name, digest in PROTECTED.items():
        require(sha(read(root, name)[1]) == digest, 'Immutable historical policy or guard differs: ' + name)
    changes = manifest['changes']
    require(isinstance(changes, dict) and set(changes) == set(MODIFIED) | set(ADDITIONS), 'Discovery release exact delta inventory differs')
    expected = {name: dict(item) for name, item in previous['entries'].items()}
    for name, after in {**MODIFIED, **ADDITIONS}.items():
        require(safe_path(name) and isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] in ('100644', '100755') and valid_sha(after['sha256'], 64), 'Discovery fixed input identity differs')
        change = changes[name]
        require(isinstance(change, dict) and set(change) == {'before', 'after', 'reason'} and same(change['before'], previous['entries'].get(name)) and same(change['after'], after) and isinstance(change['reason'], str) and change['reason'].strip(), 'Discovery change attribution or fixed bytes differ: ' + name)
        require((name in MODIFIED) == (name in previous['entries']), 'Discovery addition/modification differs: ' + name)
        expected[name] = dict(after)
    expected[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    expected[VERIFIER] = {'mode': '100644', 'sha256': selection['verifierSha256']}
    expected[BASELINE] = {'mode': '100644', 'sha256': BASELINE_SHA256}
    return expected, previous


def validate_projections(root, previous):
    require(set(PROJECTIONS) == set(MODIFIED), 'Discovery exact reverse projection paths differ')
    for name, edits in PROJECTIONS.items():
        original = previous['originals'][name]
        expected = original
        for start, before, after in reversed(edits):
            require(type(start) is int and start >= 0 and expected[start:start + len(before)] == before, 'Immutable Discovery projection differs')
            expected = expected[:start] + after + expected[start + len(before):]
        actual = read(root, name)[1].decode('utf8')
        require(actual == expected, 'Discovery shared source changed beyond exact reviewed edits: ' + name)
        restored = actual
        for start, before, after in edits:
            require(restored[start:start + len(after)] == after, 'Discovery inverse projection differs')
            restored = restored[:start] + before + restored[start + len(after):]
        require(restored == original and blob(restored.encode()) == previous['entries'][name]['blob'], 'Discovery projection did not reproduce published v1.19.6 bytes')


def restore_next_security_patch(name, before, after):
    if name not in ('ui/package.json', 'ui/package-lock.json'):
        return
    original = before['packages'][''] if name.endswith('package-lock.json') else before
    current = after['packages'][''] if name.endswith('package-lock.json') else after
    for section, package in (('dependencies', 'next'), ('devDependencies', 'eslint-config-next')):
        require(original[section][package] == '15.5.27' and current[section][package] == '15.5.28',
                'Discovery Next security patch pin differs: ' + package)
        current[section][package] = original[section][package]
    if not name.endswith('package-lock.json'):
        return
    for path, integrity in NEXT_PATCH_INTEGRITIES.items():
        previous = before['packages'][path]
        require(previous['version'] == '15.5.27'
                and previous['resolved'].endswith('-15.5.27.tgz'),
                'Discovery Next predecessor record differs: ' + path)
        expected = strict_json(json.dumps(previous))
        expected.update(version='15.5.28', integrity=integrity,
                        resolved=previous['resolved'][:-len('15.5.27.tgz')] + '15.5.28.tgz')
        if path == 'node_modules/next':
            require(expected['dependencies']['@next/env'] == '15.5.27', 'Discovery Next env predecessor differs')
            expected['dependencies']['@next/env'] = '15.5.28'
            optional = expected['optionalDependencies']
            require(optional['sharp'] == '^0.34.3 || ^0.35.4', 'Discovery Next sharp predecessor differs')
            optional['sharp'] = '^0.34.3 || ^0.35.5'
            for package in optional:
                if package.startswith('@next/swc-'):
                    require(optional[package] == '15.5.27', 'Discovery Next SWC predecessor differs')
                    optional[package] = '15.5.28'
        elif path == 'node_modules/eslint-config-next':
            require(expected['dependencies']['@next/eslint-plugin-next'] == '15.5.27',
                    'Discovery Next ESLint predecessor differs')
            expected['dependencies']['@next/eslint-plugin-next'] = '15.5.28'
        require(same(after['packages'][path], expected), 'Discovery Next security package record differs: ' + path)
        after['packages'][path] = previous


def validate_packages(root, previous):
    for name in PACKAGE_FILES:
        require(name in MODIFIED, 'Discovery software labels must be explicitly versioned: ' + name)
        before = strict_json(previous['originals'][name])
        after = strict_json(read(root, name)[1])
        require(after.get('version') == VERSION, 'Discovery package version differs: ' + name)
        after['version'] = before['version']
        if name.endswith('package-lock.json'):
            require(after['packages']['']['version'] == VERSION, 'Discovery lock root version differs')
            after['packages']['']['version'] = before['packages']['']['version']
        restore_next_security_patch(name, before, after)
        require(same(after, before), 'Discovery changed a dependency, command or compiler setting: ' + name)
    before = strict_json(previous['originals']['config/usdc-deployment.json'])
    after = strict_json(read(root, 'config/usdc-deployment.json')[1])
    require(after.get('version') == VERSION, 'Discovery deployment software label differs')
    after['version'] = before['version']
    require(same(after, before), 'Discovery changed deployed contract, owner, transaction or intake configuration')


def validate_source(root, selection, paths=None):
    root = pathlib.Path(root)
    expected, previous = inventory(root, selection)
    actual = set(paths) if paths is not None else {path.relative_to(root).as_posix() for path in root.rglob('*') if path.is_file() or path.is_symlink()}
    require(actual == set(expected), 'Discovery release source has missing or unexpected inputs')
    for name, item in expected.items():
        mode, raw = read(root, name)
        require(mode == item['mode'] and (sha(raw) if 'sha256' in item else blob(raw)) == item.get('sha256', item.get('blob')), 'Discovery release bytes or mode differ: ' + name)
    validate_projections(root, previous)
    validate_packages(root, previous)
    return {'profile': PROFILE, 'version': VERSION, 'baseCommit': BASE_COMMIT, 'baseTree': BASE_TREE, 'sourceInputs': len(expected), 'qualification': QUALIFICATION, 'releaseQualified': False, 'publicationApproved': False, 'executionApproved': False, 'nativeExecutionQualified': False}


def metadata(selection):
    return {'releaseProfile': PROFILE, 'releasePolicy': dict(selection), 'qualification': 'Finite reviewed Discovery release source identity only. Fresh exact-final-source hosted qualification of all nine workflows, installed native closure and managed attestations remain external requirements; no execution or settlement authority.'}


def validate_metadata(manifest, selection):
    fields = {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files', 'releaseProfile', 'releasePolicy'}
    require(set(manifest) == fields and type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 2 and manifest['repository'] == REPOSITORY and manifest['tag'] == 'v' + VERSION and manifest['name'] == TITLE and manifest['stage'] == 'source-package' and valid_sha(manifest['sourceCommit']) and valid_sha(manifest['sourceTree']), 'Discovery release package identity differs')
    for key, value in metadata(selection).items():
        require(same(manifest[key], value), 'Discovery package policy or claim differs: ' + key)


def git(root, *arguments, work_tree=True):
    environment = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    environment.update({'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_SYSTEM': '/dev/null', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_REPLACE_OBJECTS': '1', 'GIT_OPTIONAL_LOCKS': '0', 'GIT_TERMINAL_PROMPT': '0', 'GIT_NO_LAZY_FETCH': '1'})
    return subprocess.check_output(['git', '--no-replace-objects', '--no-pager', '-C', str(root), *(['--work-tree=' + str(root)] if work_tree else []), '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.attributesFile=/dev/null', '-c', 'protocol.allow=never', *arguments], env=environment, timeout=30)



def audit_git_main_config(root):
    """Inspect inert main metadata before Git can activate per-worktree configuration."""
    root = pathlib.Path(root)
    metadata = root / '.git'
    require(metadata.is_dir() and not metadata.is_symlink()
            and metadata.resolve() == metadata and not os.path.lexists(metadata / 'commondir'),
            'Discovery root is not the actual Git worktree root')
    def metadata_bytes(target):
        before_path = target.lstat()
        require(stat.S_ISREG(before_path.st_mode) and before_path.st_size <= 128_000,
                'Discovery Git configuration is prohibited: metadata must be bounded and regular')
        descriptor = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            before = os.fstat(descriptor)
            require(stat.S_ISREG(before.st_mode) and before.st_size <= 128_000,
                    'Discovery Git configuration is prohibited: metadata must be bounded and regular')
            with os.fdopen(descriptor, 'rb', closefd=False) as stream:
                raw = stream.read(128_001)
            after = os.fstat(descriptor)
            current = target.lstat()
            fields = ('st_dev', 'st_ino', 'st_mode', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
            require(len(raw) == before.st_size and all(getattr(before, field) == getattr(after, field)
                    == getattr(current, field) for field in fields),
                    'Discovery Git configuration is prohibited: metadata changed during capture')
            return raw
        finally:
            os.close(descriptor)
    config = metadata_bytes(metadata / 'config').decode('utf8')
    require('\0' not in config, 'Discovery Git configuration is prohibited: unsupported encoding')
    section, gc_auto_seen = None, False
    for line in config.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(('#', ';')):
            continue
        # A continued value or ambiguous section must not conceal an activating flag.
        require(not line.rstrip().endswith('\\'),
                'Discovery Git configuration is prohibited: multiline values are unsupported')
        header = re.fullmatch(r'\s*\[\s*([A-Za-z][A-Za-z0-9-]*)(?:\s+"(?:[^"\\]|\\.)*")?\s*\]\s*(?:[#;].*)?', line)
        if header:
            section = header[1].lower()
            require(section in ('core', 'remote', 'branch', 'extensions', 'http', 'gc'),
                    'Discovery Git configuration is prohibited: unsupported namespace')
            require(section not in ('core', 'extensions', 'gc') or '"' not in line.split(']', 1)[0],
                    'Discovery Git configuration is prohibited: ambiguous core or extensions subsection')
            continue
        entry = re.fullmatch(r'\s*([A-Za-z][A-Za-z0-9-]*)(?:\s*=\s*(.*))?\s*', line)
        require(section is not None and entry is not None,
                'Discovery Git configuration is prohibited: unsupported main syntax')
        key = entry[1].lower()
        if section == 'gc':
            require(key == 'auto' and not gc_auto_seen and entry[2] is not None
                    and re.fullmatch(r'0\s*(?:[#;].*)?', entry[2]),
                    'Discovery Git configuration is prohibited: only literal gc.auto=0 is supported')
            gc_auto_seen = True
        require(not (section == 'core' and key in ('worktree', 'attributesfile', 'sshcommand', 'gitproxy', 'alternaterefscommand', 'fsmonitor', 'hookspath'))
                and not (section == 'extensions' and key == 'partialclone')
                and not (section == 'remote' and key in ('uploadpack', 'receivepack', 'promisor', 'vcs', 'proxy', 'proxyauthmethod'))
                and not (section == 'http' and key in ('proxy', 'proxyauthmethod')),
                'Discovery Git configuration is prohibited: redirected or executable main key')
        if section == 'extensions' and key == 'worktreeconfig':
            require(entry[2] is not None and re.fullmatch(r'false\s*(?:[#;].*)?', entry[2], re.IGNORECASE),
                    'Discovery Git configuration is prohibited: active or uncertain worktree configuration')
    # Git ignores this file when the only accepted main flag is absent or literal false.
    # Keep the ignored bytes in place; reject nonregular/oversized metadata without reading it through Git.
    ignored = metadata / 'config.worktree'
    try:
        ignored.lstat()
    except FileNotFoundError:
        pass
    else:
        metadata_bytes(ignored)
    return root


def authenticate_git_root(root):
    root = pathlib.Path(root)
    require(pathlib.Path(root).is_absolute() and pathlib.Path(root).resolve() == pathlib.Path(root), 'Discovery requires an absolute real installed root')
    audit_git_main_config(root)
    require(pathlib.Path(git(root, 'rev-parse', '--show-toplevel', work_tree=False).decode().strip()).resolve() == root, 'Discovery root is not the actual Git worktree root')
    config = git(root, 'config', '--local', '--no-includes', '--list').decode()
    require(all(row.split('=', 1)[0].split('.', 1)[0].lower() in ('core', 'remote', 'branch', 'extensions', 'http', 'gc') for row in config.splitlines() if row), 'Discovery Git helper configuration is prohibited')
    prohibited = r'(?mi)^(filter\.|include\.|includeif\.|protocol\.|core\.(worktree|attributesfile|sshcommand|gitproxy|alternaterefscommand)=|extensions\.partialclone=|remote\..*\.(uploadpack|receivepack|promisor|vcs)=)'
    require(not re.search(prohibited, config), 'Discovery Git worktree, filter or included configuration is prohibited')
    packs = pathlib.Path(git(root, 'rev-parse', '--git-path', 'objects/pack').decode().strip())
    packs = packs if packs.is_absolute() else root / packs
    require(not any(packs.glob('*.promisor')), 'Promisor Discovery object packs are prohibited')
    return root


def git_identity(root):
    root = authenticate_git_root(root)
    identity = {'commit': git(root, 'rev-parse', 'HEAD').decode().strip(),
                'tree': git(root, 'rev-parse', 'HEAD^{tree}').decode().strip()}
    require(all(valid_sha(value) for value in identity.values()), 'Discovery Git identity is malformed')
    return identity


def git_checkout(root, commit, tree, *, ancestor=None):
    require(valid_sha(commit) and valid_sha(tree), 'Discovery Git identity is malformed')
    root = pathlib.Path(root)
    identity = git_identity(root)
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Complete Discovery source ancestry is required')
    grafts = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    require(not (grafts if grafts.is_absolute() else root / grafts).exists() and not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'Replaced or grafted Discovery history is prohibited')
    require(identity == {'commit': commit, 'tree': tree}, 'Installed Discovery checkout identity differs')
    if ancestor is not None:
        require(git(root, 'rev-parse', ancestor[0] + '^{tree}').decode().strip() == ancestor[1], 'Published v1.19.6 predecessor differs')
        git(root, 'merge-base', '--is-ancestor', ancestor[0], commit)
    require(not git(root, 'status', '--porcelain', '--untracked-files=all').strip(), 'Discovery checkout has changed or untracked inputs')
    entries, index = {}, {}
    for row in git(root, 'ls-tree', '-rz', commit).split(b'\0'):
        if not row:
            continue
        details, name = row.split(b'\t', 1)
        mode, kind, oid = details.decode().split()
        require(kind == 'blob', 'Unsupported Discovery Git object')
        entries[name.decode()] = (mode, oid)
    for row in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not row:
            continue
        details, name = row.split(b'\t', 1)
        mode, oid, stage = details.decode().split()
        require(stage == '0' and name.decode() not in index, 'Unmerged Discovery source index')
        index[name.decode()] = (mode, oid)
    require(index == entries, 'Discovery index differs from source tree')
    require(all(not row or row.startswith(b'H ') for row in git(root, 'ls-files', '-v', '-z').split(b'\0')), 'Hidden Discovery index flags are prohibited')
    return entries


def capture_alpha_source(root, alpha_root):
    require(alpha_root is not None, 'Explicit installed Alpha native source root is mandatory')
    alpha_root = pathlib.Path(alpha_root)
    pin = strict_json(read(root, NATIVE_PIN, regular=True, limit=2_000_000)[1])
    fields = {'schema', 'repository', 'commit', 'tree', 'sourceHash', 'catalogPath', 'catalogSha256', 'files', 'qualification'}
    require(isinstance(pin, dict) and set(pin) == fields and pin['schema'] == 'successor/discovery-lab-alpha-source/v1' and pin['repository'] == ALPHA_REPOSITORY and pin['catalogPath'] == CATALOG and pin['qualification'] == 'PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY' and valid_sha(pin['sourceHash'], 64) and valid_sha(pin['catalogSha256'], 64), 'Discovery installed Alpha source pin differs')
    entries = git_checkout(alpha_root, pin['commit'], pin['tree'])
    captured, raw_inputs, encoded_bytes = {}, {}, 0
    def capture(name, digest):
        nonlocal encoded_bytes
        require(safe_path(name) and valid_sha(digest, 64) and name in entries and entries[name][0] in ('100644', '100755'), 'Pinned Alpha source path or mode differs')
        mode, raw = read(alpha_root, name, regular=True, limit=2_000_000)
        require(mode == entries[name][0] and blob(raw) == entries[name][1] and sha(raw) == digest, 'Installed Alpha raw source differs from pinned Git source: ' + name)
        encoded_bytes += len(raw)
        require(encoded_bytes <= 8_000_000, 'Installed Alpha source capture budget exceeded')
        captured[name] = digest
        raw_inputs[name] = (mode, raw)
        return raw
    catalog = strict_json(capture(CATALOG, pin['catalogSha256']))
    require(isinstance(catalog, dict) and set(catalog) == {'schema', 'sourceHash', 'sources'} and catalog['schema'] == 'successor-capability-source/v1' and isinstance(catalog['sources'], dict) and 0 < len(catalog['sources']) <= 256 and catalog['sourceHash'] == pin['sourceHash'], 'Installed Alpha catalog identity differs')
    canonical = json.dumps(catalog['sources'], sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    require(sha(canonical) == pin['sourceHash'] and REQUIRED_ALPHA_SOURCES <= set(catalog['sources']) and isinstance(pin['files'], dict) and set(pin['files']) == set(catalog['sources']) | {INSPECTOR}, 'Installed Alpha catalog/source closure is incomplete')
    for name, digest in pin['files'].items():
        require(name == INSPECTOR or digest == catalog['sources'][name], 'Pinned Alpha catalog digest differs: ' + name)
        capture(name, digest)
    manager_files = {name: sha(read(root, name, regular=True, limit=2_000_000)[1]) for name in ADAPTER_FILES}
    require(manager_files[ADAPTER_FILES[1]] == pin['files'].get('examples/successor-capability/discovery-lab-contract.mjs'), 'Installed Manager and Alpha contracts differ')
    report = {'scope': 'Installed source identity only; no native execution, hosted qualification or authority.', 'alphaCommit': pin['commit'], 'alphaTree': pin['tree'], 'sourceHash': pin['sourceHash'], 'catalogSha256': pin['catalogSha256'], 'sourceFiles': len(captured), 'encodedSourceBytes': encoded_bytes, 'managerFiles': manager_files, 'nativeExecutionQualified': False}
    return report, pin, raw_inputs, entries


def installed_native_closure(root, alpha_root):
    return capture_alpha_source(root, alpha_root)[0]


def capture_alpha_capsule(root, alpha_root):
    """Own the complete reviewed raw Alpha closure before creating archive output."""
    report, pin, captured, entries = capture_alpha_source(root, alpha_root)
    mode, license_raw = read(alpha_root, 'LICENSE', regular=True, limit=32_000)
    require(entries.get('LICENSE') == (mode, blob(license_raw)) and sha(license_raw) == APACHE_LICENSE_SHA256,
            'Original Alpha Apache license differs from reviewed Git source')
    captured['LICENSE'] = (mode, license_raw)
    manifest = {'schema': 'manager/discovery-alpha-capsule/v1', 'repository': ALPHA_REPOSITORY,
                'commit': pin['commit'], 'tree': pin['tree'], 'sourceHash': pin['sourceHash'],
                'catalogPath': CATALOG, 'catalogSha256': pin['catalogSha256'],
                'files': {name: {'mode': item_mode, 'blob': blob(raw), 'sha256': sha(raw), 'bytes': len(raw)}
                          for name, (item_mode, raw) in sorted(captured.items())},
                'authority': 'none', 'externalExecution': 'unprovisioned'}
    raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    captured[CAPSULE_MANIFEST] = ('100644', raw)
    return captured


def validate_alpha_capsule(root, directory):
    """Verify saved capsule bytes without Git or an unpackaged source checkout."""
    pin = strict_json(read(root, NATIVE_PIN, regular=True, limit=2_000_000)[1])
    require(isinstance(pin, dict) and set(pin) == {'schema', 'repository', 'commit', 'tree', 'sourceHash',
            'catalogPath', 'catalogSha256', 'files', 'qualification'}
            and pin['schema'] == 'successor/discovery-lab-alpha-source/v1'
            and pin['repository'] == ALPHA_REPOSITORY and pin['catalogPath'] == CATALOG
            and pin['qualification'] == 'PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY'
            and valid_sha(pin['commit']) and valid_sha(pin['tree'])
            and valid_sha(pin['sourceHash'], 64) and valid_sha(pin['catalogSha256'], 64),
            'Saved Alpha reviewed pin identity differs')
    directory = pathlib.Path(directory)
    raw = read(directory, CAPSULE_MANIFEST, regular=True, limit=2_000_000)[1]
    manifest = strict_json(raw)
    require(isinstance(manifest, dict) and set(manifest) == {'schema', 'repository', 'commit', 'tree',
            'sourceHash', 'catalogPath', 'catalogSha256', 'files', 'authority', 'externalExecution'}
            and manifest['schema'] == 'manager/discovery-alpha-capsule/v1'
            and manifest['authority'] == 'none' and manifest['externalExecution'] == 'unprovisioned',
            'Saved Alpha capsule identity or authority differs')
    require(all(manifest[key] == pin[key] for key in ('repository', 'commit', 'tree', 'sourceHash',
            'catalogPath', 'catalogSha256')), 'Saved Alpha capsule differs from reviewed pin')
    expected = {**pin['files'], CATALOG: pin['catalogSha256'], 'LICENSE': APACHE_LICENSE_SHA256}
    require(set(manifest['files']) == set(expected), 'Saved Alpha capsule source closure differs')
    observed = {path.relative_to(directory).as_posix() for path in directory.rglob('*')
                if path.is_file() or path.is_symlink()}
    require(observed == set(expected) | {CAPSULE_MANIFEST}, 'Saved Alpha capsule missing or extra input')
    total = 0
    for name, digest in expected.items():
        mode, value = read(directory, name, regular=True, limit=2_000_000)
        total += len(value)
        item = manifest['files'][name]
        require(isinstance(item, dict) and set(item) == {'mode', 'blob', 'sha256', 'bytes'}
                and item == {'mode': mode, 'blob': blob(value), 'sha256': digest, 'bytes': len(value)}
                and sha(value) == digest and total <= 8_000_000, 'Saved Alpha source differs: ' + name)
    catalog = strict_json(read(directory, CATALOG)[1])
    require(set(catalog) == {'schema', 'sourceHash', 'sources'}
            and catalog['schema'] == 'successor-capability-source/v1'
            and catalog['sourceHash'] == pin['sourceHash']
            and set(pin['files']) == set(catalog['sources']) | {INSPECTOR}
            and all(pin['files'][name] == digest for name, digest in catalog['sources'].items())
            and sha(json.dumps(catalog['sources'], sort_keys=True, separators=(',', ':')).encode()) == pin['sourceHash'],
            'Saved Alpha catalog differs')
    return manifest


def browser_policy(root):
    import runpy
    return runpy.run_path(str(pathlib.Path(root) / 'scripts/release/discovery-qualification.py'))


def capture_browser_capsule(root):
    """The sole candidate producer owns the authenticated original input bytes once."""
    snapshot = browser_policy(root)['capture_browser_input'](root=root)
    binding, files = snapshot['binding'], snapshot['files']
    require(BROWSER_MANIFEST not in files and len(files) == 11, 'Browser input capture inventory differs')
    captured = {name: ('100644', raw) for name, raw in files.items()}
    captured[BROWSER_MANIFEST] = ('100644', (json.dumps(binding, sort_keys=True, indent=2) + '\n').encode())
    return captured


def validate_browser_capsule(root, directory, *, return_files=False):
    """Check the producer's retained raw inputs offline; never rediscover a mission."""
    policy, directory = browser_policy(root), pathlib.Path(directory)
    expected = set(policy['BROWSER_MEMBERS'])
    observed = {item.relative_to(directory).as_posix() for item in directory.rglob('*')
                if item.is_file() or item.is_symlink()}
    require(observed == expected | {BROWSER_MANIFEST}, 'Saved browser input inventory differs')
    captured, total = {}, 0
    for name in sorted(expected):
        mode, raw = read(directory, name, regular=True, limit=2_000_000)
        total += len(raw)
        require(mode == '100644' and total <= 16_000_000, 'Saved browser input bytes/mode exceed their bound')
        captured[name] = raw
    binding = policy['verify_browser_files'](root, captured)
    mode, raw = read(directory, BROWSER_MANIFEST, regular=True, limit=2_000_000)
    require(mode == '100644' and same(strict_json(raw), binding), 'Saved browser input binding differs')
    return {'binding': binding, 'files': {**captured, BROWSER_MANIFEST: raw}} if return_files else binding


def checkout(root, selection, object_store, dependency_root, source, tree, *, alpha_root=None):
    root = pathlib.Path(root)
    entries = git_checkout(root, source, tree, ancestor=(BASE_COMMIT, BASE_TREE))
    require(git(root, 'rev-parse', FEATURE_COMMIT + '^{tree}').decode().strip() == FEATURE_TREE, 'Original Discovery feature tree differs')
    git(root, 'merge-base', '--is-ancestor', FEATURE_COMMIT, source)
    for name, (mode, oid) in entries.items():
        current_mode, raw = read(root, name)
        require(current_mode == mode and blob(raw) == oid, 'Current Discovery raw source differs from Git: ' + name)
    result = validate_source(root, selection, entries)
    require(dependency_root is not None, 'Exact installed compiler dependency closure is mandatory')
    require(sha(read(root, COMPILER_MANIFEST)[1]) == COMPILER_MANIFEST_SHA256, 'Immutable compiler source inventory differs')
    import runpy
    compiler = runpy.run_path(str(root / 'scripts/release/check-explicit-governor-boundaries.py'))
    result['compilerSourceUnits'] = compiler['compiler_closure'](root, strict_json(read(root, COMPILER_MANIFEST)[1]), dependency_root)
    result['installedNativeClosure'] = installed_native_closure(root, alpha_root)
    return {**result, 'sourceCommit': source, 'sourceTree': tree}


def arguments(root):
    return ['--profile', PROFILE, '--manifest', MANIFEST, '--manifest-sha256', sha(read(root, MANIFEST)[1]), '--verifier-sha256', sha(read(root, VERIFIER)[1])]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dependency-root', required=True)
    parser.add_argument('--native-source-root', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--verifier-sha256', required=True)
    options = parser.parse_args()
    selection = select(manifest=MANIFEST, manifest_sha256=options.manifest_sha256, verifier_sha256=options.verifier_sha256)
    identity = git_identity(ROOT)
    print(json.dumps(checkout(ROOT, selection, None, options.dependency_root, identity['commit'], identity['tree'], alpha_root=pathlib.Path(options.native_source_root)), sort_keys=True))
