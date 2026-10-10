#!/usr/bin/env python3
"""One-shot, exact-base v1.14.0 preparation. No deploy, tag, merge or publication."""
import base64,hashlib,json,pathlib,re,subprocess,lzma
ROOT=pathlib.Path.cwd(); BASE='191cf3590e5cdc08df1bb0af500ee28a91c8b010'
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def replace(path,old,new):
    p=ROOT/path;s=p.read_text();assert s.count(old)==1,f'Unexpected anchor in {path}: {old[:60]}';p.write_text(s.replace(old,new))
def put_json(path,obj): (ROOT/path).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
assert git('rev-parse','HEAD^')==BASE,'Preparation must begin at the exact reviewed base plus bootstrap commit'
for path,expected in {'hardhat/scripts/verify-etherscan.cjs':'71aedaea084706f98c656e0033f93c1642944ef1','hardhat/scripts/check-readiness.cjs':'4c3462d975feac82b380756d696aa49927dcad79','hardhat/scripts/nft-policy.cjs':'a36c94789914a80144162bbffa688d84efed218c'}.items():
    assert git('hash-object',path)==expected,f'Source identity changed: {path}'
payload=base64.b64decode(''.join(p.read_text() for p in sorted(ROOT.glob('.v114-bootstrap-payload.part*'))),validate=True)
assert hashlib.sha256(payload).hexdigest()=='2d0c4e7f0ff0af5c0228a98607528bbff7d79996027d3ca026bf725aa7e373f5','Bootstrap payload integrity failure'
for n,content in json.loads(lzma.decompress(payload)).items():
    assert n.startswith(('hardhat/scripts/','hardhat/test/','scripts/release/','docs/releases/v1.14.0/','.github/workflows/'))
    assert '..' not in pathlib.PurePosixPath(n).parts and not n.startswith('/')
    p=ROOT/n;p.parent.mkdir(parents=True,exist_ok=True)
    assert not p.is_symlink()
    assert not p.exists() or n in ['hardhat/scripts/check-readiness.cjs','.github/workflows/current-state-release.yml'],f'Unexpected existing target {n}'
    p.write_text(content)
replace('hardhat/scripts/verify-etherscan.cjs',"const { resolveInputSource } = require('./deployment-safety.cjs');", "const { resolveInputSource } = require('./deployment-safety.cjs');\nconst { publishedInputMatchesBuild } = require('./explorer-input-comparison.cjs');")
replace('hardhat/scripts/verify-etherscan.cjs','JSON.stringify(canonical(publishedInput)) !== JSON.stringify(canonical(sourceCode))','!publishedInputMatchesBuild(publishedInput, sourceCode, artifact)')
# Keep the existing readiness-policy tests isolated from real compiler/network work.
# Real compilation, bytecode identity and actual storage/getters have their own native suite.
replace('hardhat/test/deployment-readiness.test.cjs',"    if (name === './nft-policy.cjs') return require('../scripts/nft-policy.cjs');", """    if (name === './nft-policy.cjs') return require('../scripts/nft-policy.cjs');
    if (name === './nft-registry-snapshot.cjs') return { readRegistrySnapshot: async ({calls: at}) => {
      const agiTypes = [];
      for (let i=0;i<nftEntries.length;i+=1) agiTypes.push(await manager.agiTypes(i, at));
      return {agentNftRequired: await manager.agentNftRequired(at), agiTypes,
        evidence: {method: 'unit-test-double', count: agiTypes.length, slot: '77', transactionsBroadcast: 0}};
    }};""")
for directory in ('','hardhat/','ui/'):
    for basename in ('package.json','package-lock.json'):
        p=directory+basename;j=json.loads((ROOT/p).read_text());assert j['version']=='1.13.0';j['version']='1.14.0'
        if basename=='package-lock.json':assert j['packages']['']['version']=='1.13.0';j['packages']['']['version']='1.14.0'
        if p=='hardhat/package.json':
            for name in ('reverify:mainnet','reverify:sepolia','check:readiness','check:readiness:sepolia'):
                j['scripts'][name]=j['scripts'][name].replace(' run scripts/',' run --no-compile scripts/')
            j['scripts']['test:registry-native']='node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs test test/nft-registry-native.test.js'
        put_json(p,j)
