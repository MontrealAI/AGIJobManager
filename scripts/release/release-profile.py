"""Release-only wrapper over immutable 8815 inputs. Identity is not qualification."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import runpy
import stat
import subprocess
from release_common import require, sha, strict_json, REPOSITORY, TITLE, valid_sha

PROFILE = 'manager-explicit-governor-release-v1'
MANIFEST = 'config/explicit-governor-release-v1.json'
VERIFIER = 'scripts/release/release-profile.py'
BASE = '8815ed3181778664595f951befd672afbd7a9352'
TREE = '913e49d65263bc53026916f7fc3b4cbfb93549f8'
BASE_MANIFEST = 'config/explicit-governor-source-v1.json'
BASE_MANIFEST_SHA = '83cd0976000a74d8c8ac3b5fd21c90ba48068c5ef87582dd6ba926e2b62c01e2'
LATEST_DISPLAY_RECORD_SHA = '06def03f2844edeb2f93203edb028a37085c83f79aedd91857e8b1ae9af922c0'
VERSION = '1.19.2'
VERSION_ONLY = {p + n for p in ('', 'hardhat/', 'ui/') for n in ('package.json', 'package-lock.json')} | {'config/usdc-deployment.json'}
# Finite release delta. No contract, compiler, dependency or deployment script is mutable.
ALLOWED = VERSION_ONLY | {
    'site/deployments.mjs', 'scripts/site/deployments.test.mjs', 'scripts/site/build.mjs',
    'scripts/site/check.mjs', 'scripts/site/browser-test.mjs', 'site/template.mjs',
    'site/content/en.json', 'site/content/fr.json', 'docs/OPERATIONS/COMMISSIONING.md',
    'docs/deployments/README.md', 'OPERATOR_ACTIONS_REQUIRED.md',
    'docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md',
    'config/mainnet/manager-8815-2026-10-17.json', 'docs/deployments/MAINNET_MANAGER_2026-10-17.md', 'docs/DEPLOYMENT/SECOND_MAINNET_RELEASE.md', 'config/companion-releases.json', 'agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html', 'ui/README.md', 'docs/START_HERE.md', 'docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md', 'ui/src/generated/deployments.ts', 'ui/src/app/deployment/page.tsx', 'ui/scripts/sync-deployments.mjs', 'ui/tests/usdcConsole.test.ts',
    'README.md', 'docs/OPERATIONS/PRIVATE_FLEET.md', 'docs/V1_RELEASE_SCOPE.md',
    'docs/RELEASE_GUIDE.md', 'docs/REFERENCE/VERSIONS.md', 'docs/ui/DEPLOYMENT_MAINNET.md', 'scripts/docs/release-alignment.mjs',
    'docs/MAINNET_READINESS.md', 'scripts/docs/templates/V1_RELEASE_SCOPE.md.tpl', 'docs/REPO_MAP.md', 'scripts/docs/templates/README.md.tpl', 'ui/agijobmanager-usdc.html',
    '.github/workflows/current-state-release.yml', '.github/workflows/publish-v114.yml',
    '.github/workflows/pages.yml', 'scripts/release/run-release-preservation.py', '.github/workflows/mainnet-fork.yml', '.github/workflows/security-verification.yml',
    'scripts/release/release_common.py', 'scripts/release/package-release.py',
    'scripts/release/verify-package.py', 'scripts/release/collect-qualification.py',
    'scripts/release/publish-release.py', VERIFIER, 'scripts/release/package-policy.py',
    'scripts/release/test-release-profile.py', 'scripts/release/test-release-gates.py', 'ui/scripts/generate-deployment-docs.mjs', 'ui/scripts/docs-check.mjs', 'scripts/release/run-inherited-source-tests.py',
    'docs/qualification/mainnet-cutover-v1.19.0-expected.json', 'docs/qualification/mainnet-cutover-v1.19.1-expected.json', 'docs/qualification/mainnet-cutover-v1.19.2-expected.json',
    'docs/qualification/release-v1.19.0-provenance.json', 'docs/qualification/release-v1.19.1-provenance.json', 'docs/qualification/release-v1.19.2-provenance.json',
    'scripts/security/slither-reviewed-findings-v1.19.0.json', 'scripts/security/slither-reviewed-findings-v1.19.1.json', 'scripts/security/slither-reviewed-findings-v1.19.2.json',
    'scripts/security/verify-slither-review.py',
} | {'docs/releases/' + tag + '/' + n + '.md' for tag in ('v1.19.0', 'v1.19.1', 'v1.19.2') for n in ('START_HERE', 'RELEASE_NOTES', 'RECOVERY_GUIDE', 'VALIDATION')}


def read(root, name):
    p = pathlib.PurePosixPath(name)
    require(p.as_posix() == name and not p.is_absolute() and '..' not in p.parts and '\\' not in name, 'Unsafe release input path')
    target = pathlib.Path(root) / name
    if target.is_symlink():
        require(name == 'hardhat/contracts' and os.readlink(target) == '../contracts', 'Unexpected release symlink')
        return '120000', b'../contracts'
    require(target.is_file() and target.resolve() == target, 'Missing or indirect release input: ' + name)
    return ('100755' if target.stat().st_mode & 0o111 else '100644'), target.read_bytes()


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None, 'Release policy selection differs')
    require(all(isinstance(p, str) and re.fullmatch('[0-9a-f]{64}', p) for p in (manifest_sha256, verifier_sha256)), 'Release manifest and verifier pins are mandatory')
    return {'releaseProfile': PROFILE, 'manifestPath': MANIFEST, 'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256}


def metadata(selection):
    return {'releaseProfile': PROFILE, 'releasePolicy': dict(selection),
            'qualification': 'Release wrapper source identity only. Final exact-main-push qualification and publication authorization must be verified in the external QUALIFICATION.json.'}


def validate_metadata(manifest, selection):
    require(set(manifest) == {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource', 'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files', 'releaseProfile', 'releasePolicy'}, 'Release manifest fields differ; embedded approval is prohibited')
    require(type(manifest.get('schemaVersion')) is int and manifest['schemaVersion'] == 2 and manifest.get('repository') == REPOSITORY and manifest.get('name') == TITLE, 'Release manifest schema/repository/name differs')
    require(valid_sha(manifest.get('sourceCommit')) and valid_sha(manifest.get('sourceTree')), 'Release manifest source identity differs')
    require(not {'candidateProfile', 'sourcePackageOnly', 'releaseQualified', 'releaseIdentity'} & set(manifest), 'Candidate or fabricated qualification metadata is prohibited')
    for k, v in metadata(selection).items():
        require(manifest.get(k) == v, 'Release policy metadata differs: ' + k)
    require(manifest.get('tag') == 'v' + VERSION and manifest.get('stage') == 'source-package', 'Release wrapper identity differs')


def inventory(root, selection):
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Release verifier pin differs')
    require(sha(read(root, MANIFEST)[1]) == selection['manifestSha256'], 'Release manifest pin differs')
    inherited = read(root, BASE_MANIFEST)[1]
    require(sha(inherited) == BASE_MANIFEST_SHA, 'Immutable 8815 inventory differs')
    baseline = {name: {'mode': v['mode'], 'sha256': v['sha256']} for name, v in strict_json(inherited)['inputs'].items()}
    baseline[BASE_MANIFEST] = {'mode': '100644', 'sha256': BASE_MANIFEST_SHA}
    m = strict_json(read(root, MANIFEST)[1])
    require(set(m) == {'schema', 'profile', 'baseCommit', 'baseTree', 'version', 'qualification', 'changes'}, 'Release delta fields differ')
    require(m['schema'] == 'agijobmanager/release-delta/v1' and m['profile'] == PROFILE and m['baseCommit'] == BASE and m['baseTree'] == TREE and m['version'] == VERSION, 'Release delta identity differs')
    require(m['qualification'] == 'PENDING_FINAL_SOURCE_MAIN_PUSH', 'Source delta cannot claim release qualification')
    require(isinstance(m['changes'], dict) and m['changes'] and set(m['changes']) <= ALLOWED, 'Release delta exceeds finite allowed paths')
    result = dict(baseline)
    for name, item in m['changes'].items():
        require(set(item) == {'before', 'after', 'reason'} and isinstance(item['reason'], str) and item['reason'].strip(), 'Missing exact release delta attribution')
        require(item['before'] == baseline.get(name), 'Release predecessor bytes differ: ' + name)
        after = item['after']
        require(isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] in ('100644', '100755') and re.fullmatch('[0-9a-f]{64}', after['sha256']), 'Invalid release delta identity')
        require(after != item['before'], 'Unchanged release delta entry')
        result[name] = after
    result[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    return result, baseline



PREVIOUS_DEPLOYMENT_NOTE = 'Candidate software; no transaction target is selected by default. The separately recorded mainnet instance was deployed and ENS-connected at block 26165026. Activation remains held pending separate review. Use the recorded-instance inspection workflow for fresh state. Public-input work, no new review retainers, existing credits/claims and deployed contract behavior remain unchanged.'
DEPLOYMENT_NOTE = 'Software package; no transaction target is selected by default. The latest reported Manager deployment is recorded on 2026-10-17 in config/mainnet/manager-8815-2026-10-17.json; its authority snapshot reports paused intake. This owner-reported record is not live state or paid-intake qualification and does not establish an ENS helper attachment. The October 10 ENS-connected instance is historical and separate. Public-input work, no new review retainers, existing credits/claims and deployed contract behavior remain unchanged.'
CONSOLE_DISPLAY_PREVIOUS = """      <h2>USDC deployment · v1.18.0 candidate</h2>
      <details class="helper" style="margin:14px 0;overflow-wrap:anywhere">
        <summary>View the recorded mainnet instance — no wallet needed</summary>
        <p><b>Deployed and ENS-connected at block 26,165,026 on October 10, 2026.</b> Activation is held pending separate review. Current state is unavailable in this historical panel.</p>
        <p>Ethereum mainnet · Chain 1<br>Manager: <code>0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7</code><br>Helper: <code>0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC</code><br>Namespace: <code>usdc.jobs.agi.eth</code></p>
        <p>This panel does not select a transaction target. <a href="https://github.com/MontrealAI/AGIJobManager/blob/main/docs/OPERATIONS/COMMISSIONING.md" target="_blank" rel="noopener noreferrer">Inspect the existing instance and review A1–A5</a>.</p>
      </details>"""
PAGE_LATEST_DISPLAY = """    <section aria-labelledby='latest-reported-instance' className='space-y-3 rounded-xl border p-6'>
      <h2 id='latest-reported-instance' className='text-2xl font-semibold'>Latest reported Manager deployment · {l.recordDate}</h2>
      <p>{l.contractCount} creations reported finalized on Ethereum mainnet. Explorer report: {l.exactMatches} Exact Match and {l.retainedSimilarMatches} retained Similar Match.</p>
      <p>Owner-reported authority snapshot at block {l.block.toLocaleString('en-US')}: intake {l.intakePaused ? 'paused' : 'not paused'}. Paid intake remains held.</p>
      <p><strong>Recorded evidence, not live state.</strong> No wallet is needed. This record does not establish an ENS helper attachment or select a transaction target.</p>
      <dl className='space-y-2 break-all'>
        <dt>Latest reported manager</dt><dd><a href={l.managerCodeUrl} target='_blank' rel='noopener noreferrer'>{l.manager}</a></dd>
        <dt>Selected source commit</dt><dd>{l.sourceCommit}</dd>
        <dt>Reported owner</dt><dd>{l.owner}</dd>
        <dt>Authority snapshot block hash</dt><dd>{l.blockHash}</dd>
      </dl>
      <p><a href={`https://github.com/MontrealAI/AGIJobManager/blob/main/${l.guidePath}`} target='_blank' rel='noopener noreferrer'>Review the latest deployment and all nine contracts</a> · <a href={`https://github.com/MontrealAI/AGIJobManager/blob/main/${l.recordPath}`} target='_blank' rel='noopener noreferrer'>Machine-readable record</a></p>
    </section>
