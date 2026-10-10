"""Safely extract the exact package, verify complete inventory, and run offline smoke checks."""
import argparse
import json
import pathlib
import stat
import subprocess
import tempfile
import zipfile
from release_common import TAG, LIMIT, require, sha, verify_assets, source_path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('assets', type=pathlib.Path)
args = parser.parse_args()
verify_assets(args.assets)
manifest_bytes = (args.assets / 'RELEASE_MANIFEST.json').read_bytes()
manifest = json.loads(manifest_bytes)
prefix = f'AGIJobManager-{TAG}/'
with tempfile.TemporaryDirectory(prefix='agijobmanager-package-smoke-') as temp, zipfile.ZipFile(args.assets / f'AGIJobManager-{TAG}-COMPLETE.zip') as archive:
    require(archive.testzip() is None, 'ZIP integrity failed')
    expected = set(manifest['files']) | {'RELEASE_MANIFEST.json'}
    require(len(archive.infolist()) == len(expected) and {i.filename for i in archive.infolist()} == {prefix + n for n in expected}, 'Archive inventory is incomplete or contains extras/duplicates')
    for item in archive.infolist():
        require(item.filename.startswith(prefix), 'Archive prefix differs')
        name = item.filename[len(prefix):]
        path = pathlib.PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and '\\' not in name, 'Unsafe archive path')
        mode = item.external_attr >> 16
        require((stat.S_ISREG(mode) or (name == 'source/hardhat/contracts' and stat.S_ISLNK(mode))) and item.file_size < LIMIT, 'Unsupported archive entry')
        if name.startswith('source/'):
            source_path(name[len('source/'):], mode)
        data = archive.read(item)
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
    require((pathlib.Path(temp) / 'agijobmanager-usdc.html').read_bytes() == (args.assets / 'agijobmanager-usdc.html').read_bytes(), 'Standalone console differs')
    subprocess.run(['node', 'scripts/release/verify-usdc-ui.mjs', '.'], cwd=pathlib.Path(temp) / 'source', check=True)
    subprocess.run(['python3', 'scripts/release/test-release-gates.py'], cwd=pathlib.Path(temp) / 'source', check=True)
print('Verified complete inventory and clean-extraction offline smoke checks. No wallet, credentials or network required.')
