"""Explicit nine-workflow Discovery qualification; imports never perform I/O.

Offline records bind evidence identities only. Publication always repeats live
source/run/job/step/log/artifact checks and inherited native TI/audit gates.
"""
import copy
import io
import json
import pathlib
import re
import runpy
import stat
import subprocess
import tempfile
import zipfile
from release_common import (DISCOVERY_PROFILE, DISCOVERY_WORKFLOW, DISCOVERY_JOBS,
                            REPOSITORY, TAG, require, run_jobs, sha, strict_json, valid_sha,
                            validate_qualification)

ROOT = pathlib.Path(__file__).resolve().parents[2]
PIN = 'config/discovery-release-alpha-source-v1.json'
SCHEMA = 'agijobmanager/discovery-release-qualification/v1'
MANAGER_FILES = ('scripts/integrations/discovery-lab-work-request.mjs',
                 'scripts/integrations/discovery-lab-contract.mjs',
                 'scripts/integrations/discovery-release-native-test.mjs',
                 'scripts/integrations/discovery-installed-operator.mjs')
NODES = ('v22.23.2', 'v24.21.0')
PREP_STEPS = ('Source and dependency compatibility boundaries',
              'Run root and Hardhat audits at low threshold',
              'Native transformation profile and inherited release tests')
ARCHIVE_NAME = f'AGIJobManager-{TAG}-COMPLETE.zip'
MISSION_MEMBERS = frozenset(('native-evidence.json', 'original-request.json',
    'raw-receipt.json', 'receipt-wrapper.json', 'workspace-before.json', 'workspace-after.json',
    'docket.json', 'docket-reopened.json'))
NATIVE_MEMBERS = MISSION_MEMBERS | {'regression/' + name for name in MISSION_MEMBERS} | {'custody.json'}
DOCKET_PATHS = ('00_manifest.md', '01_claims_matrix.md', '02_environment.md',
    '03_benchmark_tasks/spec.json', '04_baselines/comparison.json', '05_agialpha_runs/run.json',
    '06_proof_bundles/capability.json', '07_replay_logs/replay.json', '08_cost_ledgers/costs.json',
    '09_safety_ledgers/safety.json', '10_validator_reports/review.json',
    '11_alpha_wu_calibration/status.json', '12_summary_tables/outcome.json')
MAX_NATIVE_ARCHIVE_BYTES = 50_000_000
MAX_NATIVE_MEMBER_BYTES = 2_000_000
MAX_NATIVE_EXPANDED_BYTES = 16 * 1024 * 1024
MAX_QUALIFICATION_BYTES = 64 * 1024 * 1024
RESOURCE_KEYS = ('acquisitions', 'search', 'checking', 'memoryBytes', 'storageBytes',
                 'workerCapacity', 'installations', 'elapsedMs')


def hash64(value):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value) is not None


def exact(value, fields):
    return isinstance(value, dict) and set(value) == set(fields)


def captured_json(raw):
    """Strict retained JSON; source parsing does not execute any supplied code."""
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate native evidence JSON key')
            result[key] = value
        return result
    def invalid(value):
        raise ValueError('Nonfinite native evidence value: ' + value)
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()



ALPHA_REPOSITORY = 'MontrealAI/AGI-Alpha-Agent-v0'
BROWSER_PIN = 'config/discovery-release-browser-artifact-v1.json'
BROWSER_SCHEMA = 'manager/discovery-browser-input-artifact/v1'
BROWSER_WORKFLOW = '.github/workflows/successor-capability.yml'
BROWSER_PREFIX = 'discovery-continuation/'
BROWSER_MEMBERS = frozenset(('source.json', 'exact-checkout.json', *(
    BROWSER_PREFIX + name for name in ('served/index.html', 'served/sources.json',
    'fleet-browser-workspace.json', 'fleet-browser-request.json', 'jobs-browser-workspace.json',
    'jobs-browser-request.json', 'browser-native-requests.json', 'journey.json', 'fleet-native/native-proof.json'))))
MAX_BROWSER_ARCHIVE_BYTES = 150_000_000
MAX_BROWSER_EXPANDED_BYTES = 250_000_000
MAX_BROWSER_MEMBER_BYTES = 32_000_000
BROWSER_METADATA = frozenset('metadata/' + name + '.json' for name in
    ('run', 'jobs', 'artifacts', 'checkout-commit', 'public-commit'))
BROWSER_CHECKS = ['saved-freeze', 'separate-bank', 'reload-before-execution', 'actual-frozen-invocations',
    'all-seven-arms', 'losses-and-ties', 'saved-reservation', 'real-task-NOT_RUN',
    'malformed-receiver-rejected-without-history-change', 'docket-download', 'reload-after-result',
    '39-recorded-contracts', 'accessibility', '320px']


def browser_pin(root=ROOT):
    path = pathlib.Path(root) / BROWSER_PIN
    require(path.is_file() and not path.is_symlink() and path.stat().st_size < 100_000,
            'Reviewed Alpha browser artifact binding is missing or unbounded')
    raw = path.read_bytes()
    pin = captured_json(raw)
    validate_browser_binding(pin)
    return {**pin, 'pinSha256': sha(raw)}


def validate_browser_binding(pin):
    require(exact(pin, ('schema', 'state', 'repository', 'workflowPath', 'producer', 'artifact',
        'sourceHash', 'pageSha256', 'catalogSha256', 'inventorySha256', 'members', 'campaignDigest',
        'missionId', 'workspaceSha256', 'requestSha256', 'transport'))
        and pin['schema'] == BROWSER_SCHEMA and pin['repository'] == ALPHA_REPOSITORY
        and pin['workflowPath'] == BROWSER_WORKFLOW
        and pin['state'] == 'REVIEWED_AUTHENTICATED_ALPHA_ARTIFACT',
        'Alpha browser artifact binding is UNSET or unreviewed')
    producer, artifact = pin['producer'], pin['artifact']
    require(exact(producer, ('runId', 'runAttempt', 'workflowId', 'event', 'headBranch', 'headCommit',
        'checkoutCommit', 'checkoutTree', 'checkoutParents'))
        and all(type(producer[key]) is int and producer[key] > 0 for key in ('runId', 'runAttempt', 'workflowId'))
        and producer['event'] in ('push', 'pull_request') and isinstance(producer['headBranch'], str)
        and 0 < len(producer['headBranch']) < 256
        and all(valid_sha(producer[key]) for key in ('headCommit', 'checkoutCommit', 'checkoutTree'))
        and isinstance(producer['checkoutParents'], list) and 1 <= len(producer['checkoutParents']) <= 2
        and all(valid_sha(item) for item in producer['checkoutParents'])
        and (producer['event'] != 'pull_request' or (len(producer['checkoutParents']) == 2
             and producer['checkoutParents'][1] == producer['headCommit']))
        and (producer['event'] != 'push' or producer['checkoutCommit'] == producer['headCommit']),
        'Alpha browser producer source/run/checkout binding differs')
    require(exact(artifact, ('id', 'name', 'digest', 'sizeInBytes'))
        and type(artifact['id']) is int and artifact['id'] > 0
        and artifact['name'] == 'successor-capability-' + producer['checkoutCommit']
        and isinstance(artifact['digest'], str) and re.fullmatch('sha256:[0-9a-f]{64}', artifact['digest'])
        and type(artifact['sizeInBytes']) is int and 0 < artifact['sizeInBytes'] <= MAX_BROWSER_ARCHIVE_BYTES,
        'Alpha browser artifact identity/digest is malformed')
    require(all(hash64(pin[key]) for key in ('sourceHash', 'pageSha256', 'catalogSha256', 'inventorySha256',
        'campaignDigest', 'workspaceSha256', 'requestSha256'))
        and isinstance(pin['missionId'], str) and pin['missionId'].startswith('capability-')
        and exact(pin['members'], BROWSER_MEMBERS)
        and all(exact(item, ('bytes', 'sha256')) and type(item['bytes']) is int
            and 0 < item['bytes'] <= MAX_NATIVE_MEMBER_BYTES and hash64(item['sha256'])
            for item in pin['members'].values()), 'Alpha browser raw member commitments differ')
    transport = pin['transport']
    require(exact(transport, ('repository', 'commit', 'tree', 'path', 'custodySha256', 'custodyBytes', 'custodyGitBlob'))
        and transport['repository'] == ALPHA_REPOSITORY and valid_sha(transport['commit'])
        and valid_sha(transport['tree']) and valid_sha(transport['custodyGitBlob'])
        and hash64(transport['custodySha256']) and type(transport['custodyBytes']) is int
        and 0 < transport['custodyBytes'] <= MAX_NATIVE_MEMBER_BYTES
        and isinstance(transport['path'], str) and 0 < len(transport['path']) <= 256
        and re.fullmatch(r'[A-Za-z0-9_./-]+', transport['path'])
        and transport['path'] == 'evidence/discovery-browser-inputs-v1/' + producer['headCommit'],
        'Reviewed immutable public browser packet transport is missing or malformed')
    for key, name in (('workspaceSha256', 'fleet-browser-workspace.json'),
                      ('requestSha256', 'fleet-browser-request.json'),
                      ('pageSha256', 'served/index.html'), ('catalogSha256', 'served/sources.json')):
        require(pin[key] == pin['members'][BROWSER_PREFIX + name]['sha256'],
                'Alpha browser selected member digest differs: ' + key)


