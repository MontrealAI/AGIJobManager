"""Build an exact-source reproducible package; qualification is recorded externally."""
import argparse
import datetime
import io
import json
import os
import pathlib
import runpy
import stat
import subprocess
import sys
import tarfile
import tempfile
import zipfile
sys.dont_write_bytecode = True
from release_common import TAG, TITLE, LIMIT, BUILDER_ASSETS, BUILDER_ARCHIVE_ONLY_ASSETS, REPOSITORY, sha, require, source_path, packaged_guide, require_builder_outputs, verified_builder_context, verify_builder_context_outputs
from release_common import builder_reconstruction

root = pathlib.Path(__file__).resolve().parents[2]
candidate_policy = runpy.run_path(str(pathlib.Path(__file__).with_name('package-policy.py')))

def git(*args):
    env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_SYSTEM='/dev/null', GIT_CONFIG_GLOBAL='/dev/null', GIT_NO_REPLACE_OBJECTS='1', GIT_TERMINAL_PROMPT='0')
    return subprocess.check_output(['git', '--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', *args], cwd=root, env=env)

def package(out, *, profile='legacy-v114', manifest=None, manifest_sha256=None,
            verifier_sha256=None, schema_sha256=None, object_store=None, dependency_root=None):
    selection = candidate_policy['select'](profile, manifest=manifest, manifest_sha256=manifest_sha256,
        verifier_sha256=verifier_sha256, schema_sha256=schema_sha256)
    require(selection is not None or not any((object_store, dependency_root)), 'Legacy packaging cannot accept candidate roots')
    source = git('rev-parse', 'HEAD').decode().strip()
    tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
    require(not git('status', '--porcelain', '--untracked-files=no').strip(), 'Tracked source must be clean')
    if selection is None:
        subprocess.run(['python3', 'scripts/release/check-v114-boundaries.py'], cwd=root, check=True)
    else:
        candidate_policy['checkout'](root, selection, object_store, dependency_root, source, tree)
    payload = {}
    with tarfile.open(fileobj=io.BytesIO(git('archive', source)), mode='r:') as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            if member.name == 'ui/test-results/.last-run.json':
                continue
            mode = (stat.S_IFLNK | 0o777) if member.issym() else (stat.S_IFREG | (0o755 if member.mode & 0o111 else 0o644))
            require(member.isfile() or (member.issym() and member.name == 'hardhat/contracts' and member.linkname == '../contracts'), 'Unreviewed symlinks and nonregular source are prohibited')
            source_path(member.name, mode)
            data = member.linkname.encode() if member.issym() else archive.extractfile(member).read()
            require(len(data) < LIMIT, 'Source file exceeds package limit')
            payload['source/' + member.name] = (data, mode)
    guides = {f'docs/releases/{TAG}/{name}': name for name in ['START_HERE.md', 'RELEASE_NOTES.md', 'RECOVERY_GUIDE.md', 'VALIDATION.md']}
    for source_name, name in guides.items():
        payload[name] = (packaged_guide(payload['source/' + source_name][0], source_name, payload, guides), stat.S_IFREG | 0o644)
    for name, source_name in [('agijobmanager-usdc.html', 'ui/agijobmanager-usdc.html'), ('LICENSE', 'LICENSE')]:
        payload[name] = payload['source/' + source_name]
    # Build solely from the archived commit, never untracked working-tree inputs.
    with tempfile.TemporaryDirectory(prefix='successor-release-build-') as temp:
        extracted = pathlib.Path(temp) / 'source'
        for name, (data, mode) in payload.items():
            if name.startswith('source/') and stat.S_ISREG(mode):
                target = pathlib.Path(temp) / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                if selection is not None:
                    target.chmod(mode & 0o777)
            elif selection is not None and name == 'source/hardhat/contracts':
                target = pathlib.Path(temp) / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to('../contracts', target_is_directory=True)
        if selection is not None:
            candidate_policy['validate_source'](extracted, selection)
        builder_source, selected_package = verified_builder_context(root, extracted, source)
        generated = pathlib.Path(temp) / 'builder'
        with builder_reconstruction(extracted, builder_source, selected_package):
            subprocess.run(['node', 'scripts/successor/build.mjs', '--out', str(generated)], cwd=extracted, check=True)
            require_builder_outputs(generated)
            verify_builder_context_outputs(builder_source, generated)
        for name in BUILDER_ASSETS | BUILDER_ARCHIVE_ONLY_ASSETS:
            payload[name] = ((generated / name).read_bytes(), stat.S_IFREG | 0o644)
    manifest = {'schemaVersion': 2, 'repository': REPOSITORY, 'tag': TAG, 'name': TITLE,
        'sourceCommit': source, 'sourceTree': tree, 'builderSource': builder_source, 'stage': 'source-package',
        'qualification': 'See the external QUALIFICATION.json accompanying an approved published release. This manifest alone is byte identity, not qualification.',
        'archiveLimitBytes': LIMIT, 'toolchain': {'node': '22.23.2 (qualification workflow)', 'solc': '0.8.37', 'hardhat': '3.17.0'},
        'exclusions': ['untracked files', 'Git internals', 'operator transcripts and private configuration', 'dependencies and caches', 'transport/bootstrap material', 'unreviewed symlinks (hardhat/contracts -> ../contracts is retained)', 'ui/test-results/.last-run.json', 'archives and signer material'],
        'files': {n: {'sha256': sha(data), 'bytes': len(data), 'mode': mode} for n, (data, mode) in sorted(payload.items())}}
    if selection is not None:
        manifest.update(candidate_policy['metadata'](selection))
        candidate_policy['validate_metadata'](manifest, selection)
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode()
    payload['RELEASE_MANIFEST.json'] = (manifest_bytes, stat.S_IFREG | 0o644)
    out = pathlib.Path(out).resolve()
    require(out != root and root not in out.parents or str(out).startswith(str(root / 'build') + '/'), 'Use an external or build output directory')
    out.mkdir(parents=True, exist_ok=True)
    require(not any(out.iterdir()), 'Output must be empty; previous artifacts are never overwritten')
    stamp = int(git('show', '-s', '--format=%ct', source))
    dt = datetime.datetime.fromtimestamp(stamp, datetime.timezone.utc)
    date = (max(1980, dt.year), dt.month, dt.day, dt.hour, dt.minute, dt.second // 2 * 2)
    archive_path = out / f'AGIJobManager-{TAG}-COMPLETE.zip'
    with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, (data, mode) in sorted(payload.items()):
            info = zipfile.ZipInfo(f'AGIJobManager-{TAG}/' + name, date_time=date)
            info.create_system = 3
            info.external_attr = mode << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    (out / 'agijobmanager-usdc.html').write_bytes(payload['agijobmanager-usdc.html'][0])
    (out / 'RELEASE_MANIFEST.json').write_bytes(manifest_bytes)
    for name in BUILDER_ASSETS:
        (out / name).write_bytes(payload[name][0])
    for file in out.iterdir():
        require(file.stat().st_size < LIMIT, 'Asset exceeds 450 MB')
    (out / 'SHA256SUMS.txt').write_text(''.join(f'{sha(f.read_bytes())}  {f.name}\n' for f in sorted(out.iterdir())))
    result = {'sourceCommit': source, 'sourceTree': tree, 'files': len(manifest['files']), 'zipBytes': archive_path.stat().st_size, 'published': False}
    if selection is not None:
        result.update(candidate_policy['metadata'](selection))
    print(json.dumps(result))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path, default=root / ('build/release/' + TAG + '-candidate'))
    candidate_policy['add_selection_arguments'](parser)
    parser.add_argument('--object-store', action='append', help='Exact absolute Git object-store root for explicitly selected candidate input checks')
    parser.add_argument('--dependency-root', help='Exact absolute installed compiler dependency root; never used by offline extraction')
    package(**vars(parser.parse_args()))
