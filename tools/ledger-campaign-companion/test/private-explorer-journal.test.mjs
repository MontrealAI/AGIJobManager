import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { openExplorerJournal } from '../verification/private-explorer-journal.mjs';
import { sha256 } from '../bridge/private-store.mjs';
import { canonicalJson } from '../verification/explorer.mjs';

const taskId = 'a'.repeat(64), identity = { source: { commit: '1'.repeat(40) }, planSha256: '2'.repeat(64), buildPolicySha256: '3'.repeat(64), taskIds: [taskId], authorizationSha256: '4'.repeat(64) };
const record = (state, extra = {}) => ({ schema: 'manual-ledger-explorer-state-v1', taskId, state, submissionAttempted: state !== 'prepared', updatedAt: '2030-01-01T00:00:00.000Z', ...extra });
const digest = value => value ? sha256(canonicalJson(value)) : null;
async function fixture(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'standalone-explorer-journal-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return { root, directory: path.join(root, 'private'), identity }; }
test('standalone explorer restart preserves durable attempted record, GUID and exact identity without signing state', async t => {
  const settings = await fixture(t); let journal = await openExplorerJournal(settings);
  const prepared = record('prepared'), attempted = record('submission-attempted'), pending = record('pending', { guid: 'synthetic_guid_0123456789' });
  await journal.transition(prepared, { taskId, expectedPreviousDigest: null });
  await journal.transition(attempted, { taskId, expectedPreviousDigest: digest(prepared) });
  await journal.transition(pending, { taskId, expectedPreviousDigest: digest(attempted) });
  await journal.close(); journal = await openExplorerJournal(settings);
  try { assert.deepEqual(await journal.readState(taskId), pending); await assert.rejects(journal.transition(record('prepared'), { taskId, expectedPreviousDigest: digest(pending) }), { code: 'EXPLORER_SUBMISSION_MARKER_IMMUTABLE' }); await assert.rejects(journal.transition(record('pending', { guid: 'different_guid_0123456789' }), { taskId, expectedPreviousDigest: digest(pending) }), { code: 'EXPLORER_SUBMISSION_GUID_IMMUTABLE' }); }
  finally { await journal.close(); }
  assert.equal((await fs.stat(settings.directory)).mode & 0o777, 0o700);
  const names = await fs.readdir(settings.directory); assert.equal(names.some(name => name.startsWith('signed-step-')), false);
  for (const name of names) assert.equal((await fs.stat(path.join(settings.directory, name))).mode & 0o777, 0o600);
});
test('standalone explorer concurrent stale transitions commit one attempt and reject stale CAS', async t => {
  const settings = await fixture(t), journal = await openExplorerJournal(settings);
  try { const results = await Promise.allSettled([journal.transition(record('submission-attempted'), { taskId, expectedPreviousDigest: null }), journal.transition(record('prepared'), { taskId, expectedPreviousDigest: null })]); assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected'); assert.equal(results[1].reason.code, 'EXPLORER_JOURNAL_COMPARE_AND_SWAP_FAILED'); assert.equal((await journal.readState(taskId)).submissionAttempted, true); }
  finally { await journal.close(); }
});
test('standalone explorer identity changes cannot reset an uncertain submission or replace current owner', async t => {
  const settings = await fixture(t), journal = await openExplorerJournal(settings);
  try { await journal.transition(record('submission-uncertain'), { taskId, expectedPreviousDigest: null }); await assert.rejects(openExplorerJournal(settings), { code: 'CAMPAIGN_ALREADY_OPEN' }); await assert.rejects(openExplorerJournal({ ...settings, identity: { ...identity, planSha256: '5'.repeat(64) } }), { code: 'CAMPAIGN_CHANGED' }); }
  finally { await journal.close(); }
  const reopened = await openExplorerJournal(settings); try { assert.equal((await reopened.readState(taskId)).state, 'submission-uncertain'); } finally { await reopened.close(); }
});
test('standalone explorer malformed/unapproved records are refused before a journal append', async t => {
  const settings = await fixture(t), journal = await openExplorerJournal(settings);
  try { for (const next of [record('pending', { submissionAttempted: false }), record('prepared', { apiKey: 'never-store-credentials' }), record('prepared', { reason: 'private error text' }), record('pending', { guid: 'short' }), record('prepared', { taskId: 'f'.repeat(64) })]) await assert.rejects(journal.transition(next, { taskId, expectedPreviousDigest: null })); assert.equal(await journal.readState(taskId), null); }
  finally { await journal.close(); }
});
test('standalone explorer refuses symlink and permissive private paths', async t => {
  const settings = await fixture(t); await fs.mkdir(settings.directory, { mode: 0o700 }); await fs.symlink(settings.directory, path.join(settings.root, 'alias'));
  await assert.rejects(openExplorerJournal({ ...settings, directory: path.join(settings.root, 'alias') })); await fs.chmod(settings.directory, 0o755); await assert.rejects(openExplorerJournal(settings));
});
