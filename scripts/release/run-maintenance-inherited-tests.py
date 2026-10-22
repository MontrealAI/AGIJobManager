"""Run immutable v1.19.5 regressions on authenticated predecessor bytes."""
import argparse
import io
import pathlib
import runpy
import stat
import subprocess
import tarfile
import tempfile
from release_common import require, source_path

root = pathlib.Path(__file__).resolve().parents[2]
policy = runpy.run_path(str(root / 'scripts/release/maintenance-profile.py'))
parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--dependency-root',required=True); args=parser.parse_args()
git = lambda *args: policy['git'](root, *args)
require(git('rev-parse', policy['BASE_COMMIT'] + '^{tree}').decode().strip() == policy['BASE_TREE'], 'Previous release tree differs')
with tempfile.TemporaryDirectory(prefix='manager-inherited-v1.19.4-') as tmp:
    target = pathlib.Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(git('archive', policy['BASE_COMMIT']))) as archive:
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
    policy['git'](target, 'read-tree', policy['BASE_COMMIT'])
    policy['git'](target, 'update-ref', 'refs/heads/inherited-release-fixture', policy['BASE_COMMIT'])
    policy['git'](target, 'symbolic-ref', 'HEAD', 'refs/heads/inherited-release-fixture')
    for script, options in [
        ('test-dependency-boundaries.py', []),
        ('run-inherited-source-tests.py', ['--dependency-root', args.dependency_root]),
        ('run-inherited-release-tests.py', []),
        ('test-transformational-profile.py', []),
        ('test-transformational-qualification.py', []),
        ('test-publication-authorization-ti.py', []),
        ('test-pages-publication-ti.py', []),
        ('run-transformational-inherited-tests.py', []),
    ]:
        subprocess.run(['python3', 'scripts/release/'+script, *options],cwd=target,check=True)
print('Immutable v1.19.5 source/release adversarial regressions passed on authenticated predecessor; v1.19.6 qualification remains pending.')
