"""Finite v1.19.6 dependency maintenance; exact-source qualification is separate."""
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

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILE = 'manager-dependency-maintenance-v1'
VERSION = '1.19.6'
BASE_COMMIT = '4d4c32685eebf23b0aa35dbb45abe23ac8a261cb'
BASE_TREE = '3676cb41be9c5c5110cc266e0ff6f7c20bfbec86'
MANIFEST = 'config/manager-dependency-maintenance-v1.json'
BASELINE = 'config/manager-dependency-maintenance-baseline-v1.json'
VERIFIER = 'scripts/release/maintenance-profile.py'
BASELINE_SHA256 = 'b504618477206dcbea90ca8f0db4726210aa9cf87fe193795e1795f48326e456'
# These are exact reviewed files/digests, never directory or pattern exceptions.
MODIFIED = {'.github/workflows/current-state-release.yml': '811a69cbe4d63ab7fa807ac286dd4ecc19251e1525a29d3939b6cc0b4746ebbb',
 '.github/workflows/mainnet-fork.yml': '444ee4ae1d1090d69f327b98fa0d549f3d0f21fc692c514a883aca890ffd754a',
 '.github/workflows/pages.yml': 'bb9c46fe84ed42365834db094bc7064a137b48d19100b02157367d186d9e39b8',
 '.github/workflows/publish-v114.yml': 'cd634de8605033fb378073c78e7ea3abeb99f8c1594a45b9af29cc9fcde802a6',
 'README.md': '46387078ae9b4cad8c929e03cddf73c48f3acab9cb2900bf5ca393328ea9d68b',
 'agijobmanager.html': 'ef9269b71e8af047b7f5ebe9b70b4b2b34f88aff89692e805dc6ee177e212979',
 'config/companion-releases.json': '73bd57527908a457c29ebac54038c1a989b862f10731d8f463d1ed3643f1245b',
 'config/usdc-deployment.json': 'f306a0665e7741d8a6a301264dda1dad800ba29f83f0c87e1471b674e29a03a4',
 'docs/MAINNET_READINESS.md': 'ffe0764ef89e296302424039a89a2cdf2ab0ca6f226b8ec53c493086aec18f9a',
 'docs/OPERATIONS/PRIVATE_FLEET.md': 'd486515ee52ab9d07664c35964cc814817297f1a6127adfb1886b8c5658d4759',
 'docs/REFERENCE/VERSIONS.md': 'f0a4f6d21704459da73c6ab2889375d29e01949a08fb2435fcefe3754d3b6bf1',
 'docs/RELEASE_GUIDE.md': 'd8aace22bab7abeee888ff44db25d9746fed318354e6057becb6ab6b19cd2a4f',
 'docs/START_HERE.md': '5fcd220a20d45193fba79dc0a9b7df1ab30804f0a9e725b7f0f7e9eaf983f32c',
 'docs/V1_RELEASE_SCOPE.md': '5328f3aa663cef90e3339aa38ba6ee0a0e38e516d06ac69009ff3943f67cbc54',
 'docs/ui/DEPLOYMENT_MAINNET.md': 'e15507c07b197e0aafb423929d97a6afd05fdfb3f6c9cef92b585115ff6aa87a',
 'docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md': '29a4a44c588ff8c7566f20eac7a2553d372d3ac18a8de5701a019da6384d244d',
 'hardhat/package-lock.json': '15efa1c467c5c222186fc626b10a756cf6e54c5a50ca87a893349dd2b6055475',
 'hardhat/package.json': '45176599865ef1c625714e5929b60ab62c4d8a2e8731282a57526f3ee4a61b17',
 'package-lock.json': '6ccc35925c6019431e987b71e7b09ee08e23eaa16af32d62fb08c9088066682e',
 'package.json': '46c9136b7fe45bae4253ea9ddb1800429c6cd9ffaafc02c44d0bdcec326310ea',
 'scripts/docs/templates/README.md.tpl': '3c95d656134ba9267cd3cb1747ce448a118bae30d0f6c8b7e236a72dafa0018c',
 'scripts/docs/templates/V1_RELEASE_SCOPE.md.tpl': '4fbea937c03558ac8c44782c6be89b6c30a751cef82edcc36c21cc9d156c3fd1',
 'scripts/release/collect-qualification.py': 'dbaa6d1d5f0328e38c5160fe810f5b90236959cf8ab4300b0cf499e1ef00db0b',
 'scripts/release/package-policy.py': '75639e987aca2b84399763b71b8814eed832bc99778dc3368c5cfc4bdad2f7e8',
 'scripts/release/publish-release.py': '9574531a96193cf6740a289c12594430740bf5b86a022ee99f234fa1ddbcb4d1',
 'scripts/release/verify-package.py': '5d2dda6df18e85af68a052db1620907a8b9b995d032a860ad46178d06cca6c19',
 'scripts/security/verify-slither-review.py': '5bb9d061a9e58ce33a07d33ed91188a574773e1a98c1bbee6ee5303e245fe2fb',
 'ui/README.md': '78816005ac878b9b0c73def3c2bf8711d38130fafe2ef6a3cb23b5c66db4fb1d',
 'ui/agijobmanager-usdc.html': 'f6bde452b9b432849475d9e97c9445c48a465bf246a99d0995bd93e6eb690727',
 'ui/dist-ipfs/agijobmanager.html': 'ef9269b71e8af047b7f5ebe9b70b4b2b34f88aff89692e805dc6ee177e212979',
 'ui/package-lock.json': '650c834edc6d0b5fdcfd2c9e3c8ab54bdc7beb9afef65dd8ef38f4d0850b8c2a',
 'ui/package.json': 'd863a5d84ffb914f3eea0812f39d939de988bc0ca67fb6631b91aa4d2768410b',
 'ui/scripts/singlefile-template.html': 'b9248ceaeaee112cf3b3add20ac1c416d7eb6afd13e250d2d8bf365624db719f',
 'ui/src/generated/deployments.ts': '79380e05c8228d47455f36de7b96f53ffdb5c9c7479fcd308cfd26d8732d36b9'}