def github_read_api(repository, endpoint):
    """Read only fixed GitHub repositories and relative REST paths; no redirected URLs escape."""
    require(repository in (REPOSITORY, ALPHA_REPOSITORY) and isinstance(endpoint, str)
        and re.fullmatch(r'[A-Za-z0-9_./?=&%-]+', endpoint) and '..' not in endpoint,
        'Unsupported release metadata repository/path')
    require(not endpoint.startswith(('git/blobs/', 'contents/')) and not endpoint.endswith('/zip'),
            'Immutable body bytes cannot use REST blob, contents or ZIP fallbacks')
    require(not endpoint.startswith('/'), 'Unsupported release metadata path')
    raw = public_http_bytes('https://api.github.com/repos/' + repository + '/' + endpoint,
        32_000_000, 'application/vnd.github+json', 'Public release metadata')
    return captured_json(raw)


def validate_browser_archive(raw, binding):
    """CRC/hash all inert transport members, retaining only the exact original UI inputs."""
    validate_browser_binding({key: value for key, value in binding.items() if key != 'pinSha256'})
    require(isinstance(raw, bytes) and len(raw) == binding['artifact']['sizeInBytes']
        and len(raw) <= MAX_BROWSER_ARCHIVE_BYTES
        and 'sha256:' + sha(raw) == binding['artifact']['digest'], 'Downloaded Alpha browser artifact differs')
    selected, inventory, expanded = {}, {}, 0
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(0 < len(entries) <= 2048, 'Alpha browser artifact inventory exceeds its bound')
        for item in entries:
            name = item.filename
            clean = name[:-1] if item.is_dir() else name
            require(isinstance(name, str) and name not in inventory and clean and len(name) <= 512
                and not clean.startswith('/') and '\\' not in clean and ':' not in clean
                and all(part not in ('', '.', '..') for part in clean.split('/'))
                and not item.flag_bits & 1
                and stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFDIR if item.is_dir() else stat.S_IFREG)
                and 0 <= item.file_size <= MAX_BROWSER_MEMBER_BYTES,
                'Alpha browser artifact member is unsafe, duplicated, encrypted or oversized')
            expanded += item.file_size
            require(expanded <= MAX_BROWSER_EXPANDED_BYTES, 'Alpha browser artifact expansion exceeds its bound')
            data = archive.read(item)  # Complete read checks CRC for every retained or unretained member.
            require(len(data) == item.file_size, 'Alpha browser artifact member size differs')
            inventory[name] = {'bytes': len(data), 'sha256': sha(data)}
            if name in BROWSER_MEMBERS:
                require(data and not item.is_dir(), 'Alpha browser required member is empty or nonregular')
                selected[name] = data
    require(exact(selected, BROWSER_MEMBERS) and sha(canonical(inventory)) == binding['inventorySha256']
        and {name: inventory[name] for name in BROWSER_MEMBERS} == binding['members'],
        'Alpha browser artifact inventory/member commitment differs')
    return _validate_browser_files(selected, binding)


def _validate_browser_files(selected, binding):
    require(exact(selected, BROWSER_MEMBERS)
        and all(isinstance(raw, bytes) and 0 < len(raw) <= MAX_NATIVE_MEMBER_BYTES for raw in selected.values())
        and sum(map(len, selected.values())) <= MAX_NATIVE_EXPANDED_BYTES
        and {name: {'bytes': len(raw), 'sha256': sha(raw)} for name, raw in selected.items()} == binding['members'],
        'Retained Alpha browser raw file inventory/digests differ')
    catalog = captured_json(selected[BROWSER_PREFIX + 'served/sources.json'])
    source = captured_json(selected['source.json'])
    checkout = captured_json(selected['exact-checkout.json'])
    require(catalog.get('schema') == 'successor-capability-source/v1'
        and catalog.get('sourceHash') == binding['sourceHash'] and isinstance(catalog.get('sources'), dict)
        and 0 < len(catalog['sources']) <= 256
        and all(isinstance(name, str) and hash64(digest) for name, digest in catalog['sources'].items())
        and sha(canonical(catalog['sources'])) == binding['sourceHash']
        and source.get('commit') == checkout.get('commit') == binding['producer']['checkoutCommit']
        and checkout.get('tree') == binding['producer']['checkoutTree']
        and source.get('trackedDiff') == '' and source.get('source') == checkout.get('source') == catalog
        and checkout.get('files') == catalog['sources'], 'Alpha browser exact checkout/catalog differs')
    workspace = captured_json(selected[BROWSER_PREFIX + 'fleet-browser-workspace.json'])
    request = captured_json(selected[BROWSER_PREFIX + 'fleet-browser-request.json'])
    jobs_request = captured_json(selected[BROWSER_PREFIX + 'jobs-browser-request.json'])
    exports = captured_json(selected[BROWSER_PREFIX + 'browser-native-requests.json'])
    proof = captured_json(selected[BROWSER_PREFIX + 'fleet-native/native-proof.json'])
    journey = captured_json(selected[BROWSER_PREFIX + 'journey.json'])
    events = workspace.get('events')
    require(selected[BROWSER_PREFIX + 'fleet-browser-workspace.json'] == selected[BROWSER_PREFIX + 'jobs-browser-workspace.json']
        and workspace.get('missionId') == request.get('missionId') == jobs_request.get('missionId') == binding['missionId']
        and isinstance(events, list) and 0 < len(events) < 24
        and workspace.get('revision') == len(events) - 1
        and workspace.get('authority') == [] and workspace.get('paymentRoute') == 'none'
        and request.get('commission', {}).get('route') == 'manager-usdc'
        and request['commission'].get('currency') == 'USDC6' and request['commission'].get('capBaseUnits') == '0'
        and jobs_request.get('commission', {}).get('route') == 'jobs-agialpha'
        and jobs_request['commission'].get('currency') == 'AGIALPHA18' and jobs_request['commission'].get('capBaseUnits') == '0'
        and request['commission'].get('id') == jobs_request['commission'].get('id')
        and request['commission'].get('branch') != jobs_request['commission'].get('branch')
        and {key: value for key, value in request.items() if key != 'commission'} ==
            {key: value for key, value in jobs_request.items() if key != 'commission'},
        'Alpha browser original mission or alternative zero-cap UI drafts differ')
    wanted_exports = {'schema': 'actual-browser-native-request-exports/v1', 'missionId': binding['missionId'],
        'campaignDigest': binding['campaignDigest'], 'sourceHash': binding['sourceHash'], 'pageSha256': binding['pageSha256'],
        'workspace': {'file': 'fleet-browser-workspace.json', 'sha256': binding['workspaceSha256'],
            'jobsFile': 'jobs-browser-workspace.json', 'jobsSha256': binding['workspaceSha256'],
            'revision': workspace['revision'], 'eventPrefix': [event['digest'] for event in events], 'head': events[-1]['digest']},
        'requests': {'manager-usdc': {'file': 'fleet-browser-request.json', 'sha256': binding['requestSha256'], 'currency': 'USDC6'},
            'jobs-agialpha': {'file': 'jobs-browser-request.json',
                'sha256': binding['members'][BROWSER_PREFIX + 'jobs-browser-request.json']['sha256'], 'currency': 'AGIALPHA18'}},
        'scope': 'Actual UI downloads from one unchanged pre-Fleet mission; alternative unsubmitted zero-cap drafts'}
    require(exports == wanted_exports and proof.get('schema') == 'actual-browser-fleet-native-return/v1'
        and proof.get('alphaCommit') == binding['producer']['checkoutCommit']
        and proof.get('alphaTree') == binding['producer']['checkoutTree']
        and all(proof.get(key) == binding[key] for key in ('campaignDigest', 'sourceHash', 'workspaceSha256', 'requestSha256'))
        and journey.get('passed') is True and journey.get('pageErrors') == [] and journey.get('checks') == BROWSER_CHECKS
        and journey.get('pageSha256') == binding['pageSha256'] and journey.get('source') == catalog
        and journey.get('fleetLocalReview', {}).get('requestExports') == exports,
        'Alpha browser export/page/source/journey evidence differs')
    return {'binding': copy.deepcopy(binding), 'files': copy.deepcopy(selected), 'workspace': selected[BROWSER_PREFIX + 'fleet-browser-workspace.json'],
        'request': selected[BROWSER_PREFIX + 'fleet-browser-request.json'], 'catalog': catalog}


