"""Safely extract the exact package, verify complete inventory, and run offline smoke checks."""
import argparse
import json
import pathlib
import runpy
import stat
import subprocess
import sys
import tempfile
import zipfile
sys.dont_write_bytecode = True
from release_common import TAG, TITLE, REPOSITORY, WORKFLOWS, DISCOVERY_PROFILE, qualification_workflows, LIMIT, require, sha, valid_sha, verify_assets, source_path, verify_builder_rebuild, verify_builder_context_outputs, strict_json
from release_common import builder_reconstruction, retained_builder_package

candidate_policy = runpy.run_path(str(pathlib.Path(__file__).with_name('package-policy.py')))

def package_inventory(assets, *, published=False, profile='legacy-v114', manifest=None,
                      manifest_sha256=None, verifier_sha256=None, schema_sha256=None):
    """Verify local bytes and recorded bindings, without claiming live CI/provenance verification."""
    selection = candidate_policy['select'](profile, manifest=manifest, manifest_sha256=manifest_sha256,
        verifier_sha256=verifier_sha256, schema_sha256=schema_sha256, published=published)
    config = None
    if published:
        qualification = assets / 'QUALIFICATION.json'
        qualification_limit = 64 * 1024 * 1024 if profile == DISCOVERY_PROFILE else 1_000_000
        require(qualification.is_file() and not qualification.is_symlink() and qualification.stat().st_size < qualification_limit, 'Published qualification is missing or oversized')
        config = json.loads(qualification.read_text())
        require(config.get('repository') == REPOSITORY and config.get('tag') == TAG and config.get('name') == TITLE and config.get('status') == 'qualified', 'Published qualification identity differs')
        require(valid_sha(config.get('sourceCommit')) and valid_sha(config.get('sourceTree')) and config.get('checkoutCommit') == config['sourceCommit'], 'Published source binding differs')
        workflows = qualification_workflows(config)
        require(set(config.get('requiredSourceRuns', {})) == set(workflows), f'Published qualification must record all {len(workflows)} workflows')
    if published and selection and selection.get('releaseProfile') in ('manager-transformational-v1', 'manager-dependency-maintenance-v1', DISCOVERY_PROFILE):
        runpy.run_path(str(pathlib.Path(__file__).with_name('transformational-qualification.py')))['verify_record'](config)
    if published and selection and selection.get('releaseProfile') == 'manager-dependency-maintenance-v1':
        runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance-qualification.py')))['verify_record'](config)
    if published and selection and selection.get('releaseProfile') == DISCOVERY_PROFILE:
        runpy.run_path(str(pathlib.Path(__file__).with_name('discovery-qualification.py')))['verify_record'](config)
    verify_assets(assets, config)
    manifest_bytes = (assets / 'RELEASE_MANIFEST.json').read_bytes()
    manifest = strict_json(manifest_bytes)
    require(valid_sha(manifest.get('sourceCommit')) and valid_sha(manifest.get('sourceTree')), 'Invalid manifest source identity')
    candidate_policy['validate_metadata'](manifest, selection)
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


def extract_browser_capsule(assets, destination, selection):
    """Reuse exact candidate-owned original bytes for a deterministic publisher rebuild."""
    assets, destination = pathlib.Path(assets), pathlib.Path(destination)
    require(selection is not None and selection.get('releaseProfile') == DISCOVERY_PROFILE,
            'Saved browser extraction requires explicit Discovery profile')
    require(destination.is_absolute() and not destination.exists() and destination.parent.resolve() == destination.parent,
            'Saved browser extraction output must be absent and absolute')
    verify_assets(assets)
    manifest_raw = (assets / 'RELEASE_MANIFEST.json').read_bytes()
    manifest = strict_json(manifest_raw)
    candidate_policy['validate_metadata'](manifest, selection)
    source_root = pathlib.Path(__file__).resolve().parents[2]
    discovery = candidate_policy['policy'](selection)
    expected = set(discovery['browser_policy'](source_root)['BROWSER_MEMBERS']) | {discovery['BROWSER_MANIFEST']}
    captured = {}
    with zipfile.ZipFile(assets / f'AGIJobManager-{TAG}-COMPLETE.zip') as archive:
        prefix = archive_inventory(archive, manifest)
        total = 0
        for name in sorted(expected):
            target_name = discovery['BROWSER_CAPSULE'] + '/' + name
            item = archive.getinfo(prefix + target_name)
            total += item.file_size
            require(0 < item.file_size <= 2_000_000 and total <= 16_000_000
                    and item.external_attr >> 16 == (stat.S_IFREG | 0o644),
                    'Saved browser extraction bytes/mode exceed their bound')
            raw = archive.read(item)
            require(manifest['files'][target_name] == {'sha256': sha(raw), 'bytes': len(raw), 'mode': item.external_attr >> 16},
                    'Saved browser extraction member differs')
            captured[name] = raw
    destination.mkdir(mode=0o700)
    for name, raw in captured.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(raw)
        target.chmod(0o644)
    discovery['validate_browser_capsule'](source_root, destination)
    return destination

