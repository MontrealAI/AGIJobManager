#!/usr/bin/env python3
"""Offline source, dependency and version boundaries for v1.14.0 preparation."""
import json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE='191cf3590e5cdc08df1bb0af500ee28a91c8b010'
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True)
def read(path): return json.loads((ROOT/path).read_text())
def original(path): return json.loads(git('show',f'{BASE}:{path}'))
for directory in ('','hardhat/','ui/'):
    pkg=read(directory+'package.json'); old=original(directory+'package.json')
    if not (pkg['version']=='1.14.0'): raise AssertionError('Release invariant failed')
    for field in ('dependencies','devDependencies','optionalDependencies','peerDependencies','overrides','engines'):
        if not (pkg.get(field)==old.get(field)): raise AssertionError(f'Dependency/toolchain field changed: {directory}{field}')
    lock=read(directory+'package-lock.json'); prior=original(directory+'package-lock.json')
    if not (lock['version']==lock['packages']['']['version']=='1.14.0'): raise AssertionError('Release invariant failed')
    lock['version']=prior['version'];lock['packages']['']['version']=prior['packages']['']['version']
    if not (lock==prior): raise AssertionError(f'Dependency resolution changed: {directory}')
if not (read('config/usdc-deployment.json')['version']=='1.14.0'): raise AssertionError('Release invariant failed')
protected=['contracts','hardhat.config.mjs','hardhat/hardhat.config.js','foundry.toml','remappings.txt']
if not (not git('diff','--name-only',BASE,'--',*protected).strip()): raise AssertionError('Contract or compiler configuration changed')
pkg=read('hardhat/package.json')
for name in ('reverify:mainnet','reverify:sepolia','check:readiness','check:readiness:sepolia'):
    if not ('--no-compile' in pkg['scripts'][name]): raise AssertionError(f'{name} must preserve saved artifacts')
text=(ROOT/'hardhat/scripts/check-readiness.cjs').read_text()
if not ('readRegistrySnapshot' in text and 'await checkNftPolicy(' not in text): raise AssertionError('Release invariant failed')
if not (not list(ROOT.glob('.v114-bootstrap*'))): raise AssertionError('Bootstrap material must not ship')
print('v1.14.0 BOUNDARIES PASSED: contracts/compiler/dependency resolutions unchanged; standard commands integrated.')
