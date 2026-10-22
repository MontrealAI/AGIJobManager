"""Validate current Discovery inputs/Pages and run unchanged authenticated predecessors."""
import argparse
import hashlib
import os
import pathlib
import re
import runpy
import shutil
import subprocess
import tempfile
from release_common import require, sha, strict_json

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE_COMMIT = '900bb4b46cb7de7f6f69f553a5687866f978a413'
BASE_TREE = 'bc42f0b295a649900667dcb1c487122726df7a02'
VERSION = '1.20.0'
PROTECTED = (
    'config/manager-dependency-maintenance-baseline-v1.json',
    'config/manager-dependency-maintenance-v1.json',
    'scripts/release/maintenance-profile.py',
    'scripts/release/maintenance-qualification.py',
    'scripts/release/pages-publication-maintenance.py',
    'scripts/release/run-maintenance-preservation.py',
    'scripts/release/run-maintenance-inherited-tests.py',
    'scripts/release/test-maintenance-profile.py',
    'scripts/release/test-maintenance-qualification.py',
    'scripts/release/test-maintenance-plumbing.py',
    'scripts/release/test-pages-publication-maintenance.py',
    '.github/workflows/publish-v114.yml',
)
ENV = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
ENV.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_SYSTEM='/dev/null',
           GIT_CONFIG_GLOBAL='/dev/null', GIT_NO_REPLACE_OBJECTS='1',
           GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0', GIT_NO_LAZY_FETCH='1',
           PYTHONDONTWRITEBYTECODE='1')


def git(root, *arguments, force_worktree=True):
    return subprocess.check_output(['git', '--no-replace-objects', '--no-pager', '-C', str(root),
        *(['--work-tree=' + str(root)] if force_worktree else []),
        '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
        '-c', 'core.attributesFile=/dev/null', '-c', 'protocol.allow=never',
        *arguments], env=ENV)


def validate_current(root):
    root = pathlib.Path(root).resolve()
    require((root / '.git').is_dir() and not (root / '.git').is_symlink(),
        'Discovery preservation requires the actual Git root')
    raw_policy = runpy.run_path(str(ROOT / 'scripts/release/discovery-release-profile.py'))
    raw_policy['audit_git_main_config'](root)
    require(pathlib.Path(git(root, 'rev-parse', '--show-toplevel', force_worktree=False).decode().strip()).resolve() == root,
        'Discovery preservation requires the actual Git root')
    config = git(root, 'config', '--local', '--no-includes', '--list').decode()
    keys = re.findall(r'(?m)^([^=\n]+)=', config)
    require(all(key.split('.', 1)[0].lower() in {'core', 'remote', 'branch', 'extensions', 'http', 'gc'} for key in keys),
        'Discovery preservation local Git configuration is prohibited')
    prohibited = r'(?mi)^(filter\.|include\.|includeif\.|protocol\.|core\.(worktree|attributesfile|sshcommand|gitproxy|alternaterefscommand|fsmonitor|hookspath)=|extensions\.partialclone=|remote\..*\.(uploadpack|receivepack|promisor|vcs|proxy|proxyauthmethod)=|http\..*(proxy|proxyauthmethod)=)'
    require(not re.search(prohibited, config), 'Discovery preservation local Git configuration is prohibited')
    packs = pathlib.Path(git(root, 'rev-parse', '--git-path', 'objects/pack').decode().strip())
    packs = packs if packs.is_absolute() else root / packs
    require(not any(packs.glob('*.promisor')), 'Promisor Discovery preservation object packs are prohibited')
    require(not git(root, 'status', '--porcelain', '--untracked-files=all').strip(),
        'Discovery preservation requires clean complete source')
    require(git(root, 'rev-parse', '--is-shallow-repository').decode().strip() == 'false',
        'Complete Discovery ancestry is required')
    require(not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(),
        'Replaced Discovery history is prohibited')
    graft = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    require(not (graft if graft.is_absolute() else root / graft).exists(), 'Grafted Discovery history is prohibited')
    require(git(root, 'rev-parse', BASE_COMMIT + '^{tree}').decode().strip() == BASE_TREE,
        'Published maintenance baseline differs')
    subprocess.run(['git', '--no-replace-objects', '-C', str(root), 'merge-base', '--is-ancestor',
        BASE_COMMIT, 'HEAD'], env=ENV, check=True)
    for name in PROTECTED:
        require((root / name).is_file() and not (root / name).is_symlink()
            and (root / name).read_bytes() == git(root, 'show', BASE_COMMIT + ':' + name),
            'Historical maintenance input changed: ' + name)
    policy = runpy.run_path(str(root / 'scripts/release/discovery-release-profile.py'))
    selection = policy['select'](manifest=policy['MANIFEST'],
        manifest_sha256=sha((root / policy['MANIFEST']).read_bytes()),
        verifier_sha256=sha((root / policy['VERIFIER']).read_bytes()))
    rows = git(root, 'ls-tree', '-rz', 'HEAD').split(b'\0')
    paths, entries = set(), {}
    for row in rows:
        if not row:
            continue
        metadata, raw_name = row.split(b'\t', 1)
        mode, kind, digest = metadata.decode().split()
        name = raw_name.decode(); paths.add(name); entries[name] = (mode, digest)
        target = root / name
        require(kind == 'blob', 'Unsupported source object')
        raw = os.readlink(target).encode() if target.is_symlink() else target.read_bytes()
        actual_mode = '120000' if target.is_symlink() else '100755' if target.stat().st_mode & 0o111 else '100644'
        actual_digest = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        require(actual_mode == mode and actual_digest == digest, 'Current raw Git input differs: ' + name)
    index = {}
    for row in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not row:
            continue
        metadata, raw_name = row.split(b'\t', 1)
        mode, digest, stage = metadata.decode().split()
        require(stage == '0' and raw_name.decode() not in index, 'Unmerged Discovery index')
        index[raw_name.decode()] = (mode, digest)
    require(index == entries, 'Discovery index differs from its committed tree')
    require(all(not row or row.startswith(b'H ') for row in git(root, 'ls-files', '-v', '-z').split(b'\0')),
        'Hidden Discovery index flags are prohibited')
    policy['validate_source'](root, selection, paths=paths)
    baseline = strict_json((root / 'docs/successor/PRESERVATION_BASELINE.json').read_bytes())
    for name, hashes in baseline['mermaidBlocks'].items():
        blocks = re.findall(r'```mermaid[^\n]*\n[\s\S]*?```', (root / name).read_text())
        require(set(hashes) <= {sha(block.encode()) for block in blocks}, 'Historical diagram is missing: ' + name)
    return git(root, 'rev-parse', 'HEAD').decode().strip()


