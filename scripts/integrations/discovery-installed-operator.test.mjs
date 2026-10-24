// SPDX-License-Identifier: MIT
// Inert metadata and text-decoding fixtures; no Git process or supplied module is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {guardMainGitConfig,decodeUtf8} from './discovery-release-native-test.mjs';

function fixture(check) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'manager-inert-worktree-'));
  fs.mkdirSync(path.join(root,'.git'));
  const config=path.join(root,'.git/config'),ignored=path.join(root,'.git/config.worktree');
  fs.writeFileSync(config,'[core]\n repositoryformatversion = 0\n bare = false\n');
  try {return check({root,config,ignored});} finally {fs.rmSync(root,{recursive:true,force:true});}
}

test('original UTF8 text preserves framing and malformed encoded input is refused',()=>{
  const raw=Buffer.from('  {"original":"café"}\n');
  assert.equal(decodeUtf8(raw),'  {"original":"café"}\n');
  assert.throws(()=>decodeUtf8(Buffer.from([0xc3,0x28])));
});

test('a bounded regular ignored worktree file is retained when main cannot activate it',()=>fixture(({root,config,ignored})=>{
  fs.writeFileSync(ignored,'[core]\n worktree = /inert/unavailable/path\n');
  const before=fs.readFileSync(ignored);
  guardMainGitConfig(root);
  fs.appendFileSync(config,'[extensions]\n worktreeConfig = false # explicitly inactive\n');
  guardMainGitConfig(root);
  assert.deepEqual(fs.readFileSync(ignored),before);
}));

test('active bare unknown and multiline worktree flags fail before any Git operation',()=>fixture(({root,config,ignored})=>{
  fs.writeFileSync(ignored,'ordinary ignored bytes');
  for(const suffix of ['worktreeConfig = true','worktreeConfig','worktreeConfig = "false"',
    'worktreeConfig = unknown','worktreeConfig = fal\\\n se','worktreeConfig = false\n worktreeConfig = true']) {
    fs.writeFileSync(config,'[core]\n bare = false\n[extensions]\n '+suffix+'\n');
    assert.throws(()=>guardMainGitConfig(root),undefined,suffix);
  }
}));

test('ignored worktree metadata still must be bounded and regular',()=>fixture(({root,ignored})=>{
  fs.writeFileSync(ignored,Buffer.alloc(128001));
  assert.throws(()=>guardMainGitConfig(root));
  fs.unlinkSync(ignored);fs.mkdirSync(ignored);
  assert.throws(()=>guardMainGitConfig(root));
}));

test('raw main namespaces and root redirection are refused without starting Git',()=>fixture(({root,config})=>{
  for(const raw of ['[include]\n path = /inert/unavailable/config\n',
    '[filter "inert"]\n required = true\n','[core]\n worktree = /inert/unavailable/root\n',
    '[core "inert"]\n bare = false\n','[extensions]\n partialClone = inert\n']) {
    fs.writeFileSync(config,raw);assert.throws(()=>guardMainGitConfig(root));
  }
  fs.writeFileSync(config,'[core]\n bare = false\n');
  fs.writeFileSync(path.join(root,'.git/commondir'),'inert-unavailable-metadata');
  assert.throws(()=>guardMainGitConfig(root));
}));

test('checkout gc metadata permits only one literal inactive auto zero',()=>fixture(({root,config})=>{
  fs.writeFileSync(config,'[core]\n bare = false\n[gc]\n auto = 0 # checkout disables auto gc\n');
  guardMainGitConfig(root);
  for(const raw of ['[gc]\n auto\n','[gc]\n auto = 1\n','[gc]\n auto = "0"\n',
    '[gc]\n auto = 0\n auto = 1\n','[gc]\n auto = 0\n auto = 0\n',
    '[gc "inert"]\n auto = 0\n','[gc]\n other = 0\n']) {
    fs.writeFileSync(config,raw);assert.throws(()=>guardMainGitConfig(root));
  }
}));