def raw_path(name):
    return (isinstance(name, str) and 0 < len(name) <= 512
        and re.fullmatch(r'[A-Za-z0-9_./-]+', name) is not None
        and all(part not in ('', '.', '..') for part in name.split('/')))


def public_raw_body(commit, name, maximum):
    """One bounded unauthenticated immutable raw request; redirects and retries are refused."""
    require(valid_sha(commit) and raw_path(name) and type(maximum) is int
        and 0 < maximum <= MAX_BROWSER_MEMBER_BYTES, 'Immutable raw body selection differs')
    url = 'https://raw.githubusercontent.com/' + ALPHA_REPOSITORY + '/' + commit + '/' + name
    return public_http_bytes(url, maximum, 'application/octet-stream', 'Immutable public raw')


def public_http_bytes(url, maximum, accept, purpose):
    """Read a fixed public GitHub endpoint without credentials, redirects, retries or fallback."""
    import time
    import urllib.error
    import urllib.parse
    import urllib.request
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == 'https' and parsed.hostname in ('raw.githubusercontent.com', 'api.github.com')
        and parsed.username is None and parsed.password is None and parsed.port is None and not parsed.fragment
        and type(maximum) is int and 0 < maximum <= MAX_BROWSER_MEMBER_BYTES,
        'Unsupported bounded public GitHub HTTP read')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, response, code, message, headers, new_url):
            raise ValueError(purpose + ' redirect refused: HTTP ' + str(code))
    headers = {'Accept': accept, 'Accept-Encoding': 'identity'}
    if parsed.hostname == 'api.github.com':
        headers['X-GitHub-Api-Version'] = '2022-11-28'
    request = urllib.request.Request(url, method='GET', headers=headers)
    opener = urllib.request.build_opener(NoRedirect())
    deadline = time.monotonic() + 60
    try:
        with opener.open(request, timeout=30) as response:
            require(response.status == 200 and response.geturl() == url,
                    purpose + ' response identity differs')
            require(response.headers.get('Content-Encoding', 'identity').lower() == 'identity',
                    'Encoded public GitHub response is prohibited')
            declared = response.headers.get('Content-Length')
            if declared is not None:
                require(re.fullmatch(r'[0-9]+', declared) is not None and 0 < int(declared) <= maximum,
                        purpose + ' declared bytes exceed their bound')
            chunks, total = [], 0
            while True:
                require(time.monotonic() < deadline, purpose + ' body timed out')
                chunk = response.read(min(65536, maximum + 1 - total))
                if not chunk:
                    break
                chunks.append(chunk); total += len(chunk)
                require(total <= maximum, purpose + ' body exceeds its byte bound')
            require(total > 0 and (declared is None or total == int(declared)),
                    purpose + ' body is empty or truncated')
            return b''.join(chunks)
    except urllib.error.HTTPError as error:
        raise ValueError(purpose + ' body refused: HTTP ' + str(error.code)) from None


def verified_raw_blob(raw_body, entry, *, commit, name, maximum, modes=('100644',)):
    """Bind actual raw bytes to their complete-tree path/mode/size and Git blob SHA-1."""
    import hashlib
    require(isinstance(entry, dict) and entry.get('path') == name and raw_path(name)
        and valid_sha(commit) and type(maximum) is int and 0 < maximum <= MAX_BROWSER_MEMBER_BYTES
        and entry.get('type') == 'blob' and entry.get('mode') in modes
        and valid_sha(entry.get('sha')) and type(entry.get('size')) is int
        and 0 < entry['size'] <= maximum, 'Public raw Git tree path/type/mode/size differs')
    raw = raw_body(commit, name, entry['size'], entry['sha'])
    require(isinstance(raw, bytes) and len(raw) == entry['size'] and len(raw) <= maximum
        and hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == entry['sha'],
        'Public immutable raw Git blob bytes differ')
    return raw


def public_browser_packet(binding, api, raw_body):
    """Read the root-authenticated immutable public packet; never fetch a private Actions ZIP."""
    transport = binding['transport']
    commit = api(f'git/commits/{transport["commit"]}')
    require(commit.get('sha') == transport['commit'] and commit.get('tree', {}).get('sha') == transport['tree'],
            'Public browser packet commit/tree differs')
    tree = api(f'git/trees/{transport["tree"]}?recursive=1')
    entries = tree.get('tree')
    require(tree.get('sha') == transport['tree'] and tree.get('truncated') is False and isinstance(entries, list)
        and len(entries) <= 100_000 and all(isinstance(item.get('path'), str) for item in entries)
        and len({item['path'] for item in entries}) == len(entries), 'Public browser packet full tree differs')
    prefix = transport['path'] + '/'
    selected_entries = {item['path'][len(prefix):]: item for item in entries if item['path'].startswith(prefix)
        and item.get('type') != 'tree'}
    require(exact(selected_entries, BROWSER_MEMBERS | BROWSER_METADATA | {'CUSTODY.json'}),
            'Public browser packet selected raw inventory differs')
    def packet_raw(name):
        return verified_raw_blob(raw_body, selected_entries[name], commit=transport['commit'],
            name=prefix + name, maximum=MAX_NATIVE_MEMBER_BYTES)
    custody_raw = packet_raw('CUSTODY.json')
    require(len(custody_raw) == transport['custodyBytes'] and sha(custody_raw) == transport['custodySha256']
        and selected_entries['CUSTODY.json']['sha'] == transport['custodyGitBlob'],
        'Public browser packet exact custody bytes differ')
    custody = captured_json(custody_raw)
    wanted = {'schema': 'successor/discovery-browser-artifact-custody/v1',
        **{key: binding[key] for key in ('repository', 'workflowPath', 'producer', 'artifact',
                                       'sourceHash', 'pageSha256', 'catalogSha256', 'members')}}
    require(exact(custody, set(wanted) | {'inventory'}) and all(custody[key] == value for key, value in wanted.items())
        and isinstance(custody['inventory'], dict) and 0 < len(custody['inventory']) <= 2048,
        'Public browser packet original artifact custody/source differs')
    inventory = custody['inventory']
    require(all(isinstance(name, str) and name and len(name) <= 512 and not name.startswith('/')
        and '\\' not in name and ':' not in name
        and all(part not in ('', '.', '..') for part in name.rstrip('/').split('/'))
        and exact(item, ('bytes', 'sha256')) and type(item['bytes']) is int
        and 0 <= item['bytes'] <= MAX_BROWSER_MEMBER_BYTES and hash64(item['sha256'])
        for name, item in inventory.items())
        and sum(item['bytes'] for item in inventory.values()) <= MAX_BROWSER_EXPANDED_BYTES
        and sha(canonical(inventory)) == binding['inventorySha256']
        and {name: inventory.get(name) for name in BROWSER_MEMBERS} == binding['members'],
        'Public browser packet complete original ZIP inventory differs')
    metadata = {name: captured_json(packet_raw('metadata/' + name + '.json'))
        for name in ('run', 'jobs', 'artifacts', 'checkout-commit', 'public-commit')}
    producer = binding['producer']
    require(all(metadata['run'].get(key) == value for key, value in {'id': producer['runId'],
        'run_attempt': producer['runAttempt'], 'workflow_id': producer['workflowId'],
        'head_sha': producer['headCommit'], 'head_branch': producer['headBranch'], 'event': 'push',
        'path': BROWSER_WORKFLOW, 'status': 'completed', 'conclusion': 'success'}.items()),
        'Public browser captured run metadata differs')
    for name in ('checkout-commit', 'public-commit'):
        record = metadata[name]
        tree_record = record.get('tree', record.get('commit', {}).get('tree', {}))
        require(record.get('sha') == producer['headCommit'] and tree_record.get('sha') == producer['checkoutTree']
            and [item.get('sha') for item in record.get('parents', [])] == producer['checkoutParents'],
            'Public browser captured source commit metadata differs')
    for name, field in (('jobs', 'jobs'), ('artifacts', 'artifacts')):
        record = metadata[name]
        require(isinstance(record.get(field), list) and type(record.get('total_count')) is int
            and record['total_count'] == len(record[field]) and 0 < len(record[field]) <= 100
            and len({item.get('id') for item in record[field]}) == len(record[field]),
            'Public browser captured metadata inventory is incomplete or duplicated')
    jobs = [item for item in metadata['jobs']['jobs'] if item.get('name') == 'capability']
    require(len(jobs) == 1 and jobs[0].get('run_id') == producer['runId']
        and jobs[0].get('head_sha') == producer['headCommit'] and jobs[0].get('status') == 'completed'
        and jobs[0].get('conclusion') == 'success', 'Public browser captured capability job differs')
    for name in ('Bind retained evidence to exact source',
        'Saved future-task protocol, docket and real-task boundary acceptance',
        'Retain exact-source screenshots and journey evidence'):
        steps = [item for item in jobs[0].get('steps', []) if item.get('name') == name]
        require(len(steps) == 1 and steps[0].get('status') == 'completed' and steps[0].get('conclusion') == 'success',
            'Public browser captured capability step differs')
    artifacts = [item for item in metadata['artifacts']['artifacts'] if item.get('id') == binding['artifact']['id']]
    require(len(artifacts) == 1 and all(artifacts[0].get(key) == binding['artifact'][field]
        for key, field in (('id', 'id'), ('name', 'name'), ('digest', 'digest'), ('size_in_bytes', 'sizeInBytes')))
        and artifacts[0].get('workflow_run', {}).get('id') == producer['runId']
        and artifacts[0].get('workflow_run', {}).get('head_sha') == producer['headCommit'],
        'Public browser captured artifact metadata differs')
    files = {name: packet_raw(name) for name in sorted(BROWSER_MEMBERS)}
    return _validate_browser_files(files, binding)


def authenticate_browser_input(binding, api, expected, *, raw_body=None):
    """Repeat public producer/source API checks and immutable authenticated packet bytes."""
    require(callable(api), 'Live public Alpha browser API is required')
    original_api, immutable, bodies = api, {}, {}
    fetch_raw, rest_reads, raw_bytes = raw_body or public_raw_body, 0, 0
    require(callable(fetch_raw), 'Immutable public raw body reader is required')
    def api(endpoint):
        nonlocal rest_reads
        require(not endpoint.startswith(('git/blobs/', 'contents/')) and not endpoint.endswith('/zip'),
                'Immutable body bytes cannot use REST blob, contents or ZIP fallbacks')
        fixed = re.fullmatch(r'git/(?:commits/[a-f0-9]{40}|trees/[a-f0-9]{40}\?recursive=1)', endpoint)
        if fixed and endpoint in immutable:
            return copy.deepcopy(immutable[endpoint])
        require(rest_reads < 12, 'Alpha public metadata REST budget exceeds twelve reads per authentication')
        rest_reads += 1
        result = original_api(endpoint)
        if fixed:
            immutable[endpoint] = copy.deepcopy(result)
        return result
    def owned_raw(commit, name, maximum, blob):
        nonlocal raw_bytes
        if blob not in bodies:
            require(len(bodies) < 300, 'Immutable raw object inventory exceeds its bound')
            value = fetch_raw(commit, name, maximum)
            require(isinstance(value, bytes) and 0 < len(value) <= maximum,
                    'Immutable public raw body exceeds its byte bound')
            raw_bytes += len(value)
            require(raw_bytes <= 64_000_000, 'Immutable public raw capture exceeds its total byte bound')
            bodies[blob] = value
        return bodies[blob]
    validate_browser_binding({key: value for key, value in binding.items() if key != 'pinSha256'})
    producer = binding['producer']
    require(producer['event'] == 'push' and producer['headBranch'] == 'main'
        and producer['headCommit'] == producer['checkoutCommit'] == expected['alphaCommit']
        and producer['checkoutTree'] == expected['alphaTree'] and binding['sourceHash'] == expected['alphaSourceHash']
        and binding['catalogSha256'] == expected['catalogSha256'], 'Alpha browser input differs from the reviewed shipping source')
    workflow = api(f'actions/workflows/{producer["workflowId"]}')
    run = api(f'actions/runs/{producer["runId"]}')
    require(workflow.get('path') == BROWSER_WORKFLOW and workflow.get('id') == producer['workflowId']
        and all(run.get(key) == value for key, value in {'id': producer['runId'], 'run_attempt': producer['runAttempt'],
            'workflow_id': producer['workflowId'], 'head_sha': producer['headCommit'], 'head_branch': producer['headBranch'],
            'event': producer['event'], 'path': BROWSER_WORKFLOW, 'status': 'completed', 'conclusion': 'success'}.items())
        and run.get('repository', {}).get('full_name') == ALPHA_REPOSITORY
        and run.get('head_repository', {}).get('full_name') == ALPHA_REPOSITORY,
        'Alpha browser producer workflow/run/source is unqualified')
    jobs = run_jobs(api, producer['runId'], producer['runAttempt'])
    capability = [job for job in jobs if job.get('name') == 'capability']
    require(len(capability) == 1 and capability[0].get('status') == 'completed'
        and capability[0].get('conclusion') == 'success' and capability[0].get('head_sha') == producer['headCommit'],
        'Alpha browser capability job did not succeed on the exact source')
    for name in ('Bind retained evidence to exact source', 'Saved future-task protocol, docket and real-task boundary acceptance',
                 'Retain exact-source screenshots and journey evidence'):
        steps = [item for item in capability[0].get('steps', []) if item.get('name') == name]
        require(len(steps) == 1 and steps[0].get('status') == 'completed' and steps[0].get('conclusion') == 'success',
                'Alpha browser producer step did not execute: ' + name)
    commit = api(f'git/commits/{producer["checkoutCommit"]}')
    require(commit.get('sha') == producer['checkoutCommit'] and commit.get('tree', {}).get('sha') == producer['checkoutTree']
        and [item.get('sha') for item in commit.get('parents', [])] == producer['checkoutParents'],
        'Alpha browser synthetic/main checkout commit tree or parents differ')
    artifact = api(f'actions/artifacts/{binding["artifact"]["id"]}')
    require(all(artifact.get(key) == binding['artifact'][field] for key, field in
        (('id', 'id'), ('name', 'name'), ('digest', 'digest'), ('size_in_bytes', 'sizeInBytes')))
        and artifact.get('expired') is False and artifact.get('workflow_run', {}).get('id') == producer['runId']
        and artifact.get('workflow_run', {}).get('head_sha') == producer['headCommit'],
        'Alpha browser artifact API identity differs')
    result = public_browser_packet(binding, api, owned_raw)
    tree = api(f'git/trees/{producer["checkoutTree"]}?recursive=1')
    entries = tree.get('tree')
    require(tree.get('sha') == producer['checkoutTree'] and tree.get('truncated') is False and isinstance(entries, list)
        and len(entries) <= 100_000 and len({item.get('path') for item in entries}) == len(entries),
        'Alpha browser checkout full tree is incomplete')
    for name, digest in {**result['catalog']['sources'],
            'docs/successor/capabilities/sources.json': binding['catalogSha256']}.items():
        matches = [item for item in entries if item.get('path') == name]
        require(len(matches) == 1, 'Alpha browser checkout source blob is absent or duplicated')
        data = verified_raw_blob(owned_raw, matches[0], commit=producer['checkoutCommit'], name=name,
            maximum=MAX_BROWSER_MEMBER_BYTES, modes=('100644', '100755'))
        if name == 'docs/successor/capabilities/sources.json':
            require(data == result['files'][BROWSER_PREFIX + 'served/sources.json'],
                    'Alpha browser served catalog differs from the exact raw Git catalog bytes')
        require(sha(data) == digest,
                'Alpha browser source input differs from exact Git blob bytes')
    result['rawTransport'] = {'restReads': rest_reads, 'immutableObjects': len(bodies), 'rawBytes': raw_bytes,
        'objects': {blob: {'bytes': len(data), 'sha256': sha(data)} for blob, data in bodies.items()}}
    return result


def verify_browser_files(root, files):
    """Validate selected saved bytes without claiming fresh hosted provenance."""
    binding = browser_pin(root)
    _validate_browser_files(files, binding)
    return binding


def capture_browser_input(root=ROOT, *, api=None, raw_body=None):
    """Producer captures the one reviewed Alpha artifact before candidate packaging."""
    expected = source_metadata(root)
    result = authenticate_browser_input(expected['browserInput'],
        api or (lambda endpoint: github_read_api(ALPHA_REPOSITORY, endpoint)), expected, raw_body=raw_body)
    return {'binding': result['binding'], 'files': result['files']}