ADDITIONS = {'docs/qualification/mainnet-cutover-v1.19.6-expected.json': '801abf1a278b91ceab8e69dcf5e3f927c31aea30137d09386924cae693869966',
 'docs/qualification/release-v1.19.6-provenance.json': '3f526bc1521e04d3fac1745f84e58fc60417a5821a59134aead36fd0178a3224',
 'docs/releases/v1.19.6/RECOVERY_GUIDE.md': '3c8d20637557a5cab6fb81024865246d36f5121f5e0f448601157d84e12f6185',
 'docs/releases/v1.19.6/RELEASE_NOTES.md': 'e3699f104bd1d9bb693cf04cdf19b5627e8fc523bb8eb648203024d9ad17edc0',
 'docs/releases/v1.19.6/START_HERE.md': '6d38c71a06b3cbc5a325bdb89c5b95da7d71b2da5ab35d6cafd239a07d6fc0c0',
 'docs/releases/v1.19.6/VALIDATION.md': '68e39ca852f37d6278a3b7edc5ce8867cbfe8e45437db0986013ef0fa7dab9f1',
 'scripts/release/maintenance-qualification.py': '29198ae6cc626cfeb9f0d66f6d5dc7a578848c017198f48f701988aefb9c8c2f',
 'scripts/release/pages-publication-maintenance.py': '61ec8c5ea9ef738dac3fe7acd7b0c972ea3877cc238541417c100771521e2e25',
 'scripts/release/run-maintenance-inherited-tests.py': '5d1477f43102b739c6c09fcbe895002d36a521b59a2eb4ae7e61ec31176eeec4',
 'scripts/release/run-maintenance-preservation.py': 'bc3780dba7bbfe224c88ee7779cadb0d32ee119c1bec60335907c2a03c0582d1',
 'scripts/release/test-maintenance-plumbing.py': '11d173f7aa44520f1d09dc3d7a490927f9ed2bcc427746cc10bb92e17124e337',
 'scripts/release/test-maintenance-profile.py': '1d871e191888dd5cc567738e23e12eedc34c09d8bf9ac94b9fe11e75b99a4e17',
 'scripts/release/test-maintenance-qualification.py': '07f8ec422cb6b74870c2c319f88279256efd67c7fda3f72e796b603cd21d7fae',
 'scripts/release/test-pages-publication-maintenance.py': '4a3371fcf80a681c69fb35221f04ba34545d86e7716b5b906d18d78ef57c035d',
 'scripts/security/slither-reviewed-findings-v1.19.6.json': '5728f37e6bc3ee9b86f47f955404cc5ccda90e27401972d5c2aa6c283e3992cb'}
