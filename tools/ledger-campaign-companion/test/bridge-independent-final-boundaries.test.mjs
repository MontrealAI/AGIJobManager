// Independent review regressions retained with permission; synthetic fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {registerActorLockDirectory,operatorPolicyDirectory} from '../bridge/actor-lock-policy.mjs';
import {runtime,cleanEnvironment} from '../coordinators/common.mjs';
const root=path.resolve('.');
async function temp(fn){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'independent-final-boundary-'));try{await fn(directory);}finally{await fs.rm(directory,{recursive:true,force:true});}}
test('operator registry accepts concurrent identical pinning and refuses alternate actor directory',()=>temp(async dir=>{const policyDirectory=path.join(dir,'operator-policy'),directory=path.join(dir,'shared-actors');const result=await Promise.all([registerActorLockDirectory({directory,policyDirectory}),registerActorLockDirectory({directory,policyDirectory})]);assert.deepEqual(result[0],result[1]);await assert.rejects(registerActorLockDirectory({directory:path.join(dir,'alternate'),policyDirectory}));const registry=path.join(policyDirectory,'actor-lock-policy.json');assert.equal((await fs.stat(registry)).mode&0o777,0o600);assert.equal(JSON.parse(await fs.readFile(registry,'utf8')).actorLockDirectory,directory);}));
test('operator registry rejects symlink directory and permissive registry file',()=>temp(async dir=>{const policyDirectory=path.join(dir,'operator-policy'),directory=path.join(dir,'shared-actors');await fs.mkdir(directory,{mode:0o700});await fs.symlink(directory,path.join(dir,'alias'));await assert.rejects(registerActorLockDirectory({directory:path.join(dir,'alias'),policyDirectory}));await registerActorLockDirectory({directory,policyDirectory});await fs.chmod(path.join(policyDirectory,'actor-lock-policy.json'),0o644);await assert.rejects(registerActorLockDirectory({directory,policyDirectory}));}));
test('operator policy location is obtained from OS account rather than HOME environment',()=>{const original=process.env.HOME;try{process.env.HOME='/not-an-operator-home-fixture';assert.ok(operatorPolicyDirectory().startsWith(os.userInfo().homedir+path.sep));assert.equal(operatorPolicyDirectory().includes('not-an-operator-home-fixture'),false);}finally{if(original===undefined)delete process.env.HOME;else process.env.HOME=original;}});
test('runtime pin validates exact executable hash and actual version; bad pins fail before coordinator load',async()=>{const nodePath=await fs.realpath(process.execPath),bytes=await fs.readFile(nodePath),nodeSha256=createHash('sha256').update(bytes).digest('hex'),nodeVersion=process.versions.node,config={nodePath,nodeSha256,nodeVersion},supported={nodeVersions:[nodeVersion]};assert.doesNotThrow(()=>runtime(config,supported));assert.throws(()=>runtime({...config,nodeSha256:'f'.repeat(64)},supported));assert.throws(()=>runtime({...config,nodeVersion:'0.0.0'},supported));assert.throws(()=>runtime(config,{nodeVersions:['0.0.0']}));});
test('startup malformed flags expose only fixed error and do not create state or claim actor policy',()=>temp(async dir=>{const result=spawnSync(process.execPath,[path.join(root,'bridge/start.mjs'),'--campaign',path.join(dir,'missing.json'),'--reviewed-campaign-sha256','f'.repeat(64),'--actor-lock-directory',path.join(dir,'actors'),'--state',path.join(dir,'state'),'--policy-directory',path.join(dir,'forbidden')],{encoding:'utf8',env:cleanEnvironment()});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^COMPANION_START_BLOCKED: preserve private state and review the exact campaign\/source configuration\.\n$/);assert.deepEqual(await fs.readdir(dir),[]);}));
test('production startup requires independently reviewed trust policy and rejects non-Mac hosts before reading or creating campaign state',()=>temp(async dir=>{
  const flags=['--campaign',path.join(dir,'missing.json'),'--reviewed-campaign-sha256','a'.repeat(64),'--actor-lock-directory',path.join(dir,'actors'),'--state',path.join(dir,'state')];
  for(const args of [flags,[...flags,'--trust-policy',path.join(dir,'policy.json'),'--reviewed-trust-policy-sha256','b'.repeat(64)]]){
    const result=spawnSync(process.execPath,[path.join(root,'bridge/start.mjs'),...args],{encoding:'utf8',env:cleanEnvironment()});
    assert.equal(result.status,1);assert.equal(result.stdout,'');
    const nonMac=process.platform!=='darwin'&&args.length>flags.length;
    assert.equal(result.stderr,(nonMac?'TRUSTED_MAC_SIGNING_HOST_REQUIRED\n':'')+'COMPANION_START_BLOCKED: preserve private state and review the exact campaign/source configuration.\n');
    assert.deepEqual(await fs.readdir(dir),[]);
  }
}));