def semantic_receipt_id(receipt):
    request = captured_json(receipt['original'])
    native_work = {key: receipt['resources']['checkerUsed'][key] for key in
                   ('acquisitions', 'search', 'checking', 'storageBytes', 'installations', 'workerCapacity')}
    return sha(canonical({'schema': 'discovery-lab-receipt-identity/v3', 'request': request,
        'receiptSchema': receipt['schema'], 'source': receipt['source'],
        'receiverAdmissionChecks': 10_000, 'nativeWork': native_work}))


def download_native_artifact(artifact, *, repository=REPOSITORY, maximum=MAX_NATIVE_ARCHIVE_BYTES):
    """Bound the binary download while streaming; never print redirected URLs."""
    require(repository == REPOSITORY and type(maximum) is int and 0 < maximum <= 450_000_000
            and type(artifact.get('id')) is int and artifact['id'] > 0
            and type(artifact.get('size_in_bytes')) is int
            and 0 < artifact['size_in_bytes'] <= maximum,
            'Native artifact download selection is malformed')
    with tempfile.TemporaryDirectory(prefix='manager-native-artifact-') as directory:
        error_path = pathlib.Path(directory) / 'download-error'
        with error_path.open('wb') as errors:
            process = subprocess.Popen(['gh', 'api', f'repos/{repository}/actions/artifacts/{artifact["id"]}/zip',
                '--method', 'GET'], stdout=subprocess.PIPE, stderr=errors)
            try:
                # communicate() is deliberately not used: bytes are bounded as they arrive.
                import selectors
                import time
                selector = selectors.DefaultSelector()
                selector.register(process.stdout, selectors.EVENT_READ)
                chunks, size, deadline = [], 0, time.monotonic() + 180
                while True:
                    require(time.monotonic() < deadline, 'Native artifact download timed out')
                    events = selector.select(min(1, max(0, deadline - time.monotonic())))
                    if not events:
                        continue
                    chunk = process.stdout.read1(65536)
                    if not chunk:
                        break
                    size += len(chunk)
                    require(size <= artifact['size_in_bytes'] and size <= maximum,
                            'Native artifact download exceeds its authenticated byte bound')
                    chunks.append(chunk)
                require(process.wait(timeout=10) == 0, 'Native artifact download failed (response withheld)')
                require(size == artifact['size_in_bytes'], 'Native artifact download size differs')
                return b''.join(chunks)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=10)
                if process.stdout is not None:
                    process.stdout.close()
                if 'selector' in locals():
                    selector.close()


def validate_native_archive(raw, artifact, *, config, expected, node, run, evidence_sha256):
    """Authenticate downloaded ZIP bytes, then reconcile every retained native result."""
    require(isinstance(raw, bytes) and 0 < len(raw) <= MAX_NATIVE_ARCHIVE_BYTES
            and len(raw) == artifact['size_in_bytes']
            and artifact['digest'] == 'sha256:' + sha(raw), 'Downloaded native artifact bytes/digest differ')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) == len(NATIVE_MEMBERS) and {item.filename for item in entries} == NATIVE_MEMBERS,
                'Native artifact inventory is missing, duplicated or unexpected')
        require(sum(item.file_size for item in entries) <= MAX_NATIVE_EXPANDED_BYTES,
                'Native artifact expansion exceeds its bound')
        for item in entries:
            require(not item.is_dir() and stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG)
                    and not item.flag_bits & 1 and 0 < item.file_size <= MAX_NATIVE_MEMBER_BYTES,
                    'Native artifact member is nonregular, encrypted or oversized')
        # Reading each complete member verifies its ZIP CRC before parsing it.
        files = {item.filename: archive.read(item) for item in entries}
    result = validate_native_files(files, config=config, expected=expected, node=node,
        run=run, evidence_sha256=evidence_sha256)
    return {'archiveSha256': sha(raw), 'archiveBytes': len(raw), **result}


def validate_native_files(files, *, config, expected, node, run, evidence_sha256):
    """Reconcile retained bytes; this pure offline check makes no live provenance claim."""
    require(exact(files, NATIVE_MEMBERS) and all(isinstance(raw, bytes)
            and 0 < len(raw) <= MAX_NATIVE_MEMBER_BYTES for raw in files.values())
            and sum(map(len, files.values())) <= MAX_NATIVE_EXPANDED_BYTES,
            'Native retained file map exceeds its exact inventory or byte bounds')
    hashes = {name: {'bytes': len(value), 'sha256': sha(value)} for name, value in files.items()}
    require(sha(files['native-evidence.json']) == evidence_sha256,
            'Downloaded native evidence does not match the executed log commitment')
    custody = captured_json(files['custody.json'])
    wanted = {'schema': 'manager/discovery-saved-native-custody/v1',
        'sourceCommit': config['sourceCommit'], 'sourceTree': config['sourceTree'],
        'profile': DISCOVERY_PROFILE, 'node': node, 'runId': run['id'], 'runAttempt': run['attempt'],
        'candidateArtifactId': config['candidateArtifact']['id'],
        'candidateArtifactDigest': config['candidateArtifact']['digest'],
        'candidateArchiveSha256': config['artifactDigests'][ARCHIVE_NAME],
        'browserInput': expected['browserInput'],
        'files': {name: item for name, item in hashes.items() if name != 'custody.json'}}
    require(canonical(custody) == canonical(wanted),
            'Downloaded native custody source/run/candidate/file binding differs')
    primary = _validate_mission_files({name: files[name] for name in MISSION_MEMBERS},
        config=config, expected=expected, node=node, regression=False)
    regression = _validate_mission_files({name: files['regression/' + name] for name in MISSION_MEMBERS},
        config=config, expected=expected, node=node, regression=True)
    require(primary['missionId'] != regression['missionId']
        and primary.get('regression') == {'scope': 'constructed-independent-mission',
            'nativeEvidenceSha256': hashes['regression/native-evidence.json']['sha256'],
            'missionId': regression['missionId'], 'campaignDigest': regression['campaignDigest'],
            'receiptId': regression['receiptId'], 'validReceiptCount': 8, 'invalidQualificationCount': 1},
        'Native original and constructed regression missions are conflated or unbound')
    return {'memberCount': len(files), 'rawFiles': {name: raw.decode('utf8') for name, raw in files.items()},
        'custodySha256': hashes['custody.json']['sha256'], 'files': hashes,
        'candidateArtifactId': wanted['candidateArtifactId'], 'candidateArtifactDigest': wanted['candidateArtifactDigest'],
        'candidateArchiveSha256': wanted['candidateArchiveSha256'], 'runId': run['id'], 'runAttempt': run['attempt'],
        'missionId': primary['missionId'], 'campaignDigest': primary['campaignDigest'], 'receiptId': primary['receiptId']}


