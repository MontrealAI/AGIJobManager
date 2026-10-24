"""Exact-source qualification and archive policy; no network or writes on import."""
import hashlib
import contextlib
import json
import itertools
import os
import pathlib
import posixpath
import re
import stat
import subprocess
import zipfile
from urllib.parse import quote, urlsplit, urlunsplit

REPOSITORY = 'MontrealAI/AGIJobManager'
TAG = 'v' + json.loads((pathlib.Path(__file__).resolve().parents[2] / 'package.json').read_text())['version']
TITLE = TAG + ' — Shared mission receipt context'
BUILDER_ASSETS = {'My-SUCCESSOR-Omega-en.html', 'My-SUCCESSOR-Omega-fr.html', 'SUCCESSOR-Omega-editable-source.zip', 'SOURCE_MANIFEST.json'}
BUILDER_ARCHIVE_ONLY_ASSETS = {'MANAGER_CONTEXT.json'}
LIMIT = 450_000_000
RELEASE_ASSET_MAX_BYTES = 2_147_483_647
_READ_CHUNK_BYTES = 1024 * 1024
BASE = '191cf3590e5cdc08df1bb0af500ee28a91c8b010'
WORKFLOWS = {
    'ci.yml': ['build (0)', 'build (1)', 'build (2)', 'build (3)'],
    'ui.yml': ['ui'],
    'docs.yml': ['docs'],
    'security-verification.yml': ['security-verification'],
    'mainnet-fork.yml': ['mainnet-usdc'],
    'current-state-release.yml': ['qualify'],
    'pages.yml': ['Build and check website'],
    'alpha-project-handoff.yml': ['receiver-validation'],
}
DISCOVERY_PROFILE = 'manager-discovery-release-v1'
DISCOVERY_WORKFLOW = 'discovery-lab-receiver.yml'
DISCOVERY_JOBS = ['Discovery Lab zero-cap receiver policy (22.23.2)', 'Discovery Lab zero-cap receiver policy (24.21.0)']

def qualification_workflows(config=None):
    # Existing historical profiles retain their original eight gates.
    result = {name: list(jobs) for name, jobs in WORKFLOWS.items()}
    if config and config.get('sourcePolicy', {}).get('releaseProfile') == DISCOVERY_PROFILE:
        result[DISCOVERY_WORKFLOW] = list(DISCOVERY_JOBS)
    return result

