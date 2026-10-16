#!/usr/bin/env python3
"""Sequential, offline exact-c2 native campaigns; never operational acceptance.

Raw runner reports are immutable. Only their checked explicit evidence inventory,
report.json and SHA256SUMS may enter shareable/. Launcher logs remain local.
The command requires an externally reviewed pin digest and harness commit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import stat
import subprocess
import sys
import time

sys.dont_write_bytecode = True
TARGET = 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699'
TREE = '8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f'
PARENTS = ['3c974ad3cb1d828e5c89464fd8424d8ae853d9dd', 'eb6f725e0b40ac81e50a374304e54a5ff6859fcf']
LEGACY = '6484d09afbba64d7de24cd18ae4dbd246caffd17'
LEGACY_TREE = 'fb8d1443f705731cfa5dfc89b065b4ca1bcf2ab0'
TARGET_SHA = 'd56bcfd0a47c83f220a81ebd4de3b3e18b5c4952ecc10024a889b1e64f99999a'
BINDING_SHA = 'dd3c4500be119cd8802d24486ad4ea3073fb1fe7e7e1977bcd6762a6ab76fa2a'
PROFILE = 'manager-explicit-governor-v1'
HEX64 = re.compile(r'^[0-9a-f]{64}$')
HEX40 = re.compile(r'^[0-9a-f]{40}$')
TXHASH = re.compile(r'^0x[0-9a-fA-F]{64}$')
ADDRESS = re.compile(r'^0x[0-9a-fA-F]{40}$')
REPORT_SCHEMA = 'manager-native-core-session-qualification-v1'
CORE_ERROR = 'MANAGER_CORE_COMMAND_FAILED: Stop and preserve private inputs and the session. Inspect or recover before any retry; no activation was authorized.'
EXPORT_ERROR = 'MANAGER_VERIFICATION_EXPORT_FAILED: Stop and preserve private inputs and any incomplete export. No explorer acceptance or activation was established.'
COMMAND_FIELDS = ('label', 'exitCode', 'expectedFailure', 'failureAfterSubmission', 'privateMaterialExcluded', 'failureBoundary', 'boundary', 'relayHttpSubmissions', 'scriptSha256', 'stderr')
CASE_FIELDS = ('name', 'commands', 'receipts', 'state', 'configurationTransactions', 'activationTransactions')
BASE_PINS = {'scripts/qualification/run-native-campaigns.py', 'scripts/qualification/select-source-profile.py', 'config/expected-campaigns.json', 'config/reviewed-c2-target.json', 'config/c2-source-review-binding.json', 'scripts/qualification/test-run-native-campaigns.py'}
SCOPE = 'FINITE_DISPOSABLE_LOCAL_NATIVE_FUNCTIONAL_CAMPAIGNS_ONLY'


class CampaignError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise CampaignError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(data):
    def pairs(items):
        out = {}
        for key, value in items:
            require(key not in out, 'Duplicate JSON member')
            out[key] = value
        return out
    def invalid(_):
        raise CampaignError('Non-finite JSON number')
    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid)


def exact_path(value, directory=False):
    path = Path(value)
    require(path.is_absolute() and path == path.resolve(), 'Noncanonical or symlink path')
    mode = path.lstat().st_mode
    require(stat.S_ISDIR(mode) if directory else stat.S_ISREG(mode), 'Wrong path type')
    return path


def relative_path(name, share=False):
    require(isinstance(name, str) and 0 < len(name) < 4096, 'Invalid relative filename')
    path = PurePosixPath(name)
    require(not path.is_absolute() and str(path) == name and '\\' not in name and
            all(part not in ('.', '..', '.git') for part in path.parts) and
            not any(ord(c) < 32 or ord(c) == 127 for c in name), 'Unsafe relative filename')
    if share:
        require(not any(part.lower() in ('private', 'signed', 'source-probes') for part in path.parts), 'Private directory in evidence allowlist')
        require(path.suffix.lower() not in ('.pem', '.key', '.p12', '.pfx', '.keystore') and
                path.name.lower() not in ('.env', 'id_rsa', 'id_ed25519'), 'Private file in evidence allowlist')
    return path


def read_regular(root, name, share=False):
    rel = relative_path(name, share)
    path = root / rel
    require(path == path.resolve(), 'Symlink in evidence or pinned path')
    # O_NOFOLLOW plus fstat protects the final component, and identity is rechecked
    # before and after reading. No launched process remains during publication.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'Non-regular or hard-linked file')
        chunks = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        data = b''.join(chunks)
        after = os.fstat(fd)
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'File changed during observation')
        current = path.lstat()
        require((after.st_dev, after.st_ino) == (current.st_dev, current.st_ino) and path == path.resolve(), 'File alias changed during observation')
        return data
    finally:
        os.close(fd)


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not isinstance(data, bytes):
        data = (json.dumps(data, indent=2, sort_keys=True) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())


def child_environment(node, home):
    # Deliberately do not inherit PATH, HOME, proxies, provider URLs, CA overrides,
    # secrets, Node loaders/options, coverage flags, or GIT_* from the caller.
    return {'PATH': str(node.parent) + ':/usr/local/bin:/usr/bin:/bin', 'HOME': str(home),
            'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC', 'CI': 'true',
            'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONNOUSERSITE': '1',
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_SYSTEM': '/dev/null',
            'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_REPLACE_OBJECTS': '1',
            'GIT_TERMINAL_PROMPT': '0', 'GIT_NO_LAZY_FETCH': '1',
            'GIT_ALLOW_PROTOCOL': '', 'GIT_OPTIONAL_LOCKS': '0'}


def git(root, env, *args):
    result = subprocess.run(['git', '--no-replace-objects', '-c', 'protocol.allow=never',
        '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
        '-c', 'core.attributesFile=/dev/null', *args], cwd=root, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, check=False)
    require(result.returncode == 0, 'Offline Git observation failed: ' + ' '.join(args[:2]))
    return result.stdout


def observe_git(root, env, commit, tree=None, parents=None, clean=True):
    require(HEX40.fullmatch(commit) is not None, 'Invalid commit identity')
    require(git(root, env, 'rev-parse', '--show-toplevel').decode().strip() == str(root), 'Git root mismatch')
    require(git(root, env, 'rev-parse', 'HEAD').decode().strip() == commit, 'Actual HEAD mismatch')
    raw = git(root, env, 'cat-file', 'commit', commit)
    require(hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == commit, 'Unauthentic commit object')
    headers = raw.split(b'\n\n', 1)[0].splitlines()
    trees = [x[5:].decode() for x in headers if x.startswith(b'tree ')]
    actual_parents = [x[7:].decode() for x in headers if x.startswith(b'parent ')]
    require(len(trees) == 1 and (tree is None or trees == [tree]), 'Actual tree mismatch')
    require(parents is None or parents == actual_parents, 'Ordered parent mismatch')
    if clean:
        entries = {}
        for item in git(root, env, 'ls-tree', '-rz', '--full-tree', commit).split(b'\0'):
            if not item:
                continue
            metadata, name = item.split(b'\t', 1)
            mode, kind, oid = metadata.decode().split()
            require(kind == 'blob' and mode in ('100644', '100755', '120000'), 'Unsupported tracked entry')
            entries[name.decode()] = (mode, oid)
        index = {}
        for item in git(root, env, 'ls-files', '--stage', '-z').split(b'\0'):
            if not item:
                continue
            metadata, name = item.split(b'\t', 1)
            mode, oid, stage = metadata.decode().split()
            require(stage == '0' and name.decode() not in index, 'Unmerged index')
            index[name.decode()] = (mode, oid)
        require(index == entries, 'Staged source or harness changed')
        require(not git(root, env, 'ls-files', '--others', '--exclude-standard', '-z'), 'Untracked source or harness files')
        tags = git(root, env, 'ls-files', '-v', '-z').split(b'\0')
        require(all(not tag or tag[:1] == b'H' for tag in tags), 'Hidden index flags')
        for name, (mode, oid) in entries.items():
            path = root / relative_path(name)
            if mode == '120000':
                require(path.is_symlink() and path.parent == path.parent.resolve(), 'Tracked symlink changed')
                data = os.readlink(path).encode()
            else:
                data = read_regular(root, name)
                require(bool(path.stat().st_mode & 0o111) == (mode == '100755'), 'Tracked mode changed')
            actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            require(actual == oid, 'Tracked bytes changed: ' + name)
    return {'commit': commit, 'tree': trees[0], 'parents': actual_parents}


def verify_pins(root, pins_path, digest):
    require(HEX64.fullmatch(digest) is not None, 'Invalid external pin digest')
    data = read_regular(pins_path.parent, pins_path.name)
    require(sha(data) == digest, 'Harness pins digest mismatch')
    pins = strict_json(data)
    require(set(pins) == {'schema', 'files'} and pins['schema'] == 'agijobmanager/native-harness-pins/v1', 'Unexpected harness pins schema')
    require(isinstance(pins['files'], dict) and BASE_PINS <= set(pins['files']), 'Required harness pins missing')
    for name, expected in pins['files'].items():
        require(isinstance(expected, str) and HEX64.fullmatch(expected), 'Invalid file digest')
        require(sha(read_regular(root, name)) == expected, 'Harness file pin mismatch: ' + name)
    expected = strict_json(read_regular(root, 'config/expected-campaigns.json'))
    require(expected.get('schema') == 'agijobmanager/native-campaign-expectations/v1' and
            set(expected.get('campaigns', {})) == {'full', 'marker'}, 'Unexpected campaign expectations')
    require(pins['files']['scripts/qualification/select-source-profile.py'] == expected.get('selectorSha256'), 'Selector reviewed pin mismatch')
    require(sha(read_regular(root, 'config/reviewed-c2-target.json')) == TARGET_SHA and
            sha(read_regular(root, 'config/c2-source-review-binding.json')) == BINDING_SHA, 'Reviewed source pin mismatch')
    for suite, oracle in expected['campaigns'].items():
        runner_root = root / 'runners' / suite
        actual = set()
        for directory, dirs, files in os.walk(runner_root, followlinks=False):
            require(all(not (Path(directory) / d).is_symlink() for d in dirs), 'Runner symlink directory')
            for filename in files:
                name = (Path(directory) / filename).relative_to(root).as_posix()
                actual.add(name)
                require(name in pins['files'], 'Unpinned runner file')
        require(actual, 'Missing runner files')
        for name, digest in oracle['harnessFiles'].items():
            require(pins['files'].get('runners/' + suite + '/' + name) == digest, 'Runner oracle pin mismatch')
    return pins['files'], expected['campaigns']


def launch(command, cwd, env, log_base, timeout):
    """No shell; preserve complete logs; kill the complete process group on timeout."""
    started = time.monotonic()
    with open(str(log_base) + '.stdout.raw.log', 'xb') as out, open(str(log_base) + '.stderr.raw.log', 'xb') as err:
        child = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                 stdout=out, stderr=err, start_new_session=True)
        timed_out = False
        try:
            code = child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(child.pid, signal.SIGKILL)
            code = child.wait()
        except BaseException:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
            raise
    return {'exitCode': code, 'timedOut': timed_out, 'elapsedSeconds': round(time.monotonic() - started, 3)}


def source_gate(root, harness, env, logs, label, launcher=launch):
    command = [sys.executable, '-I', str(harness / 'scripts/qualification/select-source-profile.py'),
        '--profile', PROFILE, '--mode', 'bound', '--source-root', str(root),
        '--target-manifest', str(harness / 'config/reviewed-c2-target.json'),
        '--target-manifest-sha256', TARGET_SHA,
        '--review-binding', str(harness / 'config/c2-source-review-binding.json'),
        '--review-binding-sha256', BINDING_SHA]
    result = launcher(command, harness, env, logs / label, 900)
    require(result['exitCode'] == 0 and result['timedOut'] is False, 'Bound source selector failed')
    data = read_regular(logs, label + '.stdout.raw.log')
    receipt = strict_json(data)
    for key, value in {'profile': PROFILE, 'status': 'CLEAN_SOURCE_BOUNDARIES_PASSED',
            'releaseQualified': False, 'mode': 'bound', 'sourceCommit': TARGET, 'sourceTree': TREE,
            'compilerSourceUnits': 91, 'manifestSha256': '7aced0aee4c2161f92fa507809a5084d0a7ab13e52ead31d95c916ee00f2e973'}.items():
        require(type(receipt.get(key)) is type(value) and receipt.get(key) == value, 'Invalid source selection receipt: ' + key)
    require(receipt.get('localUnqualifiedMounts') == [], 'Source has unqualified local mounts')
    return {'label': label, 'sha256': sha(data), 'receipt': receipt}


def _rlp(data, offset=0):
    require(offset < len(data), 'Invalid RLP')
    prefix = data[offset]
    if prefix < 128:
        return bytes([prefix]), offset + 1
    if prefix < 184:
        start, length, listing = offset + 1, prefix - 128, False
    elif prefix < 192:
        size = prefix - 183
        require(offset + 1 + size <= len(data), 'Invalid RLP')
        length = int.from_bytes(data[offset + 1:offset + 1 + size], 'big')
        start, listing = offset + 1 + size, False
    elif prefix < 248:
        start, length, listing = offset + 1, prefix - 192, True
    else:
        size = prefix - 247
        require(offset + 1 + size <= len(data), 'Invalid RLP')
        length = int.from_bytes(data[offset + 1:offset + 1 + size], 'big')
        start, listing = offset + 1 + size, True
    end = start + length
    require(end <= len(data), 'Invalid RLP')
    if not listing:
        return data[start:end], end
    values = []
    while start < end:
        value, start = _rlp(data, start)
        values.append(value)
    require(start == end, 'Invalid RLP')
    return values, end


def is_signed_transaction(value):
    if not isinstance(value, str) or not re.fullmatch(r'0x[0-9a-fA-F]{100,}', value) or len(value) % 2:
        return False
    try:
        data = bytes.fromhex(value[2:])
        typed = data[0] if data[0] in (1, 2, 3, 4) else 0
        decoded, end = _rlp(data, 1 if typed else 0)
        sizes = {0: 9, 1: 11, 2: 12, 3: 14, 4: 13}
        return end == len(data) and isinstance(decoded, list) and len(decoded) == sizes[typed] and all(
            isinstance(x, bytes) and 0 < len(x) <= 32 and any(x) for x in decoded[-2:])
    except (CampaignError, ValueError, RecursionError):
        return False


def scan_shareable(name, data):
    relative_path(name, True)
    text = data.decode('utf-8', errors='strict')
    require(not re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', text), 'Private key PEM in evidence')
    require(not re.search(r'(?i)["\'](?:private[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase|raw(?:Transaction)?|signedTransaction|serializedTransaction)["\']\s*:\s*["\']', text), 'Private key or signed-capability field in evidence')
    for value in re.findall(r'0x[0-9a-fA-F]{100,}', text):
        require(not is_signed_transaction(value), 'Raw signed transaction in evidence')
    if name.endswith('.json'):
        value = strict_json(data)
        sensitive = {'privatekey', 'secretkey', 'mnemonic', 'seedphrase', 'raw', 'rawtransaction',
                     'signedtransaction', 'serializedtransaction', 'signingkey', 'signedcapability', 'signingcapability', 'signature'}
        def walk(item):
            if isinstance(item, dict):
                for key, child in item.items():
                    require(re.sub(r'[_-]', '', key).lower() not in sensitive or child is None,
                            'Private or signed-capability JSON member')
                    walk(child)
            elif isinstance(item, list):
                for child in item:
                    walk(child)
            elif isinstance(item, str):
                require(not is_signed_transaction(item), 'Raw signed transaction JSON value')
        walk(value)


def shared_members(root):
    """Match the pinned runners' inventory, without following fixture aliases."""
    members = set()
    def walk(directory, prefix=''):
        for path in directory.iterdir():
            name = prefix + path.name
            if (not prefix and path.name in ('private', 'source-probes', 'report.json', 'SHA256SUMS', 'INCOMPLETE')) or path.name == 'signed':
                continue
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode):
                continue  # Expected negative path aliases remain raw, never publishable.
            if stat.S_ISDIR(mode):
                walk(path, name + '/')
            else:
                require(stat.S_ISREG(mode), 'Unexpected raw evidence file type')
                members.add(name)
    walk(root)
    return members


def evidence_inventory(root):
    raw_report = read_regular(root, 'report.json', True)
    report = strict_json(raw_report)
    require(report.get('schema') == REPORT_SCHEMA and report.get('acceptanceComplete') is False and
            report.get('nativeCLIQualified') is False, 'Raw report scope changed')
    files = report.get('evidenceFiles')
    require(isinstance(files, list), 'Missing evidence allowlist')
    inventory = {}
    for item in files:
        require(isinstance(item, dict) and set(item) == {'path', 'bytes', 'sha256'}, 'Invalid evidence descriptor')
        name = item['path']
        relative_path(name, True)
        require(name not in ('report.json', 'SHA256SUMS', 'INCOMPLETE') and name not in inventory, 'Duplicate or reserved evidence member')
        require(type(item['bytes']) is int and item['bytes'] >= 0 and isinstance(item['sha256'], str) and HEX64.fullmatch(item['sha256']), 'Invalid evidence size or hash')
        data = read_regular(root, name, True)
        require(len(data) == item['bytes'] and sha(data) == item['sha256'], 'Evidence byte/hash mismatch: ' + name)
        scan_shareable(name, data)
        inventory[name] = item['sha256']
    require(set(inventory) == shared_members(root), 'Evidence membership differs from raw shareable files')
    scan_shareable('report.json', raw_report)
    inventory['report.json'] = sha(raw_report)
    sums = read_regular(root, 'SHA256SUMS', True)
    parsed = {}
    for line in sums.decode().splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
        require(match is not None, 'Malformed SHA256SUMS')
        digest, name = match.groups()
        relative_path(name, True)
        require(name not in parsed, 'Duplicate SHA256SUMS member')
        parsed[name] = digest
    require(parsed == inventory, 'SHA256SUMS membership or digest mismatch')
    inventory['SHA256SUMS'] = sha(sums)
    return report, inventory