import {receiverSourcesForHistory,qualifiedCounterpartSource,JOBS_RC20_COUNTERPART,JOBS_RC21_COUNTERPART} from './discovery-installed-operator.mjs';
const ownSource={repository:'MontrealAI/AGIJobManager',
  commit:'3153ac394d37eeecb03e825ecce37559427bc6c3',tree:'4a08ce51d68ea57bbb7193275870053b79943c25',
  adapterSha256:'a'.repeat(64),contractSha256:JOBS_RC20_COUNTERPART.source.contractSha256};

test('historical cross-receiver evidence requires explicit qualified counterpart selection',()=>{
  assert.deepEqual(receiverSourcesForHistory(ownSource,[ownSource]),[ownSource]);
  assert.throws(()=>receiverSourcesForHistory(ownSource,[JOBS_RC20_COUNTERPART.source]),/absent/);
  assert.deepEqual(receiverSourcesForHistory(ownSource,[JOBS_RC20_COUNTERPART.source,ownSource],
    structuredClone(JOBS_RC20_COUNTERPART)),[ownSource,JOBS_RC20_COUNTERPART.source]);
});

test('counterpart selection refuses absent unknown or changed public archive and source identities',()=>{
  for(const key of ['schema','id','archiveSha256','archiveBytes','manifestSha256','source']) {
    const missing=structuredClone(JOBS_RC20_COUNTERPART);delete missing[key];
    assert.throws(()=>receiverSourcesForHistory(ownSource,[],missing),/Counterpart/);
    const changed=structuredClone(JOBS_RC20_COUNTERPART);
    changed[key]=key==='archiveBytes'?changed[key]+1:key==='source'?{...changed.source,commit:'f'.repeat(40)}:'unknown';
    assert.throws(()=>receiverSourcesForHistory(ownSource,[],changed),/Counterpart/);
  }
  const extra={...structuredClone(JOBS_RC20_COUNTERPART),authority:'execute'};
  assert.throws(()=>receiverSourcesForHistory(ownSource,[],extra),/Counterpart/);
  let reads=0;const accessor={get id(){reads++;return 'jobs-rc20-f7';}};
  assert.throws(()=>receiverSourcesForHistory(ownSource,[],accessor));assert.equal(reads,0);
});

test('known counterpart admission never trusts a changed source in retained receipt history',()=>{
  for(const key of ['repository','commit','tree','adapterSha256','contractSha256']) {
    const changed={...JOBS_RC20_COUNTERPART.source,[key]:'unknown'};
    assert.throws(()=>receiverSourcesForHistory(ownSource,[changed],JOBS_RC20_COUNTERPART),/absent/);
  }
  assert.throws(()=>receiverSourcesForHistory(ownSource,[{...JOBS_RC20_COUNTERPART.source,extra:true}],JOBS_RC20_COUNTERPART),/absent/);
  assert.throws(()=>receiverSourcesForHistory(ownSource,[{...ownSource,commit:'0'.repeat(40)}],JOBS_RC20_COUNTERPART),/absent/);
});

test('pending rc21 counterpart admits no inferred archive manifest or source identity',()=>{
  assert.equal(JOBS_RC21_COUNTERPART,null);
  assert.equal(qualifiedCounterpartSource(structuredClone(JOBS_RC20_COUNTERPART)),JOBS_RC20_COUNTERPART.source);
  const unqualified={...structuredClone(JOBS_RC20_COUNTERPART),id:'jobs-rc21-unpublished'};
  assert.throws(()=>qualifiedCounterpartSource(unqualified),/Counterpart.*pending/);
  assert.throws(()=>receiverSourcesForHistory(ownSource,[unqualified.source],unqualified),/Counterpart.*pending/);
  assert.throws(()=>qualifiedCounterpartSource(null),/Counterpart.*pending/);
});

test('counterpart selection cannot combine the pending edition with historical rc20 identities',()=>{
  for(const key of ['archiveSha256','archiveBytes','manifestSha256','source']) {
    const selection=structuredClone(JOBS_RC20_COUNTERPART);
    selection[key]=key==='archiveBytes'?selection[key]+1:key==='source'?{...selection.source,commit:'0'.repeat(40)}:'0'.repeat(64);
    assert.throws(()=>qualifiedCounterpartSource(selection),/Counterpart/);
  }
  assert.deepEqual(receiverSourcesForHistory(ownSource,[],null),[ownSource]);
});