def _validate_mission_files(files, *, config, expected, node, regression):
    """Reconcile one independent mission's receipt, preserved history, docket and actual costs."""
    hashes = {name: {'bytes': len(raw), 'sha256': sha(raw)} for name, raw in files.items()}
    evidence = captured_json(files['native-evidence.json'])
    evidence_bindings = {'sourceCommit': config['sourceCommit'], 'sourceTree': config['sourceTree'],
        'alphaCommit': expected['alphaCommit'], 'alphaTree': expected['alphaTree'],
        'sourceHash': expected['alphaSourceHash'], 'node': node,
        'candidateArchiveSha256': config['artifactDigests'][ARCHIVE_NAME], 'authority': 'none',
        'externalExecution': 'unprovisioned', 'currencyCapBaseUnits': '0'}
    require(isinstance(evidence, dict) and evidence.get('schema') == 'successor/discovery-release-native-evidence/v1'
            and all(evidence.get(key) == value for key, value in evidence_bindings.items()),
            'Downloaded native evidence source/runtime/authority differs')
    if regression:
        require(evidence.get('inputWorkspace') == 'constructed-independent-regression'
            and 'browserInput' not in evidence, 'Regression mission is not explicitly independent of the original UI mission')
    else:
        browser = expected['browserInput']
        require(evidence.get('inputWorkspace') == 'authenticated-original-browser-workspace'
            and evidence.get('browserInput') == browser and evidence.get('primaryCase') == 'original-browser-usdc'
            and hashes['workspace-before.json']['sha256'] == browser['workspaceSha256']
            and hashes['original-request.json']['sha256'] == browser['requestSha256']
            and evidence.get('missionId') == browser['missionId'] and evidence.get('campaignDigest') == browser['campaignDigest']
            and 'outcomes' not in evidence and 'qualificationRefusals' not in evidence,
            'Native evidence does not consume only the authenticated original browser workspace/request')
    operator = evidence.get('installedOperator')
    require(exact(operator, ('path', 'sha256', 'docketSha256', 'reopenedDocketSha256', 'sourceCustody'))
            and operator['path'] == MANAGER_FILES[3]
            and operator['sha256'] == expected['managerFiles'][MANAGER_FILES[3]]
            and hash64(operator['docketSha256']) and operator['docketSha256'] == operator['reopenedDocketSha256']
            and isinstance(operator['sourceCustody'], dict)
            and (regression or operator['docketSha256'] == hashes['docket.json']['sha256']),
            'Actual installed operator source and original docket reopen are unqualified')
    require(canonical(evidence.get('sameHistory')) == canonical({'prefixPreserved': True, 'appendedEvents': 1,
        'duplicateRefused': True, 'refusalPreserved': True, 'reopenByteIdentical': True, 'docketSections': 13}),
        'Installed native same-history acceptance is incomplete')
    for field, name in {'requestSha256': 'original-request.json', 'receiptSha256': 'raw-receipt.json',
        'workspaceBeforeSha256': 'workspace-before.json', 'workspaceAfterSha256': 'workspace-after.json',
        'docketSha256': 'docket.json', 'reopenedDocketSha256': 'docket-reopened.json'}.items():
        require(evidence.get(field) == hashes[name]['sha256'], 'Native retained file digest differs: ' + field)
    require(files['docket.json'] == files['docket-reopened.json'], 'Installed docket reopen bytes differ')
    request = captured_json(files['original-request.json'])
    receipt = captured_json(files['raw-receipt.json'])
    wrapper = captured_json(files['receipt-wrapper.json'])
    before, after = (captured_json(files[name]) for name in ('workspace-before.json', 'workspace-after.json'))
    require(canonical(evidence.get('retainedWorkspace')) == canonical(after)
            and evidence.get('workspaceDigest') == sha(canonical(after)),
            'Downloaded native result does not retain the exact post-return workspace')
    require(isinstance(request, dict) and request.get('commission', {}).get('route') == 'manager-usdc'
            and request['commission'].get('currency') == 'USDC6' and request['commission'].get('capBaseUnits') == '0',
            'Native retained request changes the commission route or zero cap')
    require(isinstance(receipt, dict) and exact(receipt.get('resources', {}).get('totalUsed'), RESOURCE_KEYS)
            and all(type(value) is int and 0 <= value <= 9007199254740991
                for value in receipt['resources']['totalUsed'].values())
            and receipt.get('original') == files['original-request.json'].decode('utf8')
            and receipt.get('requestSha256') == hashes['original-request.json']['sha256']
            and receipt.get('commission') == request['commission']
            and receipt.get('state') == 'local-checked' and receipt.get('authority') == 'none'
            and receipt.get('lifecycle') == {'commission': 'DRAFT_NOT_SUBMITTED', 'reservedBaseUnits': '0',
                'execution': 'unprovisioned', 'review': 'separate-review-required', 'settlement': 'not-connected'},
            'Downloaded raw native receipt/request/status differs')
    source = {'repository': REPOSITORY, 'commit': config['sourceCommit'], 'tree': config['sourceTree'],
        'adapterSha256': expected['managerFiles'][MANAGER_FILES[0]],
        'contractSha256': expected['managerFiles'][MANAGER_FILES[1]]}
    require(wrapper == {'raw': files['raw-receipt.json'].decode('utf8'), 'source': source}
            and receipt.get('source') == {key: source[key] for key in ('adapterSha256', 'contractSha256')},
            'Downloaded wrapper source or exact raw receipt bytes differ')
    require(isinstance(before, dict) and isinstance(after, dict) and before.get('missionId') == after.get('missionId')
            == request.get('missionId') == evidence.get('missionId')
            and before.get('authority') == after.get('authority') == []
            and before.get('paymentRoute') == after.get('paymentRoute') == 'none',
            'Downloaded return changes mission or authority')
    prior, events = before.get('events'), after.get('events')
    require(isinstance(prior, list) and 0 < len(prior) < 24 and isinstance(events, list)
            and len(events) == len(prior) + 1 and canonical(events[:-1]) == canonical(prior)
            and type(before.get('revision')) is int and before['revision'] == len(prior) - 1
            and type(after.get('revision')) is int and after['revision'] == len(events) - 1,
            'Downloaded return drops original history or adds unexpected events')
    event = events[-1]
    payload = event.get('payload', {})
    require(event.get('kind') == 'lab-evidence-attached' and type(event.get('sequence')) is int
            and event['sequence'] == len(prior)
            and event.get('previous') == prior[-1].get('digest')
            and payload.get('kind') == 'receiver-receipt' and payload.get('record') == wrapper
            and payload.get('campaignDigest') == evidence.get('campaignDigest')
            and payload.get('recordDigest') == sha(canonical(wrapper)),
            'Downloaded appended receipt event framing differs')
    event_value = {'missionId': after['missionId'], 'sequence': event['sequence'], 'kind': event['kind'],
        'previous': event['previous'], 'payload': payload}
    require(event.get('digest') == sha(b'successor-omega/v1:capability-event\0' + canonical(event_value)),
            'Downloaded appended receipt event digest differs')
    receipt_id = semantic_receipt_id(receipt)
    require(evidence.get('receiptId') == receipt_id, 'Downloaded semantic native receipt identity differs')
    docket = captured_json(files['docket.json'])
    require(exact(docket, ('schema', 'format', 'files', 'checksums'))
            and docket['schema'] == 'successor-discovery-evidence-docket/v1'
            and docket['format'] == 'bounded-canonical-file-map'
            and exact(docket['files'], DOCKET_PATHS) and exact(docket['checksums'], DOCKET_PATHS),
            'Downloaded docket omits an original section')
    for name in DOCKET_PATHS:
        require(isinstance(docket['files'][name], str)
                and sha(docket['files'][name].encode()) == docket['checksums'][name],
                'Downloaded docket section checksum differs')
    run_record = captured_json(docket['files']['05_agialpha_runs/run.json'])
    require(canonical(run_record.get('workspace')) == canonical(after),
            'Downloaded docket is for a different retained workspace')
    attachments = run_record.get('attachments', {})
    if regression:
        outcomes = evidence.get('outcomes')
        cases = ['accepted-' + stage for stage in ('learn', 'think', 'design', 'strategise', 'execute', 'evolve')]
        cases += ['missing-inspection-reserve', 'rehashed-invalid-measurement', 'stronger-successor']
        require(isinstance(outcomes, list) and len(outcomes) == len(cases)
                and [item.get('case') for item in outcomes] == cases,
                'Downloaded native evidence drops an original stage or negative/successor case')
        require(evidence.get('primaryCase') in ('accepted-evolve', 'stronger-successor')
                and next(item['receipt'] for item in outcomes if item['case'] == evidence['primaryCase']) == receipt,
                'Primary actual UI receipt differs from its retained native outcome')
        refusals = evidence.get('qualificationRefusals')
        require(isinstance(refusals, list) and len(refusals) == 1 and exact(refusals[0],
                ('case', 'rawReceipt', 'resourceUsed', 'admittedToMission', 'totalComplete', 'authority', 'scope')),
                'Downloaded qualification refusals are missing or ambiguous')
        refusal = refusals[0]
        negative = outcomes[cases.index('rehashed-invalid-measurement')]['receipt']
        require(isinstance(refusal['rawReceipt'], str) and captured_json(refusal['rawReceipt']) == negative
                and canonical({key: value for key, value in refusal.items() if key != 'rawReceipt'}) == canonical({
                    'case': 'rehashed-invalid-measurement', 'resourceUsed': negative['resources']['totalUsed'],
                    'admittedToMission': False, 'totalComplete': False, 'authority': 'none',
                    'scope': 'Negative qualification-test observation outside the admitted mission receipt ledger.'}),
                'Downloaded rejected qualification observation loses its raw receipt/costs or changes authority')
        combined = [item['payload']['record'] for item in events if item.get('kind') == 'lab-evidence-attached'
                    and item.get('payload', {}).get('kind') == 'receiver-receipt']
        attachments = run_record.get('attachments', {})
        require(isinstance(attachments.get('receipts'), list), 'Downloaded docket raw receipt attachments are absent')
        combined += attachments['receipts']
        admitted_observations = []
        for outcome in outcomes:
            observed = outcome.get('receipt')
            require(isinstance(observed, dict) and exact(observed.get('resources', {}).get('totalUsed'), RESOURCE_KEYS)
                    and all(type(value) is int and 0 <= value <= 9007199254740991
                        for value in observed['resources']['totalUsed'].values()),
                    'Downloaded native outcome omits a declared resource observation')
            observed_request = captured_json(observed.get('original', '{}'))
            require(observed_request.get('missionId') == before['missionId']
                and observed.get('requestSha256') == sha(observed['original'].encode())
                and observed.get('source') == receipt['source'] and observed.get('authority') == 'none'
                and observed.get('commission', {}).get('route') == 'manager-usdc'
                and observed['commission'].get('currency') == 'USDC6' and observed['commission'].get('capBaseUnits') == '0',
                'Regression observation changes mission/source/authority or denomination')
            retained = [item for item in combined if exact(item, ('raw', 'source')) and item['source'] == source
                        and captured_json(item['raw']) == observed]
            require(len(retained) == (0 if outcome['case'] == 'rehashed-invalid-measurement' else 1),
                    'Downloaded docket omits or duplicates admitted work, or imports an invalid qualification payload')
            state = observed.get('state')
            require((state == 'local-checked' if outcome['case'].startswith('accepted-')
                        or outcome['case'] == 'stronger-successor'
                    else state == 'inconclusive' if outcome['case'] == 'missing-inspection-reserve'
                    else state != 'local-checked'), 'Downloaded native outcome status differs')
            if outcome['case'] != 'rehashed-invalid-measurement':
                admitted_observations.append({'receiptId': semantic_receipt_id(observed),
                    'receiptDigest': sha(retained[0]['raw'].encode()), 'commission': observed['commission'],
                    'resources': observed['resources']['totalUsed']})
    else:
        require(attachments.get('receipts') == [] and exact(evidence.get('primaryObservation'),
            ('receiptId', 'receiptSha256', 'resourceUsed', 'totalComplete', 'authority'))
            and evidence['primaryObservation'] == {'receiptId': receipt_id,
                'receiptSha256': hashes['raw-receipt.json']['sha256'], 'resourceUsed': receipt['resources']['totalUsed'],
                'totalComplete': False, 'authority': 'none'},
            'Original UI mission docket imports regression observations or loses its sole actual cost')
        admitted_observations = [{'receiptId': receipt_id, 'receiptDigest': hashes['raw-receipt.json']['sha256'],
            'commission': receipt['commission'], 'resources': receipt['resources']['totalUsed']}]
    proof = captured_json(docket['files']['06_proof_bundles/capability.json'])
    matches = [item for item in proof.get('receiverReceipts', []) if item.get('receiptId') == receipt_id]
    require(len(matches) == 1 and matches[0].get('receiptDigest') == hashes['raw-receipt.json']['sha256']
            and matches[0].get('commission') == request['commission'],
            'Downloaded docket omits or duplicates the exact returned receipt')
    for observed in admitted_observations:
        matches = [item for item in proof['receiverReceipts'] if item.get('receiptId') == observed['receiptId']]
        require(len(matches) == 1 and matches[0].get('inspectionKind') != 'fleet-local-review'
                and all(canonical(matches[0].get(key)) == canonical(value)
                for key, value in observed.items()),
                'Downloaded docket changes actual native receipt identity or declared resource observations')
    require(len([item for item in proof['receiverReceipts']
        if item.get('commission', {}).get('route') == 'manager-usdc' and item.get('inspectionKind') != 'fleet-local-review'])
        == len(admitted_observations), 'Docket aggregates unobserved work from another mission')
    costs = captured_json(docket['files']['08_cost_ledgers/costs.json'])
    require(costs.get('totalComplete') is False and costs.get('currenciesCombined') is False
            and exact(costs.get('receiverInspectionByRoute', {}).get('manager-usdc'), RESOURCE_KEYS),
            'Downloaded docket changes cost/denomination boundaries')
    route_total = costs['receiverInspectionByRoute']['manager-usdc']
    route_receipts = [item for item in proof['receiverReceipts']
        if item.get('commission', {}).get('route') == 'manager-usdc' and item.get('inspectionKind') != 'fleet-local-review']
    require(len({item.get('receiptId') for item in proof['receiverReceipts']}) == len(proof['receiverReceipts']),
            'Downloaded docket repeats a semantic receipt cost')
    for key, amount in route_total.items():
        values = [item.get('resources', {}).get(key) for item in route_receipts]
        require(type(amount) is int and amount >= 0
                and values and all(type(value) is int and value >= 0 for value in values)
                and amount == (max(values) if key in ('memoryBytes', 'workerCapacity') else sum(values)),
                'Downloaded docket receiver costs differ from retained receipt observations')
    return evidence