REQUIRED_STEPS = {
    'discovery-lab-receiver.yml': ['Check exact source and run transport-policy regressions', 'Verify the versioned Discovery release source inventory', 'Capture the exact reviewed Alpha implementation', 'Run actual pinned synthetic campaign and native admission', 'Retain exact-source policy and actual local native evidence'],
    'alpha-project-handoff.yml': ['Fetch the exact reviewed native Alpha validator', 'Exercise actual receiver validation, work and bilingual history'],
    'pages.yml': ['Build and verify static pages', 'SUCCESSOR local and adversarial checks', 'Verify mobile, desktop and bilingual interactions', 'SUCCESSOR browser, accessibility and isolated worker rehearsal'],
    'ci.yml': ['Lint', 'Build', 'Bytecode size check', 'Test'],
    'ui.yml': ['Check UI registry audit and bounded backport disposition', 'Run npm run lint', 'Run npm run typecheck', 'Run npm run test', 'Run npm run test:e2e', 'Run npm run test:a11y', 'Run npm run verify:deterministic'],
    'docs.yml': ['Check docs freshness/integrity', 'ENS docs integrity'],
    'security-verification.yml': ['Verify deployment toolchain', 'Forge build', 'Forge unit + fuzz tests', 'Forge invariants', 'Run and review extended Slither findings'],
    'mainnet-fork.yml': ['Test actual Circle USDC on a pinned local mainnet fork', 'Rehearse USDC and ENS cutover beside the actual legacy manager', 'Match the committed qualification to the executed source and observations'],
    'current-state-release.yml': ['Source and dependency compatibility boundaries', 'Complete preflight and real entrypoint regressions', 'Native compiler, provider, storage and historical runtime compatibility', 'Test release qualification gates offline', 'Build and independently rebuild candidate assets', 'Clean extraction and offline smoke test', 'Retain source-pinned candidate assets'],
}
ROOT_FILES = {'.env.example', 'agijobmanager.html', 'truffle-config.js', 'LICENSE', 'README.md', 'package.json', 'package-lock.json', 'foundry.toml', 'remappings.txt', 'requirements.txt', 'pyproject.toml', 'tsconfig.json', 'slither.config.json', '.gitignore', '.gitmodules', '.gitattributes', '.npmrc', '.nvmrc', '.prettierrc', '.solhint.json', '.solhintignore'}
ROOT_DIRS = {'examples', 'integrations', 'presentations', '.github', 'config', 'contracts', 'docs', 'experiments', 'forge-test', 'hardhat', 'lib', 'migrations', 'schemas', 'scripts', 'site', 'test', 'ui', 'ui-tests', 'vendor'}
FORBIDDEN = {'node_modules', '.git', '.venv', '__pycache__', '.next', 'cache', 'cache_hardhat', 'artifacts', 'artifacts_hardhat', 'build', 'out', 'coverage', 'playwright-report', 'test-results', 'originals-INTERNAL-DO-NOT-PUBLISH'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()


def _file_snapshot(value):
    return tuple(getattr(value, name) for name in
        ('st_dev', 'st_ino', 'st_mode', 'st_size', 'st_mtime_ns', 'st_ctime_ns'))

@contextlib.contextmanager
def _open_bounded_file(path, maximum, *, expected=None):
    """Open an ordinary bounded leaf without following links or blocking on a FIFO."""
    path = pathlib.Path(path)
    before = path.stat(follow_symlinks=False)
    require(expected is None or _file_snapshot(before) == _file_snapshot(expected),
            'File changed before comparison: ' + path.name)
    require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= maximum,
            'File is not an ordinary bounded input: ' + path.name)
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        require(_file_snapshot(os.fstat(descriptor)) == _file_snapshot(before),
                'File changed before capture: ' + path.name)
        with os.fdopen(descriptor, 'rb') as stream:
            descriptor = None
            yield stream, before
            require(_file_snapshot(os.fstat(stream.fileno())) == _file_snapshot(before)
                    and _file_snapshot(path.stat(follow_symlinks=False)) == _file_snapshot(before),
                    'File changed during capture: ' + path.name)
    finally:
        if descriptor is not None:
            os.close(descriptor)

def _file_chunks(path, maximum, *, expected=None):
    with _open_bounded_file(path, maximum, expected=expected) as (stream, before):
        total = 0
        while True:
            block = stream.read(min(_READ_CHUNK_BYTES, before.st_size - total + 1))
            if not block:
                break
            total += len(block)
            require(total <= before.st_size, 'File grew during capture: ' + pathlib.Path(path).name)
            yield block
        require(total == before.st_size, 'File changed during capture: ' + pathlib.Path(path).name)

def file_sha(path, *, maximum=None):
    """Hash complete ordinary file bytes through bounded, snapshot-checked reads."""
    result = hashlib.sha256()
    maximum = RELEASE_ASSET_MAX_BYTES if maximum is None else maximum
    for block in _file_chunks(path, maximum):
        result.update(block)
    return result.hexdigest()

def read_bounded(path, *, maximum=None):
    """Keep metadata parsing below the unchanged archive resource ceiling."""
    return b''.join(_file_chunks(path, LIMIT - 1 if maximum is None else maximum))

def files_equal(left, right):
    """Compare ordinary files by size first, then through bounded complete reads."""
    left, right = pathlib.Path(left), pathlib.Path(right)
    details = [path.stat(follow_symlinks=False) for path in (left, right)]
    require(all(stat.S_ISREG(item.st_mode) and 0 <= item.st_size <= RELEASE_ASSET_MAX_BYTES
                for item in details), 'File comparison requires ordinary bounded inputs')
    if details[0].st_size != details[1].st_size:
        return False
    with contextlib.closing(_file_chunks(left, RELEASE_ASSET_MAX_BYTES, expected=details[0])) as first, \
            contextlib.closing(_file_chunks(right, RELEASE_ASSET_MAX_BYTES, expected=details[1])) as second:
        return all(a == b for a, b in itertools.zip_longest(first, second))

def valid_sha(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value) is not None

def strict_json(data):
    def finite_float(raw):
        result = float(raw)
        require(result not in (float('inf'), float('-inf')), 'Non-finite JSON number')
        return result

    def reject_constant(raw):
        raise ValueError('Non-finite JSON constant: ' + raw)

    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON field: ' + key)
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=reject_constant, parse_float=finite_float)

