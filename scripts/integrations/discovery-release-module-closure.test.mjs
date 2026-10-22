// SPDX-License-Identifier: MIT
// Ordinary syntax and resolver fixtures only. Supplied modules are never evaluated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseModuleSources, checkDependencyRecords, ownedTarget} from './discovery-release-module-closure.mjs';

test('engine parser retains named, namespace, side-effect and re-export dependencies', () => {
  const source = `import value from './value.mjs';
import * as space from './space.mjs';
import './side.mjs';
export {named} from './named.mjs';
export * from './star.mjs';
export * as namespace from './namespace.mjs';`;
  const records = parseModuleSources([{name:'entry.mjs',source}]);
  assert.deepEqual(records,[{name:'entry.mjs',requests:[
    './value.mjs','./space.mjs','./side.mjs','./named.mjs','./star.mjs','./namespace.mjs']}]);
  checkDependencyRecords(records,new Set(['entry.mjs','value.mjs','space.mjs','side.mjs','named.mjs','star.mjs','namespace.mjs']));
});

test('comments, line breaks, URL strings and escaped string specifiers preserve static dependencies', () => {
  const source = `const documentation = 'https://example.invalid/';
import /* ordinary comment */
  {value} from './de\\u0070.mjs';
export /* another comment */ {value} from './dep.mjs';`;
  const records = parseModuleSources([{name:'entry.mjs',source}]);
  assert.deepEqual(records,[{name:'entry.mjs',requests:['./dep.mjs']}]);
});

test('all captured modules are checked, including modules outside the entry graph', () => {
  const records = parseModuleSources([
    {name:'entry.mjs',source:'export const value = 1;'},
    {name:'other.mjs',source:"export * from './missing.mjs';"}]);
  assert.throws(()=>checkDependencyRecords(records,new Set(['entry.mjs','other.mjs'])),/absent/);
});

test('owned relative resolution permits captured cycles and normalizes relative paths', () => {
  const records = parseModuleSources([
    {name:'entry.mjs',source:"import './nested/child.mjs';"},
    {name:'nested/child.mjs',source:"export * from '../entry.mjs';"}]);
  const names = new Set(['entry.mjs','nested/child.mjs']);
  checkDependencyRecords(records,names);
  assert.equal(ownedTarget('./nested/../entry.mjs','entry.mjs',names),'entry.mjs');
});

test('unlisted, bare, builtin, URL, absolute, query and fragment targets are denied', () => {
  const names = new Set(['entry.mjs','dep.mjs']);
  for(const specifier of ['../outside.mjs','./missing.mjs','package','node:fs',
    'https://example.invalid/source.mjs','file:///ordinary/source.mjs','/ordinary/source.mjs',
    './dep.mjs?version=1','./dep.mjs#section','./%64ep.mjs']) {
    assert.throws(()=>ownedTarget(specifier,'entry.mjs',names),undefined,specifier);
  }
});

test('builtin exceptions are exact and per parent', () => {
  const names = new Set(['entry.mjs','other.mjs']);
  const policy = {'entry.mjs':['node:crypto']};
  assert.equal(ownedTarget('node:crypto','entry.mjs',names,policy),'node:crypto');
  assert.throws(()=>ownedTarget('node:crypto','other.mjs',names,policy));
  assert.throws(()=>ownedTarget('crypto','entry.mjs',names,policy));
});

test('dynamic syntax has no static request record and requires the owned loader boundary', () => {
  const records = parseModuleSources([{name:'entry.mjs',source:
    "export const later = name => import(name);"}]);
  assert.deepEqual(records,[{name:'entry.mjs',requests:[]}]);
  // This assertion deliberately makes no dynamic-loading safety claim from parsing.
});

test('duplicate module records and an overlarge source map are refused by the bounded parser', () => {
  assert.throws(()=>parseModuleSources([{name:'same.mjs',source:''},{name:'same.mjs',source:''}]));
  assert.throws(()=>parseModuleSources(Array.from({length:257},(_,index)=>({name:`module-${index}.mjs`,source:''}))));
});