def source_metadata(root=ROOT):
    root = pathlib.Path(root)
    file = root / PIN
    require(file.is_file() and not file.is_symlink() and file.stat().st_size < 100_000,
            'Discovery installed source pin is missing or unbounded')
    raw = file.read_bytes()
    pin = strict_json(raw)
    require(isinstance(pin, dict) and set(pin) == {'schema', 'repository', 'commit', 'tree',
            'sourceHash', 'catalogPath', 'catalogSha256', 'files', 'qualification'},
            'Discovery installed source fields differ')
    require(pin['schema'] == 'successor/discovery-lab-alpha-source/v1'
            and pin['repository'] == 'MontrealAI/AGI-Alpha-Agent-v0'
            and valid_sha(pin['commit']) and valid_sha(pin['tree'])
            and pin['catalogPath'] == 'docs/successor/capabilities/sources.json'
            and pin['qualification'] == 'PENDING_FINAL_SOURCE_NATIVE_COMPATIBILITY',
            'Discovery source identity or self-qualification differs')
    hashes = [pin['sourceHash'], pin['catalogSha256'], *pin['files'].values()] if isinstance(pin['files'], dict) else []
    require(2 < len(hashes) <= 258 and all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value)
            for value in hashes), 'Discovery native source hashes differ')
    return {'schema': SCHEMA, 'profile': DISCOVERY_PROFILE,
            'alphaRepository': pin['repository'], 'alphaCommit': pin['commit'], 'alphaTree': pin['tree'],
            'alphaSourceHash': pin['sourceHash'], 'catalogSha256': pin['catalogSha256'],
            'sourcePinSha256': sha(raw), 'sourceFiles': len(pin['files']) + 1,
            'browserInput': browser_pin(root),
            'managerFiles': {name: sha((root / name).read_bytes()) for name in MANAGER_FILES},
            'nodes': list(NODES), 'authority': 'none',
            'scope': 'Exact installed synthetic source and receiver qualification; external execution, money and settlement remain unprovisioned.'}


def marker(text, name):
    values = re.findall(r'^(?:\d{4}-\d{2}-\d{2}T\S+[ \t]+)?' + re.escape(name)
                        + r'=([^\r\n]*?)[ \t]*\r?$', text, re.MULTILINE)
    require(len(values) == 1, 'Missing or duplicated Discovery native marker: ' + name)
    return values[0]