def builder_archive_context(source, context, selected_package=None):
    """Cross-bind a retained v2 context to the archived selector and exact bytes.

    This validates an offline trust checkpoint, not publication or Git provenance.
    The unchanged Builder resolver additionally checks its complete ordered closure.
    """
    source = pathlib.Path(source).resolve()
    def read(name):
        source_path(name, stat.S_IFREG | 0o644)
        target = source / name
        require(target.is_file() and not target.is_symlink() and target.resolve() == target,
                'Builder source must be a regular file: ' + name)
        return target.read_bytes()
    require(isinstance(context, dict) and set(context) == {'schema', 'commit', 'tree', 'version', 'packageSha256', 'sourceManifest'}, 'Builder archive context fields differ')
    require(context['schema'] == 'agijobmanager/successor-editable-source/v2' and valid_sha(context['commit']) and valid_sha(context['tree']), 'Builder archive context identity differs')
    selector = strict_json(read('config/successor-builder-source.json'))
    require(isinstance(selector, dict) and set(selector) == {'schema', 'repository', 'commit', 'tree', 'version', 'engineSha256'}, 'Builder selector fields differ')
    require(selector['schema'] == 'agijobmanager/successor-builder-source/v1' and selector['repository'] == REPOSITORY, 'Builder selector identity differs')
    require(all(context[key] == selector[key] for key in ['commit', 'tree', 'version']), 'Builder selected-source binding differs')
    wrapper_package = read('package.json')
    wrapper = strict_json(wrapper_package)
    require(isinstance(wrapper, dict) and wrapper.get('version') == TAG[1:], 'Builder wrapper package differs')
    package = wrapper_package if selected_package is None else selected_package
    require(isinstance(package, bytes) and 0 < len(package) <= 1_000_000, 'Builder selected package bytes differ')
    selected = strict_json(package)
    require(isinstance(selected, dict) and context['packageSha256'] == sha(package) and context['version'] == selected.get('version'), 'Builder selected package differs')
    manifest = context['sourceManifest']
    require(isinstance(manifest, dict) and set(manifest) == {'repository', 'commit', 'engineSha256', 'files', 'license'}, 'Builder source manifest fields differ')
    require(manifest['repository'] == REPOSITORY and manifest['commit'] == context['commit'] and manifest['license'] == 'MIT', 'Builder source manifest identity differs')
    files = manifest['files']
    require(isinstance(files, list) and 0 < len(files) <= 50, 'Builder source inventory differs')
    seen = set()
    for item in files:
        require(isinstance(item, dict) and set(item) == {'path', 'sha256'} and isinstance(item['path'], str), 'Builder source inventory entry differs')
        require(item['path'] not in seen and item['path'] not in {'config/successor-builder-source.json', 'SOURCE.json', 'package.json'}, 'Builder source inventory is duplicated or self-referential')
        seen.add(item['path'])
        require(item['sha256'] == sha(read(item['path'])), 'Builder archived source bytes differ: ' + item['path'])
    digest = sha(json.dumps(files, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())
    require(manifest['engineSha256'] == selector['engineSha256'] == digest, 'Builder source inventory digest differs')
    return (json.dumps(context, indent=2, ensure_ascii=False) + '\n').encode()

def verified_builder_context(repository, archived, expected_source):
    """Use the committed resolver in normal Git-pin mode; never bootstrap."""
    program = '''
      import path from 'node:path';
      import { pathToFileURL } from 'node:url';
      const [repository, archived] = process.argv.slice(1);
      const { SOURCE_FILES } = await import(pathToFileURL(path.join(archived, 'scripts/successor/build.mjs')));
      const { resolveBuilderSource, actualRepositoryCommit, ARCHIVE_SCHEMA } = await import(pathToFileURL(path.join(archived, 'scripts/successor/source-identity.mjs')));
      const identity = resolveBuilderSource(repository, SOURCE_FILES);
      if (identity.verification.mode !== 'git-object-pin') throw Error('SOURCE_GIT_PIN_REQUIRED');
      console.log(JSON.stringify({ checkoutCommit: actualRepositoryCommit(repository), packageRaw: identity.packageRaw, context: {
        schema: ARCHIVE_SCHEMA, commit: identity.commit, tree: identity.tree, version: identity.version,
        packageSha256: identity.packageSha256, sourceManifest: identity.sourceManifest
      }}));
    '''
    result = strict_json(subprocess.check_output(['node', '--input-type=module', '-e', program, str(repository), str(archived)]))
    require(result.get('checkoutCommit') == expected_source, 'Builder qualification checkout differs')
    context = result['context']
    require(isinstance(result.get('packageRaw'), str), 'Builder selected package bytes are missing')
    selected_package = result['packageRaw'].encode('utf-8')
    builder_archive_context(archived, context, selected_package)
    return context, selected_package


def retained_builder_package(directory):
    """Read only the unique regular package entry in the retained Builder ZIP."""
    target = pathlib.Path(directory) / 'SUCCESSOR-Omega-editable-source.zip'
    require(target.is_file() and not target.is_symlink(), 'Missing regular Builder ZIP')
    with zipfile.ZipFile(target) as archive:
        entries = [item for item in archive.infolist() if item.filename == 'package.json']
        require(len(entries) == 1, 'Builder selected package entry is missing or duplicated')
        item = entries[0]
        require(stat.S_IFMT(item.external_attr >> 16) in {0, stat.S_IFREG} and 0 < item.file_size <= 1_000_000,
                'Builder selected package must be a bounded regular entry')
        package = archive.read(item)
        require(len(package) == item.file_size, 'Builder selected package size differs')
        return package


@contextlib.contextmanager
def builder_reconstruction(source, context, selected_package):
    """Use selected bytes only in a temporary rebuild; restore the wrapper."""
    source = pathlib.Path(source)
    encoded = builder_archive_context(source, context, selected_package)
    marker, package = source / 'SOURCE.json', source / 'package.json'
    require(not marker.exists() and not marker.is_symlink(), 'Unexpected Builder reconstruction context')
    wrapper = package.read_bytes()
    try:
        package.write_bytes(selected_package)
        marker.write_bytes(encoded)
        yield
    finally:
        package.write_bytes(wrapper)
        if marker.exists() or marker.is_symlink():
            marker.unlink()

def require_builder_outputs(directory):
    """Accept only reviewed standalone and archive-only generated Builder files."""
    files = list(pathlib.Path(directory).iterdir())
    require({p.name for p in files} == BUILDER_ASSETS | BUILDER_ARCHIVE_ONLY_ASSETS,
            'Builder release inventory differs')
    require(all(p.is_file() and not p.is_symlink() for p in files),
            'Builder outputs must be regular files')

def verify_builder_context_outputs(context, directory):
    """Check retained selected identity before executing an offline rebuild."""
    directory = pathlib.Path(directory)
    for name in ['SOURCE_MANIFEST.json', 'MANAGER_CONTEXT.json']:
        target = directory / name
        require(target.is_file() and not target.is_symlink(), 'Missing regular Builder identity output: ' + name)
        value = strict_json(target.read_bytes())
        if name == 'MANAGER_CONTEXT.json':
            require(isinstance(value, dict) and set(value) == {'sourceManifest', 'managerSource'}, 'Builder manager context fields differ')
            value = value['sourceManifest']
        require(value == context['sourceManifest'], 'Builder retained source manifest differs: ' + name)

def verify_builder_rebuild(regenerated, assets, extracted):
    """Bind standalone outputs and archive-only context to clean source output."""
    regenerated, assets, extracted = map(pathlib.Path, (regenerated, assets, extracted))
    require_builder_outputs(regenerated)
    for name in BUILDER_ASSETS | BUILDER_ARCHIVE_ONLY_ASSETS:
        archived = extracted / name
        require(archived.is_file() and not archived.is_symlink(), 'Missing regular Builder archive output: ' + name)
        require(files_equal(regenerated / name, archived), 'Clean Builder archive rebuild differs: ' + name)
        if name in BUILDER_ASSETS:
            require(files_equal(assets / name, archived), 'Standalone Builder rebuild differs: ' + name)

def source_path(name, mode):
    p = pathlib.PurePosixPath(name)
    require(p.as_posix() == name and not p.is_absolute() and '..' not in p.parts and '\\' not in name and not any(ord(c) < 32 for c in name), 'Unsafe package path: ' + name)
    require(stat.S_ISREG(mode) or (name == 'hardhat/contracts' and stat.S_ISLNK(mode)), 'Unreviewed symlink or special source file: ' + name)
    require(not set(p.parts) & FORBIDDEN, 'Excluded package path: ' + name)
    require(not any(part.startswith('.v114-bootstrap') for part in p.parts), 'Transport source must not ship')
    require(p.name != 'v114-preparation-bootstrap.yml', 'Transport workflow must not ship')
    require(not (p.name == '.env' or (p.name.startswith('.env.') and not p.name.endswith(('.example', '.sample', '.template')))), 'Private environment file must not ship')
    require(p.suffix.lower() not in {'.zip', '.tar', '.gz', '.xz', '.7z', '.pem', '.key', '.p12', '.pfx'}, 'Archive or signer material must not ship: ' + name)
    require((len(p.parts) > 1 and p.parts[0] in ROOT_DIRS) or (len(p.parts) == 1 and (name in ROOT_FILES or name.startswith('hardhat.') or name.endswith(('.md', '.yml', '.yaml')))), 'Path is outside the reviewed inclusion policy: ' + name)


def packaged_guide(data, source_name, available, guide_destinations):
    """Rebase inline Markdown links in root guide copies; preserve source bytes."""
    def rebase(match):
        href = match.group(2)
        target = urlsplit(href)
        if target.scheme or target.netloc or href.startswith('#'):
            return match.group(0)
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(source_name), target.path))
        require(not resolved.startswith(('/', '../')) and resolved != '..' and '\\' not in resolved, 'Unsafe packaged guide link: ' + href)
        source_target = 'source/' + resolved
        require(source_target in available, 'Missing packaged guide link target: ' + resolved)
        destination = guide_destinations.get(resolved, source_target)
        return match.group(1) + urlunsplit(('', '', destination, target.query, target.fragment)) + match.group(3)
    return re.sub(r'(\[[^\]\n]+\]\()([^()\s]+)(\))', rebase, data.decode('utf-8')).encode('utf-8')


def github_release_notes(data, source_name, available):
    """Resolve release-page links against this immutable tag and packaged files."""
    destinations = {
        name[7:]: f'https://github.com/{REPOSITORY}/blob/{TAG}/{quote(name[7:], safe="/")}'
        for name in available if name.startswith('source/')
    }
    return packaged_guide(data, source_name, available, destinations).decode('utf-8')


def run_jobs(api, run_id, attempt):
    result, page = [], 1
    while True:
        batch = api(f'actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100&page={page}')['jobs']
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1

def validate_run(api, logs, workflow, item, source, *, publication=False, workflows=None):
    workflows = WORKFLOWS if workflows is None else workflows
    require(workflow in workflows and item['workflow'] == workflow, 'Unknown workflow identity')
    require(type(item['id']) is int and item['id'] > 0 and type(item['attempt']) is int and item['attempt'] > 0, 'Invalid run identity')
    run = api(f'actions/runs/{item["id"]}')
    for key, value in [('id', item['id']), ('workflow_id', item['workflowId']), ('run_attempt', item['attempt']), ('head_sha', source), ('path', '.github/workflows/' + workflow), ('event', item['event']), ('head_branch', item['headBranch']), ('status', 'completed'), ('conclusion', 'success')]:
        require(run.get(key) == value, 'Run identity or result differs: ' + key)
    require(run['repository']['full_name'] == REPOSITORY and run['head_repository']['full_name'] == REPOSITORY, 'Run repository differs')
    require(run['event'] in {'push', 'pull_request'} and not run['head_branch'].startswith('bootstrap/'), 'Unqualified event/ref')
    if publication:
        require(run['event'] == 'push' and run['head_branch'] == 'main', 'Publication requires final main-source push qualification')
    identity = api(f'actions/workflows/{item["workflowId"]}')
    require(identity['id'] == item['workflowId'] and identity['path'] == '.github/workflows/' + workflow, 'Workflow ID/path differs')
    jobs = run_jobs(api, item['id'], item['attempt'])
    if workflow == 'pages.yml':
        deployment = [j for j in jobs if j['name'] == 'Publish GitHub Pages']
        require(len(deployment) == 1 and deployment[0]['status'] == 'completed' and deployment[0]['conclusion'] == 'skipped', 'Qualification must not publish Pages')
        jobs = [j for j in jobs if j['name'] != 'Publish GitHub Pages']
    require(sorted(j['name'] for j in jobs) == sorted(workflows[workflow]), 'Required jobs differ or are duplicated')
    for job in jobs:
        require(job['status'] == 'completed' and job['conclusion'] == 'success' and job.get('head_sha') == source and job.get('run_id') == item['id'], 'Required source job did not succeed on source')
        wanted = ['Verify qualified source checkout', *REQUIRED_STEPS[workflow]]
        if workflow == 'ci.yml' and job['name'] == 'build (0)':
            wanted += ['Released USDC console browser checks', 'Simulation accounting regression checks', 'UI smoke test']
        for name in wanted:
            steps = [s for s in job.get('steps', []) if s['name'] == name]
            require(len(steps) == 1 and steps[0]['status'] == 'completed' and steps[0]['conclusion'] == 'success', 'Required step did not execute successfully: ' + name)
        marker = re.findall(r'^(?:\d{4}-\d{2}-\d{2}T\S+[ \t]+)?QUALIFIED_SOURCE_COMMIT=([0-9a-f]{40})[ \t]*\r?$', logs(job['id']), re.MULTILINE)
        require(marker == [source], 'Missing, duplicate or wrong checkout log evidence')
    return run, jobs

