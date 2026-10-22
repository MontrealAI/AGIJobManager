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
