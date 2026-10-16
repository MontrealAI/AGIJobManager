#!/usr/bin/env python3
"""Tiny synthetic/mock wrapper boundary tests. NOT native c2 qualification.

No EVM, installation, network, real signing or production source mutation occurs.
Every fixture lives in a temporary directory and is removed by the test runner.
"""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('native_campaign_wrapper', Path(__file__).with_name('run-native-campaigns.py'))
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
HARNESS = Path(__file__).resolve().parents[2]


def encoded(value):
    return (json.dumps(value, indent=2) + '\n').encode()


def put(root, name, value):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value if isinstance(value, bytes) else encoded(value))
    return path


def seal(root, report):
    report['evidenceFiles'] = [{'path': p, 'bytes': len(M.read_regular(root, p)), 'sha256': M.sha(M.read_regular(root, p))} for p in sorted(M.shared_members(root))]
    put(root, 'report.json', report)
    entries = [(x['path'], x['sha256']) for x in report['evidenceFiles']] + [('report.json', M.sha((root / 'report.json').read_bytes()))]
    put(root, 'SHA256SUMS', ''.join(digest + '  ' + name + '\n' for name, digest in entries).encode())


def simple_report(root):
    put(root, 'outputs/safe.json', {'message': 'SYNTHETIC WRAPPER BOUNDARY FIXTURE ONLY'})
    report = {'schema': M.REPORT_SCHEMA, 'acceptanceComplete': False, 'nativeCLIQualified': False}
    seal(root, report)
    return report