def validate_qualification(config, api, logs, *, publication=False):
    require(config.get('repository') == REPOSITORY and config.get('tag') == TAG and config.get('name') == TITLE, 'Release identity differs')
    require(config.get('status') == 'qualified' and valid_sha(config.get('sourceCommit')) and valid_sha(config.get('sourceTree')), 'Release is not qualified')
    source = config['sourceCommit']
    require(config.get('checkoutCommit') == source, 'Qualification did not check out exact source')
    require(api(f'git/commits/{source}')['tree']['sha'] == config['sourceTree'], 'Source tree differs')
    workflows = qualification_workflows(config)
    require(set(config.get('requiredSourceRuns', {})) == set(workflows), f'All {len(workflows)} qualification workflows are required')
    for workflow, item in config['requiredSourceRuns'].items():
        validate_run(api, logs, workflow, item, source, publication=publication, workflows=workflows)
    return source

def verify_assets(out, config=None, *, return_manifest=False):
    out = pathlib.Path(out)
    expected = {}
    checksum_raw = read_bounded(out / 'SHA256SUMS.txt')
    for line in checksum_raw.decode('utf8').splitlines():
        require('  ' in line, 'Malformed checksum inventory')
        digest, name = line.split('  ', 1)
        require(pathlib.Path(name).name == name and name not in expected and re.fullmatch('[0-9a-f]{64}', digest), 'Malformed checksum inventory')
        expected[name] = digest
    names = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html', 'RELEASE_MANIFEST.json'} | BUILDER_ASSETS
    if config is not None:
        names.add('QUALIFICATION.json')
    require(set(expected) == names and {p.name for p in out.iterdir()} == names | {'SHA256SUMS.txt'}, 'Unexpected or missing assets')
    for name in expected:
        f = out / name
        require(f.is_file() and not f.is_symlink() and f.stat().st_size <= RELEASE_ASSET_MAX_BYTES,
                'Asset digest/size differs: ' + name)
    manifest_raw = read_bounded(out / 'RELEASE_MANIFEST.json')
    manifest = strict_json(manifest_raw)
    require(isinstance(manifest, dict), 'Release manifest must be an object')
    require(sha(manifest_raw) == expected['RELEASE_MANIFEST.json'], 'Asset digest/size differs: RELEASE_MANIFEST.json')
    for name, digest in expected.items():
        maximum = LIMIT - 1 if name == 'RELEASE_MANIFEST.json' else RELEASE_ASSET_MAX_BYTES
        require(file_sha(out / name, maximum=maximum) == digest, 'Asset digest/size differs: ' + name)
    if config is not None:
        require('candidateProfile' not in manifest and 'sourcePackageOnly' not in manifest,
                'Candidate input-identity packages cannot be published')
        if 'releaseProfile' in manifest:
            require(manifest.get('releasePolicy') == config.get('sourcePolicy'), 'Release policy qualification binding differs')
        require(manifest['sourceCommit'] == config['sourceCommit'] and manifest['sourceTree'] == config['sourceTree'], 'Assets and qualification identify different source')
        require(config['artifactDigests'] == {n: d for n, d in expected.items() if n != 'QUALIFICATION.json'}, 'Qualification asset binding differs')
    expected['SHA256SUMS.txt'] = sha(checksum_raw)
    require(file_sha(out / 'SHA256SUMS.txt', maximum=LIMIT - 1) == expected['SHA256SUMS.txt'],
            'Checksum inventory changed during asset verification')
    return (expected, manifest, manifest_raw) if return_manifest else expected
