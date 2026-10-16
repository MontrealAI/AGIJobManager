"""Safely extract the exact package, verify complete inventory, and run offline smoke checks."""
import argparse
import json
import pathlib
import stat
import subprocess
import tempfile
import zipfile
from release_common import TAG, TITLE, REPOSITORY, WORKFLOWS, LIMIT, require, sha, valid_sha, verify_assets, source_path, verify_builder_rebuild, verify_builder_context_outputs, strict_json
from release_common import builder_reconstruction, retained_builder_package

def package_inventory(assets, *, published=False):
    """Verify local bytes and recorded bindings, without claiming live CI/provenance verification."""
    config = None
    if published:
        qualification = assets / 'QUALIFICATION.json'
        require(qualification.is_file() and not qualification.is_symlink() and qualification.stat().st_size < 1_000_000, 'Published qualification is missing or oversized')
        config = json.loads(qualification.read_text())
        require(config.get('repository') == REPOSITORY and config.get('tag') == TAG and config.get('name') == TITLE and config.get('status') == 'qualified', 'Published qualification identity differs')
        require(valid_sha(config.get('sourceCommit')) and valid_sha(config.get('sourceTree')) and config.get('checkoutCommit') == config['sourceCommit'], 'Published source binding differs')
        require(set(config.get('requiredSourceRuns', {})) == set(WORKFLOWS), f'Published qualification must record all {len(WORKFLOWS)} workflows')
    verify_assets(assets, config)
    manifest_bytes = (assets / 'RELEASE_MANIFEST.json').read_bytes()
    manifest = strict_json(manifest_bytes)
    require(valid_sha(manifest.get('sourceCommit')) and valid_sha(manifest.get('sourceTree')), 'Invalid manifest source identity')
    return manifest, manifest_bytes

def archive_inventory(archive, manifest):
    """Bound every entry and the total expansion before decompressing any entry."""
    prefix = f'AGIJobManager-{TAG}/'
    require(isinstance(manifest.get('files'), dict) and len(manifest['files']) < 20_000, 'Invalid or oversized source inventory')
    expected = set(manifest['files']) | {'RELEASE_MANIFEST.json'}
    require(len(archive.infolist()) == len(expected) and {i.filename for i in archive.infolist()} == {prefix + n for n in expected}, 'Archive inventory is incomplete or contains extras/duplicates')
    require(sum(item.file_size for item in archive.infolist()) < LIMIT, 'Archive expanded size exceeds the package limit')
    for item in archive.infolist():
        require(item.filename.startswith(prefix), 'Archive prefix differs')
        name = item.filename[len(prefix):]
        path = pathlib.PurePosixPath(name)
        require(path.as_posix() == name and not path.is_absolute() and '..' not in path.parts and '\\' not in name, 'Unsafe archive path')
        require(not name.startswith('source/hardhat/contracts/'), 'Archive entries must not traverse the retained contracts symlink')
        mode = item.external_attr >> 16
        require((stat.S_ISREG(mode) or (name == 'source/hardhat/contracts' and stat.S_ISLNK(mode))) and item.file_size < LIMIT, 'Unsupported archive entry')
        if name.startswith('source/'):
            source_path(name[len('source/'):], mode)
    return prefix

def verify_package(assets, *, published=False):
    assets = pathlib.Path(assets)
    manifest, manifest_bytes = package_inventory(assets, published=published)
    with tempfile.TemporaryDirectory(prefix='agijobmanager-package-smoke-') as temp, zipfile.ZipFile(assets / f'AGIJobManager-{TAG}-COMPLETE.zip') as archive:
        prefix = archive_inventory(archive, manifest)
        for item in archive.infolist():
            name = item.filename[len(prefix):]
            mode = item.external_attr >> 16
            data = archive.read(item)  # Reading checks the CRC after the bounded inventory review.
            if name == 'RELEASE_MANIFEST.json':
                require(data == manifest_bytes, 'Embedded manifest differs')
            else:
                details = manifest['files'][name]
                require(len(data) == details['bytes'] and sha(data) == details['sha256'] and mode == details['mode'], 'Payload identity differs: ' + name)
            target = pathlib.Path(temp) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if stat.S_ISLNK(mode):
                require(name == 'source/hardhat/contracts' and data == b'../contracts', 'Unsafe symlink target')
                require((target.parent / data.decode()).resolve() == pathlib.Path(temp) / 'source/contracts', 'Symlink escapes source')
                target.symlink_to('../contracts', target_is_directory=True)
            else:
                target.write_bytes(data)
                target.chmod(mode & 0o777)
        require((pathlib.Path(temp) / 'agijobmanager-usdc.html').read_bytes() == (assets / 'agijobmanager-usdc.html').read_bytes(), 'Standalone console differs')
        source_dir = pathlib.Path(temp) / 'source'
        regenerated = pathlib.Path(temp) / 'rebuilt'
        selected_package = retained_builder_package(temp)
        with builder_reconstruction(source_dir, manifest.get('builderSource'), selected_package):
            verify_builder_context_outputs(manifest['builderSource'], temp)
            subprocess.run(['node', 'scripts/successor/build.mjs', '--out', str(regenerated)], cwd=source_dir, check=True)
            verify_builder_rebuild(regenerated, assets, temp)
            subprocess.run(['node', '--test', 'scripts/successor/portable.test.mjs'], cwd=source_dir, check=True)
        subprocess.run(['node', 'scripts/release/verify-usdc-ui.mjs', '.'], cwd=source_dir, check=True)
        subprocess.run(['python3', 'scripts/release/test-release-gates.py'], cwd=source_dir, check=True)
    print('Verified complete inventory and clean-extraction offline smoke checks. No wallet, credentials or network required.')
    if published:
        print('Published qualification bindings match. Live CI status, release authenticity and attestations must be verified separately.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('assets', type=pathlib.Path)
    parser.add_argument('--published', action='store_true', help='Require the complete published inventory, including QUALIFICATION.json and its exact asset/source bindings')
    args = parser.parse_args()
    verify_package(args.assets, published=args.published)