# Fixed character edits must reconstruct the authenticated old selector/workflow bytes.
PROJECTIONS = {'.github/workflows/current-state-release.yml': [[1318, '', 'dependency-main'],
                                                 [1319, 'r', 'en'],
                                                 [1322, 'sformational', 'ce'],
                                                 [1411, '', 'main'],
                                                 [1412, 'r', 'en'],
                                                 [1415, 'sformational', 'ce'],
                                                 [1490, '', 'main'],
                                                 [1491, 'r', 'en'],
                                                 [1494, 'sformational', 'ce'],
                                                 [1660,
                                                  '',
                                                  '\n'
                                                  '      - name: Run root and Hardhat audits at low '
                                                  'threshold\n'
                                                  '        run: |\n'
                                                  '          npm audit --audit-level=low\n'
                                                  '          npm --prefix hardhat audit --audit-level=low'],
                                                 [2312,
                                                  'test-dependency-boundaries.py\n'
                                                  '          python3 scripts/release/',
                                                  ''],
                                                 [2379, '', '-maintenance'],
                                                 [2389, '-source', ''],
                                                 [2450,
                                                  '\n'
                                                  '          python3 '
                                                  'scripts/release/run-inherited-release-tests.py',
                                                  ''],
                                                 [2642, '', 'main'],
                                                 [2643, 'r', 'en'],
                                                 [2646, 'sformational', 'ce'],
                                                 [2666,
                                                  '',
                                                  '.py\n'
                                                  '          python3 '
                                                  'scripts/release/test-maintenance-qualification'],
                                                 [2871, '', 'main'],
                                                 [2872, 'i', 'enance'],
                                                 [2911, 'run-transformational-inherited-', ''],
                                                 [2946, 's', '-maintenance-plumbing'],
                                                 [3907, '', 'dependency-main'],
                                                 [3908, 'r', 'en'],
                                                 [3911, 'sformational', 'ce'],
                                                 [4052, '', 'dependency-main'],
                                                 [4053, 'r', 'en'],
                                                 [4056, 'sformational', 'ce'],
                                                 [4701, '', 'dependency-main'],
                                                 [4702, 'r', 'en'],
                                                 [4705, 'sformational', 'ce'],
                                                 [4747, '', 'dependency-main'],
                                                 [4748, 'r', 'en'],
                                                 [4751, 'sformational', 'ce']],
 '.github/workflows/mainnet-fork.yml': [[1806, '5', '6']],
 '.github/workflows/pages.yml': [[2564, '', 'main'],
                                 [2565, 'i', 'enance'],
                                 [3424, '', 'main'],
                                 [3425, 'r', 'en'],
                                 [3428, 'sformational', 'ce']],
 '.github/workflows/publish-v114.yml': [[163, '5', '6'],
                                        [345, '5', '6'],
                                        [517, '5', '6'],
                                        [1856, '5', '6'],
                                        [1876, '', 'dependency-main'],
                                        [1877, 'r', 'en'],
                                        [1880, 'sformational', 'ce'],
                                        [1922, '', 'dependency-main'],
                                        [1923, 'r', 'en'],
                                        [1926, 'sformational', 'ce'],
                                        [1993, '', 'dependency-main'],
                                        [1994, 'r', 'en'],
                                        [1997, 'sformational', 'ce'],
                                        [2083, '', 'main'],
                                        [2084, 'r', 'en'],
                                        [2087, 'sformational', 'ce'],
                                        [2315, '5', '6'],
                                        [2347, '', 'dependency-main'],
                                        [2348, 'r', 'en'],
                                        [2351, 'sformational', 'ce'],
                                        [2393, '', 'dependency-main'],
                                        [2394, 'r', 'en'],
                                        [2397, 'sformational', 'ce'],
                                        [2464, '', 'dependency-main'],
                                        [2465, 'r', 'en'],
                                        [2468, 'sformational', 'ce'],
                                        [2554, '', 'main'],
                                        [2555, 'r', 'en'],
                                        [2558, 'sformational', 'ce'],
                                        [2836, '5', '6'],
                                        [3087, '5', '6'],
                                        [3649, '5', '6'],
                                        [3699, '5', '6'],
                                        [3729, '', 'dependency-main'],
                                        [3730, 'r', 'en'],
                                        [3733, 'sformational', 'ce'],
                                        [3775, '', 'dependency-main'],
                                        [3776, 'r', 'en'],
                                        [3779, 'sformational', 'ce'],
                                        [3846, '', 'dependency-main'],
                                        [3847, 'r', 'en'],
                                        [3850, 'sformational', 'ce'],
                                        [3936, '', 'main'],
                                        [3937, 'r', 'en'],
                                        [3940, 'sformational', 'ce']],
 'scripts/release/collect-qualification.py': [[1884, '==', 'in'],
                                              [1887, '', '('],
                                              [1916, '', ", 'manager-dependency-maintenance-v1')"],
                                              [3545, '==', 'in'],
                                              [3548, '', '('],
                                              [3577, '', ", 'manager-dependency-maintenance-v1')"],
                                              [3692,
                                               '',
                                               "-qualification.py')))['validate'](config, api, lambda job: "
                                               "gh('api', f'repos/{REPOSITORY}/actions/jobs/{job}/logs', "
                                               "'--method', 'GET', '--allow-escape-sequences'))\n"
                                               "if source_policy and source_policy.get('releaseProfile') == "
                                               "'manager-dependency-maintenance-v1':\n"
                                               "    config['maintenanceQualification'] = "
                                               "runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance"]],
 'scripts/release/package-policy.py': [[414,
                                        '',
                                        "MAINTENANCE_PROFILE = 'manager-dependency-maintenance-v1'\n"],
                                       [493,
                                        '',
                                        "-profile.py'))\n"
                                        '\n'
                                        'def maintenance():\n'
                                        "    return runpy.run_path(str(BASE / 'maintenance"],
                                       [781, '', ', MAINTENANCE_PROFILE'],
                                       [1003, '', 'maintenance() if profile == MAINTENANCE_PROFILE else '],
                                       [1237,
                                        '',
                                        ' maintenance() if selection is not None and '
                                        "selection.get('releaseProfile') == MAINTENANCE_PROFILE else"]],
 'scripts/release/publish-release.py': [[8144, '==', 'in'],
                                        [8147, '', '('],
                                        [8176, '', ", 'manager-dependency-maintenance-v1')"],
                                        [8525,
                                         '',
                                         " qualification binding differs')\n"
                                         "if source_policy and source_policy.get('releaseProfile') == "
                                         "'manager-dependency-maintenance-v1':\n"
                                         '    maintenance = '
                                         "runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance-qualification.py')))\n"
                                         "    require(config.get('maintenanceQualification') == "
                                         "maintenance['validate'](config, api, lambda job: gh('api', "
                                         "f'repos/{repo}/actions/jobs/{job}/logs', '--method', 'GET', "
                                         "'--allow-escape-sequences')), 'Maintenance"],
                                        [10549, '==', 'in'],
                                        [10552, '', '('],
                                        [10581, '', ", 'manager-dependency-maintenance-v1')"],
                                        [14734, '==', 'in'],
                                        [14737, '', '('],
                                        [14766, '', ", 'manager-dependency-maintenance-v1')"],
                                        [15115,
                                         '',
                                         " qualification binding differs')\n"
                                         "if source_policy and source_policy.get('releaseProfile') == "
                                         "'manager-dependency-maintenance-v1':\n"
                                         '    maintenance = '
                                         "runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance-qualification.py')))\n"
                                         "    require(config.get('maintenanceQualification') == "
                                         "maintenance['validate'](config, api, lambda job: gh('api', "
                                         "f'repos/{repo}/actions/jobs/{job}/logs', '--method', 'GET', "
                                         "'--allow-escape-sequences')), 'Maintenance"]],
 'scripts/release/verify-package.py': [[2013, '==', 'in'],
                                       [2016, '', '('],
                                       [2045, '', ", 'manager-dependency-maintenance-v1')"],
                                       [2124,
                                        '',
                                        "-qualification.py')))['verify_record'](config)\n"
                                        "    if published and selection and selection.get('releaseProfile') "
                                        "== 'manager-dependency-maintenance-v1':\n"
                                        '        '
                                        "runpy.run_path(str(pathlib.Path(__file__).with_name('maintenance"],
                                       [7074, '==', 'in'],
                                       [7077, '', '('],
                                       [7106, '', ", 'manager-dependency-maintenance-v1')"]],
 'scripts/security/verify-slither-review.py': [[292, '5', '6']]}