def complete_fixture(base):
    """Synthetic positive for verifier wiring, not Git/source/EVM qualification."""
    root = base / 'raw'; root.mkdir()
    source = base / 'synthetic-source'; source.mkdir()
    runner = base / 'synthetic-runner'; runner.mkdir()
    node = put(base, 'synthetic-node', b'not executable; tests never launch this file\n')
    node_sha = M.sha(node.read_bytes())
    target = json.loads((HARNESS / 'config/reviewed-d371-target.json').read_text())
    identity = {'commit': M.TARGET, 'tree': M.TREE, 'rootLockSha256': target['lockSha256']['package-lock.json'], 'hardhatLockSha256': target['lockSha256']['hardhat/package-lock.json']}
    source_file = put(source, 'contracts/fixture.txt', b'SYNTHETIC SOURCE ONLY\n')
    sources = {'synthetic/unit-' + str(i): {'path': str(source_file), 'sha256': M.sha(source_file.read_bytes())} for i in range(91)}
    artifacts = {}
    for i in range(9):
        file = put(source, 'hardhat/artifacts/artifact-' + str(i) + '.json', {'synthetic': i})
        artifacts['Synthetic' + str(i)] = {'path': str(file), 'sha256': M.sha(file.read_bytes())}
    compiler_files = {}
    for key in ('input', 'output'):
        file = put(source, 'hardhat/artifacts/' + key + '.json', {'fixture': key})
        compiler_files[key] = {'path': str(file), 'sha256': M.sha(file.read_bytes())}
    compiler = {'version': 'synthetic'}
    catalog = {'schema': 'synthetic-catalog', 'builds': {'synthetic': {'source': identity, 'compiler': compiler, **compiler_files, 'sources': sources, 'artifacts': artifacts}}}
    put(root, 'catalog/catalog.json', catalog)
    catalog_sha = M.sha((root / 'catalog/catalog.json').read_bytes())
    build = {'source': identity, 'sourceRoot': str(source), 'parents': M.PARENTS,
        'buildId': 'synthetic', 'buildDigest': 'b' * 64, 'catalogPath': str(root / 'catalog/catalog.json'),
        'catalogSha256': catalog_sha, 'compiler': compiler,
        'inputSha256': compiler_files['input']['sha256'], 'outputSha256': compiler_files['output']['sha256'],
        'sourceChecksums': {k: v['sha256'] for k, v in sources.items()},
        'artifactHashes': {k: {'artifactSha256': v['sha256']} for k, v in artifacts.items()},
        'tools': {'node': 'v22.23.2'}, 'providerQualified': False, 'walletQualified': False, 'explorerAcceptanceObserved': False}
    put(root, 'catalog/preparation.json', build)
    command = {'sequence': 0, 'label': 'synthetic-command', 'exitCode': 0, 'expectedFailure': False,
        'executable': str(node), 'executableSha256': node_sha, 'signal': None, 'timedOut': False, 'oversized': False,
        'stdoutSha256': M.sha(b''), 'stderrSha256': M.sha(b''), 'stderr': '', 'output': None,
        'relayHttpSubmissions': 0}
    put(root, 'commands/00000.json', command)
    put(root, 'commands/00000.stdout.txt', b'')
    put(root, 'commands/00000.stderr.txt', b'')
    commands = [command]
    operations, planned = [], []
    for i in range(9):
        txhash = '0x' + format(i + 1, '064x')
        address = '0x' + format(i + 1, '040x')
        creator = '0x' + 'a' * 40
        envelope = {'type': 2, 'chainId': 1, 'from': creator, 'nonce': i, 'to': None, 'value': '0', 'data': '0x6000'}
        proof = {'index': i, 'transactionHash': txhash, 'address': address, 'block': {'hash': '0x' + format(i + 10, '064x')}, 'runtimeCodeHash': '0x' + 'b' * 64}
        trace_path = 'scenarios/synthetic/trace-' + str(i) + '.json'
        put(root, trace_path, {'synthetic': i})
        trace = {'path': trace_path, 'traceSha256': M.sha((root / trace_path).read_bytes()), 'creatorInvocations': 0, 'targetInvocations': 0,
            'executionTimeCodeObserved': False, 'traceCompletenessIndependentlyEstablished': False, 'block': proof['block']}
        unsigned = format(i + 20, '064x'); raw = format(i + 40, '064x')
        operations.append({'scenario': 'synthetic', 'envelope': envelope, 'recoveredCreator': creator, 'proof': proof,
            'transactionHash': txhash, 'traceEvidence': trace, 'unsignedSha256': unsigned, 'rawSha256': raw})
        planned.append({'envelope': envelope, 'predictedAddress': address})
        commands.append({'sequence': i + 1, 'label': 'disposable-sign', 'exitCode': 0,
            'executable': str(node), 'executableSha256': node_sha, 'privateMaterialExcluded': True,
            'script': str(runner / 'scripts/qualification/core-session-native.mjs'), 'arguments': ['--disposable-sign', str(source)],
            'rawKeccak256': txhash, 'rawSha256': raw, 'unsignedSha256': unsigned})
    put(root, 'outputs/receipt-proofs.json', {'proofs': [op['proof'] for op in operations]})
    put(root, 'scenarios/synthetic/session/plan.json', {'source': identity, 'buildId': 'synthetic',
        'buildDigest': build['buildDigest'], 'catalogSha256': catalog_sha, 'operations': planned})
    report = {'schema': M.REPORT_SCHEMA, 'status': 'PASS_IMPLEMENTED_CASES', 'suite': 'marker', 'failures': [],
        'acceptanceComplete': False, 'nativeCLIQualified': False, 'source': identity, 'finalSource': identity,
        'sourceRoot': str(source), 'parents': M.PARENTS, 'sourceIncludesHarness': False, 'harnessFiles': {},
        'cases': [{'name': 'SYNTHETIC_VERIFIER_WIRING_ONLY', 'commands': 10, 'receipts': 9, 'status': 'PASS'}],
        'commands': commands, 'operations': operations, 'nodeExecutableSha256': node_sha,
        'counts': {'cases': 1, 'passed': 1, 'failed': 0, 'commands': 10, 'positiveCoreReceipts': 9},
        'limitations': {'syntheticVerifierWiringOnly': True}, 'build': build,
        'chain': {'type': 'disposable-edr', 'chainId': 1, 'hardfork': 'osaka', 'blockGasLimit': '30000000', 'eip170Enforced': True, 'coverageBypass': False},
        'transport': {'readEndpoint': 'https://127.0.0.1:12345/', 'relayEndpoint': 'https://127.0.0.1:12346/', 'normalTlsVerification': True, 'childOnlyCaSha256': 'c' * 64},
        'http': {'counts': {'forbidden': 0}}}
    expected = {'cases': [M.project(c, M.CASE_FIELDS) for c in report['cases']], 'commands': [M.project(c, M.COMMAND_FIELDS) for c in commands],
        'counts': report['counts'], 'harnessFiles': {}, 'limitations': report['limitations'],
        'build': M.project(build, ('compiler', 'inputSha256', 'outputSha256', 'buildDigest', 'sourceChecksums', 'artifactHashes')),
        'operationScenarios': ['synthetic'] * 9}
    seal(root, report)
    return root, source, runner, node, report, copy.deepcopy(expected)


class SyntheticBoundaries(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='native-wrapper-boundary-')
        self.base = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def assert_rejected(self, fn, pattern=None):
        with self.assertRaises((M.CampaignError, ValueError, OSError)) as caught:
            fn()
        if pattern:
            self.assertIn(pattern, str(caught.exception))

    def test_hosted_profile_changes_only_exact_thirteen_container_fields(self):
        original = json.loads((HARNESS / 'config/d371-campaign-expectations.json').read_text())['campaigns']
        before = copy.deepcopy(original)
        hosted = M.select_container_profile(HARNESS, original, M.HOSTED_CONTAINER_PROFILE)
        self.assertEqual(original, before)
        fixed = json.loads((HARNESS / 'config/hosted-container-profile.json').read_text())
        self.assertEqual(len(fixed['containers']), 13)
        restored = copy.deepcopy(hosted)
        for row in fixed['containers']:
            targets = [restored[x]['build'] for x in ('full', 'marker')] if row['group'] == 'new' else [restored['full']['historicalCatalog']]
            for target in targets:
                if row['name'] in ('input', 'output'):
                    self.assertEqual(target[row['name'] + 'Sha256'], row['hostedSha256'])
                    target[row['name'] + 'Sha256'] = row['originalSha256']
                    target['compilerBuildInfoId'] = row['originalId']
                else:
                    self.assertEqual(target['artifactHashes'][row['name']]['artifactSha256'], row['hostedSha256'])
                    target['artifactHashes'][row['name']]['artifactSha256'] = row['originalSha256']
        self.assertEqual(restored, before)
        self.assertIs(M.select_container_profile(HARNESS, original, M.LOCAL_CONTAINER_PROFILE), original)

    def test_unknown_or_mutated_container_profile_and_baseline_fail_closed(self):
        original = json.loads((HARNESS / 'config/d371-campaign-expectations.json').read_text())['campaigns']
        self.assert_rejected(lambda: M.select_container_profile(HARNESS, original, 'discover'), 'Unknown')
        temp = self.base / 'profile'; temp.mkdir()
        config = json.loads((HARNESS / 'config/hosted-container-profile.json').read_text())
        config['unknown'] = True
        put(temp, 'config/hosted-container-profile.json', config)
        self.assert_rejected(lambda: M.select_container_profile(temp, original, M.HOSTED_CONTAINER_PROFILE), 'profile bytes changed')
        put(temp, 'config/hosted-container-profile.json', (HARNESS / 'config/hosted-container-profile.json').read_bytes())
        put(temp, 'config/d371-campaign-expectations.json', b'{}')
        self.assert_rejected(lambda: M.select_container_profile(temp, original, M.HOSTED_CONTAINER_PROFILE), 'baseline changed')

    def test_safe_allowlist_copy_preserves_raw_and_excludes_private(self):
        raw = self.base / 'raw'; raw.mkdir(); simple_report(raw)
        put(raw, 'private/key.json', {'privateKey': 'not-a-real-key'})
        put(raw, 'source-probes/mutable.txt', b'not uploaded')
        put(raw, 'scenarios/example/signed/raw.txt', b'not uploaded')
        (raw / 'ignored-fixture-alias').symlink_to(raw / 'private', target_is_directory=True)
        before = (raw / 'report.json').read_bytes()
        _, inventory = M.publish_allowlist(raw, self.base / 'shareable')
        self.assertEqual(set(inventory), {'outputs/safe.json', 'report.json', 'SHA256SUMS'})
        self.assertEqual((raw / 'report.json').read_bytes(), before)
        self.assertEqual((self.base / 'shareable/report.json').read_bytes(), before)

    def test_duplicate_json_keys_rejected(self):
        self.assert_rejected(lambda: M.strict_json(b'{"x":1,"x":2}'))

    def test_nonfinite_json_rejected(self):
        for value in ('NaN', 'Infinity', '-Infinity'):
            with self.subTest(value=value):
                self.assert_rejected(lambda: M.strict_json('{"x":' + value + '}'))

    def test_relative_path_boundary_negatives(self):
        for name in ('../escape', '/absolute', 'a/../b', 'a//b', './a', 'a\\b', '.git/HEAD', 'a\nb', 'private/key', 'nested/signed/raw', 'source-probes/x', 'x.pem', '.env'):
            with self.subTest(name=name):
                self.assert_rejected(lambda: M.relative_path(name, True))

    def test_symlink_file_and_ancestor_rejected(self):
        put(self.base, 'target/file', b'a')
        (self.base / 'alias').symlink_to(self.base / 'target', target_is_directory=True)
        (self.base / 'file-link').symlink_to(self.base / 'target/file')
        for name in ('alias/file', 'file-link'):
            with self.subTest(name=name):
                self.assert_rejected(lambda: M.read_regular(self.base, name))

    def test_hardlink_rejected(self):
        put(self.base, 'original', b'a'); os.link(self.base / 'original', self.base / 'alias')
        self.assert_rejected(lambda: M.read_regular(self.base, 'alias'))

    def test_evidence_tampering_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); simple_report(raw)
        put(raw, 'outputs/safe.json', {'tampered': True})
        self.assert_rejected(lambda: M.evidence_inventory(raw), 'byte/hash')

    def test_unlisted_evidence_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); simple_report(raw)
        put(raw, 'extra.json', {})
        self.assert_rejected(lambda: M.evidence_inventory(raw), 'membership')

    def test_missing_evidence_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); simple_report(raw)
        (raw / 'outputs/safe.json').unlink()
        self.assert_rejected(lambda: M.evidence_inventory(raw))

    def test_duplicate_evidence_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); report = simple_report(raw)
        report['evidenceFiles'].append(report['evidenceFiles'][0]); put(raw, 'report.json', report)
        self.assert_rejected(lambda: M.evidence_inventory(raw), 'Duplicate')

    def test_private_allowlist_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); report = simple_report(raw)
        report['evidenceFiles'][0]['path'] = 'private/key.json'; put(raw, 'report.json', report)
        self.assert_rejected(lambda: M.evidence_inventory(raw), 'Private')

    def test_symlink_allowlist_rejected(self):
        raw = self.base / 'raw'; raw.mkdir(); simple_report(raw)
        (raw / 'outputs/safe.json').unlink(); (raw / 'outputs/safe.json').symlink_to('/dev/null')
        self.assert_rejected(lambda: M.evidence_inventory(raw), 'Symlink')

    def test_sha_inventory_wrong_report_extra_duplicate_rejected(self):
        for mutation in ('wrong-report', 'extra', 'duplicate'):
            with self.subTest(mutation=mutation):
                raw = self.base / mutation; raw.mkdir(); simple_report(raw)
                sums = (raw / 'SHA256SUMS').read_text()
                if mutation == 'wrong-report':
                    lines = sums.splitlines(); lines[-1] = '0' * 64 + '  report.json'; sums = '\n'.join(lines) + '\n'
                elif mutation == 'extra':
                    sums += '0' * 64 + '  extra.json\n'
                else:
                    sums += sums.splitlines()[0] + '\n'
                put(raw, 'SHA256SUMS', sums.encode())
                self.assert_rejected(lambda: M.evidence_inventory(raw))

    def test_private_content_negative_group(self):
        for text in ('{"privateKey":"x"}', '{"private_key":"x"}', '{"mnemonic":"x"}', '{"raw":"0x1234"}', '{"signedTransaction":"x"}', '-----BEGIN PRIVATE KEY-----'):
            with self.subTest(text=text):
                self.assert_rejected(lambda: M.scan_shareable('safe.txt', text.encode()))

    def test_raw_signed_transaction_scanner(self):
        # Tiny structurally signed type-2 RLP, containing no valid real signature.
        def rlp(value):
            if isinstance(value, list):
                data = b''.join(rlp(x) for x in value)
                return bytes([0xc0 + len(data)]) + data if len(data) < 56 else b'\xf8' + bytes([len(data)]) + data
            return bytes([0x80 + len(value)]) + value
        raw = '0x02' + rlp([b''] * 9 + [b'', b'\x01' * 32, b'\x02' * 32]).hex()
        self.assertTrue(M.is_signed_transaction(raw))
        self.assert_rejected(lambda: M.scan_shareable('leak.txt', raw.encode()), 'Raw signed transaction')
        self.assertFalse(M.is_signed_transaction('0x' + '60' * 100))

    def test_failure_report_stays_failure_when_shared(self):
        raw = self.base / 'raw'; raw.mkdir(); report = simple_report(raw)
        report.update(status='FAIL', failures=[{'message': 'synthetic failure'}]); seal(raw, report)
        copied, _ = M.publish_allowlist(raw, self.base / 'shareable')
        self.assertEqual(copied['status'], 'FAIL')
        self.assertFalse(copied['acceptanceComplete'])

    def test_operational_scope_upgrade_rejected(self):
        for key in ('acceptanceComplete', 'nativeCLIQualified'):
            with self.subTest(key=key):
                raw = self.base / key; raw.mkdir(); report = simple_report(raw)
                report[key] = True; seal(raw, report)
                self.assert_rejected(lambda: M.evidence_inventory(raw), 'scope changed')

    def test_environment_allowlist_discards_provider_secret_node_git(self):
        with patch.dict(os.environ, {'PATH': '/evil', 'HOME': '/evil', 'NODE_OPTIONS': '--require /evil', 'NODE_TLS_REJECT_UNAUTHORIZED': '0', 'HTTPS_PROXY': 'https://evil', 'MANAGER_READ_RPC_URL': 'https://evil', 'AWS_SECRET_ACCESS_KEY': 'secret', 'GIT_DIR': '/evil', 'GIT_CONFIG_COUNT': '3'}, clear=False):
            env = M.child_environment(Path('/trusted/bin/node'), self.base)
        for key in ('NODE_OPTIONS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'HTTPS_PROXY', 'MANAGER_READ_RPC_URL', 'AWS_SECRET_ACCESS_KEY', 'GIT_DIR', 'GIT_CONFIG_COUNT'):
            self.assertNotIn(key, env)
        self.assertNotIn('/evil', env['PATH']); self.assertEqual(env['GIT_ALLOW_PROTOCOL'], '')
        self.assertEqual(env['GIT_NO_LAZY_FETCH'], '1')

    def test_fresh_output_rejects_reuse_and_overlap(self):
        source = self.base / 'source'; source.mkdir()
        for path in (source / 'output', source, self.base):
            with self.subTest(path=str(path)):
                self.assert_rejected(lambda: M.fresh_output(str(path), [source]))
        fresh = M.fresh_output(str(self.base / 'external'), [source])
        self.assertTrue(fresh.is_dir())
        self.assert_rejected(lambda: M.fresh_output(str(fresh), [source]))

    def test_mocked_report_positive_wiring_only(self):
        raw, source, runner, node, report, expected = complete_fixture(self.base)
        summary = M.validate_report(raw, 'marker', expected, source, runner, node, 'synthetic')
        self.assertEqual(summary['counts']['positiveCoreReceipts'], 9)

    def test_mocked_report_identity_case_child_negative_groups(self):
        changes = {
            'same-tree-local25379': lambda r: r['source'].update(commit='25379ef1b0f484fea6bf559bf4a0b41e43a2e699'),
            'wrong-tree': lambda r: r['source'].update(tree='0' * 40),
            'wrong-parents': lambda r: r.update(parents=['0' * 40]),
            'wrong-harness': lambda r: r.update(harnessFiles={'changed': '0' * 64}),
            'wrong-count': lambda r: r['counts'].update(commands=99),
            'numeric-boolean-count': lambda r: r['counts'].update(failed=False),
            'missing-case': lambda r: r.update(cases=[]),
            'skipped-case': lambda r: r['cases'][0].update(status='SKIP'),
            'failed-case': lambda r: r['cases'][0].update(status='FAIL'),
            'child-crash': lambda r: r['commands'][0].update(exitCode=-9),
            'child-timeout': lambda r: r['commands'][0].update(timedOut=True),
            'child-oversized': lambda r: r['commands'][0].update(oversized=True),
            'child-signal': lambda r: r['commands'][0].update(signal='SIGKILL'),
            'provider': lambda r: r['transport'].update(readEndpoint='https://example.org/'),
            'tls-bypass': lambda r: r['transport'].update(normalTlsVerification=False),
            'gas-bypass': lambda r: r['chain'].update(coverageBypass=True),
            'changed-compiler': lambda r: r['build'].update(inputSha256='0' * 64),
            'changed-limits': lambda r: r['limitations'].update(actualWalletQualified=True),
            'wrong-envelope': lambda r: r['operations'][0]['envelope'].update(to='0x' + '1' * 40),
            'wrong-creator': lambda r: r['operations'][0].update(recoveredCreator='0x' + '1' * 40),
            'duplicate-receipt': lambda r: r['operations'][1].update(transactionHash=r['operations'][0]['transactionHash']),
            'wrong-proof': lambda r: r['operations'][0]['proof'].update(transactionHash='0x' + '1' * 64),
            'wrong-trace': lambda r: r['operations'][0]['traceEvidence'].update(traceSha256='0' * 64),
            'trace-scope-upgrade': lambda r: r['operations'][0]['traceEvidence'].update(traceCompletenessIndependentlyEstablished=True),
            'signing-hash-drift': lambda r: r['commands'][1].update(rawSha256='0' * 64),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                base = self.base / name; base.mkdir()
                raw, source, runner, node, report, expected = complete_fixture(base)
                change(report); seal(raw, report)
                self.assert_rejected(lambda: M.validate_report(raw, 'marker', expected, source, runner, node, 'synthetic'))

    def test_artifact_mutation_after_report_rejected(self):
        raw, source, runner, node, report, expected = complete_fixture(self.base)
        put(source, 'hardhat/artifacts/artifact-0.json', {'changed': True})
        self.assert_rejected(lambda: M.validate_report(raw, 'marker', expected, source, runner, node, 'synthetic'), 'Artifact bytes')

    def test_missing_proof_membership_rejected(self):
        raw, source, runner, node, report, expected = complete_fixture(self.base)
        put(raw, 'outputs/receipt-proofs.json', {'proofs': []}); seal(raw, report)
        self.assert_rejected(lambda: M.validate_report(raw, 'marker', expected, source, runner, node, 'synthetic'), 'native proof')

    def test_archived_catalog_identity_expected_in_frozen_config(self):
        config = json.loads((HARNESS / 'config/d371-campaign-expectations.json').read_text())
        full = config['campaigns']['full']
        self.assertEqual(full['historicalCatalog']['source']['commit'], M.LEGACY)
        self.assertEqual(full['historicalCatalog']['source']['tree'], M.LEGACY_TREE)
        self.assertEqual(full['historicalCatalog']['constructorArguments'], 6)
        self.assertEqual(full['counts'], {'cases': 96, 'passed': 96, 'failed': 0, 'commands': 355, 'positiveCoreReceipts': 18})
        self.assertEqual(config['campaigns']['marker']['counts'], {'cases': 30, 'passed': 30, 'failed': 0, 'commands': 118, 'positiveCoreReceipts': 9})

    def test_cli_rejects_unknown_profile_identity_override_and_duplicates(self):
        for argv in (['--profile', 'legacy-v114'], ['--expected-commit', '0' * 40], ['--source-root', '/x', '--source-root', '/y']):
            with self.subTest(argv=argv), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    M.parse_args(argv)

    def test_real_small_git_observer_rejects_commit_parent_dirty_mode_flags(self):
        root = self.base / 'git'; root.mkdir()
        env = M.child_environment(Path('/usr/bin/node'), self.base)
        env.update(GIT_AUTHOR_NAME='Synthetic fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid', GIT_COMMITTER_NAME='Synthetic fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid')
        def git(*args):
            return subprocess.check_output(['/usr/bin/git', *args], cwd=root, env=env, stderr=subprocess.DEVNULL).decode().strip()
        git('init'); put(root, 'file.txt', b'fixture\n'); git('add', 'file.txt'); git('commit', '-m', 'Synthetic boundary fixture')
        commit = git('rev-parse', 'HEAD'); tree = git('rev-parse', 'HEAD^{tree}')
        self.assertEqual(M.observe_git(root, env, commit, tree, [])['commit'], commit)
        self.assert_rejected(lambda: M.observe_git(root, env, '1' * 40), 'HEAD mismatch')
        self.assert_rejected(lambda: M.observe_git(root, env, commit, '1' * 40), 'tree mismatch')
        self.assert_rejected(lambda: M.observe_git(root, env, commit, tree, ['1' * 40]), 'parent mismatch')
        put(root, 'file.txt', b'changed\n'); self.assert_rejected(lambda: M.observe_git(root, env, commit), 'Tracked bytes')
        put(root, 'file.txt', b'fixture\n'); (root / 'file.txt').chmod(0o755)
        self.assert_rejected(lambda: M.observe_git(root, env, commit), 'mode changed')
        (root / 'file.txt').chmod(0o644); git('update-index', '--assume-unchanged', 'file.txt')
        self.assert_rejected(lambda: M.observe_git(root, env, commit), 'Hidden index')
        git('update-index', '--no-assume-unchanged', 'file.txt'); put(root, 'untracked', b'x')
        self.assert_rejected(lambda: M.observe_git(root, env, commit), 'Untracked')

    def test_external_pins_file_and_runner_mutation_rejected(self):
        files = {}
        for path in HARNESS.rglob('*'):
            if path.is_file() and not path.is_symlink() and '.git' not in path.parts and path.suffix != '.pyc':
                files[path.relative_to(HARNESS).as_posix()] = M.sha(path.read_bytes())
        pins_path = put(self.base, 'pins.json', {'schema': 'agijobmanager/native-harness-pins/v1', 'files': files})
        digest = M.sha(pins_path.read_bytes())
        verified, expected = M.verify_pins(HARNESS, pins_path, digest)
        self.assertEqual(verified, files)
        self.assertEqual(set(expected), {'full', 'marker'})
        self.assert_rejected(lambda: M.verify_pins(HARNESS, pins_path, '0' * 64), 'digest mismatch')
        for label, change in (
            ('runner', lambda x: x.update({'runners/full/scripts/qualification/core-session-native.mjs': '0' * 64})),
            ('missing-wrapper', lambda x: x.pop('scripts/qualification/run-native-campaigns.py'))):
            with self.subTest(label=label):
                broken = copy.deepcopy(files); change(broken)
                path = put(self.base, label + '.json', {'schema': 'agijobmanager/native-harness-pins/v1', 'files': broken})
                self.assert_rejected(lambda: M.verify_pins(HARNESS, path, M.sha(path.read_bytes())))

    def test_mocked_selector_receipt_negative_groups(self):
        baseline = {'profile': M.PROFILE, 'status': 'CLEAN_SOURCE_BOUNDARIES_PASSED', 'releaseQualified': False,
            'mode': 'bound', 'sourceCommit': M.TARGET, 'sourceTree': M.TREE, 'compilerSourceUnits': 91,
            'manifestSha256': '7aced0aee4c2161f92fa507809a5084d0a7ab13e52ead31d95c916ee00f2e973', 'localUnqualifiedMounts': []}
        variants = [('positive-wiring', None, None), ('staged', 'mode', 'staged'), ('wrong-source', 'sourceCommit', '1' * 40),
            ('wrong-tree', 'sourceTree', '1' * 40), ('unqualified-mount', 'localUnqualifiedMounts', ['source-probe']),
            ('missing-compiler-unit', 'compilerSourceUnits', 90), ('wrong-manifest', 'manifestSha256', '0' * 64),
            ('release-upgrade', 'releaseQualified', True), ('numeric-false', 'releaseQualified', 0)]
        for label, key, value in variants:
            with self.subTest(label=label):
                receipt = copy.deepcopy(baseline)
                if key:
                    receipt[key] = value
                def mock_launcher(command, cwd, env, log_base, timeout):
                    self.assertIn('--mode', command); self.assertIn('bound', command)
                    put(log_base.parent, log_base.name + '.stdout.raw.log', receipt)
                    return {'exitCode': 0, 'timedOut': False}
                if key:
                    self.assert_rejected(lambda: M.source_gate(self.base, HARNESS, {}, self.base, label, mock_launcher))
                else:
                    observed = M.source_gate(self.base, HARNESS, {}, self.base, label, mock_launcher)
                    self.assertEqual(observed['receipt'], receipt)
                    self.assertEqual(observed['label'], label)

    def test_success_summary_links_copied_reports_and_false_scope(self):
        output = self.base / 'output'; (output / 'shareable').mkdir(parents=True)
        campaigns = []
        for suite in ('full', 'marker'):
            raw = put(output / 'shareable', suite + '/report.json', {'synthetic': suite, 'acceptanceComplete': False, 'nativeCLIQualified': False})
            campaigns.append({'suite': suite, 'process': {'exitCode': 0, 'timedOut': False},
                'verified': {'suite': suite, 'reportSha256': M.sha(raw.read_bytes()), 'counts': {'synthetic': True}}})
        summary = {'schema': 'synthetic-wiring-only', 'status': 'PASS_FINITE_FUNCTIONAL_CAMPAIGNS', 'scope': M.SCOPE,
            'source': {'commit': M.TARGET}, 'harness': {'commit': '1' * 40, 'tree': '2' * 40, 'parents': []},
            'harnessPinsSha256': 'a' * 64, 'nodeExecutableSha256': 'b' * 64, 'acceptanceComplete': False, 'nativeCLIQualified': False,
            'functionalCampaignsComplete': True, 'configurationAuthorized': False, 'activationAuthorized': False,
            'claimsExcluded': ['SYNTHETIC TEST ONLY'], 'sourceGates': [], 'campaigns': campaigns}
        result = M.publish_success_summary(output, summary, {'synthetic-file': 'c' * 64})
        self.assertEqual([c['report'] for c in result['campaigns']], ['full/report.json', 'marker/report.json'])
        self.assertFalse(result['acceptanceComplete']); self.assertFalse(result['nativeCLIQualified'])
        data = (output / 'shareable/campaign-summary.json').read_bytes()
        self.assertEqual((output / 'shareable/campaign-summary.SHA256SUMS').read_text(), M.sha(data) + '  campaign-summary.json\n')
        campaigns[0]['verified']['reportSha256'] = '0' * 64
        self.assert_rejected(lambda: M.publish_success_summary(output, summary, {}), 'bind published')

    def test_launcher_preserves_complete_logs_and_timeout(self):
        env = M.child_environment(Path(sys.executable), self.base)
        result = M.launch([sys.executable, '-I', '-c', 'print("synthetic stdout");import sys;sys.stderr.write("synthetic stderr\\n")'], self.base, env, self.base / 'completed', 5)
        self.assertEqual(result['exitCode'], 0)
        self.assertEqual((self.base / 'completed.stdout.raw.log').read_bytes(), b'synthetic stdout\n')
        self.assertEqual((self.base / 'completed.stderr.raw.log').read_bytes(), b'synthetic stderr\n')
        result = M.launch([sys.executable, '-I', '-c', 'import time;time.sleep(30)'], self.base, env, self.base / 'timed', 0.02)
        self.assertTrue(result['timedOut']); self.assertLess(result['exitCode'], 0)

    def test_mocked_orchestration_stops_first_failure_and_keeps_false_flags(self):
        source = self.base / 'source'; source.mkdir()
        legacy = self.base / 'legacy'; legacy.mkdir()
        artifacts = legacy / 'artifacts'; artifacts.mkdir()
        node = put(self.base, 'node', b'synthetic, never launched')
        pins = put(self.base, 'pins.json', {})
        args = SimpleNamespace(source_root=str(source), legacy_source_root=str(legacy), legacy_artifacts_root=str(artifacts),
            node=str(node), pins=str(pins), pins_sha256='a' * 64, output=str(self.base / 'out'), build_id='synthetic',
            expected_harness_commit='1' * 40, timeout_seconds=60)
        calls = []
        def mock_launcher(command, cwd, env, log_base, timeout):
            calls.append(command)
            put(log_base.parent, log_base.name + '.stdout.raw.log', b'synthetic failure\n')
            put(log_base.parent, log_base.name + '.stderr.raw.log', b'not published\n')
            return {'exitCode': 1, 'timedOut': False}
        with patch.object(M, 'verify_pins', return_value=({}, {'full': {}, 'marker': {}})), patch.object(M, 'observe_git', return_value={'commit': '1' * 40}), patch.object(M, 'source_gate', return_value={'synthetic': True}), patch.object(M.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'v22.23.2\n', stderr=b'')), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(M.run(args, launcher=mock_launcher), 1)
        self.assertEqual(len(calls), 1)
        self.assertIn('--max-old-space-size=384', calls[0])
        self.assertEqual(calls[0][calls[0].index('--suite') + 1], 'full')
        self.assertIn(M.LEGACY, calls[0]); self.assertIn(M.TARGET, calls[0])
        summary = json.loads((self.base / 'out/campaign-summary.json').read_text())
        self.assertFalse(summary['acceptanceComplete']); self.assertFalse(summary['nativeCLIQualified']); self.assertFalse(summary['functionalCampaignsComplete'])
        self.assertTrue((self.base / 'out/INCOMPLETE').exists())
        diag = json.loads((self.base / 'out/shareable/failure-diagnostics.json').read_text())
        self.assertEqual(len(diag['localLauncherLogSha256']), 2)
        self.assertNotIn('not published', json.dumps(diag))


if __name__ == '__main__':
    print('SYNTHETIC/MOCK WRAPPER BOUNDARIES ONLY. No actual-c2 native qualification claim.')
    unittest.main(verbosity=2)
