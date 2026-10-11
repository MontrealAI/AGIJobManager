'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const E = require('../../scripts/commissioning/mainnet-evidence.cjs');
const root = path.resolve(__dirname, '../..');
const raw = fs.readFileSync(E.RECORD, 'utf8');
const duplicateAuthority = raw.replace('"intakeActivationAuthorized": false',
  '"intakeActivationAuthorized": true, "intakeActivationAuthorized": false');
test('raw duplicate authority is rejected before the parsed-object fingerprint can discard it', () => {
  assert.notEqual(duplicateAuthority, raw);
  assert.deepEqual(JSON.parse(duplicateAuthority), JSON.parse(raw));
  assert.throws(() => E.parseRecord(duplicateAuthority), {message: 'RECORD_JSON_DUPLICATE_KEY'});
});
for (const [name, text] of [
  ['root key', '{"x":0,"x":1}'],
  ['identical value', '{"x":0,"x":0}'],
  ['nested key', '{"x":{"y":0,"y":1}}'],
  ['object inside array', '{"x":[{"y":0,"y":1}]}'],
  ['escaped first key', String.raw`{"\u0078":0,"x":1}`],
  ['escaped second key', String.raw`{"x":0,"\u0078":1}`],
  ['escaped quote key', String.raw`{"a\"b":0,"a\u0022b":1}`],
  ['prototype-named key', '{"__proto__":null,"__proto__":null}'],
]) test('duplicate-key scanner rejects ' + name, () => {
  assert.throws(() => E.parseRecord(text), {message: 'RECORD_JSON_DUPLICATE_KEY'});
});
for (const [name, text] of [
  ['original record', raw],
  ['formatted record', JSON.stringify(JSON.parse(raw), null, 4)],
  ['repeated keys in separate objects', '{"a":{"x":0},"b":[{"x":1},{"x":2}]}'],
  ['structural characters inside strings', JSON.stringify({a: '{,"x":0}', b: ['["x",]', 'a\\"b'], c: {'a"b': 'text'}})],
  ['empty containers and scalar values', '[{},[],null,false,true,1,-2,1.5,"text"]'],
]) test('strict parser accepts ' + name + ' without changing the decoded value', () => {
  assert.deepEqual(E.parseRecord(text), JSON.parse(text));
});
for (const text of ['{"SECRET_SENTINEL":', '{"x":1,}', '{"x":1} trailing', '{"x":"\\x20"}'])
  test('malformed JSON produces a fixed diagnostic, not a source excerpt: ' + text.length, () => {
    assert.throws(() => E.parseRecord(text), {message: 'RECORD_JSON_INVALID'});
  });
test('parser limits raw byte length before parsing and bounds structural nesting', () => {
  assert.throws(() => E.parseRecord(' '.repeat(262145)), {message: 'RECORD_JSON_SIZE'});
  assert.throws(() => E.parseRecord('['.repeat(33) + '0' + ']'.repeat(33)), {message: 'RECORD_JSON_DEPTH'});
  assert.equal(E.parseRecord('0' + ' '.repeat(262143)), 0);
});
function cli(t, text, checkerSource = undefined) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-PRIVATE_PATH_SENTINEL-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const file of ['scripts/commissioning/mainnet-evidence.cjs', 'hardhat/scripts/check-ens-usdc-connection.cjs']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  const checker = path.join(dir, 'hardhat/scripts/check-ens-usdc-connection.cjs');
  if (checkerSource === null) fs.rmSync(checker);
  else if (checkerSource !== undefined) fs.writeFileSync(checker, checkerSource);
  fs.mkdirSync(path.join(dir, 'config/mainnet'), {recursive: true});
  if (text !== null) fs.writeFileSync(path.join(dir, 'config/mainnet/agi-jobs-usdc.json'), text);
  return spawnSync(process.execPath, [path.join(dir, 'scripts/commissioning/mainnet-evidence.cjs')],
    {cwd: dir, encoding: 'utf8', timeout: 10000, env: {PATH: process.env.PATH}});
}
for (const [name, text, code] of [
  ['duplicate authority', duplicateAuthority, 'RECORD_JSON_DUPLICATE_KEY'],
  ['malformed private-looking input', '{"SECRET_SENTINEL":', 'RECORD_JSON_INVALID'],
  ['missing record', null, 'RECORD_LOCAL_READ_OR_VALIDATION_FAILURE'],
]) test('actual offline CLI refuses ' + name + ' without leaking input or private paths', t => {
  const result = cli(t, text);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'STOP: ' + code + '\n');
  assert(!result.stderr.includes('SECRET_SENTINEL'));
  assert(!result.stderr.includes('PRIVATE_PATH_SENTINEL'));
});
test('actual offline CLI still accepts the original record and retains HOLD', t => {
  const result = cli(t, raw);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.recordConsistent, true);
  assert.equal(report.activationDecision, 'HOLD_INTAKE_ACTIVATION');
  assert.equal(report.intakeActivationAuthorized, false);
  assert.equal(report.productionReadinessCertified, false);
  assert.equal(report.liveRpcQueries, 0);
  assert.equal(report.historySha256, '000945c8869f1e6015ba817ce58f8f975c0206deaef6ef9965629091f0f2bb8d');
});

for (const [name, source] of [
  ['missing checker', null],
  ['malformed checker', 'const PRIVATE_MODULE_SENTINEL = ;'],
  ['missing nested dependency', "require('./PRIVATE_MODULE_SENTINEL.cjs');"],
  ['throwing initialization', "throw new Error('PRIVATE_MODULE_SENTINEL');"],
  ['primitive initialization failure', 'throw null;'],
]) test('CLI sanitizes ' + name + ' before any raw require stack escapes', t => {
  const result = cli(t, raw, source);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'STOP: RECORD_CONNECTION_CHECKER_UNAVAILABLE\n');
  assert(!result.stderr.includes('PRIVATE_MODULE_SENTINEL'));
  assert(!result.stderr.includes('PRIVATE_PATH_SENTINEL'));
});
test('CLI also sanitizes a non-Error failure from an invalid dependency export', t => {
  const result = cli(t, raw, 'module.exports = {eq(){throw null;}, P:{}};');
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'STOP: RECORD_LOCAL_READ_OR_VALIDATION_FAILURE\n');
});
