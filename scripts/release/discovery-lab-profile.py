"""Explicit finite Discovery Lab source/package candidate; never a publication profile."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
REPOSITORY = 'MontrealAI/AGIJobManager'
BASE_COMMIT = '4d4c32685eebf23b0aa35dbb45abe23ac8a261cb'
BASE_TREE = '3676cb41be9c5c5110cc266e0ff6f7c20bfbec86'
PROFILE = 'discovery-lab-source-candidate-v1'
SOURCE_VERSION = '1.19.5'
MANIFEST = 'config/discovery-lab-source-candidate-v1.json'
BASELINE = 'config/discovery-lab-source-baseline-v1.json'
BASELINE_SHA256 = 'ceeca49019f418637dcec1b3586699d382ecdaee23790fef50ae177a360ba74a'
VERIFIER = 'scripts/release/discovery-lab-profile.py'
ALLOWED = {'scripts/integrations/discovery-lab-native-test.mjs', 'scripts/integrations/discovery-lab-contract.mjs', 'scripts/integrations/discovery-lab-work-request.test.mjs', '.github/workflows/discovery-lab-receiver.yml', 'docs/successor/DISCOVERY_LAB.md', 'scripts/integrations/discovery-lab-work-request.mjs', 'scripts/release/test-discovery-lab-profile.py', 'scripts/integrations/fixtures/discovery-lab-request.json', 'config/discovery-lab-alpha-source.json'}
MODIFIED = {'scripts/release/package-policy.py'}
DISPATCHER_PROJECTION = [("TRANSFORMATIONAL_PROFILE = 'manager-transformational-v1'\nDISCOVERY_PROFILE = 'discovery-lab-source-candidate-v1'\n", "TRANSFORMATIONAL_PROFILE = 'manager-transformational-v1'\n"), ("\ndef discovery():\n    return runpy.run_path(str(BASE / 'discovery-lab-profile.py'))\n\ndef correction():\n", '\ndef correction():\n'), ('CORRECTION_PROFILE, TRANSFORMATIONAL_PROFILE, DISCOVERY_PROFILE)', 'CORRECTION_PROFILE, TRANSFORMATIONAL_PROFILE)'), ('return (discovery() if profile == DISCOVERY_PROFILE else transformational() if profile == TRANSFORMATIONAL_PROFILE', 'return (transformational() if profile == TRANSFORMATIONAL_PROFILE'), ("return discovery() if selection is not None and selection.get('profile') == DISCOVERY_PROFILE else transformational() if selection is not None", 'return transformational() if selection is not None')]
CLAIMS = {'sourcePackageOnly': True, 'releaseQualified': False,
          'releaseIdentity': None, 'publicationApproved': False, 'executionApproved': False}
sha = lambda raw: hashlib.sha256(raw).hexdigest()
same = lambda a,b: json.dumps(a,sort_keys=True,separators=(',',':'),allow_nan=False) == json.dumps(b,sort_keys=True,separators=(',',':'),allow_nan=False)
def require(ok, message):
    if not ok: raise ValueError(message)
def strict_json(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            require(key not in out, 'Duplicate JSON key'); out[key] = value
        return out
    return json.loads(raw, object_pairs_hook=pairs)
def read(root, name):
    require(isinstance(name, str) and name and not name.startswith('/') and
            all(part and part not in ('.', '..') for part in name.split('/')) and '\\' not in name,
            'Unsafe source path')
    path = pathlib.Path(root) / name
    parent = path.parent
    while parent != pathlib.Path(root):
        require(not parent.is_symlink(), 'Symlink source ancestor'); parent = parent.parent
    mode = path.lstat().st_mode
    if stat.S_ISLNK(mode): return '120000', os.readlink(path).encode()
    require(stat.S_ISREG(mode), 'Source must be a regular file or retained symlink')
    return ('100755' if mode & 0o111 else '100644'), path.read_bytes()
def tree_digest(entries):
    root = {}
    for path, item in entries.items():
        require(isinstance(path, str) and path and not path.startswith('/') and '\\' not in path
                and all(part and part not in ('.', '..') for part in path.split('/')), 'Invalid baseline path')
        require(isinstance(item, dict) and set(item) == {'mode', 'blob'}
                and item['mode'] in ('100644', '100755', '120000')
                and isinstance(item['blob'], str) and re.fullmatch('[0-9a-f]{40}', item['blob']), 'Invalid baseline Git entry')
        node = root
        parts = path.split('/')
        for part in parts[:-1]:
            node = node.setdefault(part, {})
            require(isinstance(node, dict) and 'blob' not in node, 'Baseline path collision')
        require(parts[-1] not in node, 'Baseline path collision'); node[parts[-1]] = item
    def encode(node):
        result = b''
        ordered = sorted(node, key=lambda name: name.encode('utf8') + (b'/' if 'blob' not in node[name] else b''))
        for name in ordered:
            item = node[name]; leaf = 'blob' in item
            mode, digest = (item['mode'], item['blob']) if leaf else ('40000', encode(item))
            result += mode.encode() + b' ' + name.encode('utf8') + b'\0' + bytes.fromhex(digest)
        return hashlib.sha1(b'tree ' + str(len(result)).encode() + b'\0' + result).hexdigest()
    return encode(root)
def select(profile=PROFILE, *, manifest=MANIFEST, manifest_sha256, verifier_sha256, schema_sha256=None, published=False):
    require(profile == PROFILE and manifest == MANIFEST and schema_sha256 is None, 'Discovery candidate selection differs')
    require(not published, 'Discovery Lab candidate cannot qualify publication')
    require(all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value)
                for value in (manifest_sha256, verifier_sha256)), 'Externally reviewed policy pins are required')
    return {'profile': PROFILE, 'manifestSha256': manifest_sha256, 'verifierSha256': verifier_sha256, **CLAIMS}
def inventory(root, selection):
    require(same(selection, select(manifest_sha256=selection.get('manifestSha256'),
            verifier_sha256=selection.get('verifierSha256'))), 'Candidate selection or claims differ')
    require(sha(read(root, VERIFIER)[1]) == selection['verifierSha256'], 'Candidate verifier pin differs')
    manifest_raw = read(root, MANIFEST)[1]
    require(sha(manifest_raw) == selection['manifestSha256'], 'Candidate manifest pin differs')
    manifest = strict_json(manifest_raw)
    require(set(manifest) == {'schema', 'repository', 'profile', 'baseCommit', 'baseTree', 'claims', 'changes'}, 'Candidate fields differ')
    require(manifest['schema'] == 'successor/discovery-lab-source-candidate/v1'
            and manifest['repository'] == REPOSITORY and manifest['profile'] == PROFILE
            and manifest['baseCommit'] == BASE_COMMIT and manifest['baseTree'] == BASE_TREE
            and same(manifest['claims'], CLAIMS), 'Candidate baseline or claims differ')
    baseline_raw = read(root, BASELINE)[1]
    require(sha(baseline_raw) == BASELINE_SHA256, 'Immutable baseline inventory bytes differ')
    baseline = strict_json(baseline_raw)
    require(set(baseline) == {'repository', 'commit', 'tree', 'entries'} and baseline['repository'] == REPOSITORY
            and baseline['commit'] == BASE_COMMIT and baseline['tree'] == BASE_TREE
            and tree_digest(baseline['entries']) == BASE_TREE, 'Immutable baseline inventory differs')
    changes = manifest['changes']
    require(isinstance(changes, dict) and set(changes) == ALLOWED | MODIFIED, 'Candidate differs from explicit reviewed paths')
    expected = {name: dict(item) for name, item in baseline['entries'].items()}
    for name, item in changes.items():
        require(isinstance(item, dict) and set(item) == {'before', 'after', 'reason'}
                and ((name not in expected and item['before'] is None) or (name in MODIFIED and item['before'] == expected[name])) and isinstance(item['reason'], str) and item['reason'].strip(), 'Only attributed additions and the exact selector projection are admitted')
        after = item['after']
        require(isinstance(after, dict) and set(after) == {'mode', 'sha256'} and after['mode'] == '100644'
                and isinstance(after['sha256'], str) and re.fullmatch('[0-9a-f]{64}', after['sha256']), 'Candidate added input identity differs')
        expected[name] = dict(after)
    expected[MANIFEST] = {'mode': '100644', 'sha256': selection['manifestSha256']}
    expected[VERIFIER] = {'mode': '100644', 'sha256': selection['verifierSha256']}
    expected[BASELINE] = {'mode': '100644', 'sha256': BASELINE_SHA256}
    return expected
def validate_source(root, selection, paths=None):
    root = pathlib.Path(root).resolve(); expected = inventory(root, selection)
    actual = set(paths) if paths is not None else {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() or p.is_symlink()}
    require(actual == set(expected), 'Source inventory has missing or unexpected inputs')
    for name, item in expected.items():
        mode, raw = read(root, name)
        if name in MODIFIED:
            projected = raw.decode('utf8')
            for current, previous in DISPATCHER_PROJECTION:
                require(projected.count(current) == 1, 'Candidate selector delta differs')
                projected = projected.replace(current, previous, 1)
            original = strict_json(read(root, BASELINE)[1])['entries'][name]
            old = projected.encode('utf8')
            require(hashlib.sha1(b'blob ' + str(len(old)).encode() + b'\0' + old).hexdigest() == original['blob'], 'Legacy selector bytes were altered')
        require(mode == item['mode'], 'Source mode differs: ' + name)
        digest = sha(raw) if 'sha256' in item else hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        require(digest == item.get('sha256', item.get('blob')), 'Source bytes differ: ' + name)
    return {'profile': PROFILE, 'repository': REPOSITORY, 'baseCommit': BASE_COMMIT,
            'baseTree': BASE_TREE, 'inputCount': len(expected), **CLAIMS}
def metadata(selection):
    return {'candidateProfile': PROFILE, 'sourcePackageOnly': True, 'sourceBound': True,
            'releaseQualified': False, 'releaseIdentity': None,
            'sourceBoundaryStatus': 'CHECKED_OUT_INPUT_BOUNDARIES_PASSED',
            'sourceBoundaryPolicy': dict(selection),
            'qualification': 'Discovery Lab source-package identity only; no release, publication, execution or deployment approval.'}

def validate_metadata(manifest, selection):
    fields = {'schemaVersion', 'repository', 'tag', 'name', 'sourceCommit', 'sourceTree', 'builderSource',
              'stage', 'qualification', 'archiveLimitBytes', 'toolchain', 'exclusions', 'files'} | set(metadata(selection))
    require(set(manifest) == fields and manifest['repository'] == REPOSITORY
            and type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 2
            and manifest['stage'] == 'source-package'
            and manifest['tag'] == 'v'+SOURCE_VERSION
            and manifest['name'] == 'v'+SOURCE_VERSION+' — Operator guidance and deployment evidence',
            'Discovery candidate package metadata differs')
    for key, value in metadata(selection).items():
        require(same(manifest[key], value), 'Discovery candidate approval or metadata differs: ' + key)
    require(all(isinstance(manifest[key], str) and re.fullmatch('[0-9a-f]{40}', manifest[key])
                for key in ['sourceCommit', 'sourceTree']), 'Candidate source identity differs')

def checkout(root, selection, object_store, dependency_root, source, tree):
    root = pathlib.Path(root).resolve()
    environment = {key:value for key,value in os.environ.items() if not key.startswith('GIT_')}
    environment.update({'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null',
                        'GIT_NO_REPLACE_OBJECTS':'1','GIT_OPTIONAL_LOCKS':'0'})
    prefix = ['git','--no-replace-objects','--no-pager','-C',str(root),'--work-tree='+str(root),'-c','core.fsmonitor=false']
    def git_bytes(*args): return subprocess.check_output([*prefix,*args],env=environment)
    def git(*args): return git_bytes(*args).decode().strip()
    require(git('rev-parse', '--is-shallow-repository') == 'false', 'Complete candidate ancestry is required')
    require(not git('for-each-ref', '--format=%(refname)', 'refs/replace'), 'Replaced source history is prohibited')
    grafts = pathlib.Path(git('rev-parse', '--git-path', 'info/grafts'))
    require(not (grafts if grafts.is_absolute() else root/grafts).exists(), 'Grafted source history is prohibited')
    require(git('rev-parse', 'HEAD') == source and git('rev-parse', 'HEAD^{tree}') == tree,
            'Candidate checked-out source identity differs')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'Tracked candidate source is dirty')
    require(git('rev-parse', BASE_COMMIT+'^{tree}') == BASE_TREE, 'Candidate predecessor tree differs')
    subprocess.check_call([*prefix,'merge-base','--is-ancestor',BASE_COMMIT,source],env=environment)
    entries = {}
    for entry in git_bytes('ls-tree','-rz',source).split(b'\0'):
        if not entry: continue
        meta, path = entry.split(b'\t',1); mode, kind, oid = meta.decode().split()
        require(kind == 'blob', 'Unsupported candidate Git object'); entries[path.decode()] = (mode,oid)
    index = {}
    for entry in git_bytes('ls-files','--stage','-z').split(b'\0'):
        if not entry: continue
        meta,path = entry.split(b'\t',1); mode,oid,stage = meta.decode().split()
        require(stage == '0' and path.decode() not in index, 'Unmerged candidate index'); index[path.decode()] = (mode,oid)
    require(index == entries, 'Candidate index differs from its source tree')
    flags = git_bytes('ls-files','-v','-z').split(b'\0')
    require(all(not item or item.startswith(b'H ') for item in flags), 'Hidden candidate index flags are prohibited')
    result = validate_source(root, selection, paths=set(entries))
    for name,(mode,oid) in entries.items():
        actual_mode, raw = read(root,name)
        require(mode == actual_mode and hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == oid,
                'Current raw source differs from Git: '+name)
    require(dependency_root is not None, 'Exact installed compiler dependency closure is required')
    import runpy
    previous = runpy.run_path(str(root/'scripts/release/transformational-profile.py'))
    compiler = runpy.run_path(str(root/'scripts/release/check-explicit-governor-boundaries.py'))
    expected = strict_json(read(root,previous['PREVIOUS']['PREVIOUS']['BASE_MANIFEST'])[1])
    result['compilerSourceUnits'] = compiler['compiler_closure'](root,expected,dependency_root)
    return {**result,'sourceCommit':source,'sourceTree':tree}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--verifier-sha256', required=True)
    args = parser.parse_args()
    print(json.dumps(validate_source(args.root, select(manifest_sha256=args.manifest_sha256,
            verifier_sha256=args.verifier_sha256))))
