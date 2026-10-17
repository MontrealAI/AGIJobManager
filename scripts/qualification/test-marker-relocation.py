#!/usr/bin/env python3
"""Relocate the external marker helper test with the former scratch root unreadable.

Node's per-process read permission is narrowed for this test only. No host
permissions are changed and no dependencies are installed. This is not an EVM
campaign or a substitute for actual-c2 source binding.
"""
import argparse
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
OLD = '/tmp/manager-combined-r5-20261016/package.json'
NODE = SOURCE = None
TEST = 'hardhat/test/marker-native-evidence.test.cjs'


class MarkerRelocation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='marker-portable-fixture-')
        cls.fixture = pathlib.Path(cls.temp.name).resolve()
        for name in (TEST, 'scripts/qualification/marker-native-evidence.mjs',
                     'scripts/qualification/core-session-native.mjs'):
            target = cls.fixture / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / 'runners/marker' / name, target)
        cls.env = {'PATH': str(NODE.parent) + ':/usr/bin:/bin', 'HOME': str(cls.fixture),
                   'LANG': 'C.UTF-8', 'MANAGER_QUALIFICATION_SOURCE_ROOT': str(SOURCE)}
        # A retained local test install may symlink individual dependencies.
        # Permit only the observed ethers installation's node_modules directory;
        # the hosted exact checkout normally resolves to its own node_modules.
        modules = (SOURCE / 'node_modules/ethers').resolve().parent
        assert modules.name == 'node_modules' and (modules / 'ethers/package.json').is_file()
        cls.permissions = ['--permission', '--allow-fs-read=' + str(cls.fixture),
                           '--allow-fs-read=' + str(SOURCE),
                           '--allow-fs-read=' + str(modules)]
        # The former dependency root must not be inside any permitted directory.
        old = pathlib.Path(OLD)
        for permitted in (cls.fixture, SOURCE, modules):
            assert not old.is_relative_to(permitted)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_node(self, arguments, env=None):
        return subprocess.run([str(NODE), '--max-old-space-size=384', *self.permissions, *arguments],
            cwd=self.fixture, env=self.env if env is None else env,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, timeout=30)

    def test_01_former_dependency_root_is_actually_unreadable_in_child(self):
        probe = "const fs=require('node:fs'),a=require('node:assert/strict');a.throws(()=>fs.readFileSync(" + repr(OLD) + "),e=>e.code==='ERR_ACCESS_DENIED');console.log('OLD_SCRATCH_ROOT_UNREADABLE');"
        result = self.run_node(['-e', probe])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('OLD_SCRATCH_ROOT_UNREADABLE', result.stdout)

    def test_02_original_dependency_lookup_fails_in_same_child_boundary(self):
        probe = "require('node:module').createRequire(" + repr(OLD) + ")('ethers')"
        result = self.run_node(['-e', probe])
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue('ERR_ACCESS_DENIED' in result.stderr or 'MODULE_NOT_FOUND' in result.stderr)

    def test_03_all_nine_relocated_helper_cases_pass_without_old_root(self):
        result = self.run_node([str(self.fixture / TEST)])
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        for expected in ('# tests 9\n', '# pass 9\n', '# fail 0\n', '# skipped 0\n'):
            self.assertIn(expected, result.stdout)

    def test_04_omitted_explicit_dependency_root_has_no_fallback(self):
        env = dict(self.env); del env['MANAGER_QUALIFICATION_SOURCE_ROOT']
        result = self.run_node([str(self.fixture / TEST)], env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Set the absolute qualification source root', result.stderr)

    def test_05_noncanonical_source_alias_is_rejected(self):
        alias = self.fixture / 'source-alias'; alias.symlink_to(SOURCE, target_is_directory=True)
        env = dict(self.env); env['MANAGER_QUALIFICATION_SOURCE_ROOT'] = str(alias)
        result = self.run_node([str(self.fixture / TEST)], env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Use the canonical qualification source root', result.stderr)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument('--node', required=True)
    parser.add_argument('--source-root', required=True)
    args, rest = parser.parse_known_args()
    NODE, SOURCE = pathlib.Path(args.node), pathlib.Path(args.source_root)
    assert NODE.is_absolute() and NODE == NODE.resolve() and NODE.is_file()
    assert SOURCE.is_absolute() and SOURCE == SOURCE.resolve() and SOURCE.is_dir()
    assert (SOURCE / 'package.json').is_file() and (SOURCE / 'node_modules').is_dir()
    unittest.main(argv=[__file__, *rest])
