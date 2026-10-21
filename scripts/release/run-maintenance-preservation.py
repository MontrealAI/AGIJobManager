"""Check native-transformation source, current Pages and unchanged historical assertions."""
import io
import json
import pathlib
import re
import runpy
import shutil
import stat
import subprocess
import tarfile
import tempfile
from release_common import require, sha, source_path, strict_json

ROOT = pathlib.Path(__file__).resolve().parents[2]


def validate_current(root, policy):
    selection = policy['select'](manifest=policy['MANIFEST'],
        manifest_sha256=sha((root / policy['MANIFEST']).read_bytes()),
        verifier_sha256=sha((root / policy['VERIFIER']).read_bytes()))
    git = lambda *args: policy['git'](root, *args).decode().strip()
    # Includes clean raw Git bytes, complete finite closure, exact version-only
    # dependency metadata and independently normalized executable UI invariants.
    policy['checkout'](root, selection, None, None, git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'))
    baseline = strict_json((root / 'docs/successor/PRESERVATION_BASELINE.json').read_bytes())
    for name, hashes in baseline['mermaidBlocks'].items():
        blocks = re.findall(r'```mermaid[^\n]*\n[\s\S]*?```', (root / name).read_text())
        require(set(hashes) <= {sha(block.encode()) for block in blocks}, 'Current historical diagram is missing: ' + name)


def validate_pages(root, pages, commit):
    require(pages.is_dir() and not pages.is_symlink(), 'Current Pages build is missing or indirect')
    info = strict_json((pages / 'build-info.json').read_bytes())
    require(info['sourceCommit'] == commit and info['sourceVersion'] == '1.19.6', 'Current Pages source identity differs')
    require(all(not p.is_symlink() for p in pages.rglob('*')), 'Current Pages contains indirect files')
    actual = {p.relative_to(pages).as_posix() for p in pages.rglob('*') if p.is_file()}
    build_only = info.get('buildOnlyFiles', {})
    require(set(build_only) == {'.nojekyll'} and not set(build_only) & set(info['files']), 'Current Pages build-only inventory differs')
    require((pages / '.nojekyll').read_bytes() == b'', 'Current Pages build-only marker differs')
    files = {**info['files'], **build_only}
    require(actual == set(files) | {'build-info.json'}, 'Current Pages file inventory differs')
    for name, item in files.items():
        path = pathlib.PurePosixPath(name)
        require(path.as_posix() == name and not path.is_absolute() and '..' not in path.parts and '\\' not in name, 'Unsafe current Pages path')
        data = (pages / name).read_bytes()
        require(len(data) == item['bytes'] and sha(data) == item['sha256'], 'Current Pages asset differs: ' + name)
    baseline = strict_json((root / 'docs/successor/PRESERVATION_BASELINE.json').read_bytes())
    for name in baseline['routes'] + ['successor/index.html', 'fr/successor/index.html']:
        require(name in actual, 'Current Pages route is missing: ' + name)


def validate_fixture_tree(actual, policy):
    require(actual == policy['TREE'], 'Historical fixture tree identity differs')


def main():
    require((ROOT / 'config/manager-dependency-maintenance-v1.json').is_file(), 'Correction preservation manifest is required; no implicit legacy fallback')
    policy = runpy.run_path(str(ROOT / 'scripts/release/maintenance-profile.py'))
    previous = runpy.run_path(str(ROOT / 'scripts/release/transformational-profile.py'))
    history = previous['PREVIOUS']['PREVIOUS']
    validate_current(ROOT, policy)
    git = lambda *args: policy['git'](ROOT, *args)
    commit = git('rev-parse', 'HEAD').decode().strip()
    pages = ROOT / 'build/pages'
    validate_pages(ROOT, pages, commit)
    validate_fixture_tree(git('rev-parse', history['BASE'] + '^{tree}').decode().strip(), history)
    with tempfile.TemporaryDirectory(prefix='manager-historical-preservation-') as tmp:
        target = pathlib.Path(tmp)
        with tarfile.open(fileobj=io.BytesIO(git('archive', history['BASE']))) as archive:
            for member in archive.getmembers():
                if member.isdir(): continue
                mode = stat.S_IFLNK | 0o777 if member.issym() else stat.S_IFREG | (0o755 if member.mode & 0o111 else 0o644)
                source_path(member.name, mode)
                require(member.isfile() or member.issym() and member.name == 'hardhat/contracts' and member.linkname == '../contracts', 'Invalid historical archive entry')
                path = target / member.name
                path.parent.mkdir(parents=True, exist_ok=True)
                if member.issym(): path.symlink_to('../contracts')
                else:
                    path.write_bytes(archive.extractfile(member).read())
                    path.chmod(mode & 0o777)
        manifest = strict_json((target / history['BASE_MANIFEST']).read_bytes())
        require(sha((target / history['BASE_MANIFEST']).read_bytes()) == history['BASE_MANIFEST_SHA'], 'Historical inventory pin differs')
        path = 'scripts/release/candidate-profile.py'
        require(sha((target / path).read_bytes()) == manifest['inputs'][path]['sha256'], 'Historical candidate verifier differs')
        candidate = runpy.run_path(str(target / path))
        selection = candidate['select'](candidate['PROFILE'], manifest=candidate['MANIFEST'], manifest_sha256=history['BASE_MANIFEST_SHA'], verifier_sha256=manifest['inputs'][candidate['VERIFIER']]['sha256'], schema_sha256=manifest['inputs'][candidate['SCHEMA']]['sha256'])
        candidate['validate_source'](target, selection)
        shutil.copytree(pages, target / 'build/pages')
        validate_pages(ROOT, target / 'build/pages', commit)
        print('Running unchanged historical assertions on authenticated 8815 fixture, with current Pages assets.', flush=True)
        subprocess.run(['node', '--test', 'scripts/successor/preservation.test.mjs'], cwd=target, check=True)
    print('Current release invariants and Pages passed; historical 8815 assertions passed. Current fork execution remains a separate mandatory gate.')


if __name__ == '__main__':
    main()