j=json.loads((ROOT/'config/usdc-deployment.json').read_text());assert j['version']=='1.13.0';j['version']='1.14.0';put_json('config/usdc-deployment.json',j)
# Active version labels/download references only; historical and legal evidence remains untouched.
active=[ROOT/'README.md',ROOT/'hardhat/README.md',ROOT/'ui/README.md']
for p in (ROOT/'docs').rglob('*'):
    if p.suffix=='.md' and not set(p.relative_to(ROOT/'docs').parts[:-1])&{'releases','qualification','LEGAL','security'}:active.append(p)
for p in active:
    s=p.read_text();s=s.replace('/releases/download/v1.13.0/','/releases/download/v1.14.0/').replace('AGIJobManager-v1.13.0-COMPLETE.zip','AGIJobManager-v1.14.0-COMPLETE.zip')
    lines=s.splitlines(keepends=True)
    if lines:lines[0]=lines[0].replace('v1.13.0','v1.14.0').replace(' 1.13.0',' 1.14.0')
    s=''.join(lines)
    s=s.replace('**Current software edition: v1.13.0.**','**Current software edition: v1.14.0.**')
    p.write_text(s)
p=ROOT/'ui/agijobmanager-usdc.html';s=p.read_text();s=s.replace('v1.13.0','v1.14.0');p.write_text(s)
for path in ('scripts/release/package-release.py','scripts/release/publish-release.py','scripts/release/test-release-gates.py'):
    p=ROOT/path;p.write_text(p.read_text().replace('v1.13.0','v1.14.0'))
replace('scripts/release/publish-release.py',"repo, tag, source = (config[k] for k in ['repository', 'tag', 'sourceCommit'])", """repo, tag, source = (config[k] for k in ['repository', 'tag', 'sourceCommit'])
if config.get('status') != 'qualified' or not isinstance(source, str) or not re.fullmatch(r'[0-9a-f]{40}', source):
    raise SystemExit('Release is prepared, not qualified for publication. Record the final source commit and successful CI before publishing.')""")
replace('scripts/release/publish-release.py',"assert os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires a main push.'", """assert os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' and os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Publication requires an explicitly authorized main-branch dispatch.'
assert os.environ.get('RELEASE_PUBLISH_CONFIRMATION') == 'PUBLISH_v1.14.0', 'Explicit v1.14.0 publication confirmation is required.'""")
replace('scripts/release/publish-release.py',"required_workflows = {'ci.yml', 'ui.yml', 'docs.yml', 'security-verification.yml', 'mainnet-fork.yml'}", "required_workflows = {'ci.yml', 'ui.yml', 'docs.yml', 'security-verification.yml', 'mainnet-fork.yml', 'current-state-release.yml'}")
p=ROOT/'scripts/release/publish-release.py';s=p.read_text().replace('The five application qualification workflows are required.','All six application and release-preparation qualification workflows are required.');p.write_text(s)
config={'repository':'MontrealAI/AGIJobManager','tag':'v1.14.0','version':'1.14.0','name':'v1.14.0 — Ethereum Mainnet Verification & Readiness','status':'prepared','publicationAuthorized':False,'sourceCommit':None,'sourceTree':None,'releaseDate':None,'primaryUI':'ui/agijobmanager-usdc.html','requiredSourceRuns':{},'requiredWorkflows':['ci.yml','ui.yml','docs.yml','security-verification.yml','mainnet-fork.yml','current-state-release.yml'],'remainingGate':'Populate immutable final-source CI evidence and review the final archive before separately authorized publication.'}
put_json('docs/releases/v1.14.0/release.json',config)
readme=ROOT/'README.md';s=readme.read_text();pos=s.find('\n')+1;s=s[:pos]+"\n> **v1.14.0 preparation candidate:** [verification, readiness and recovery guide](docs/releases/v1.14.0/RECOVERY_GUIDE.md). [Release notes](docs/releases/v1.14.0/RELEASE_NOTES.md). This branch is not a published release and does not authorize activation. Candidate artifacts are retained by the release-preparation workflow; versioned download links become available only after publication.\n"+s[pos:];readme.write_text(s)
for p in [*ROOT.glob('.v114-bootstrap-payload.part*'),ROOT/'.v114-bootstrap.py',ROOT/'.github/workflows/v114-preparation-bootstrap.yml']:p.unlink()
assert not git('diff','--name-only',BASE,'--','contracts','hardhat.config.mjs','hardhat/hardhat.config.js','foundry.toml','remappings.txt'),'Protected source changed'
print('v1.14.0 source prepared. Generate documentation, commit and qualify the exact resulting source. No publication authorized.')