def verify_package(assets, *, published=False, profile='legacy-v114', manifest=None,
                   manifest_sha256=None, verifier_sha256=None, schema_sha256=None, native_source_root=None):
    assets = pathlib.Path(assets)
    options = dict(profile=profile, manifest=manifest, manifest_sha256=manifest_sha256,
        verifier_sha256=verifier_sha256, schema_sha256=schema_sha256)
    selection = candidate_policy['select'](**options, published=published)
    manifest, manifest_bytes = package_inventory(assets, published=published, **options)
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
        if selection is not None:
            candidate_policy['validate_source'](source_dir, selection)
        if selection is not None and selection.get('releaseProfile') == DISCOVERY_PROFILE:
            discovery = candidate_policy['policy'](selection)
            capsule = pathlib.Path(temp) / discovery['CAPSULE']
            discovery['validate_alpha_capsule'](source_dir, capsule)
            browser_capsule = pathlib.Path(temp) / discovery['BROWSER_CAPSULE']
            browser_input = discovery['validate_browser_capsule'](source_dir, browser_capsule)
            context = pathlib.Path(temp) / 'native-context.json'
            context.write_text(json.dumps({'sourceCommit': manifest['sourceCommit'],
                'sourceTree': manifest['sourceTree'],
                'browserInput': browser_input,
                'candidateArchiveSha256': sha((assets / f'AGIJobManager-{TAG}-COMPLETE.zip').read_bytes())}) + '\n')
            subprocess.run(['node', 'scripts/integrations/discovery-release-native-test.mjs',
                '--installed', str(capsule), str(context), str(pathlib.Path(temp) / 'native-evidence'),
                str(browser_capsule / 'discovery-continuation/fleet-browser-workspace.json'),
                str(browser_capsule / 'discovery-continuation/fleet-browser-request.json'),
                browser_input['campaignDigest']], cwd=source_dir, check=True)
        else:
            require(native_source_root is None, 'Native source root requires explicit Discovery release selection')
        regenerated = pathlib.Path(temp) / 'rebuilt'
        selected_package = retained_builder_package(temp)
        with builder_reconstruction(source_dir, manifest.get('builderSource'), selected_package):
            verify_builder_context_outputs(manifest['builderSource'], temp)
            subprocess.run(['node', 'scripts/successor/build.mjs', '--out', str(regenerated)], cwd=source_dir, check=True)
            verify_builder_rebuild(regenerated, assets, temp)
            subprocess.run(['node', '--test', 'scripts/successor/portable.test.mjs'], cwd=source_dir, check=True)
        subprocess.run(['node', 'scripts/release/verify-usdc-ui.mjs', '.'], cwd=source_dir, check=True)
        subprocess.run(['python3', 'scripts/release/test-release-gates.py'], cwd=source_dir, check=True)
        if selection is not None and selection.get('releaseProfile') in ('manager-transformational-v1', 'manager-dependency-maintenance-v1', DISCOVERY_PROFILE):
            subprocess.run(['node', '--test', 'scripts/integrations/transformational-work-request.test.mjs', 'scripts/integrations/transformational-native-source.test.mjs'], cwd=source_dir, check=True)
            subprocess.run(['python3', 'scripts/release/test-transformational-qualification.py'], cwd=source_dir, check=True)
            subprocess.run(['python3', 'scripts/release/test-publication-authorization-ti.py'], cwd=source_dir, check=True)
    print('Verified complete inventory and clean-extraction offline smoke checks. No wallet, credentials or network required.')
    if selection is not None and 'releaseProfile' not in selection:
        print('Candidate source package only: input identity is bound; release identity is unselected and release qualification is false.')
    if published:
        print('Published qualification bindings match. Live CI status, release authenticity and attestations must be verified separately.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('assets', type=pathlib.Path)
    parser.add_argument('--published', action='store_true', help='Require the complete published inventory, including QUALIFICATION.json and its exact asset/source bindings')
    candidate_policy['add_selection_arguments'](parser)
    parser.add_argument('--native-source-root', help='Optional source-side capture root; installed Discovery replay uses only saved capsule bytes')
    verify_package(**vars(parser.parse_args()))
