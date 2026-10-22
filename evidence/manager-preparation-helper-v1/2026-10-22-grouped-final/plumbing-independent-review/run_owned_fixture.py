"""Only two selected existing fixtures, with reviewed EMPTY profile and inert local data."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode=True
ROOT=Path('/workspace/scratch/475a997acac1')
HERE=Path(__file__).parent
parser=argparse.ArgumentParser()
parser.add_argument('variant',choices=['before','after'])
args=parser.parse_args()
cap=ROOT/'manager-final615-attempt-inputs-20261022/capture'
current=json.loads((cap/'meta/current_map.json').read_bytes())
overlays=json.loads((cap/'meta/overlays.json').read_bytes())
before=json.loads((cap/'meta/before.json').read_bytes())
source=ROOT/'manager-public0a1-integration-independent-review-20261022/source-data'
template=(ROOT/'manager-helper-pages-policy-20261022/fixtures/reviewed-template.py.txt').read_bytes()
assert len(template)==40085 and hashlib.sha256(template).hexdigest()=='91dff54f2dbd7f6644c6a3b93540c584a964af03eadfa8170e1491d2ececa213'
package_names=('package.json','package-lock.json','hardhat/package.json','hardhat/package-lock.json','ui/package.json','ui/package-lock.json','config/usdc-deployment.json')
baseline={name:(cap/'cas'/before[name]['blob']).read_bytes() for name in package_names}
commands=[]
with tempfile.TemporaryDirectory(prefix='manager-owned-plumbing-fixture-') as folder:
    fixture_root=Path(folder)/'source'
    for path in source.glob('scripts/release/*.py'):
        relative=path.relative_to(source)
        if relative.as_posix()=='scripts/release/discovery-release-profile.py':continue
        target=fixture_root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(path.read_bytes())
    profile=fixture_root/'scripts/release/discovery-release-profile.py';profile.write_bytes(template)
    for name in package_names:
        row=overlays.get(name,current[name]);target=fixture_root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((cap/'cas'/row['blob']).read_bytes())
    target=fixture_root/'scripts/release/test-discovery-release-plumbing.py'
    target.write_bytes((HERE/args.variant/'scripts/release/test-discovery-release-plumbing.py').read_bytes())
    sys.path.insert(0,str(fixture_root/'scripts/release'))
    spec=importlib.util.spec_from_file_location('owned_plumbing_fixture',target)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    original_previous=module.previous
    def previous(name,source=module.BASE):
        if source!=module.BASE:
            raise LookupError('Owned original900 data has no unavailable historical publisher reference: '+source)
        return baseline[name]
    module.previous=previous
    actual_run=subprocess.run
    def local_git_only(command,*positional,**options):
        # The existing rebuild fixture creates its own tiny inert Git source.
        if not isinstance(command,list) or command[0]!='git':
            raise AssertionError('External process outside inert local Git fixture: '+repr(command))
        if any(value in command for value in ['fetch','clone','push','pull','ls-remote','remote']):
            raise AssertionError('Network Git is prohibited in this owned fixture')
        commands.append(command)
        return actual_run(command,*positional,**options)
    subprocess.run=local_git_only
    suite=unittest.TestSuite([
        module.DiscoveryPlumbing('test_package_and_deployment_changes_are_version_metadata_only'),
        module.QualifiedDiscoveryRebuild('test_actual_publisher_rebuild_uses_the_collected_qualified_phase_and_original_capsule'),
    ])
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    if args.variant=='after' and result.wasSuccessful():
        # Unrelated dependencies/commands still fail the entire-document comparison.
        for label,name,change in [
                ('unrelated-ui-dependency','ui/package.json',lambda v:v['dependencies'].update(react='0.0.0')),
                ('unrelated-ui-override','ui/package.json',lambda v:v['overrides'].update(sharp='0.0.0')),
                ('unrelated-root-command','package.json',lambda v:v['scripts'].update(build='unreviewed-command')),
                ('locked-next-integrity','ui/package-lock.json',lambda v:v['packages']['node_modules/next'].update(integrity='sha512-unreviewed'))]:
            path=fixture_root/name;raw=path.read_bytes();value=json.loads(raw);change(value);path.write_text(json.dumps(value))
            case=module.DiscoveryPlumbing('test_package_and_deployment_changes_are_version_metadata_only')
            negative=unittest.TestResult();case.run(negative)
            assert negative.failures or negative.errors,'Unrelated package mutation unexpectedly accepted'
            if label=='locked-next-integrity':
                assert any('Discovery Next security package record differs: node_modules/next' in trace
                           for _,trace in negative.errors),'Locked integrity did not fail the exact existing security guard'
            else:
                assert negative.failures,'Unrelated delta did not fail full-document equality'
            path.write_bytes(raw)
            print('OWNED_UNRELATED_PACKAGE_MUTATION_REFUSED='+label)
    subprocess.run=actual_run
    assert profile.read_bytes()==template
    print(json.dumps({'variant':args.variant,'selectedTests':result.testsRun,'success':result.wasSuccessful(),
        'failures':len(result.failures),'errors':len(result.errors),'profile':'reviewed-empty-template-only',
        'profileSha256':hashlib.sha256(template).hexdigest(),'localInertGitCommands':len(commands),
        'networkNativeGeneratedVerifierExecuted':False},sort_keys=True))
    raise SystemExit(0 if result.wasSuccessful() else 1)
