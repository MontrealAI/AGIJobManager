const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const braces = require('../vendor/braces');
const parse = require('../vendor/braces/lib/parse');
const compile = require('../vendor/braces/lib/compile');
const expand = require('../vendor/braces/lib/expand');
const stringify = require('../vendor/braces/lib/stringify');
const { flatten } = require('../vendor/braces/lib/utils');
const { MAX_NESTING, MAX_NODES } = require('../vendor/braces/lib/guard');
const complexity = error => error instanceof SyntaxError && error.code === 'ERR_BRACES_COMPLEXITY' && !/call stack/i.test(error.message);

test('all installed transitive braces consumers resolve the reviewed local fork', () => {
  const expected = fs.realpathSync(require.resolve('../vendor/braces'));
  for (const owner of ['micromatch', 'chokidar', 'tailwindcss']) {
    const from = createRequire(require.resolve(owner));
    assert.equal(fs.realpathSync(from.resolve('braces')), expected, owner);
  }
  const plugin = createRequire(require.resolve('@next/eslint-plugin-next'));
  const glob = createRequire(plugin.resolve('fast-glob'));
  const match = createRequire(glob.resolve('micromatch'));
  assert.equal(fs.realpathSync(match.resolve('braces')), expected);
  const lock = require('../package-lock.json');
  for (const [name, value] of Object.entries(lock.packages)) {
    if (name.endsWith('node_modules/braces')) assert.ok(value.link && value.resolved === 'vendor/braces', name);
  }
});

test('valid brace expansion and regex compilation preserve consumer behavior', () => {
  assert.deepEqual(braces.expand('src/{app,components}/**/*.{ts,tsx}'), ['src/app/**/*.ts','src/app/**/*.tsx','src/components/**/*.ts','src/components/**/*.tsx']);
  assert.equal(braces.compile('job-{1..3}-{a,b}'), 'job-([1-3])-(a|b)');
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a','b','c']);
  assert.deepEqual(braces.expand('{a,a,,b}', { nodupes: true, noempty: true }), ['a','b']);
  assert.equal(braces.stringify(braces.parse('src/{a,b}')), 'src/{a,b}');
  assert.deepEqual(braces.expand('{1..1001}', { rangeLimit: false }).length, 1001);
  assert.throws(() => braces.expand('{1..1001}'), RangeError);
  assert.deepEqual(require('micromatch')(['src/a.ts','src/a.tsx','src/a.js'], 'src/*.{ts,tsx}'), ['src/a.ts','src/a.tsx']);
});

test('every public string entrypoint rejects deeply nested braces and parentheses', () => {
  const inputs = ['{'.repeat(4000)+'x'+'}'.repeat(4000), '('.repeat(4000)+'x'+')'.repeat(4000), '{('.repeat(2000)+'x'+')}'.repeat(2000)];
  for (const input of inputs) for (const fn of [braces, braces.create, braces.parse, braces.compile, braces.expand, braces.stringify, parse]) {
    assert.throws(() => fn(input, { maxDepth: Infinity, depth: Infinity, maxLength: NaN }), complexity);
  }
});

test('parser allows exactly the nesting boundary and rejects one level more', () => {
  for (const [open, close] of [['{','}'], ['(',')']]) {
    const allowed = open.repeat(MAX_NESTING)+'x'+close.repeat(MAX_NESTING);
    assert.equal(braces.stringify(allowed), allowed);
    assert.doesNotThrow(() => braces.compile(allowed));
    assert.doesNotThrow(() => braces.expand(allowed));
    assert.throws(() => parse(open+allowed+close), complexity);
  }
});

test('quoted, escaped and bracket-literal delimiters do not consume AST nesting', () => {
  for (const input of ['"'+'{'.repeat(300)+'"', '\\{'.repeat(300), '['+'{'.repeat(300)+']']) {
    assert.doesNotThrow(() => braces.compile(input));
  }
  for (const input of ['{{a,b}', '((a)', 'x/{a,b', '{a,(b,c)}', '${a,{b,c}}', '{a..b,c}']) {
    assert.doesNotThrow(() => braces.compile(input));
    assert.doesNotThrow(() => braces.expand(input));
    assert.doesNotThrow(() => braces.stringify(input));
  }
});

