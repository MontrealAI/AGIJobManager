/** Exact selected Alpha source; native free inspection is not paid-work authority. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { immutableGitBytes } from '../successor/source-identity.mjs';
import { parseStrict } from '../../site/assets/successor/safe.mjs';
import { inspectTransformationWorkRequest, createTransformationWorkDraft } from './transformational-work-request.mjs';

const pin = parseStrict(fs.readFileSync(new URL('../../config/transformational-alpha-source.json', import.meta.url), 'utf8'));
const fixture = 'examples/transformational-intelligence/campaign.json';
const inspector = 'examples/transformational-intelligence/inspector.mjs';
const engine = 'docs/assets/successor/engine.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(Object.keys(pin).sort(), ['schema','repository','commit','tree','fixturePath','files'].sort());
assert.equal(pin.schema, 'agijobmanager/transformational-alpha-source/v1');
assert.equal(pin.repository, 'MontrealAI/AGI-Alpha-Agent-v0');
assert.match(pin.commit, /^[a-f0-9]{40}$/); assert.match(pin.tree, /^[a-f0-9]{40}$/);
assert.equal(pin.fixturePath, fixture);
assert.deepEqual(Object.keys(pin.files).sort(), [fixture, inspector, engine].sort());
assert.ok(process.argv.length === 3 && path.isAbsolute(process.argv[2]), 'Explicit absolute Alpha checkout path required');
const root = fs.realpathSync(process.argv[2]);
const git = args => immutableGitBytes(root, args);
assert.equal(fs.realpathSync(git(['rev-parse','--show-toplevel']).toString('utf8').trim()), root);
assert.equal(git(['cat-file','-t',pin.commit]).toString('utf8').trim(), 'commit');
assert.equal(git(['rev-parse',pin.commit + '^{tree}']).toString('utf8').trim(), pin.tree);
const captured = new Map();
for (const name of [fixture, inspector, engine]) {
  assert.match(pin.files[name], /^[a-f0-9]{64}$/);
  const file = path.join(root, name);
  assert.equal(fs.realpathSync(file), file, 'No symlink file or ancestor');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    assert.ok(before.isFile() && before.size <= 2_000_000);
    const bytes = fs.readFileSync(fd), after = fs.fstatSync(fd);
    assert.deepEqual([after.dev,after.ino,after.size,after.mtimeMs,after.ctimeMs], [before.dev,before.ino,before.size,before.mtimeMs,before.ctimeMs]);
    assert.equal(hash(bytes), pin.files[name], 'Native selected bytes changed: ' + name);
    assert.ok(bytes.equals(git(['show',pin.commit + ':' + name])), 'Native Git object differs: ' + name);
    captured.set(name, bytes);
  } finally { fs.closeSync(fd); }
}
// The fixed inspector has one fixed import and the fixed engine has no imports.
// Execute captured, authenticated bytes rather than rereading a mutable checkout.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-native-ti-'));
try {
  for (const name of [inspector, engine]) {
    const file = path.join(tmp, name); fs.mkdirSync(path.dirname(file), { recursive:true, mode:0o700 });
    fs.writeFileSync(file, captured.get(name), { mode:0o600, flag:'wx' });
  }
  const { inspectTransformationEnvelope } = await import(pathToFileURL(path.join(tmp, inspector)).href);
  const { canonical, digest } = await import(pathToFileURL(path.join(tmp, engine)).href);
  const raw = new TextDecoder('utf-8', { fatal:true }).decode(captured.get(fixture));
  const native = await inspectTransformationEnvelope(raw);
  const options = { inspectWorkRequest:inspectTransformationEnvelope, expectedBindingsDigest:native.bindings_digest };
  const accepted = await inspectTransformationWorkRequest(raw, options);
  assert.equal(canonical(accepted), canonical(native));
  assert.equal(accepted.charter.budgets.USDCBaseUnits, '0');
  assert.equal(accepted.charter.budgets.AGIALPHABaseUnits, '0');
  assert.equal(accepted.authorization.authority_expansion, false);
  assert.equal(accepted.settlement.transaction_prepared, false);
  await assert.rejects(createTransformationWorkDraft(raw, { ...options, budgetUSDC:'25', createdAt:'2026-10-19T15:00:00.000Z' }), /TRANSFORMATION_USDC_(ROUTE|CAP)/);
  await assert.rejects(inspectTransformationWorkRequest(raw, { ...options, expectedBindingsDigest:'0'.repeat(64) }), /TRANSFORMATION_STALE_BINDINGS/);
  const authority = JSON.parse(raw); authority.authorization.authority_expansion = true;
  await assert.rejects(inspectTransformationWorkRequest(canonical(authority), options));
  const credential = JSON.parse(raw); credential.bindings.request.configuration.api_key = 'synthetic-fixture-only';
  credential.bindings_digest = await digest('ti-bindings', credential.bindings);
  let invoked = false;
  await assert.rejects(inspectTransformationWorkRequest(canonical(credential), {
    expectedBindingsDigest:credential.bindings_digest, inspectWorkRequest:async value => { invoked = true; return inspectTransformationEnvelope(value); },
  }), /TRANSFORMATION_PRIVATE_FIELD/);
  assert.equal(invoked, false);
  console.log('TI_NATIVE_ALPHA_COMMIT=' + pin.commit);
  console.log('TI_NATIVE_FIXTURE_SHA256=' + pin.files[fixture]);
  console.log('TI_NATIVE_BOUNDARY=free-inspection-positive-payment-refused');
  console.log(JSON.stringify({ scope:'native-free-inspection-only', paidSupported:false, sourceTree:pin.tree, sourceFiles:captured.size }));
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }
