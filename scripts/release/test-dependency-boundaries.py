import json, pathlib, shutil, subprocess, tempfile, unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]

class DependencyBoundaries(unittest.TestCase):
    def test_authorized_repairs_and_rejected_mutations(self):
        with tempfile.TemporaryDirectory(prefix='v114-boundaries-') as tmp:
            root=pathlib.Path(tmp)/'source'
            subprocess.run(['git','clone','--quiet','--shared','--no-checkout',str(ROOT),str(root)],check=True)
            subprocess.run(['git','reset','--hard','191cf3590e5cdc08df1bb0af500ee28a91c8b010'],cwd=root,check=True,stdout=subprocess.DEVNULL)
            paths=['package.json','package-lock.json','hardhat/package.json','hardhat/package-lock.json','ui/package.json','ui/package-lock.json','config/usdc-deployment.json','config/v114-dependency-repairs.json','scripts/release/check-v114-boundaries.py','hardhat/scripts/check-readiness.cjs','config/next-deployment-contract-changes.json','config/compiler-profile-mitigation.json','hardhat/hardhat.config.js','foundry.toml','test/fixtures/ENSOwnership.pre-revocation.sol.txt','contracts/utils/ENSOwnership.sol','contracts/test/MockENS.sol']
            paths += [str(p.relative_to(ROOT)) for p in (ROOT/'ui/vendor/braces').rglob('*') if p.is_file()]
            for name in paths:
                target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
            def check(): return subprocess.run(['python3',str(root/'scripts/release/check-v114-boundaries.py')],cwd=root,capture_output=True,text=True)
            result=check();self.assertEqual(result.returncode,0,result.stderr)
            cases=[('package.json','0.8.37','0.8.38'),('hardhat/package-lock.json','6.17.0','6.17.1'),('ui/package-lock.json','15.5.27','15.5.28'),('ui/package.json','18.3.1','18.3.2'),('ui/vendor/braces/lib/guard.js','128','129'),('hardhat.config.mjs','', '\n// unreviewed compiler change\n'),('hardhat/hardhat.config.js',"optimizerSteps: 'dfD","optimizerSteps: 'dfDE"),('hardhat/hardhat.config.js','runs: 40','runs: 41'),('foundry.toml','optimizerSteps = "dfD','optimizerSteps = "dfDE'),('foundry.toml','optimizer_runs = 40','optimizer_runs = 41'),('contracts/utils/ENSOwnership.sol','', '\n// unreviewed contract change\n'),('contracts/AGIJobManager.sol','', '\n// unreviewed manager change\n'),('test/fixtures/ENSOwnership.pre-revocation.sol.txt','', '\n// mutated history\n')]
            for name,old,new in cases:
                with self.subTest(name=name):
                    target=root/name;before=target.read_text()
                    if old:self.assertIn(old,before)
                    target.write_text(before.replace(old,new,1) if old else before+new)
                    try:self.assertNotEqual(check().returncode,0)
                    finally:target.write_text(before)
            target=root/'config/compiler-profile-mitigation.json';before=target.read_text()
            def mutate_review(change):
                review=json.loads(before);change(review);target.write_text(json.dumps(review))
                try:self.assertNotEqual(check().returncode,0)
                finally:target.write_text(before)
            for field,value in [('baseline','0'*40),('advisory','SOL-2026-8'),('scope','')]:
                with self.subTest(review_field=field):mutate_review(lambda review: review.update({field:value}))
            for name in ('hardhat/hardhat.config.js','foundry.toml'):
                with self.subTest(missing_inventory=name):mutate_review(lambda review: review['files'].pop(name))
                for field in ('beforeSha256','afterSha256'):
                    with self.subTest(inventory=name,digest=field):mutate_review(lambda review: review['files'][name].update({field:'0'*64}))
                with self.subTest(empty_purpose=name):mutate_review(lambda review: review['files'][name].update({'purpose':''}))
                with self.subTest(extra_entry_field=name):mutate_review(lambda review: review['files'][name].update({'unreviewed':True}))
            with self.subTest(extra_inventory=True):
                mutate_review(lambda review: review['files'].update({'hardhat.config.mjs':review['files']['hardhat/hardhat.config.js']}))
            for name in ('hardhat/hardhat.config.js','foundry.toml'):
                with self.subTest(omitted_profile=name):
                    target=root/name;before=target.read_bytes()
                    target.write_bytes(subprocess.check_output(['git','show','191cf3590e5cdc08df1bb0af500ee28a91c8b010:'+name],cwd=root))
                    try:self.assertNotEqual(check().returncode,0)
                    finally:target.write_bytes(before)
            extra=root/'remappings.txt';extra.write_text('@unreviewed/=vendor/unreviewed/\n')
            self.assertNotEqual(check().returncode,0);extra.unlink()
            extra=root/'ui/vendor/braces/unreviewed.js';extra.write_text('module.exports = {};\n')
            self.assertNotEqual(check().returncode,0);extra.unlink()
            self.assertEqual(check().returncode,0)
            extra=root/'contracts/Unreviewed.sol';extra.write_text('// unreviewed source\n')
            self.assertNotEqual(check().returncode,0);extra.unlink()
            self.assertEqual(check().returncode,0)

if __name__=='__main__':unittest.main()