PACKAGE_FILES = ('package.json','package-lock.json','hardhat/package.json','hardhat/package-lock.json','ui/package.json','ui/package-lock.json')
REPAIRED_RECORDS = {'package-lock.json': {'node_modules/follow-redirects': {'version': '1.16.1',
                                                         'resolved': 'https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.1.tgz',
                                                         'integrity': 'sha512-FNvFGzoMLWmE6Yj9spb/zjd7yiNCHiAW9/Tg9CXrQ8wuu32HtlJOwWO11OJafl5FfY3DxTdQ0vj42zU1kvv5jg==',
                                                         'dev': True,
                                                         'funding': [{'type': 'individual',
                                                                      'url': 'https://github.com/sponsors/RubenVerborgh'}],
                                                         'license': 'MIT',
                                                         'engines': {'node': '>=4.0'},
                                                         'peerDependenciesMeta': {'debug': {'optional': True}}}},
 'ui/package-lock.json': {'node_modules/follow-redirects': {'version': '1.16.1',
                                                            'resolved': 'https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.1.tgz',
                                                            'integrity': 'sha512-FNvFGzoMLWmE6Yj9spb/zjd7yiNCHiAW9/Tg9CXrQ8wuu32HtlJOwWO11OJafl5FfY3DxTdQ0vj42zU1kvv5jg==',
                                                            'funding': [{'type': 'individual',
                                                                         'url': 'https://github.com/sponsors/RubenVerborgh'}],
                                                            'license': 'MIT',
                                                            'engines': {'node': '>=4.0'},
                                                            'peerDependenciesMeta': {'debug': {'optional': True}}},
                          'node_modules/hono': {'version': '4.13.11',
                                                'resolved': 'https://registry.npmjs.org/hono/-/hono-4.13.11.tgz',
                                                'integrity': 'sha512-/SMX/RQNJn7oNmFwH6DtwDqcrzZU2otm1FD6OJe2cWF6cfy/F8hq0XVBv7xW3FTJshRQwuBnXHDq2kNsdZnshg==',
                                                'license': 'MIT',
                                                'engines': {'node': '>=16.9.0'}},
                          'node_modules/vite': {'version': '7.3.7',
                                                'resolved': 'https://registry.npmjs.org/vite/-/vite-7.3.7.tgz',
                                                'integrity': 'sha512-AHEzTORMbi7/7aXp7w7KZ5+DCUdSeLsJz0grY8xHpc9DHdYb0vQu6DqJfm2tOw3gDExNgPgnJTXxM6syYFHaCA==',
                                                'dev': True,
                                                'license': 'MIT',
                                                'dependencies': {'esbuild': '^0.27.0 || ^0.28.0',
                                                                 'fdir': '^6.5.0',
                                                                 'picomatch': '^4.0.3',
                                                                 'postcss': '^8.5.6',
                                                                 'rollup': '^4.43.0',
                                                                 'tinyglobby': '^0.2.15'},
                                                'bin': {'vite': 'bin/vite.js'},
                                                'engines': {'node': '^20.19.0 || >=22.12.0'},
                                                'funding': {'url': 'https://github.com/vitejs/vite?sponsor=1'},
                                                'optionalDependencies': {'fsevents': '~2.3.3'},
                                                'peerDependencies': {'@types/node': '^20.19.0 || >=22.12.0',
                                                                     'jiti': '>=1.21.0',
                                                                     'less': '^4.0.0',
                                                                     'lightningcss': '^1.21.0',
                                                                     'sass': '^1.70.0',
                                                                     'sass-embedded': '^1.70.0',
                                                                     'stylus': '>=0.54.8',
                                                                     'sugarss': '^5.0.0',
                                                                     'terser': '^5.16.0',
                                                                     'tsx': '^4.8.1',
                                                                     'yaml': '^2.4.2'},
                                                'peerDependenciesMeta': {'@types/node': {'optional': True},
                                                                         'jiti': {'optional': True},
                                                                         'less': {'optional': True},
                                                                         'lightningcss': {'optional': True},
                                                                         'sass': {'optional': True},
                                                                         'sass-embedded': {'optional': True},
                                                                         'stylus': {'optional': True},
                                                                         'sugarss': {'optional': True},
                                                                         'terser': {'optional': True},
                                                                         'tsx': {'optional': True},
                                                                         'yaml': {'optional': True}}}}}


