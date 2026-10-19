"""Run unchanged v1.19.4 release-policy regressions on its authenticated source."""
import io
import pathlib
import runpy
import stat
import subprocess
import tarfile
import tempfile
from release_common import require, source_path

root = pathlib.Path(__file__).resolve().parents[2]
policy = runpy.run_path(str(root / 'scripts/release/transformational-profile.py'))
git = lambda *args: policy['git'](root, *args)
require(git('rev-parse', policy['BASE'] + '^{tree}').decode().strip() == policy['TREE'], 'Previous release tree differs')
with tempfile.TemporaryDirectory(prefix='manager-inherited-v1.19.4-') as tmp:
    target = pathlib.Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(git('archive', policy['BASE']))) as archive:
        for member in archive.getmembers():
            if member.isdir(): continue
            mode = stat.S_IFLNK | 0o777 if member.issym() else stat.S_IFREG | (0o755 if member.mode & 0o111 else 0o644)
            source_path(member.name, mode)
            require(member.isfile() or member.issym() and member.name == 'hardhat/contracts' and member.linkname == '../contracts', 'Unexpected previous release archive entry')
            path = target / member.name
            path.parent.mkdir(parents=True, exist_ok=True)
            if member.issym(): path.symlink_to('../contracts')
            else:
                path.write_bytes(archive.extractfile(member).read())
                path.chmod(mode & 0o777)
    subprocess.run(['git', 'init', '--quiet', str(target)], check=True)
    objects = pathlib.Path(git('rev-parse', '--git-path', 'objects').decode().strip())
    if not objects.is_absolute(): objects = root / objects
    (target / '.git/objects/info/alternates').write_text(str(objects.resolve()) + '\n')
    policy['git'](target, 'read-tree', policy['BASE'])
    policy['git'](target, 'update-ref', 'refs/heads/inherited-release-fixture', policy['BASE'])
    policy['git'](target, 'symbolic-ref', 'HEAD', 'refs/heads/inherited-release-fixture')
    subprocess.run(['python3', 'scripts/release/test-correction-profile.py'], cwd=target, check=True)
    subprocess.run(['python3', 'scripts/release/test-publication-authorization.py'], cwd=target, check=True)
    subprocess.run(['python3', 'scripts/release/run-inherited-release-tests.py'], cwd=target, check=True)
print('Unchanged v1.19.4 release-policy adversarial regressions passed on authenticated source; current correction qualification remains separate.')
