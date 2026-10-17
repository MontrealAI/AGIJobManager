"""Run original source-boundary regressions on authenticated immutable 8815 bytes."""
import argparse
import io
import pathlib
import runpy
import subprocess
import tarfile
import tempfile
from release_common import require, source_path
import stat

root = pathlib.Path(__file__).resolve().parents[2]
policy = runpy.run_path(str(root / 'scripts/release/release-profile.py'))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dependency-root', required=True)
args = parser.parse_args()
git = lambda *a: policy['git'](root, *a)
require(git('rev-parse', policy['BASE'] + '^{tree}').decode().strip() == policy['TREE'], 'Inherited source tree differs')
with tempfile.TemporaryDirectory(prefix='manager-inherited-8815-') as tmp:
    target = pathlib.Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(git('archive', policy['BASE']))) as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            mode = stat.S_IFLNK | 0o777 if member.issym() else stat.S_IFREG | (0o755 if member.mode & 0o111 else 0o644)
            source_path(member.name, mode)
            require(member.isfile() or member.issym() and member.name == 'hardhat/contracts' and member.linkname == '../contracts', 'Invalid inherited archive entry')
            p = target / member.name
            p.parent.mkdir(parents=True, exist_ok=True)
            if member.issym():
                p.symlink_to('../contracts')
            else:
                p.write_bytes(archive.extractfile(member).read())
                p.chmod(mode & 0o777)
    # Validate every extracted source byte before executing inherited test code.
    from release_common import sha, strict_json
    inherited = strict_json((target / policy['BASE_MANIFEST']).read_bytes())
    require(sha((target / policy['BASE_MANIFEST']).read_bytes()) == policy['BASE_MANIFEST_SHA'], 'Inherited inventory pin differs')
    candidate_path = 'scripts/release/candidate-profile.py'
    require(sha((target / candidate_path).read_bytes()) == inherited['inputs'][candidate_path]['sha256'], 'Inherited candidate verifier differs')
    candidate = runpy.run_path(str(target / candidate_path))
    selection = candidate['select'](candidate['PROFILE'], manifest=candidate['MANIFEST'], manifest_sha256=policy['BASE_MANIFEST_SHA'], verifier_sha256=inherited['inputs'][candidate['VERIFIER']]['sha256'], schema_sha256=inherited['inputs'][candidate['SCHEMA']]['sha256'])
    candidate['validate_source'](target, selection)
    subprocess.run(['git', 'init', '--quiet', str(target)], check=True)
    objects = pathlib.Path(git('rev-parse', '--git-path', 'objects').decode().strip())
    if not objects.is_absolute(): objects = root / objects
    (target / '.git/objects/info/alternates').write_text(str(objects.resolve()) + '\n')
    policy['git'](target, 'read-tree', policy['BASE'])
    policy['git'](target, 'update-ref', 'refs/heads/inherited-fixture', policy['BASE'])
    policy['git'](target, 'symbolic-ref', 'HEAD', 'refs/heads/inherited-fixture')
    for script, options in [
        ('test-source-boundary-dispatch.py', ['--object-store', str(root), '--dependency-root', args.dependency_root]),
        ('test-candidate-package-profile.py', []),
    ]:
        subprocess.run(['python3', 'scripts/release/' + script, *options], cwd=target, check=True)
print('Original 8815 source/candidate regressions passed; release-wrapper qualification remains separate.')