def same(a, b):
    return json.dumps(a, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(b, sort_keys=True, separators=(',', ':'), allow_nan=False)


def blob(raw):
    return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()


def read(root, name):
    require(isinstance(name,str) and name and not name.startswith('/') and '\\' not in name and all(p and p not in ('.','..') for p in name.split('/')), 'Unsafe maintenance source path')
    root=pathlib.Path(root); target=root/name; parent=target.parent
    while parent != root:
        require(not parent.is_symlink(), 'Indirect maintenance source ancestor'); parent=parent.parent
    mode=target.lstat().st_mode
    if stat.S_ISLNK(mode):
        require(name=='hardhat/contracts' and os.readlink(target)=='../contracts', 'Unexpected source symlink')
        return '120000', b'../contracts'
    require(stat.S_ISREG(mode), 'Maintenance source is not a regular file')
    return ('100755' if mode & 0o111 else '100644'), target.read_bytes()


def tree_digest(entries):
    tree={}
    for name, item in entries.items():
        require(isinstance(name,str) and name and not name.startswith('/') and '\\' not in name and all(p and p not in ('.','..') for p in name.split('/')), 'Unsafe baseline path')
        require(isinstance(item,dict) and set(item)=={'mode','blob'} and item['mode'] in ('100644','100755','120000') and valid_sha(item['blob']), 'Invalid baseline Git entry')
        node=tree; parts=name.split('/')
        for part in parts[:-1]:
            node=node.setdefault(part,{})
            require(isinstance(node,dict) and 'blob' not in node,'Baseline path collision')
        require(parts[-1] not in node,'Baseline path collision'); node[parts[-1]]=item
    def encode(node):
        raw=b''
        for name in sorted(node,key=lambda n:n.encode()+ (b'/' if 'blob' not in node[n] else b'')):
            item=node[name]; leaf='blob' in item
            mode,digest=(item['mode'],item['blob']) if leaf else ('40000',encode(item))
            raw+=mode.encode()+b' '+name.encode()+b'\0'+bytes.fromhex(digest)
        return hashlib.sha1(b'tree '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    return encode(tree)


def select(profile=PROFILE, *, manifest=None, manifest_sha256=None, verifier_sha256=None, schema_sha256=None, published=False):
    require(profile==PROFILE and manifest==MANIFEST and schema_sha256 is None and type(published) is bool, 'Maintenance policy selection differs')
    require(all(isinstance(v,str) and re.fullmatch('[0-9a-f]{64}',v) for v in (manifest_sha256,verifier_sha256)), 'Externally reviewed maintenance pins are mandatory')
    return {'releaseProfile':PROFILE,'manifestPath':MANIFEST,'manifestSha256':manifest_sha256,'verifierSha256':verifier_sha256}


def baseline(root):
    raw=read(root,BASELINE)[1]
    require(sha(raw)==BASELINE_SHA256,'Immutable maintenance baseline differs')
    old=strict_json(raw)
    require(isinstance(old,dict) and set(old)=={'repository','commit','tree','entries','originals'} and old['repository']==REPOSITORY and old['commit']==BASE_COMMIT and old['tree']==BASE_TREE and tree_digest(old['entries'])==BASE_TREE,'Maintenance baseline tree differs')
    require(set(old['originals'])==set(PROJECTIONS)|set(PACKAGE_FILES),'Maintenance original-byte projection inventory differs')
    for name, text in old['originals'].items():
        require(isinstance(text,str) and blob(text.encode())==old['entries'][name]['blob'],'Maintenance predecessor bytes differ: '+name)
    return old


def inventory(root, selection):
    require(same(selection,select(manifest=selection.get('manifestPath'),manifest_sha256=selection.get('manifestSha256'),verifier_sha256=selection.get('verifierSha256'))),'Maintenance selection fields differ')
    require(sha(read(root,VERIFIER)[1])==selection['verifierSha256'],'Maintenance verifier pin differs')
    raw=read(root,MANIFEST)[1]; require(sha(raw)==selection['manifestSha256'],'Maintenance manifest pin differs')
    manifest=strict_json(raw); old=baseline(root)
    require(isinstance(manifest,dict) and set(manifest)=={'schema','repository','profile','version','baseCommit','baseTree','qualification','changes'} and manifest['schema']=='agijobmanager/dependency-maintenance-profile/v1' and manifest['repository']==REPOSITORY and manifest['profile']==PROFILE and manifest['version']==VERSION and manifest['baseCommit']==BASE_COMMIT and manifest['baseTree']==BASE_TREE and manifest['qualification']=='PENDING_EXACT_FINAL_SOURCE_HOSTED_EXECUTION','Maintenance manifest identity/claims differ')
    changes=manifest['changes']; require(isinstance(changes,dict) and set(changes)==set(MODIFIED)|set(ADDITIONS),'Maintenance exact delta inventory differs')
    expected={name:dict(item) for name,item in old['entries'].items()}
    for name, digest in {**MODIFIED,**ADDITIONS}.items():
        item=changes[name]; before=old['entries'].get(name)
        require(isinstance(item,dict) and set(item)=={'before','after','reason'} and same(item['before'],before) and isinstance(item['reason'],str) and item['reason'].strip(),'Maintenance change attribution differs: '+name)
        mode=before['mode'] if before else '100644'
        require(same(item['after'],{'mode':mode,'sha256':digest}),'Maintenance change cannot be broadened by repinning: '+name)
        require((name in MODIFIED)==(before is not None),'Maintenance addition/modification differs')
        expected[name]={'mode':mode,'sha256':digest}
    expected[MANIFEST]={'mode':'100644','sha256':selection['manifestSha256']}
    expected[VERIFIER]={'mode':'100644','sha256':selection['verifierSha256']}
    expected[BASELINE]={'mode':'100644','sha256':BASELINE_SHA256}
    return expected,old


def validate_projections(root, old):
    for name, edits in PROJECTIONS.items():
        original=old['originals'][name]; expected=original
        for start,before,after in reversed(edits):
            require(expected[start:start+len(before)]==before,'Immutable predecessor projection differs')
            expected=expected[:start]+after+expected[start+len(before):]
        actual=read(root,name)[1].decode()
        require(actual==expected,'Maintenance selector or workflow changed beyond exact reviewed edits: '+name)
        restored=actual
        # Restore in forward order: earlier edits restore the original offsets.
        for start,before,after in edits:
            require(restored[start:start+len(after)]==after,'Maintenance inverse projection differs')
            restored=restored[:start]+before+restored[start+len(after):]
        require(restored==original and blob(restored.encode())==old['entries'][name]['blob'],'Maintenance projection did not reproduce predecessor bytes')


def validate_packages(root, old):
    for name in PACKAGE_FILES:
        before=strict_json(old['originals'][name]); after=strict_json(read(root,name)[1])
        require(after.get('version')==VERSION,'Maintenance package version differs: '+name)
        after['version']=before['version']
        if name.endswith('package-lock.json'):
            require(after['packages']['']['version']==VERSION,'Maintenance lock root version differs')
            after['packages']['']['version']=before['packages']['']['version']
            repairs=REPAIRED_RECORDS.get(name,{})
            for path, record in repairs.items():
                require(same(after['packages'][path],record),'Maintenance repaired package record differs: '+path)
                after['packages'][path]=before['packages'][path]
            if name=='ui/package-lock.json':
                require(after['packages']['']['devDependencies']['vite']=='7.3.7','Maintenance UI root Vite pin differs')
                after['packages']['']['devDependencies']['vite']=before['packages']['']['devDependencies']['vite']
        elif name=='ui/package.json':
            require(after['devDependencies']['vite']=='7.3.7','Maintenance UI Vite pin differs')
            after['devDependencies']['vite']=before['devDependencies']['vite']
        require(same(after,before),'Maintenance changed another dependency, command or setting: '+name)
    require(strict_json(read(root,'config/usdc-deployment.json')[1])['version']==VERSION,'Maintenance deployment software label differs')


def validate_comparison_inputs(root):
    provenance=strict_json(read(root,'docs/qualification/release-v1.19.6-provenance.json')[1])
    require(provenance.get('status')=='EXPECTED_ONLY_PENDING_FINAL_SOURCE_EXECUTION' and provenance.get('executed') is False and provenance.get('version')==VERSION,'Comparison provenance cannot claim execution')
    for kind,old_path,new_path,key in (
        ('fork','docs/qualification/mainnet-cutover-v1.19.5-expected.json','docs/qualification/mainnet-cutover-v1.19.6-expected.json','sourceSha256'),
        ('staticAnalysis','scripts/security/slither-reviewed-findings-v1.19.5.json','scripts/security/slither-reviewed-findings-v1.19.6.json','source_sha256')):
        before=strict_json(read(root,old_path)[1]); after=strict_json(read(root,new_path)[1]); before_hashes=before.pop(key); after_hashes=after.pop(key)
        if kind=='staticAnalysis': before.pop('scope'); after.pop('scope')
        require(same(before,after),'Maintenance copied observations or findings were changed')
        require(set(before_hashes)==set(after_hashes),'Comparison source inventory differs')
        require(all(digest==sha(read(root,name)[1]) for name,digest in after_hashes.items()),'Comparison source hash differs')
        changed=sorted(name for name in before_hashes if before_hashes[name]!=after_hashes[name])
        record=provenance[kind]
        require(record=={'previousPath':old_path,'previousSha256':sha(read(root,old_path)[1]),'expectedPath':new_path,'expectedSha256':sha(read(root,new_path)[1]),'changedSourceHashes':changed,'observationsOrFindingsChanged':False,'executed':False},'Comparison provenance source binding differs')


def validate_source(root, selection, paths=None):
    root=pathlib.Path(root); expected,old=inventory(root,selection)
    actual=set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual==set(expected),'Maintenance source has missing or unexpected inputs')
    for name,item in expected.items():
        mode,raw=read(root,name)
        require(mode==item['mode'] and (sha(raw) if 'sha256' in item else blob(raw))==item.get('sha256',item.get('blob')),'Maintenance source bytes/mode differ: '+name)
    validate_projections(root,old); validate_packages(root,old); validate_comparison_inputs(root)
    return {'profile':PROFILE,'version':VERSION,'baseCommit':BASE_COMMIT,'baseTree':BASE_TREE,'sourceInputs':len(expected),'qualification':'PENDING_EXACT_FINAL_SOURCE_HOSTED_EXECUTION','releaseQualified':False,'publicationApproved':False,'executed':False}


def metadata(selection):
    return {'releaseProfile':PROFILE,'releasePolicy':dict(selection),'qualification':'Finite reviewed dependency-maintenance source identity only. Fresh exact-final-source hosted qualification and publication must be verified separately in external QUALIFICATION.json.'}


def validate_metadata(manifest, selection):
    fields={'schemaVersion','repository','tag','name','sourceCommit','sourceTree','builderSource','stage','qualification','archiveLimitBytes','toolchain','exclusions','files','releaseProfile','releasePolicy'}
    require(set(manifest)==fields and type(manifest['schemaVersion']) is int and manifest['schemaVersion']==2 and manifest['repository']==REPOSITORY and manifest['tag']=='v'+VERSION and manifest['name']==TITLE and manifest['stage']=='source-package' and valid_sha(manifest['sourceCommit']) and valid_sha(manifest['sourceTree']),'Maintenance package identity differs')
    for key,value in metadata(selection).items(): require(same(manifest[key],value),'Maintenance package policy/claim differs: '+key)


def git(root,*args):
    environment={k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    environment.update({'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_NO_REPLACE_OBJECTS':'1','GIT_OPTIONAL_LOCKS':'0'})
    return subprocess.check_output(['git','--no-replace-objects','--no-pager','-C',str(root),'-c','core.fsmonitor=false',*args],env=environment)


def checkout(root, selection, object_store, dependency_root, source, tree):
    root=pathlib.Path(root).resolve()
    require(pathlib.Path(git(root,'rev-parse','--show-toplevel').decode().strip()).resolve()==root,'Maintenance root is not the actual Git worktree root')
    require(git(root,'rev-parse','--is-shallow-repository').strip()==b'false','Complete maintenance ancestry is required')
    grafts=pathlib.Path(git(root,'rev-parse','--git-path','info/grafts').decode().strip()); grafts=grafts if grafts.is_absolute() else root/grafts
    require(not grafts.exists() and not git(root,'for-each-ref','--format=%(refname)','refs/replace').strip(),'Replaced/grafted maintenance history is prohibited')
    require(git(root,'rev-parse','HEAD').decode().strip()==source and git(root,'rev-parse','HEAD^{tree}').decode().strip()==tree,'Maintenance checkout identity differs')
    require(git(root,'rev-parse',BASE_COMMIT+'^{tree}').decode().strip()==BASE_TREE,'Maintenance Git predecessor differs')
    git(root,'merge-base','--is-ancestor',BASE_COMMIT,source)
    require(not git(root,'status','--porcelain','--untracked-files=all').strip(),'Maintenance source has tracked changes or untracked nonignored inputs')
    entries={}
    for row in git(root,'ls-tree','-rz',source).split(b'\0'):
        if not row: continue
        meta,name=row.split(b'\t',1); mode,kind,oid=meta.decode().split(); require(kind=='blob','Unsupported maintenance Git object'); entries[name.decode()]=(mode,oid)
    index={}
    for row in git(root,'ls-files','--stage','-z').split(b'\0'):
        if not row: continue
        meta,name=row.split(b'\t',1); mode,oid,stage=meta.decode().split(); require(stage=='0' and name.decode() not in index,'Unmerged maintenance index'); index[name.decode()]=(mode,oid)
    require(index==entries,'Maintenance index differs from source tree')
    require(all(not row or row.startswith(b'H ') for row in git(root,'ls-files','-v','-z').split(b'\0')),'Hidden maintenance index flags are prohibited')
    for name,(mode,oid) in entries.items():
        current,raw=read(root,name); require(mode==current and oid==blob(raw),'Raw maintenance source differs from Git: '+name)
    result=validate_source(root,selection,entries)
    if dependency_root is not None:
        previous=runpy.run_path(str(root/'scripts/release/transformational-profile.py'))
        compiler=runpy.run_path(str(root/'scripts/release/check-explicit-governor-boundaries.py'))
        expected=strict_json(read(root,previous['PREVIOUS']['PREVIOUS']['BASE_MANIFEST'])[1])
        result['compilerSourceUnits']=compiler['compiler_closure'](root,expected,dependency_root)
    else:
        result['compilerClosureChecked']=False
    return {**result,'sourceCommit':source,'sourceTree':tree}


def arguments(root):
    return ['--profile',PROFILE,'--manifest',MANIFEST,'--manifest-sha256',sha(read(root,MANIFEST)[1]),'--verifier-sha256',sha(read(root,VERIFIER)[1])]


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--dependency-root',required=True); args=parser.parse_args()
    selection=select(manifest=MANIFEST,manifest_sha256=sha(read(ROOT,MANIFEST)[1]),verifier_sha256=sha(read(ROOT,VERIFIER)[1]))
    result=checkout(ROOT,selection,None,args.dependency_root,git(ROOT,'rev-parse','HEAD').decode().strip(),git(ROOT,'rev-parse','HEAD^{tree}').decode().strip())
    print(json.dumps(result,sort_keys=True))
    for key,value in {'MAINTENANCE_VERSION':VERSION,'MAINTENANCE_MANIFEST_SHA256':selection['manifestSha256'],'MAINTENANCE_VERIFIER_SHA256':selection['verifierSha256']}.items(): print(key+'='+value)