def publish_allowlist(raw, destination):
    report, inventory = evidence_inventory(raw)
    require(not destination.exists() and not destination.is_symlink(), 'Shareable destination already exists')
    destination.mkdir(mode=0o700)
    for name, digest in inventory.items():
        data = read_regular(raw, name, True)
        require(sha(data) == digest, 'Evidence changed before copy')
        scan_shareable(name, data)
        write_new(destination / name, data)
    require(set(p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file()) == set(inventory), 'Published membership mismatch')
    for name, digest in inventory.items():
        require(sha(read_regular(destination, name, True)) == digest, 'Published evidence hash mismatch')
    return report, inventory


def same(actual, expected):
    # JSON booleans must not satisfy numeric count expectations (False == 0).
    return json.dumps(actual, sort_keys=True, separators=(',', ':')) == json.dumps(expected, sort_keys=True, separators=(',', ':'))


def project(value, fields):
    return {key: value[key] for key in fields if key in value}


def validate_report(root, suite, expected, source, runner, node, build_id):
    report, evidence = evidence_inventory(root)
    require(not (root / 'INCOMPLETE').exists() and not (root / 'INCOMPLETE').is_symlink(), 'Incomplete runner directory')
    require(report.get('status') == 'PASS_IMPLEMENTED_CASES' and report.get('suite') == suite and
            report.get('failures') == [], 'Campaign failed or incomplete')
    target = strict_json(read_regular(Path(__file__).resolve().parents[2], 'config/reviewed-c2-target.json'))
    identity = {'commit': TARGET, 'tree': TREE,
                'rootLockSha256': target['lockSha256']['package-lock.json'],
                'hardhatLockSha256': target['lockSha256']['hardhat/package-lock.json']}
    require(report.get('source') == identity and report.get('finalSource') == identity and
            report.get('parents') == PARENTS and report.get('sourceRoot') == str(source) and
            report.get('sourceIncludesHarness') is False, 'Report source identity mismatch')
    require(same(report.get('harnessFiles'), expected['harnessFiles']), 'Reported runner pins differ')
    require(same(report.get('counts'), expected['counts']), 'Campaign count mismatch')
    cases = report.get('cases')
    require(isinstance(cases, list) and same([project(c, CASE_FIELDS) for c in cases], expected['cases']) and
            all(c.get('status') == 'PASS' and not c.get('skipped') for c in cases), 'Case inventory, expectation, failure or skip mismatch')
    commands = report.get('commands')
    require(isinstance(commands, list) and same([project(c, COMMAND_FIELDS) for c in commands], expected['commands']), 'Command sequence or expected result mismatch')
    executable_sha = sha(node.read_bytes())
    require(report.get('nodeExecutableSha256') == executable_sha, 'Node executable identity mismatch')
    for index, command in enumerate(commands):
        require(command.get('sequence') == index and not command.get('skipped') and
                command.get('signal') is None and command.get('timedOut', False) is False and
                command.get('oversized', False) is False, 'Crashed, timed out, skipped or malformed child')
        if 'executable' in command:
            require(command['executable'] == str(node), 'Child executable mismatch')
        if 'executableSha256' in command:
            require(command['executableSha256'] == executable_sha, 'Child executable digest mismatch')
        if command.get('privateMaterialExcluded') is True:
            require(command.get('script') == str(runner / 'scripts/qualification/core-session-native.mjs') and
                    command.get('arguments') == ['--disposable-sign', str(source)], 'Signer outside frozen disposable scope')
        if 'expectedFailure' in command:
            prefix = 'commands/' + str(index).zfill(5)
            require(strict_json(read_regular(root, prefix + '.json', True)) == command, 'Command record membership mismatch')
            for stream in ('stdout', 'stderr'):
                require(evidence.get(prefix + '.' + stream + '.txt') == command[stream + 'Sha256'], 'Command log hash mismatch')
            if command['expectedFailure']:
                require(command['exitCode'] == 1 and command['stderr'] == CORE_ERROR and
                        command['stdoutSha256'] == sha(b'') and command['stderrSha256'] == sha((CORE_ERROR + '\n').encode()), 'Native failure redaction mismatch')
            output = command.get('output')
            if output:
                path = Path(output['path'])
                require(path.is_relative_to(root), 'Command output outside raw evidence')
                require(evidence.get(path.relative_to(root).as_posix()) == output['sha256'], 'Command output missing from evidence')
    require(same(report.get('limitations'), expected['limitations']), 'Runner limitations changed')
    require(report.get('chain') == {'type': 'disposable-edr', 'chainId': 1, 'hardfork': 'osaka',
        'blockGasLimit': '30000000', 'eip170Enforced': True, 'coverageBypass': False}, 'Unsafe fixture chain')
    transport = report.get('transport', {})
    endpoints = [transport.get('readEndpoint', ''), transport.get('relayEndpoint', '')]
    require(all(re.fullmatch(r'https://127\.0\.0\.1:[1-9][0-9]{0,4}/', x) for x in endpoints) and
            endpoints[0] != endpoints[1] and transport.get('normalTlsVerification') is True and
            HEX64.fullmatch(transport.get('childOnlyCaSha256', '')), 'Invalid loopback-only transport')
    require(report.get('http', {}).get('counts', {}).get('forbidden') == 0, 'Forbidden RPC invocation')
    build = report.get('build', {})
    require(same(project(build, tuple(expected['build'])), expected['build']), 'Compiler source, artifact or catalog identity changed')
    require(build.get('source') == identity and build.get('parents') == PARENTS and build.get('sourceRoot') == str(source) and
            build.get('buildId') == build_id and build.get('catalogPath') == str(root / 'catalog/catalog.json'), 'Catalog source or path mismatch')
    require(build.get('tools', {}).get('node') == 'v22.23.2' and len(build.get('sourceChecksums', {})) == 91 and len(build.get('artifactHashes', {})) == 9 and
            build.get('providerQualified') is False and build.get('walletQualified') is False and
            build.get('explorerAcceptanceObserved') is False, 'Build qualification scope mismatch')
    require(evidence.get('catalog/catalog.json') == build.get('catalogSha256') and
            strict_json(read_regular(root, 'catalog/preparation.json', True)) == build, 'Catalog/preparation evidence binding mismatch')
    catalog = strict_json(read_regular(root, 'catalog/catalog.json', True))
    require(set(catalog.get('builds', {})) == {build_id}, 'Unexpected catalog build membership')
    entry = catalog['builds'][build_id]
    require(entry.get('source') == identity and entry.get('compiler') == build['compiler'], 'Catalog identity mismatch')
    for field in ('input', 'output'):
        descriptor = entry[field]
        require(descriptor['sha256'] == build[field + 'Sha256'], 'Catalog compiler descriptor mismatch')
        file = exact_path(descriptor['path'])
        require(file.is_relative_to(source / 'hardhat/artifacts') and sha(file.read_bytes()) == descriptor['sha256'], 'Compiled artifact changed after run')
    require(set(entry['sources']) == set(build['sourceChecksums']) and set(entry['artifacts']) == set(build['artifactHashes']), 'Catalog finite membership changed')
    for name, descriptor in entry['sources'].items():
        require(descriptor['sha256'] == build['sourceChecksums'][name] and sha(exact_path(descriptor['path']).read_bytes()) == descriptor['sha256'], 'Compiler source bytes changed after run')
    for name, descriptor in entry['artifacts'].items():
        file = exact_path(descriptor['path'])
        require(file.is_relative_to(source / 'hardhat/artifacts') and descriptor['sha256'] == build['artifactHashes'][name]['artifactSha256'] and sha(file.read_bytes()) == descriptor['sha256'], 'Artifact bytes changed after run')
    operations = report.get('operations', [])
    require([op.get('scenario') for op in operations] == expected['operationScenarios'] and
            len(operations) == expected['counts']['positiveCoreReceipts'], 'Receipt count/scenario mismatch')
    require(len({op['transactionHash'] for op in operations}) == len(operations), 'Duplicate receipt transaction')
    proof_evidence = []
    for name in evidence:
        if name.startswith('outputs/') and name.endswith('.json'):
            value = strict_json(read_regular(root, name, True))
            if isinstance(value, dict):
                if isinstance(value.get('proof'), dict):
                    proof_evidence.append(value['proof'])
                proof_evidence.extend(value.get('proofs', []))
    for i, operation in enumerate(operations):
        proof, envelope = operation['proof'], operation['envelope']
        require(TXHASH.fullmatch(operation['transactionHash']) and proof.get('transactionHash') == operation['transactionHash'] and
                proof.get('index') == i % 9 and ADDRESS.fullmatch(proof.get('address', '')) and
                TXHASH.fullmatch(proof.get('runtimeCodeHash', '')) and TXHASH.fullmatch(proof.get('block', {}).get('hash', '')), 'Malformed receipt proof')
        require(envelope.get('type') == 2 and envelope.get('chainId') == 1 and envelope.get('to') is None and
                envelope.get('value') == '0' and envelope.get('from') == operation['recoveredCreator'] and
                ADDRESS.fullmatch(operation['recoveredCreator']), 'Wrong native transaction envelope or creator')
        plan_name = 'scenarios/' + operation['scenario'] + '/session/plan.json'
        require(plan_name in evidence, 'Receipt plan missing from evidence')
        plan = strict_json(read_regular(root, plan_name, True))
        require(plan.get('source') == identity and plan.get('buildId') == build_id and
                plan.get('buildDigest') == build['buildDigest'] and plan.get('catalogSha256') == build['catalogSha256'] and
                len(plan.get('operations', [])) == 9, 'Receipt plan source/catalog binding mismatch')
        planned = plan['operations'][i % 9]
        require(planned.get('envelope') == envelope and planned.get('predictedAddress') == proof['address'] and
                proof in proof_evidence, 'Receipt lacks matching plan or native proof evidence')
        require(any(c.get('rawKeccak256') == operation['transactionHash'] and
                    c.get('rawSha256') == operation['rawSha256'] and c.get('unsignedSha256') == operation['unsignedSha256'] and
                    c.get('privateMaterialExcluded') is True for c in commands), 'Receipt lacks disposable signing hash binding')
        if suite == 'marker':
            trace = operation['traceEvidence']
            require(evidence.get(trace['path']) == trace['traceSha256'] and trace.get('creatorInvocations') == 0 and
                    trace.get('targetInvocations') == 0 and trace.get('executionTimeCodeObserved') is False and
                    trace.get('traceCompletenessIndependentlyEstablished') is False and
                    trace.get('block', {}).get('hash') == proof['block']['hash'], 'Marker trace binding/scope mismatch')
    if suite == 'full':
        historical = report.get('historicalCatalog', {})
        require(same(project(historical, tuple(expected['historicalCatalog'])), expected['historicalCatalog']), 'Authentic legacy constructor/source/artifact evidence mismatch')
        historical_bytes = read_regular(root, 'source-probes/historical-catalog.json')
        require(sha(historical_bytes) == historical.get('catalogSha256'), 'Historical catalog raw-byte binding mismatch')
        old_builds = strict_json(historical_bytes).get('builds', {})
        old_id = 'authentic-six-argument-' + LEGACY[:12]
        require(set(old_builds) == {old_id}, 'Historical catalog membership mismatch')
        old = old_builds[old_id]
        require(old.get('source') == historical['source'] and len(old.get('sources', {})) == 91 and
                len(old.get('artifacts', {})) == 9, 'Historical source/artifact membership mismatch')
        for field in ('input', 'output'):
            require(old[field]['sha256'] == historical[field + 'Sha256'], 'Historical compiler identity mismatch')
        for descriptor in [old['input'], old['output'], *old['sources'].values(), *old['artifacts'].values()]:
            require(sha(exact_path(descriptor['path']).read_bytes()) == descriptor['sha256'], 'Historical source/artifact drift after run')
    return {'suite': suite, 'counts': report['counts'], 'reportSha256': evidence['report.json'],
            'evidenceFiles': len(evidence), 'catalogSha256': build['catalogSha256'], 'buildDigest': build['buildDigest']}


