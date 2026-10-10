import pathlib, shutil, subprocess, tempfile, unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]

class DependencyBoundaries(unittest.TestCase):
    def test_authorized_repairs_and_rejected_mutations(self):
        with tempfile.TemporaryDirectory(prefix='v114-boundaries-') as tmp:
            root=pathlib.Path(tmp)/'source'
            subprocess.run(['git','clone','--quiet','--shared','--no-checkout',str(ROOT),str(root)],check=True)
            subprocess.run(['git','reset','--hard','191cf3590e5cdc08df1bb0af500ee28a91c8b010'],cwd=root,check=True,stdout=subprocess.DEVNULL)
            paths=['package.json','package-lock.json','hardhat/package.json','hardhat/package-lock.json','ui/package.json','ui/package-lock.json','config/usdc-deployment.json','config/v114-dependency-repairs.json','scripts/release/check-v114-boundaries.py','hardhat/scripts/check-readiness.cjs']
            paths += [str(p.relative_to(ROOT)) for p in (ROOT/'ui/vendor/braces').rglob('*') if p.is_file()]
            for name in paths:
                target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
            def check(): return subprocess.run(['python3',str(root/'scripts/release/check-v114-boundaries.py')],cwd=root,capture_output=True,text=True)
            self.assertEqual(check().returncode,0)
            cases=[('package.json','0.8.37','0.8.38'),('hardhat/package-lock.json','6.17.0','6.17.1'),('ui/package-lock.json','15.5.27','15.5.28'),('ui/package.json','18.3.1','18.3.2'),('ui/vendor/braces/lib/guard.js','128','129'),('hardhat.config.mjs','', '\n// unreviewed compiler change\n')]
            for name,old,new in cases:
                with self.subTest(name=name):
                    target=root/name;before=target.read_text()
                    target.write_text(before.replace(old,new,1) if old else before+new)
                    try:self.assertNotEqual(check().returncode,0)
                    finally:target.write_text(before)
            extra=root/'ui/vendor/braces/unreviewed.js';extra.write_text('module.exports = {};\n')
            self.assertNotEqual(check().returncode,0);extra.unlink()
            self.assertEqual(check().returncode,0)

if __name__=='__main__':unittest.main()
