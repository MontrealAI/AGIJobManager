"""Create a deterministic, checksum-verified archive of the pinned v0.9.5 source."""
import argparse
import hashlib
import io
import json
import pathlib
import subprocess
import zipfile

root = pathlib.Path(__file__).resolve().parents[2]
meta = root / 'docs/releases/v0.9.5'
config = json.loads((meta / 'release.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=pathlib.Path, default=root / 'build/release/v0.9.5')
out = parser.parse_args().out.resolve()
out.mkdir(parents=True, exist_ok=True)
if any(out.iterdir()):
    raise SystemExit('Output directory must be empty; existing artifacts are never overwritten.')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)


def sha(data):
    return hashlib.sha256(data).hexdigest()


source = config['sourceCommit']
assert git('rev-parse', source + '^{commit}').decode().strip() == source
assert git('rev-parse', source + '^{tree}').decode().strip() == config['sourceTree']
subprocess.run(['git', 'merge-base', '--is-ancestor', source, 'HEAD'], cwd=root, check=True)
for name, digest in config['evidenceDigests'].items():
    assert sha((meta / name).read_bytes()) == digest, f'Evidence digest mismatch: {name}'
inventory = json.loads((meta / 'CHANGES.json').read_text())
actual = [dict(zip(['status', 'path'], line.split('\t'))) for line in git('diff', '--no-renames', '--name-status', config['previousTag'], source).decode().splitlines()]
assert inventory['sourceCommit'] == source and inventory['previousTag'] == config['previousTag']
assert actual == inventory['changes'], 'Application delta does not match the recorded inventory.'
# The previous tag pins application source; its release evidence is added by the
# subsequent publication commit. Preserve those published records as well.
preservation = config['preservationCommit']
assert git('rev-parse', preservation + '^{commit}').decode().strip() == preservation
subprocess.run(['git', 'merge-base', '--is-ancestor', config['previousTag'], preservation], cwd=root, check=True)
subprocess.run(['git', 'merge-base', '--is-ancestor', preservation, source], cwd=root, check=True)
assert not git('diff', preservation, source, '--', *config['unchangedPaths']), 'Protected historical release or deployment records changed.'

payload = {}
with zipfile.ZipFile(io.BytesIO(git('archive', '--format=zip', source))) as archive:
    for item in archive.infolist():
        if not item.is_dir():
            payload['source/' + item.filename] = (archive.read(item), (item.external_attr >> 16) or 0o100644)
ui_name = pathlib.Path(config['primaryUI']).name
payload[ui_name] = (git('show', source + ':' + config['primaryUI']), 0o100644)
payload['LICENSE'] = (git('show', source + ':LICENSE'), 0o100644)
for name in ['START_HERE.md', 'RELEASE_NOTES.md', 'VALIDATION.md', 'release.json', *config['evidenceDigests']]:
    payload[name] = ((meta / name).read_bytes(), 0o100644)
for name in ['package-release.py', 'verify-usdc-ui.mjs', 'publish-release.py', 'test-release-gates.py']:
    payload['release-tooling/' + name] = ((root / 'scripts/release' / name).read_bytes(), 0o100644)
payload['release-tooling/current-state-release.yml'] = ((root / '.github/workflows/current-state-release.yml').read_bytes(), 0o100644)
manifest = dict(config, files={name: {'sha256': sha(data), 'bytes': len(data)} for name, (data, _) in sorted(payload.items())})
manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode()
payload['RELEASE_MANIFEST.json'] = (manifest_bytes, 0o100644)
prefix = f"AGIJobManager-{config['tag']}"
zip_path = out / (prefix + '-COMPLETE.zip')
date = tuple(map(int, config['releaseDate'].split('-'))) + (0, 0, 0)
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, (data, mode) in sorted(payload.items()):
        info = zipfile.ZipInfo(prefix + '/' + name, date_time=date)
        info.create_system = 3
        info.external_attr = mode << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, data, compresslevel=9)
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None
    for name, details in manifest['files'].items():
        assert sha(archive.read(prefix + '/' + name)) == details['sha256']
(out / ui_name).write_bytes(payload[ui_name][0])
(out / 'RELEASE_MANIFEST.json').write_bytes(manifest_bytes)
checksums = ''.join(f'{sha(file.read_bytes())}  {file.name}\n' for file in sorted(out.iterdir()))
(out / 'SHA256SUMS.txt').write_text(checksums)
print(f'Packaged {len(manifest["files"])} payload files from {source}')
print(checksums, end='')