"""
PAGE_DISPLAY_CHANGES = (
    ("import { OFFICIAL_DEPLOYMENTS as d, RECORDED_MAINNET_INSTANCE as r, LATEST_REPORTED_MAINNET_INSTANCE as l } from '@/generated/deployments';", "import { OFFICIAL_DEPLOYMENTS as d, RECORDED_MAINNET_INSTANCE as r } from '@/generated/deployments';"),
    ('USDC software and deployment records', 'USDC deployment and recorded instance'),
    (PAGE_LATEST_DISPLAY, ''),
    ("<h2 id='recorded-instance' className='text-2xl font-semibold'>Historical instance · October 10, 2026</h2>", "<h2 id='recorded-instance' className='text-2xl font-semibold'>Deployed and ENS-connected</h2>"),
    ("<p>Historical deployment and ENS connection recorded on {r.recordDate} at Ethereum block {r.block.toLocaleString('en-US')}. This older instance and its helper are separate from the latest reported Manager above.</p>", "<p>Recorded on {r.recordDate} at Ethereum block {r.block.toLocaleString('en-US')}. Activation is held pending separate review.</p>"),
    ("<a href='https://github.com/MontrealAI/AGIJobManager/blob/main/docs/deployments/MAINNET_USDC_2026-10-10.md' target='_blank' rel='noopener noreferrer'>Review the October 10 historical record</a>", "<a href='https://github.com/MontrealAI/AGIJobManager/blob/main/docs/OPERATIONS/COMMISSIONING.md' target='_blank' rel='noopener noreferrer'>Inspect this existing instance and review the five activation groups</a>"),
)


def revert_exact(text, after, before, label):
    require(text.count(after) == 1, 'Reviewed display fragment missing or ambiguous: ' + label)
    return text.replace(after, before, 1)


def normalize_deployment_page(text):
    for index, (after, before) in enumerate(PAGE_DISPLAY_CHANGES):
        text = revert_exact(text, after, before, 'deployment page ' + str(index))
    return text


def deployment_display_inputs(root):
    config = strict_json(read(root, 'config/usdc-deployment.json')[1])
    historical = strict_json(read(root, 'config/mainnet/agi-jobs-usdc.json')[1])
    latest_bytes = read(root, 'config/mainnet/manager-8815-2026-10-17.json')[1]
    require(sha(latest_bytes) == LATEST_DISPLAY_RECORD_SHA, 'Dated deployment evidence changed beyond its reviewed published record')
    latest = strict_json(latest_bytes)
    require(latest['schema'] == 'agijobmanager-recorded-deployment-v2' and latest['chainId'] == 1 and latest['recordDate'] == '2026-10-17', 'Reviewed latest display record identity differs')
    require(latest['notLiveState'] is True and latest['notDefaultConfiguration'] is True and latest['source']['commit'] == BASE and latest['source']['tree'] == TREE, 'Latest display record exceeds reviewed evidence scope')
    recorded = dict(chainId=historical['chainId'], manager=historical['manager'], helper=historical['helper'], namespace=historical['jobsRootName'], block=historical['connection']['snapshot']['number'], blockHash=historical['connection']['snapshot']['hash'], recordDate=historical['recordDate'], activation=historical['activation']['decision'])
    reported = dict(chainId=latest['chainId'], manager=latest['manager'], recordDate=latest['recordDate'], sourceCommit=latest['source']['commit'], block=latest['reportedAuthoritySnapshot']['blockNumber'], blockHash=latest['reportedAuthoritySnapshot']['blockHash'], owner=latest['reportedAuthoritySnapshot']['owner'], intakePaused=latest['reportedAuthoritySnapshot']['intakePaused'], contractCount=latest['deployment']['finalizedCount'], exactMatches=latest['explorerVerification']['exactMatches'], retainedSimilarMatches=latest['explorerVerification']['retainedSimilarMatches'], recordPath='config/mainnet/manager-8815-2026-10-17.json', guidePath='docs/deployments/MAINNET_MANAGER_2026-10-17.md', managerCodeUrl=latest['verificationLinks']['managerCode'])
    require(all(isinstance(reported[key], str) and re.fullmatch('0x[0-9a-fA-F]{40}', reported[key]) for key in ('manager', 'owner')), 'Unsafe latest display address')
    require(re.fullmatch('0x[0-9a-f]{64}', reported['blockHash']) and type(reported['block']) is int and reported['block'] > 0 and type(reported['intakePaused']) is bool, 'Unsafe latest display snapshot')
    require(all(type(reported[key]) is int for key in ('contractCount', 'exactMatches', 'retainedSimilarMatches')) and (reported['contractCount'], reported['exactMatches'], reported['retainedSimilarMatches']) == (9, 6, 3), 'Reviewed latest display explorer inventory differs')
    require(reported['managerCodeUrl'] == 'https://etherscan.io/address/' + reported['manager'] + '#code', 'Unsafe latest display explorer link')
    return config, recorded, reported


def generated_deployment_exports(config, recorded, reported=None):
    serialize = lambda value: json.dumps(value, indent=2, ensure_ascii=False)
    header = '// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.\n'
    if reported is not None:
        header = '// Generated from config/usdc-deployment.json and the dated deployment records. Never infer transaction defaults from these records.\n'
    content = header + 'export const OFFICIAL_DEPLOYMENTS = ' + serialize(config) + ' as const;\n\n// Historical display only; never a transaction default.\nexport const RECORDED_MAINNET_INSTANCE = ' + serialize(recorded) + ' as const;\n'
    if reported is not None:
        content += '\n// Latest owner-reported display only; not a live observation or transaction default.\nexport const LATEST_REPORTED_MAINNET_INSTANCE = ' + serialize(reported) + ' as const;\n'
    return content


def console_deployment_display(config, recorded, reported):
    from html import escape
    e = lambda value: escape(str(value), quote=True)
    github = 'https://github.com/MontrealAI/AGIJobManager/blob/main/'
    return f'''      <!-- recorded-deployment-display:start -->
      <h2>USDC deployment · v{e(config['version'])} software</h2>
      <div class="helper" style="margin:14px 0;overflow-wrap:anywhere" aria-labelledby="latestReportedDeployment">
        <h3 id="latestReportedDeployment">Latest reported Manager deployment · {e(reported['recordDate'])}</h3>
        <p>Ethereum mainnet · Chain {reported['chainId']}<br>Manager: <a href="{e(reported['managerCodeUrl'])}" target="_blank" rel="noopener noreferrer"><code>{e(reported['manager'])}</code></a></p>
        <p>{reported['contractCount']} creations reported finalized. Explorer report: {reported['exactMatches']} Exact Match and {reported['retainedSimilarMatches']} retained Similar Match. Authority snapshot: block {reported['block']:,}; intake {'paused' if reported['intakePaused'] else 'not paused'}.</p>
        <p>Owner-reported evidence, not live state. Paid intake remains held; this record does not establish an ENS helper attachment or select a transaction target. <a href="{github}{e(reported['guidePath'])}" target="_blank" rel="noopener noreferrer">Review the latest deployment and all nine contracts</a> · <a href="{github}{e(reported['recordPath'])}" target="_blank" rel="noopener noreferrer">Machine-readable record</a>.</p>
      </div>
      <details class="helper" style="margin:14px 0;overflow-wrap:anywhere">
        <summary>Historical instance · October 10, 2026 — no wallet needed</summary>
        <p><b>Historical deployment and ENS connection at block {recorded['block']:,}.</b> This older instance is separate from the latest reported Manager above. Current state is unavailable in this historical panel.</p>
        <p>Ethereum mainnet · Chain {recorded['chainId']}<br>Historical manager: <code>{e(recorded['manager'])}</code><br>Historical helper: <code>{e(recorded['helper'])}</code><br>Historical namespace: <code>{e(recorded['namespace'])}</code></p>
        <p>The historical helper is not attached to the latest Manager by this record. This panel does not select a transaction target. <a href="{github}docs/deployments/MAINNET_USDC_2026-10-10.md" target="_blank" rel="noopener noreferrer">Review the October 10 historical record</a>.</p>
      </details>
      <!-- recorded-deployment-display:end -->'''


def validate_ui_metadata(root, baseline):
    """Reverse only exact reviewed display changes; retain the immutable UI runtime hash."""
    config, recorded, reported = deployment_display_inputs(root)
    require(config['note'] == DEPLOYMENT_NOTE, 'Unreviewed deployment note')
    page_name = 'ui/src/app/deployment/page.tsx'
    page = read(root, page_name)[1].decode()
    historical_page = normalize_deployment_page(page)
    require(sha(historical_page.encode()) == baseline[page_name]['sha256'], 'Deployment page changed beyond reviewed read-only display fragments')
    generated = read(root, 'ui/src/generated/deployments.ts')[1].decode()
    require(generated == generated_deployment_exports(config, recorded, reported), 'Generated deployment metadata differs from exact recorded projection')
    historical_config = {**config, 'version': '1.18.0', 'note': PREVIOUS_DEPLOYMENT_NOTE}
    require(sha(generated_deployment_exports(historical_config, recorded).encode()) == baseline['ui/src/generated/deployments.ts']['sha256'], 'Generated deployment metadata changed beyond reviewed display projection')
    bundle_pattern = '(<script id="agijobmanager-runtime-bundle">window.__AGI_RUNTIME_BUNDLE__=)(.*?)(;window.__AGI_CONTRACT_ABI_REGISTRY__=)'
    allowed = {'README.md': 'README.md', 'config/usdc-deployment.json': 'config/usdc-deployment.json', 'docs/ui/DEPLOYMENT_MAINNET.md': 'docs/ui/DEPLOYMENT_MAINNET.md', 'src/generated/deployments.ts': 'ui/src/generated/deployments.ts'}
    def mask(text):
        text = re.sub(bundle_pattern, lambda m: m.group(1) + 'METADATA' + m.group(3), text, flags=re.S)
        def normalize_official(match):
            value = strict_json(match.group(1))
            require(value['version'] == VERSION and value['note'] == DEPLOYMENT_NOTE, 'UI official metadata differs')
            return 'const OFFICIAL=' + json.dumps({**value, 'version': 'MASKED', 'note': PREVIOUS_DEPLOYMENT_NOTE}, sort_keys=True) + ';\n'
        return re.sub(r'const OFFICIAL=(.*?);\n', normalize_official, text)
    for name in ('agijobmanager.html', 'ui/dist-ipfs/agijobmanager.html'):
        text = read(root, name)[1].decode()
        matches = list(re.finditer(bundle_pattern, text, re.S))
        require(len(matches) == 1, 'UI embedded source bundle is ambiguous')
        require(not re.search(r'</script', matches[0].group(2), re.I), 'UI embedded source bundle contains an unescaped closing script tag')
        bundle = strict_json(matches[0].group(2))
        sources = bundle['sources']
        require(bundle['sourcesSha256'] == sha(json.dumps(sources, ensure_ascii=False, separators=(',', ':')).encode()), 'UI source digest differs')
        for key, path in allowed.items():
            require(sources[key] == read(root, path)[1].decode(), 'UI embedded release document differs: ' + key)
        require(sources['src/app/deployment/page.tsx'] == page, 'UI embedded deployment page differs')
        sources['src/app/deployment/page.tsx'] = historical_page
        bundle['sources'] = {k:v for k,v in sources.items() if k not in allowed}
        bundle.pop('sourcesSha256')
        require(sha(json.dumps(bundle, sort_keys=True).encode()) == 'e7145de7bdb25b9a8cc9dbb1092a9b08d9b0d0ab47a3b00650ae51f0dea0c967', 'UI runtime sources or bundle metadata changed')
        require(sha(mask(text).encode()) == '3ea55ef04511d8d5355574582481437fba60e536db0b3252c1db40985c641641', 'UI executable bytes changed')
        official = list(re.finditer(r'const OFFICIAL=(.*?);\n', text))
        require(len(official) == 1 and strict_json(official[0].group(1))['version'] == VERSION, 'UI software version differs')
    require(read(root, 'agijobmanager.html')[1] == read(root, 'ui/dist-ipfs/agijobmanager.html')[1], 'Standalone UI copies differ')
    name = 'ui/agijobmanager-usdc.html'
    data = read(root, name)[1].decode()
    normalized = revert_exact(data, console_deployment_display(config, recorded, reported), CONSOLE_DISPLAY_PREVIOUS.replace('v1.18.0', 'v' + VERSION), 'USDC deployment display')
    require(normalized.count('v' + VERSION) == 6 and sha(normalized.replace('v' + VERSION, 'v1.18.0').encode()) == baseline[name]['sha256'], 'USDC console changed beyond reviewed display and six release labels')


def validate_source(root, selection, paths=None):
    root = pathlib.Path(root).resolve()
    expected, baseline = inventory(root, selection)
    actual = set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual == set(expected), 'Release source inventory has missing or extra inputs')
    for name, item in expected.items():
        mode, data = read(root, name)
        require(mode == item['mode'] and sha(data) == item['sha256'], 'Release source bytes/mode differ: ' + name)
        if name in VERSION_ONLY:
            value = strict_json(data)
            require(value['version'] == VERSION, 'Workspace software version differs')
            if name == 'config/usdc-deployment.json':
                require(value['note'] == DEPLOYMENT_NOTE, 'Unreviewed deployment note')
                value['note'] = PREVIOUS_DEPLOYMENT_NOTE
            value['version'] = '1.18.0'
            if name.endswith('package-lock.json'):
                require(value['packages']['']['version'] == VERSION, 'Lock software version differs')
                value['packages']['']['version'] = '1.18.0'
            require(sha((json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()) == baseline[name]['sha256'], 'Version label change altered dependencies or deployment configuration: ' + name)
    validate_ui_metadata(root, baseline)
    return {'profile': PROFILE, 'sourceInputs': len(expected), 'qualification': 'PENDING_FINAL_SOURCE_MAIN_PUSH'}


def git(root, *args):
    env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_NO_REPLACE_OBJECTS='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0')
    return subprocess.check_output(['git', '--no-replace-objects', '-c', 'protocol.allow=never', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', *args], cwd=root, env=env)


def checkout(root, selection, object_store, dependency_root, source, tree):
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Shallow release history is prohibited')
    grafts = pathlib.Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = pathlib.Path(root) / grafts
    require(not grafts.exists(), 'Grafted release history is prohibited')
    require(not git(root, 'for-each-ref', '--format=%(refname)', 'refs/replace').strip(), 'Replacement release refs are prohibited')
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == source and git(root, 'rev-parse', 'HEAD^{tree}').decode().strip() == tree, 'Release checkout identity differs')
    require(not git(root, 'status', '--porcelain', '--untracked-files=no').strip(), 'Release tracked checkout is dirty')
    require(git(root, 'rev-parse', BASE + '^{tree}').decode().strip() == TREE, 'Inherited source tree differs')
    git(root, 'merge-base', '--is-ancestor', BASE, source)
    entries = {}
    for entry in git(root, 'ls-tree', '-rz', source).split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        require(kind == 'blob', 'Unexpected release Git object')
        entries[name.decode()] = (mode, oid)
    index = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        require(stage == '0' and name.decode() not in index, 'Unmerged release index')
        index[name.decode()] = (mode, oid)
    require(index == entries, 'Release index differs from source tree')
    require(all(not entry or entry.startswith(b'H ') for entry in git(root, 'ls-files', '-v', '-z').split(b'\0')), 'Hidden release index flags are prohibited')
    for name, (mode, oid) in entries.items():
        actual_mode, data = read(root, name)
        actual_oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(mode == actual_mode and oid == actual_oid, 'Release raw bytes differ from source Git blob: ' + name)
    result = validate_source(root, selection, entries)
    if dependency_root is not None:
        verifier = runpy.run_path(str(pathlib.Path(root) / 'scripts/release/check-explicit-governor-boundaries.py'))
        result['compilerSourceUnits'] = verifier['compiler_closure'](pathlib.Path(root), strict_json(read(root, BASE_MANIFEST)[1]), dependency_root)
    return {**result, 'sourceCommit': source, 'sourceTree': tree}


def arguments(root):
    root = pathlib.Path(root)
    return ['--profile', PROFILE, '--manifest', MANIFEST, '--manifest-sha256', sha(read(root, MANIFEST)[1]), '--verifier-sha256', sha(read(root, VERIFIER)[1])]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dependency-root', required=True)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[2]
    opts = arguments(root)
    chosen = select(manifest=MANIFEST, manifest_sha256=opts[5], verifier_sha256=opts[7])
    print(json.dumps(checkout(root, chosen, None, args.dependency_root, git(root, 'rev-parse', 'HEAD').decode().strip(), git(root, 'rev-parse', 'HEAD^{tree}').decode().strip())))