def validate_pages(root, pages, commit):
    pages = pathlib.Path(pages)
    if not pages.is_absolute():
        pages = root / pages
    require(pages == pages.resolve() and pages.is_dir() and not pages.is_symlink(),
        'Current Pages build is missing or indirect')
    info = strict_json((pages / 'build-info.json').read_bytes())
    require(info['sourceCommit'] == commit and info['sourceVersion'] == VERSION,
        'Current Discovery Pages source identity differs')
    require(all(not entry.is_symlink() and (entry.is_file() or entry.is_dir()) for entry in pages.rglob('*')),
        'Current Pages contains indirect or nonregular entries')
    actual = {entry.relative_to(pages).as_posix() for entry in pages.rglob('*') if entry.is_file()}
    build_only = info.get('buildOnlyFiles', {})
    require(set(build_only) == {'.nojekyll'} and not set(build_only) & set(info['files']),
        'Current Pages build-only inventory differs')
    require((pages / '.nojekyll').read_bytes() == b'', 'Current Pages build-only marker differs')
    files = {**info['files'], **build_only}
    require(actual == set(files) | {'build-info.json'}, 'Current Pages file inventory differs')
    for name, item in files.items():
        path = pathlib.PurePosixPath(name)
        require(path.as_posix() == name and not path.is_absolute() and '..' not in path.parts and '\\' not in name,
            'Unsafe current Pages path')
        data = (pages / name).read_bytes()
        require(len(data) == item['bytes'] and sha(data) == item['sha256'], 'Current Pages asset differs: ' + name)
    baseline = strict_json((root / 'docs/successor/PRESERVATION_BASELINE.json').read_bytes())
    for name in baseline['routes'] + ['successor/index.html', 'fr/successor/index.html']:
        require(name in actual, 'Current Pages route is missing: ' + name)


def snapshot(root, destination, commit, tree):
    require(git(root, 'rev-parse', commit + '^{tree}').decode().strip() == tree,
        'Historical snapshot tree differs')
    subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', 'clone', '--quiet', '--shared', '--no-checkout',
        str(root), str(destination)], env=ENV, check=True)
    # Old unchanged runners add their own alternates. Materialize the available
    # local object stores so fixture nesting cannot hide authenticated objects.
    source_objects = pathlib.Path(git(root, 'rev-parse', '--git-path', 'objects').decode().strip())
    if not source_objects.is_absolute():
        source_objects = root / source_objects
    target_objects = destination / '.git/objects'
    seen = set()
    def materialize(objects):
        objects = objects.resolve()
        if objects in seen:
            return
        seen.add(objects)
        alternatives = objects / 'info/alternates'
        if alternatives.is_file():
            for line in alternatives.read_text().splitlines():
                alternate = pathlib.Path(line)
                materialize(alternate if alternate.is_absolute() else objects / alternate)
        for directory in objects.iterdir():
            if directory.name == 'info':
                continue
            require(directory.is_dir() and not directory.is_symlink(), 'Indirect historical object directory')
            for entry in directory.iterdir():
                require(entry.is_file() and not entry.is_symlink(), 'Indirect historical object')
                target = target_objects / directory.name / entry.name
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    shutil.copyfile(entry, target)
    materialize(source_objects)
    (target_objects / 'info/alternates').unlink()
    git(destination, 'checkout', '--quiet', '--detach', commit)
    require(git(destination, 'rev-parse', 'HEAD').decode().strip() == commit
        and git(destination, 'rev-parse', 'HEAD^{tree}').decode().strip() == tree
        and not git(destination, 'status', '--porcelain', '--untracked-files=all').strip(),
        'Historical snapshot checkout differs')