def validate(config, api, logs, download, *, alpha_api=None):
    expected = source_metadata()
    require(config.get('sourcePolicy', {}).get('releaseProfile') == DISCOVERY_PROFILE,
            'Discovery requires its explicit release source policy')
    require(callable(download) and isinstance(config.get('candidateArtifact'), dict)
            and type(config['candidateArtifact'].get('id')) is int and config['candidateArtifact']['id'] > 0
            and re.fullmatch('sha256:[0-9a-f]{64}', config['candidateArtifact'].get('digest', ''))
            and hash64(config.get('artifactDigests', {}).get(ARCHIVE_NAME)),
            'Discovery requires authenticated saved-candidate bytes and native downloads')
    authenticate_browser_input(expected['browserInput'], alpha_api, expected)
    responses, retained = {}, {}
    def observed_api(endpoint):
        if endpoint not in responses:
            responses[endpoint] = copy.deepcopy(api(endpoint))
        return copy.deepcopy(responses[endpoint])
    def observed_logs(job):
        if job not in retained:
            retained[job] = logs(job)
        return retained[job]
    validate_qualification(config, observed_api, observed_logs, publication=True)
    native = runpy.run_path(str(ROOT / 'scripts/release/transformational-qualification.py'))
    require(config.get('transformationQualification') == native['validate'](config, observed_api, observed_logs),
            'Discovery retains every inherited native transformation gate')
    prep = config['requiredSourceRuns']['current-state-release.yml']
    jobs = [job for job in run_jobs(observed_api, prep['id'], prep['attempt']) if job['name'] == 'qualify']
    require(len(jobs) == 1, 'Discovery preparation job is missing or duplicated')
    for name in PREP_STEPS:
        steps = [step for step in jobs[0]['steps'] if step['name'] == name]
        require(len(steps) == 1 and steps[0]['status'] == 'completed' and steps[0]['conclusion'] == 'success',
                'Inherited source/audit/TI gate did not execute: ' + name)
    item = config['requiredSourceRuns'][DISCOVERY_WORKFLOW]
    jobs = run_jobs(observed_api, item['id'], item['attempt'])
    require(sorted(job['name'] for job in jobs) == sorted(DISCOVERY_JOBS), 'Discovery native matrix differs')
    artifacts = []
    for page in range(1, 11):
        batch = observed_api(f'actions/runs/{item["id"]}/artifacts?per_page=100&page={page}')['artifacts']
        artifacts.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise ValueError('Discovery evidence artifact inventory is unbounded')
    evidence = []
    for node, name in zip(NODES, DISCOVERY_JOBS):
        job = next(job for job in jobs if job['name'] == name)
        text = observed_logs(job['id'])
        wanted = {'DISCOVERY_NATIVE_ALPHA_COMMIT': expected['alphaCommit'],
                  'DISCOVERY_NATIVE_ALPHA_TREE': expected['alphaTree'],
                  'DISCOVERY_NATIVE_SOURCE_HASH': expected['alphaSourceHash'],
                  'DISCOVERY_NATIVE_NODE': node,
                  'DISCOVERY_NATIVE_ADAPTER_SHA256': expected['managerFiles'][MANAGER_FILES[0]],
                  'DISCOVERY_NATIVE_CONTRACT_SHA256': expected['managerFiles'][MANAGER_FILES[1]],
                  'DISCOVERY_NATIVE_RUNNER_SHA256': expected['managerFiles'][MANAGER_FILES[2]]}
        for key, value in wanted.items():
            require(marker(text, key) == value, 'Stale or substituted Discovery native marker: ' + key)
        digest = marker(text, 'DISCOVERY_NATIVE_EVIDENCE_SHA256')
        require(re.fullmatch('[0-9a-f]{64}', digest), 'Discovery evidence digest differs')
        artifact_name = f'discovery-lab-policy-{node[1:]}-{config["sourceCommit"]}-{item["id"]}-{item["attempt"]}'
        matches = [artifact for artifact in artifacts if artifact.get('name') == artifact_name]
        require(len(matches) == 1, 'Discovery native evidence artifact is missing or duplicated')
        artifact = matches[0]
        require(type(artifact.get('id')) is int and artifact['id'] > 0
                and artifact.get('expired') is False
                and type(artifact.get('size_in_bytes')) is int and 0 < artifact['size_in_bytes'] < 50_000_000
                and isinstance(artifact.get('digest'), str) and re.fullmatch('sha256:[0-9a-f]{64}', artifact['digest'])
                and artifact.get('workflow_run', {}).get('id') == item['id']
                and artifact.get('workflow_run', {}).get('head_sha') == config['sourceCommit'],
                'Discovery native evidence artifact source/digest differs')
        downloaded = validate_native_archive(download(copy.deepcopy(artifact)), artifact, config=config,
            expected=expected, node=node, run=item, evidence_sha256=digest)
        evidence.append({'node': node, 'jobId': job['id'], 'evidenceSha256': digest,
                         'artifactId': artifact['id'], 'artifactDigest': artifact['digest'],
                         'artifactBytes': artifact['size_in_bytes'], 'downloadedCustody': downloaded})
    require(len({item['artifactId'] for item in evidence}) == len(NODES),
            'Discovery runtimes require distinct immutable evidence artifacts')
    require(len({item['downloadedCustody']['candidateArchiveSha256'] for item in evidence}) == 1,
            'Discovery runtimes did not consume one identical saved archive')
    result = {**expected, 'nativeEvidence': evidence}
    require(len(canonical(result)) <= MAX_QUALIFICATION_BYTES, 'Retained native qualification exceeds its encoded byte bound')
    return result


def verify_record(config):
    """Offline metadata comparison; no live source or hosted execution claim."""
    require(isinstance(config, dict)
            and config.get('sourcePolicy', {}).get('releaseProfile') == DISCOVERY_PROFILE,
            'Discovery requires its explicit release source policy')
    expected = source_metadata()
    record = config.get('discoveryQualification') if isinstance(config, dict) else None
    require(isinstance(record, dict) and set(record) == set(expected) | {'nativeEvidence'}
            and all(record[key] == value for key, value in expected.items()),
            'Discovery qualification source record differs')
    evidence = record['nativeEvidence']
    require(isinstance(evidence, list) and len(evidence) == len(NODES), 'Discovery native evidence is incomplete')
    seen, artifacts = set(), set()
    for node, item in zip(NODES, evidence):
        require(isinstance(item, dict) and set(item) == {'node', 'jobId', 'evidenceSha256',
                'artifactId', 'artifactDigest', 'artifactBytes', 'downloadedCustody'}
                and item['node'] == node and type(item['jobId']) is int and item['jobId'] > 0
                and item['jobId'] not in seen and isinstance(item['evidenceSha256'], str)
                and re.fullmatch('[0-9a-f]{64}', item['evidenceSha256'])
                and type(item['artifactId']) is int and item['artifactId'] > 0
                and item['artifactId'] not in artifacts
                and type(item['artifactBytes']) is int and 0 < item['artifactBytes'] < 50_000_000
                and isinstance(item['artifactDigest'], str) and re.fullmatch('sha256:[0-9a-f]{64}', item['artifactDigest']),
                'Discovery native evidence identity differs')
        custody = item['downloadedCustody']
        require(exact(custody, ('archiveSha256', 'archiveBytes', 'memberCount', 'custodySha256', 'files',
                'candidateArtifactId', 'candidateArtifactDigest', 'candidateArchiveSha256', 'runId', 'runAttempt',
                'missionId', 'campaignDigest', 'receiptId', 'rawFiles'))
                and item['artifactDigest'] == 'sha256:' + custody['archiveSha256']
                and item['artifactBytes'] == custody['archiveBytes'] and custody['memberCount'] == len(NATIVE_MEMBERS)
                and exact(custody['files'], NATIVE_MEMBERS)
                and custody['candidateArtifactId'] == config.get('candidateArtifact', {}).get('id')
                and custody['candidateArtifactDigest'] == config.get('candidateArtifact', {}).get('digest')
                and custody['candidateArchiveSha256'] == config.get('artifactDigests', {}).get(ARCHIVE_NAME)
                and custody['runId'] == config['requiredSourceRuns'][DISCOVERY_WORKFLOW]['id']
                and custody['runAttempt'] == config['requiredSourceRuns'][DISCOVERY_WORKFLOW]['attempt']
                and isinstance(custody['missionId'], str) and custody['missionId'].startswith('capability-')
                and hash64(custody['campaignDigest']) and hash64(custody['receiptId'])
                and hash64(custody['custodySha256']), 'Offline native downloaded custody identity differs')
        for name, details in custody['files'].items():
            require(exact(details, ('bytes', 'sha256')) and type(details['bytes']) is int
                    and 0 < details['bytes'] <= MAX_NATIVE_MEMBER_BYTES and hash64(details['sha256']),
                    'Offline native member identity differs')
        require(custody['files']['custody.json']['sha256'] == custody['custodySha256']
                and custody['files']['native-evidence.json']['sha256'] == item['evidenceSha256']
                and custody['files']['docket.json'] == custody['files']['docket-reopened.json'],
                'Offline native retained file commitments differ')
        require(exact(custody['rawFiles'], NATIVE_MEMBERS)
                and all(isinstance(raw, str) for raw in custody['rawFiles'].values()),
                'Offline native raw file map is absent or malformed')
        raw_files = {name: raw.encode('utf8') for name, raw in custody['rawFiles'].items()}
        observed = validate_native_files(raw_files, config=config, expected=expected, node=node,
            run=config['requiredSourceRuns'][DISCOVERY_WORKFLOW], evidence_sha256=item['evidenceSha256'])
        require(canonical(observed) == canonical({key: value for key, value in custody.items()
            if key not in ('archiveSha256', 'archiveBytes')}),
            'Offline native retained raw bytes differ from their custody record')
        seen.add(item['jobId'])
        artifacts.add(item['artifactId'])
    require(len(canonical(config)) <= MAX_QUALIFICATION_BYTES, 'Offline qualification exceeds its encoded byte bound')
    return record
