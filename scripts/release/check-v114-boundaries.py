#!/usr/bin/env python3
"""Offline pinned dependency/compiler boundaries and explicit next-deployment source changes."""
import hashlib, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE='191cf3590e5cdc08df1bb0af500ee28a91c8b010'
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True)
def read(path): return json.loads((ROOT/path).read_text())
def original(path): return json.loads(git('show',f'{BASE}:{path}'))
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
repairs=read('config/v114-dependency-repairs.json')
if repairs['baseline']!=BASE: raise AssertionError('Dependency repair baseline differs')
for name,expected in repairs['vendoredFiles'].items():
    if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=expected: raise AssertionError('Reviewed vendored repair changed: '+name)
actual_vendor={str(p.relative_to(ROOT)) for p in (ROOT/'ui/vendor/braces').rglob('*') if p.is_file()}
if actual_vendor!=set(repairs['vendoredFiles']): raise AssertionError('Reviewed vendored repair inventory changed')
for directory in ('','hardhat/','ui/'):
    pkg=read(directory+'package.json'); old=original(directory+'package.json')
    if not (pkg['version']==read('package.json')['version']): raise AssertionError('Release invariant failed')
    if directory=='ui/':
        old['dependencies']['next']='15.5.27'
        old['devDependencies'].update({'eslint-config-next':'15.5.27','braces':'file:vendor/braces'})
        old['overrides'].update({'postcss-selector-parser':'7.1.6','sharp':'0.35.5','source-map-js':'1.2.2','braces':'$braces'})
    for field in ('dependencies','devDependencies','optionalDependencies','peerDependencies','overrides','engines'):
        if not (pkg.get(field)==old.get(field)): raise AssertionError(f'Dependency/toolchain field changed: {directory}{field}')
    lock=read(directory+'package-lock.json'); prior=original(directory+'package-lock.json')
    if not (lock['version']==lock['packages']['']['version']==read('package.json')['version']): raise AssertionError('Release invariant failed')
    lock['version']=prior['version'];lock['packages']['']['version']=prior['packages']['']['version']
    if directory=='ui/':
        for field in ('dependencies','devDependencies'):
            if lock['packages'][''][field]!=old[field]: raise AssertionError('UI lock manifest differs from authorized repairs')
            lock['packages'][''][field]=prior['packages'][''][field]
    changes=repairs['lockChanges'].get(directory+'package-lock.json',{})
    actual={name for name in lock['packages'].keys()|prior['packages'].keys() if lock['packages'].get(name)!=prior['packages'].get(name)}
    if actual!=set(changes): raise AssertionError('Dependency changes exceed or omit reviewed repair inventory: '+directory)
    for name,review in changes.items():
        if digest(prior['packages'].get(name))!=review['beforeDigest'] or digest(lock['packages'].get(name))!=review['afterDigest']:
            raise AssertionError('Dependency repair bytes differ: '+directory+name)
        if name in prior['packages']: lock['packages'][name]=prior['packages'][name]
        else: lock['packages'].pop(name)
    if not (lock==prior): raise AssertionError(f'Dependency resolution changed: {directory}')
if not (read('config/usdc-deployment.json')['version']==read('package.json')['version']): raise AssertionError('Release invariant failed')
compiler=['hardhat.config.mjs','hardhat/hardhat.config.js','foundry.toml','remappings.txt']
if git('diff','--name-only',BASE,'--',*compiler).strip(): raise AssertionError('Compiler configuration changed')
contract_review=read('config/next-deployment-contract-changes.json')
if contract_review.get('baseline')!=BASE or not contract_review.get('scope'): raise AssertionError('Contract review baseline/scope differs')
changes=contract_review.get('files',{})
if not isinstance(changes,dict) or not changes: raise AssertionError('Explicit contract change inventory required')
actual=set(git('diff','--name-only',BASE,'--','contracts').splitlines())
actual.update(git('ls-files','--others','--exclude-standard','--','contracts').splitlines())
if actual!=set(changes): raise AssertionError('Contract changes exceed or omit the reviewed source inventory')
for name,review in changes.items():
    if not name.startswith('contracts/') or '..' in pathlib.PurePosixPath(name).parts or not review.get('purpose'): raise AssertionError('Invalid contract review entry')
    before=subprocess.check_output(['git','show',f'{BASE}:{name}'],cwd=ROOT)
    after=(ROOT/name).read_bytes()
    if hashlib.sha256(before).hexdigest()!=review.get('beforeSha256') or hashlib.sha256(after).hexdigest()!=review.get('afterSha256'):
        raise AssertionError('Reviewed contract source bytes differ: '+name)
fixture='test/fixtures/ENSOwnership.pre-revocation.sol.txt'
if hashlib.sha256((ROOT/fixture).read_bytes()).hexdigest()!=changes['contracts/utils/ENSOwnership.sol']['beforeSha256']:
    raise AssertionError('Historical ENS source fixture differs from preserved baseline')
pkg=read('hardhat/package.json')
for name in ('reverify:mainnet','reverify:sepolia','check:readiness','check:readiness:sepolia'):
    if not ('--no-compile' in pkg['scripts'][name]): raise AssertionError(f'{name} must preserve saved artifacts')
text=(ROOT/'hardhat/scripts/check-readiness.cjs').read_text()
if not ('readRegistrySnapshot' in text and 'await checkNftPolicy(' not in text): raise AssertionError('Release invariant failed')
if not (not list(ROOT.glob('.v114-bootstrap*'))): raise AssertionError('Bootstrap material must not ship')
print('SOURCE BOUNDARIES PASSED: compiler unchanged; contract source and dependency repairs match the exact reviewed inventories. This boundary check is not full release qualification or activation approval.')