def inherited_tests(root, dependency_root):
    require(dependency_root is not None, 'Inherited compiler tests require the actual installed dependency closure')
    with tempfile.TemporaryDirectory(prefix='manager-published-maintenance-') as temporary:
        target = pathlib.Path(temporary) / 'source'
        snapshot(root, target, BASE_COMMIT, BASE_TREE)
        scripts = [
            ('test-maintenance-profile.py', []),
            ('test-maintenance-qualification.py', []),
            ('test-transformational-qualification.py', []),
            ('test-publication-authorization-ti.py', []),
            ('test-pages-publication-maintenance.py', []),
            ('test-maintenance-plumbing.py', []),
            ('run-maintenance-inherited-tests.py', ['--dependency-root', str(pathlib.Path(dependency_root).resolve())]),
        ]
        print('Historical regression fixture: exact900bb. These tests do not perform live public release or hosted qualification verification.', flush=True)
        for name, options in scripts:
            subprocess.run(['python3', 'scripts/release/' + name, *options], cwd=target, env=ENV, check=True)
    with tempfile.TemporaryDirectory(prefix='manager-public-discovery-v1-') as temporary:
        target = pathlib.Path(temporary) / 'source'
        snapshot(root, target, '68d1d3cae2e6f2d46c21e8e73311d309b2b307fd',
            'c96140e3e0db9e47a68cab5883bb900ce9670912')
        subprocess.run(['python3', 'scripts/release/test-discovery-lab-profile.py'],
            cwd=target, env=ENV, check=True)
    print('Unchanged public Discovery v1, v1.19.6 maintenance and inherited source/release assertions passed on authenticated900bb; current Discovery qualification remains separate.')


def historical_pages(root, pages, commit):
    with tempfile.TemporaryDirectory(prefix='manager-discovery-pages-preservation-') as temporary:
        published = pathlib.Path(temporary) / 'published'
        snapshot(root, published, BASE_COMMIT, BASE_TREE)
        previous = runpy.run_path(str(published / 'scripts/release/transformational-profile.py'))
        history = previous['PREVIOUS']['PREVIOUS']
        fixture = pathlib.Path(temporary) / 'fixture'
        snapshot(root, fixture, history['BASE'], history['TREE'])
        # The historical extracted-source verifier expects only archived inputs.
        # Remove metadata only from this newly created, authenticated temp clone.
        require((fixture / '.git').is_dir() and not (fixture / '.git').is_symlink(), 'Unexpected fixture metadata')
        shutil.rmtree(fixture / '.git')
        manifest = strict_json((fixture / history['BASE_MANIFEST']).read_bytes())
        require(sha((fixture / history['BASE_MANIFEST']).read_bytes()) == history['BASE_MANIFEST_SHA'],
            'Historical Builder inventory pin differs')
        name = 'scripts/release/candidate-profile.py'
        require(sha((fixture / name).read_bytes()) == manifest['inputs'][name]['sha256'],
            'Historical candidate verifier differs')
        candidate = runpy.run_path(str(fixture / name))
        selection = candidate['select'](candidate['PROFILE'], manifest=candidate['MANIFEST'],
            manifest_sha256=history['BASE_MANIFEST_SHA'],
            verifier_sha256=manifest['inputs'][candidate['VERIFIER']]['sha256'],
            schema_sha256=manifest['inputs'][candidate['SCHEMA']]['sha256'])
        candidate['validate_source'](fixture, selection)
        shutil.copytree(pages, fixture / 'build/pages')
        validate_pages(root, fixture / 'build/pages', commit)
        subprocess.run(['node', '--test', 'scripts/successor/preservation.test.mjs'], cwd=fixture, env=ENV, check=True)
    print('Current Discovery Pages passed complete raw inventory; unchanged historical8815 Builder assertions passed on authenticated source.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--inherited', action='store_true')
    group.add_argument('--pages', type=pathlib.Path)
    parser.add_argument('--dependency-root', type=pathlib.Path)
    args = parser.parse_args()
    commit = validate_current(ROOT)
    if args.inherited:
        inherited_tests(ROOT, args.dependency_root)
    else:
        validate_pages(ROOT, args.pages, commit)
        historical_pages(ROOT, args.pages, commit)


if __name__ == '__main__':
    main()
