#!/usr/bin/env python3
"""Explicit, offline routing for reviewed source boundaries, never release approval.

The external target manifest is anchored here, rather than authorized by mutable
command-line expected values. Source checkers and inventories are not modified.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess
import sys

PROFILE = 'manager-explicit-governor-v1'
REVIEWED_TARGET_MANIFEST_SHA256 = 'bbc3d9bfae5ef7ae9e0c5b1ccb5327f02a212552220ca10c8c3052efc8e5b78e'
LEGACY_COMMIT = '6484d09afbba64d7de24cd18ae4dbd246caffd17'
LEGACY_TREE = 'fb8d1443f705731cfa5dfc89b065b4ca1bcf2ab0'
LEGACY = 'scripts/release/check-v114-boundaries.py'
LEGACY_PINS = {
    LEGACY: 'b0b5f608d08866f5b9f66a6d0381a34fc9c1851282113ddf4de2efb4ead54807',
    'config/next-deployment-contract-changes.json': '93f50d12f034ab8bdf6f951c48f71c3dd010fa82ab485d2d9f61c21f97d587d5',
}
POLICY_PATHS = {
    'manifestSha256': 'config/explicit-governor-source-v1.json',
    'dispatcherSha256': 'scripts/release/check-source-boundaries.py',
    'verifierSha256': 'scripts/release/check-explicit-governor-boundaries.py',
    'schemaSha256': 'schemas/explicit-governor-source-v1.schema.json',
}
BINDING_FIELDS = {
    'schema', 'profile', 'sourceCommit', 'sourceTree', 'manifestPath',
    *POLICY_PATHS, 'lockSha256', 'disposition',
}
TARGET_FIELDS = BINDING_FIELDS | {'sourceParents', 'reviewBindingSha256'}
LOCK_PATHS = {'package-lock.json', 'hardhat/package-lock.json', 'ui/package-lock.json'}


class SelectionError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise SelectionError(message)


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
        raise SelectionError('Non-finite JSON value: ' + value)
    return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)


def exact_path(value, directory=False):
    path = pathlib.Path(value)
    require(path.is_absolute() and path == path.resolve(),
            'Use an exact absolute path without symlink aliases')
    kind = path.lstat().st_mode
    require(stat.S_ISDIR(kind) if directory else stat.S_ISREG(kind),
            'Expected a regular ' + ('directory' if directory else 'file'))
    return path


def source_file(root, name):
    # All callers use fixed policy/lock paths or names from a locally read tree.
    relative = pathlib.PurePosixPath(name)
    require(not relative.is_absolute() and str(relative) == name and
            all(p not in ('.', '..', '.git') for p in relative.parts), 'Unsafe source path')
    return exact_path(str(root / name)).read_bytes()


def offline_env():
    env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_SYSTEM='/dev/null',
               GIT_CONFIG_GLOBAL='/dev/null', GIT_NO_REPLACE_OBJECTS='1',
               GIT_TERMINAL_PROMPT='0', GIT_NO_LAZY_FETCH='1', GIT_ALLOW_PROTOCOL='',
               GIT_OPTIONAL_LOCKS='0', GIT_CONFIG_COUNT='4',
               GIT_CONFIG_KEY_0='protocol.allow', GIT_CONFIG_VALUE_0='never',
               GIT_CONFIG_KEY_1='core.hooksPath', GIT_CONFIG_VALUE_1='/dev/null',
               GIT_CONFIG_KEY_2='core.fsmonitor', GIT_CONFIG_VALUE_2='false',
               GIT_CONFIG_KEY_3='core.attributesFile', GIT_CONFIG_VALUE_3='/dev/null')
    return env


def git(root, *args):
    result = subprocess.run(['git', '--no-replace-objects', '-c', 'protocol.allow=never',
        '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
        '-c', 'core.attributesFile=/dev/null', *args], cwd=root, env=offline_env(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    require(result.returncode == 0,
            'Required local Git object/operation unavailable: ' + ' '.join(args[:2]) +
            ': ' + result.stderr.decode(errors='replace').strip())
    return result.stdout


def observe_source(root, commit, tree, parents=None):
    require(git(root, 'rev-parse', '--show-toplevel').decode().strip() == str(root),
            'Git source root differs')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == commit,
            'Source commit differs from reviewed target')
    # Read authentic raw commit bytes, rather than a replace/graft-sensitive walk.
    raw = git(root, 'cat-file', 'commit', commit)
    require(hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == commit,
            'Raw commit object does not match its identity')
    headers = raw.split(b'\n\n', 1)[0].splitlines()
    trees = [line[5:].decode() for line in headers if line.startswith(b'tree ')]
    observed_parents = [line[7:].decode() for line in headers if line.startswith(b'parent ')]
    require(trees == [tree], 'Source tree differs from reviewed target')
    if parents is not None:
        require(observed_parents == parents, 'Ordered source parents differ from reviewed target')


def legacy_clean_source(root):
    """A raw clean-context check without depending on new files in old source."""
    expected = {}
    for item in git(root, 'ls-tree', '-rz', '--full-tree', LEGACY_COMMIT).split(b'\0'):
        if not item:
            continue
        metadata, name = item.split(b'\t', 1)
        mode, kind, oid = metadata.decode().split()
        require(kind == 'blob' and mode in ('100644', '100755', '120000'),
                'Unsupported legacy tree entry')
        expected[name.decode()] = (mode, oid)
    actual = {}
    for item in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not item:
            continue
        metadata, name = item.split(b'\t', 1)
        mode, oid, stage = metadata.decode().split()
        require(stage == '0' and name.decode() not in actual, 'Unmerged legacy index')
        actual[name.decode()] = (mode, oid)
    require(actual == expected, 'Legacy index differs from original source')
    require(not git(root, 'ls-files', '--others', '--exclude-standard').strip(),
            'Legacy source contains untracked files')
    for name, (mode, oid) in expected.items():
        path = root / name
        if mode == '120000':
            require(path.is_symlink() and path.parent == path.parent.resolve(),
                    'Legacy symlink changed: ' + name)
            data = os.readlink(path).encode()
        else:
            data = source_file(root, name)
            observed_mode = '100755' if path.stat().st_mode & 0o111 else '100644'
            require(mode == observed_mode, 'Legacy source mode changed: ' + name)
        require(hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == oid,
                'Legacy raw source bytes changed: ' + name)


def load_reviewed_target(args, root):
    require(args.target_manifest_sha256 == REVIEWED_TARGET_MANIFEST_SHA256,
            'Target manifest digest is not the immutable reviewed anchor')
    target_path = exact_path(args.target_manifest)
    binding_path = exact_path(args.review_binding)
    require(root not in target_path.parents and root not in binding_path.parents,
            'Target manifest and review binding must be external to source')
    target_data, binding_data = target_path.read_bytes(), binding_path.read_bytes()
    require(sha(target_data) == REVIEWED_TARGET_MANIFEST_SHA256,
            'Reviewed target manifest bytes changed')
    target = strict_json(target_data)
    require(isinstance(target, dict) and set(target) == TARGET_FIELDS, 'Target manifest fields differ')
    require(target['schema'] == 'agijobmanager/native-source-target/v1' and
            target['profile'] == PROFILE and
            target['manifestPath'] == POLICY_PATHS['manifestSha256'] and
            target['disposition'] == 'SOURCE_BOUNDARIES_ONLY_NOT_RELEASE_QUALIFICATION',
            'Target manifest scope differs')
    require(all(isinstance(target[k], str) and re.fullmatch('[0-9a-f]{40}', target[k])
                for k in ('sourceCommit', 'sourceTree')) and
            isinstance(target['sourceParents'], list) and len(target['sourceParents']) == 1 and
            all(isinstance(p, str) and re.fullmatch('[0-9a-f]{40}', p) for p in target['sourceParents']),
            'Complete target commit/tree/ordered parents required')
    require(set(target['lockSha256']) == LOCK_PATHS, 'Target lock inventory differs')
    require(all(isinstance(d, str) and re.fullmatch('[0-9a-f]{64}', d)
                for d in [*(target[k] for k in POLICY_PATHS), target['reviewBindingSha256'],
                          *target['lockSha256'].values()]), 'Complete target SHA256 pins required')
    require(args.review_binding_sha256 == target['reviewBindingSha256'] == sha(binding_data),
            'External review binding digest differs')
    binding = strict_json(binding_data)
    expected = {key: target[key] for key in BINDING_FIELDS}
    expected['schema'] = 'agijobmanager/source-review-binding/v1'
    require(binding == expected, 'External review binding target/policy/scope differs')
    return target


def policy_bytes(root, target):
    for key, name in POLICY_PATHS.items():
        require(sha(source_file(root, name)) == target[key], 'Source policy bytes differ: ' + key)
    for name, digest in target['lockSha256'].items():
        require(sha(source_file(root, name)) == digest, 'Source lock bytes differ: ' + name)


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--profile', required=True, choices=('legacy-v114', PROFILE))
    parser.add_argument('--source-root', required=True)
    parser.add_argument('--mode', choices=('bound',))
    for flag in ('target-manifest', 'target-manifest-sha256', 'review-binding',
                 'review-binding-sha256', 'dependency-root', 'source-commit', 'source-tree'):
        parser.add_argument('--' + flag)
    parser.add_argument('--object-store', action='append')
    seen = set()
    for argument in argv:
        if argument.startswith('--'):
            key = argument.split('=', 1)[0]
            if key != '--object-store' and key in seen:
                parser.error('Repeated selector option: ' + key)
            seen.add(key)
    args = parser.parse_args(argv)
    explicit = (args.target_manifest, args.target_manifest_sha256, args.review_binding,
                args.review_binding_sha256)
    if args.profile == PROFILE:
        if args.mode != 'bound' or not all(explicit) or args.source_commit or args.source_tree:
            parser.error('Explicit profile requires --mode bound and external manifest/binding pins only')
    elif any((*explicit, args.dependency_root, args.object_store)) or (
            args.source_commit != LEGACY_COMMIT or args.source_tree != LEGACY_TREE):
        parser.error('Legacy requires only its exact original 6484/fb8 source commit/tree')
    return args


def run(args):
    root = exact_path(args.source_root, directory=True)
    if args.profile == 'legacy-v114':
        observe_source(root, LEGACY_COMMIT, LEGACY_TREE)
        legacy_clean_source(root)
        for name, digest in LEGACY_PINS.items():
            require(sha(source_file(root, name)) == digest, 'Original legacy bytes changed: ' + name)
        # No new dispatcher, release identity, flags, fallback, or rewritten gate.
        result = subprocess.run([sys.executable, str(root / LEGACY)],
                                cwd=root, env=offline_env(), check=False)
        if result.returncode == 0:
            observe_source(root, LEGACY_COMMIT, LEGACY_TREE)
            legacy_clean_source(root)
        return result.returncode
    target = load_reviewed_target(args, root)
    observe_source(root, target['sourceCommit'], target['sourceTree'], target['sourceParents'])
    policy_bytes(root, target)
    command = [sys.executable, str(root / POLICY_PATHS['dispatcherSha256']),
        '--profile', PROFILE, '--mode', 'bound', '--source-root', str(root),
        '--manifest', target['manifestPath'], '--manifest-sha256', target['manifestSha256'],
        '--schema-sha256', target['schemaSha256'], '--verifier-sha256', target['verifierSha256'],
        '--review-binding', args.review_binding, '--review-binding-sha256', args.review_binding_sha256]
    if args.dependency_root:
        command.extend(['--dependency-root', str(exact_path(args.dependency_root, directory=True))])
    for store in args.object_store or []:
        command.extend(['--object-store', str(exact_path(store, directory=True))])
    result = subprocess.run(command, cwd=root, env=offline_env(), check=False)
    if result.returncode == 0:
        load_reviewed_target(args, root)
        observe_source(root, target['sourceCommit'], target['sourceTree'], target['sourceParents'])
        policy_bytes(root, target)
    return result.returncode


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        return run(args)
    except (SelectionError, OSError, ValueError, KeyError, TypeError) as exc:
        print('SOURCE PROFILE SELECTION FAILED: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
