"""Exact-source qualification and archive policy; no network or writes on import."""
import hashlib
import json
import pathlib
import posixpath
import re
import stat
from urllib.parse import urlsplit, urlunsplit

REPOSITORY = 'MontrealAI/AGIJobManager'
TAG = 'v' + json.loads((pathlib.Path(__file__).resolve().parents[2] / 'package.json').read_text())['version']
TITLE = TAG + ' — Guarded optional-router verification and precise Pages inventory'
BUILDER_ASSETS = {'My-SUCCESSOR-Omega-en.html', 'My-SUCCESSOR-Omega-fr.html', 'SUCCESSOR-Omega-editable-source.zip', 'SOURCE_MANIFEST.json'}
LIMIT = 450_000_000
BASE = '191cf3590e5cdc08df1bb0af500ee28a91c8b010'
WORKFLOWS = {
    'ci.yml': ['build (0)', 'build (1)', 'build (2)', 'build (3)'],
    'ui.yml': ['ui'],
    'docs.yml': ['docs'],
    'security-verification.yml': ['security-verification'],
    'mainnet-fork.yml': ['mainnet-usdc'],
    'current-state-release.yml': ['qualify'],
    'pages.yml': ['Build and check website'],
}
REQUIRED_STEPS = {
    'pages.yml': ['Build and verify static pages', 'SUCCESSOR local and adversarial checks', 'Verify mobile, desktop and bilingual interactions', 'SUCCESSOR browser, accessibility and isolated worker rehearsal'],
    'ci.yml': ['Lint', 'Build', 'Bytecode size check', 'Test'],
    'ui.yml': ['Run npm audit --audit-level=low', 'Run npm run lint', 'Run npm run typecheck', 'Run npm run test', 'Run npm run test:e2e', 'Run npm run test:a11y', 'Run npm run verify:deterministic'],
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

def valid_sha(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value) is not None

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


def run_jobs(api, run_id, attempt):
    result, page = [], 1
    while True:
        batch = api(f'actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100&page={page}')['jobs']
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1

def validate_run(api, logs, workflow, item, source, *, publication=False):
    require(workflow in WORKFLOWS and item['workflow'] == workflow, 'Unknown workflow identity')
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
    require(sorted(j['name'] for j in jobs) == sorted(WORKFLOWS[workflow]), 'Required jobs differ or are duplicated')
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
    require(set(config.get('requiredSourceRuns', {})) == set(WORKFLOWS), 'All seven qualification workflows are required')
    for workflow, item in config['requiredSourceRuns'].items():
        validate_run(api, logs, workflow, item, source, publication=publication)
    return source

def verify_assets(out, config=None):
    out = pathlib.Path(out)
    expected = {}
    for line in (out / 'SHA256SUMS.txt').read_text().splitlines():
        digest, name = line.split('  ', 1)
        require(pathlib.Path(name).name == name and name not in expected and re.fullmatch('[0-9a-f]{64}', digest), 'Malformed checksum inventory')
        f = out / name
        require(f.is_file() and not f.is_symlink() and f.stat().st_size < LIMIT and sha(f.read_bytes()) == digest, 'Asset digest/size differs: ' + name)
        expected[name] = digest
    names = {f'AGIJobManager-{TAG}-COMPLETE.zip', 'agijobmanager-usdc.html', 'RELEASE_MANIFEST.json'} | BUILDER_ASSETS
    if config is not None:
        names.add('QUALIFICATION.json')
    require(set(expected) == names and {p.name for p in out.iterdir()} == names | {'SHA256SUMS.txt'}, 'Unexpected or missing assets')
    manifest = json.loads((out / 'RELEASE_MANIFEST.json').read_text())
    if config is not None:
        require(manifest['sourceCommit'] == config['sourceCommit'] and manifest['sourceTree'] == config['sourceTree'], 'Assets and qualification identify different source')
        require(config['artifactDigests'] == {n: d for n, d in expected.items() if n != 'QUALIFICATION.json'}, 'Qualification asset binding differs')
    expected['SHA256SUMS.txt'] = sha((out / 'SHA256SUMS.txt').read_bytes())
    return expected