def fresh_output(value, excluded):
    path = Path(value)
    require(path.is_absolute() and path == path.resolve() and path.parent.is_dir() and path.parent == path.parent.resolve(), 'Output must have canonical existing parent')
    require(not path.exists() and not path.is_symlink(), 'Output must be fresh; never reuse failed campaign journals')
    require(all(not path.is_relative_to(root) and not root.is_relative_to(path) for root in excluded), 'Output overlaps source/harness/archive')
    path.mkdir(mode=0o700)
    return path


def run(args, launcher=launch):
    harness = exact_path(str(Path(__file__).resolve().parents[2]), True)
    source = exact_path(args.source_root, True)
    legacy = exact_path(args.legacy_source_root, True)
    artifacts = exact_path(args.legacy_artifacts_root, True)
    node = exact_path(args.node)
    pins_path = exact_path(args.pins)
    require(source != legacy and all(not a.is_relative_to(b) and not b.is_relative_to(a)
            for a, b in ((harness, source), (harness, legacy), (source, legacy))), 'Source and harness/archive roots overlap')
    require(artifacts.is_relative_to(legacy) and artifacts != legacy, 'Archived artifacts must belong to authentic archive checkout')
    require(HEX40.fullmatch(args.expected_harness_commit) and args.expected_harness_commit != TARGET, 'Separate explicit harness commit required')
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', args.build_id), 'Invalid build ID')
    pins, expectations = verify_pins(harness, pins_path, args.pins_sha256)
    output = fresh_output(args.output, [source, legacy, harness])
    logs = output / 'launcher-logs'; logs.mkdir(mode=0o700)
    home = output / 'private-home'; home.mkdir(mode=0o700)
    (output / 'shareable').mkdir(mode=0o700)
    env = child_environment(node, home)
    summary = {'schema': 'agijobmanager/native-campaign-result/v1', 'status': 'INCOMPLETE', 'scope': SCOPE,
        'source': {'commit': TARGET, 'tree': TREE, 'parents': PARENTS}, 'harnessPinsSha256': args.pins_sha256,
        'acceptanceComplete': False, 'nativeCLIQualified': False, 'functionalCampaignsComplete': False,
        'configurationAuthorized': False, 'activationAuthorized': False, 'campaigns': [], 'sourceGates': [],
        'claimsExcluded': ['production/provider/wallet or physical Ledger qualification', 'independent no-invocation security evidence',
            'historical release gate acceptance', 'governance configuration or activation', 'external audit and Sepolia acceptance']}
    write_new(output / 'INCOMPLETE', b'Preserve raw reports and logs. This is not operational acceptance.\n')
    current = None
    try:
        summary['harness'] = observe_git(harness, env, args.expected_harness_commit)
        observe_git(source, env, TARGET, TREE, PARENTS)
        observe_git(legacy, env, LEGACY, LEGACY_TREE)
        node_result = subprocess.run([str(node), '--version'], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=False)
        require(node_result.returncode == 0 and node_result.stdout == b'v22.23.2\n' and not node_result.stderr, 'Exactly Node v22.23.2 required')
        summary['nodeExecutableSha256'] = sha(node.read_bytes())
        for suite in ('full', 'marker'):
            verify_pins(harness, pins_path, args.pins_sha256)
            observe_git(harness, env, args.expected_harness_commit)
            observe_git(source, env, TARGET, TREE, PARENTS)
            summary['sourceGates'].append(source_gate(source, harness, env, logs, 'before-' + suite, launcher))
            current = suite
            runner = harness / 'runners' / suite
            command = [str(node), '--max-old-space-size=384', str(runner / 'scripts/qualification/core-session-native.mjs'),
                '--source-root', str(source), '--output', str(output / suite), '--expected-commit', TARGET,
                '--expected-tree', TREE, '--build-id', args.build_id, '--suite', suite]
            if suite == 'full':
                command += ['--legacy-source-root', str(legacy), '--legacy-artifacts-root', str(artifacts),
                            '--legacy-commit', LEGACY, '--legacy-tree', LEGACY_TREE]
            result = launcher(command, harness, env, logs / suite, args.timeout_seconds)
            summary['campaigns'].append({'suite': suite, 'process': result})
            require(result['exitCode'] == 0 and result['timedOut'] is False, 'Native child failed/crashed/timed out: ' + suite)
            verified = validate_report(output / suite, suite, expectations[suite], source, runner, node, args.build_id)
            verify_pins(harness, pins_path, args.pins_sha256)
            observe_git(harness, env, args.expected_harness_commit)
            observe_git(source, env, TARGET, TREE, PARENTS)
            observe_git(legacy, env, LEGACY, LEGACY_TREE)
            publish_allowlist(output / suite, output / 'shareable' / suite)
            summary['campaigns'][-1]['verified'] = verified
            current = None
        summary['sourceGates'].append(source_gate(source, harness, env, logs, 'after-marker', launcher))
        verify_pins(harness, pins_path, args.pins_sha256)
        observe_git(harness, env, args.expected_harness_commit)
        observe_git(source, env, TARGET, TREE, PARENTS)
        for suite in ('full', 'marker'):
            validate_report(output / suite, suite, expectations[suite], source, harness / 'runners' / suite, node, args.build_id)
            _, raw_inventory = evidence_inventory(output / suite)
            _, copied_inventory = evidence_inventory(output / 'shareable' / suite)
            require(raw_inventory == copied_inventory, 'Published evidence changed after validation')
        summary.update(status='PASS_FINITE_FUNCTIONAL_CAMPAIGNS', functionalCampaignsComplete=True)
        publish_success_summary(output, summary, pins)
        (output / 'INCOMPLETE').unlink()
        code = 0
    except (CampaignError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        summary['status'] = 'FAILED_OR_INCOMPLETE'
        summary['functionalCampaignsComplete'] = False
        for generated in ('campaign-summary.json', 'campaign-summary.SHA256SUMS'):
            published = output / 'shareable' / generated
            if published.exists() or published.is_symlink():
                published.unlink()  # Only this run's fresh, wrapper-generated metadata.
        summary['failure'] = {'stage': current or 'source-or-harness-gate', 'type': type(error).__name__, 'message': str(error)}
        # A failed report is retained verbatim and may be copied only if its own
        # allowlist is safe, complete and hashed. No report is synthesized/rewritten.
        if current and (output / current / 'report.json').is_file() and not (output / 'shareable' / current).exists():
            try:
                publish_allowlist(output / current, output / 'shareable' / current)
                summary['failedEvidenceSafelyCopied'] = True
            except (CampaignError, OSError, ValueError, KeyError, TypeError):
                summary['failedEvidenceSafelyCopied'] = False
        code = 1
    write_new(output / 'campaign-summary.json', summary)
    if code:
        hashes = {}
        for path in sorted(logs.glob('*.raw.log')):
            try:
                hashes[path.name] = sha(read_regular(logs, path.name))
            except (CampaignError, OSError):
                pass
        write_new(output / 'shareable' / 'failure-diagnostics.json', {
            'schema': 'agijobmanager/native-campaign-failure-diagnostics/v1',
            'status': 'FAILED_OR_INCOMPLETE', 'scope': SCOPE, 'sourceCommit': TARGET, 'sourceTree': TREE,
            'acceptanceComplete': False, 'nativeCLIQualified': False,
            'message': 'Campaign did not complete. Preserve raw files locally; no unsafe content was published.',
            'localSummarySha256': sha(read_regular(output, 'campaign-summary.json')), 'localLauncherLogSha256': hashes})
    print(json.dumps({'status': summary['status'], 'scope': SCOPE, 'summary': str(output / 'campaign-summary.json'),
        'shareable': str(output / 'shareable'), 'acceptanceComplete': False, 'nativeCLIQualified': False}))
    return code


def publish_success_summary(output, summary, pins):
    """Explicit reviewed metadata only; no absolute output paths or raw logs."""
    require(summary.get('status') == 'PASS_FINITE_FUNCTIONAL_CAMPAIGNS' and
            summary.get('functionalCampaignsComplete') is True and
            summary.get('acceptanceComplete') is False and summary.get('nativeCLIQualified') is False,
            'Cannot publish successful summary for incomplete/operational result')
    safe = {key: summary[key] for key in ('schema', 'status', 'scope', 'source', 'harness',
        'harnessPinsSha256', 'nodeExecutableSha256', 'acceptanceComplete', 'nativeCLIQualified',
        'functionalCampaignsComplete', 'configurationAuthorized', 'activationAuthorized', 'claimsExcluded')}
    safe['harnessFiles'] = pins
    safe['sourceGates'] = summary['sourceGates']
    safe['campaigns'] = []
    for campaign in summary['campaigns']:
        suite = campaign['suite']
        require(suite in ('full', 'marker'), 'Unexpected summary campaign')
        verified = campaign['verified']
        report_path = suite + '/report.json'
        require(sha(read_regular(output / 'shareable', report_path, True)) == verified['reportSha256'],
                'Summary does not bind published raw report')
        safe['campaigns'].append({'suite': suite, 'report': report_path, 'process': campaign['process'], **verified})
    require([c['suite'] for c in safe['campaigns']] == ['full', 'marker'], 'Incomplete summary campaign set')
    data = (json.dumps(safe, indent=2, sort_keys=True) + '\n').encode()
    scan_shareable('campaign-summary.json', data)
    write_new(output / 'shareable/campaign-summary.json', data)
    write_new(output / 'shareable/campaign-summary.SHA256SUMS', (sha(data) + '  campaign-summary.json\n').encode())
    return safe


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    for name in ('source-root', 'legacy-source-root', 'legacy-artifacts-root', 'node', 'build-id', 'output', 'pins', 'pins-sha256', 'expected-harness-commit'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--timeout-seconds', type=int, default=10800)
    seen = set()
    for value in argv:
        if value.startswith('--'):
            key = value.split('=', 1)[0]
            if key in seen:
                parser.error('Repeated option: ' + key)
            seen.add(key)
    args = parser.parse_args(argv)
    if not 60 <= args.timeout_seconds <= 21600:
        parser.error('Per-campaign timeout must be between 60 and 21600 seconds')
    return args


def main(argv=None):
    try:
        return run(parse_args(sys.argv[1:] if argv is None else argv))
    except (CampaignError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print('NATIVE CAMPAIGNS STOPPED: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