test('hard input length cannot be bypassed by NaN or Infinity', () => {
  for (const maxLength of [NaN, Infinity, 1000000]) assert.throws(() => parse('a'.repeat(10001), { maxLength }), SyntaxError);
  assert.throws(() => parse('abcd', { maxLength: 3 }), SyntaxError);
  assert.doesNotThrow(() => parse('a'.repeat(10000), { maxLength: NaN }));
});

test('direct AST walkers reject child cycles, parent cycles and repeated-child amplification', () => {
  const cyclic = { type:'root', nodes:[] }; cyclic.nodes.push(cyclic);
  const parentCycle = { type:'root', nodes:[] }; parentCycle.parent = parentCycle;
  const shared = { type:'text', value:'a' };
  const dag = { type:'root', nodes:[shared,shared] };
  for (const ast of [cyclic,parentCycle,dag]) for (const fn of [compile,expand,stringify,braces.compile,braces.expand,braces.stringify]) assert.throws(() => fn(ast), complexity);
});

test('direct AST walkers bound child depth, parent depth and breadth before recursion', () => {
  let deep = { type:'text', value:'x' };
  for (let i=0;i<1000;i++) deep = { type:'root', nodes:[deep] };
  const parentDeep = { type:'root', nodes:[] }; let node=parentDeep;
  for (let i=0;i<1000;i++) node=node.parent={};
  const wide = { type:'root', nodes:Array.from({length:MAX_NODES+1},()=>({type:'text',value:'x'})) };
  for (const ast of [deep,parentDeep,wide]) for (const fn of [compile,expand,stringify]) assert.throws(() => fn(ast), complexity);
});

test('iterative flatten preserves repeated arrays, detects cycles and bounds nesting', () => {
  const repeated=['a',['b']]; assert.deepEqual(flatten(repeated,repeated),['a','b','a','b']);
  const cyclic=[];cyclic.push(cyclic);assert.throws(()=>flatten(cyclic),complexity);
  let deep=['a'];for(let i=0;i<1000;i++)deep=[deep];assert.throws(()=>flatten(deep),complexity);
  assert.deepEqual(flatten([null,undefined,0,false]),[null,0,false]);
  assert.equal(flatten(Array(25000).fill('x')).length,25000);
});

test('expansion bounds inherited parent queues and supplied node values before append can overflow', () => {
  for (const source of ['parent','value']) for (const cyclic of [false,true]) for (const fn of [expand,braces.expand]) {
    let nested=['x'];
    if (cyclic) nested.push(nested);
    else for(let i=0;i<20000;i++)nested=[nested];
    const parent={type:'brace',queue:[nested]};
    const ast=source==='parent' ? {type:'paren',parent,nodes:[{type:'text',value:'a'}]} : {type:'root',nodes:[{type:'text',value:'prefix'},{type:'text',value:nested}]};
    assert.throws(()=>fn(ast),complexity);
  }
});

test('all AST walkers reject malformed scalar fields before implicit recursive coercion', () => {
  let deep=['x'];for(let i=0;i<20000;i++)deep=[deep];
  const cyclic=[];cyclic.push(cyclic);
  for(const value of [deep,cyclic,{},42,null]) for(const fn of [compile,expand,stringify,braces.compile,braces.expand,braces.stringify]) {
    assert.throws(()=>fn({type:'root',nodes:[{type:'text',value}]}),complexity);
  }
  for(const field of ['ranges','commas']) for(const value of [deep,cyclic,{},'1',null]) for(const fn of [compile,expand,stringify]) {
    assert.throws(()=>fn({type:'root',nodes:[{type:'brace',nodes:[],[field]:value}]}),complexity);
  }
});
