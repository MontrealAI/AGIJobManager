// SPDX-License-Identifier: MIT
// Inert metadata and text-decoding fixtures; no Git process or supplied module is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
  for(const peer of [JOBS_RC20_COUNTERPART,JOBS_RC21_COUNTERPART]) {
    for(const key of ['schema','id','archiveSha256','archiveBytes','manifestSha256','source']) {
      const missing=structuredClone(peer);delete missing[key];
      assert.throws(()=>receiverSourcesForHistory(ownSource,[],missing),/Counterpart/);
      const changed=structuredClone(peer);
      changed[key]=key==='archiveBytes'?changed[key]+1:key==='source'?{...changed.source,commit:'f'.repeat(40)}:'unknown';
      assert.throws(()=>receiverSourcesForHistory(ownSource,[],changed),/Counterpart/);
    }
    const extra={...structuredClone(peer),authority:'execute'};
    assert.throws(()=>receiverSourcesForHistory(ownSource,[],extra),/Counterpart/);
  }
  let reads=0;const accessor={get id(){reads++;return 'jobs-rc20-f7';}};
  assert.throws(()=>receiverSourcesForHistory(ownSource,[],accessor));assert.equal(reads,0);
});

test('known counterpart admission never trusts a changed source in retained receipt history',()=>{
  for(const peer of [JOBS_RC20_COUNTERPART,JOBS_RC21_COUNTERPART]) {
    for(const key of ['repository','commit','tree','adapterSha256','contractSha256']) {
      const changed={...peer.source,[key]:'unknown'};
      assert.throws(()=>receiverSourcesForHistory(ownSource,[changed],peer),/absent/);
    }
    assert.throws(()=>receiverSourcesForHistory(ownSource,[{...peer.source,extra:true}],peer),/absent/);
    assert.throws(()=>receiverSourcesForHistory(ownSource,[{...ownSource,commit:'0'.repeat(40)}],peer),/absent/);
  }
});

test('published rc21 selection matches the independently authenticated exact public record',()=>{
  const raw=fs.readFileSync(new URL('../../config/discovery-jobs-rc21-counterpart-v1.json',import.meta.url));
  assert.equal(raw.length,640);
  assert.equal(createHash('sha256').update(raw).digest('hex'),'b4be96c8dd1030133b7a0c3335cb6cb8134090300000c34658712a760ac30fda');
  assert.deepEqual(JSON.parse(decodeUtf8(raw)),JOBS_RC21_COUNTERPART);
  assert.equal(Object.isFrozen(JOBS_RC21_COUNTERPART),true);
  assert.equal(Object.isFrozen(JOBS_RC21_COUNTERPART.source),true);
  assert.equal(qualifiedCounterpartSource(structuredClone(JOBS_RC20_COUNTERPART)),JOBS_RC20_COUNTERPART.source);
  assert.equal(qualifiedCounterpartSource(structuredClone(JOBS_RC21_COUNTERPART)),JOBS_RC21_COUNTERPART.source);
  assert.deepEqual(receiverSourcesForHistory(ownSource,[JOBS_RC21_COUNTERPART.source,ownSource],
    JSON.parse(decodeUtf8(raw))),[ownSource,JOBS_RC21_COUNTERPART.source]);
  assert.throws(()=>qualifiedCounterpartSource({...structuredClone(JOBS_RC21_COUNTERPART),id:'jobs-rc22-unpublished'}),/Counterpart/);
  assert.throws(()=>qualifiedCounterpartSource(null),/Counterpart/);
});

test('counterpart selection cannot mix either published edition with the other identities or receipt history',()=>{
  for(const [peer,other] of [[JOBS_RC20_COUNTERPART,JOBS_RC21_COUNTERPART],[JOBS_RC21_COUNTERPART,JOBS_RC20_COUNTERPART]]) {
    for(const key of ['id','archiveSha256','archiveBytes','manifestSha256','source']) {
      const selection=structuredClone(peer);selection[key]=structuredClone(other[key]);
      assert.throws(()=>qualifiedCounterpartSource(selection),/Counterpart/);
    }
    for(const key of ['commit','tree']) {
      const selection=structuredClone(peer);selection.source[key]=other.source[key];
      assert.throws(()=>qualifiedCounterpartSource(selection),/Counterpart/);
    }
    assert.throws(()=>receiverSourcesForHistory(ownSource,[other.source],peer),/absent/);
  }
  assert.deepEqual(receiverSourcesForHistory(ownSource,[],null),[ownSource]);
});
