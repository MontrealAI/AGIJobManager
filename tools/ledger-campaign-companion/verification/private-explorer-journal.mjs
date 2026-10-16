import { openPrivateStore, sha256 } from '../bridge/private-store.mjs';
import { canonicalJson } from './explorer.mjs';

const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (value, code = 'EXPLORER_PRIVATE_JOURNAL_REJECTED') => { if (!value) stop(code); };
const copy = value => JSON.parse(canonicalJson(value));
const states = new Set(['prepared', 'submission-attempted', 'pending', 'submission-uncertain', 'verified', 'blocked', 'failed']);
function checked(record, taskId) {
  need(record && Object.keys(record).every(key => ['schema', 'taskId', 'state', 'submissionAttempted', 'updatedAt', 'guid', 'reason'].includes(key)));
  need(record.schema === 'manual-ledger-explorer-state-v1' && record.taskId === taskId && states.has(record.state) && typeof record.submissionAttempted === 'boolean');
  need(typeof record.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.updatedAt) && Number.isFinite(Date.parse(record.updatedAt)));
  need(record.guid === undefined || (typeof record.guid === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(record.guid)));
  need(record.reason === undefined || (typeof record.reason === 'string' && /^[A-Z][A-Z0-9_]{0,255}$/.test(record.reason)));
  need(canonicalJson(record).length <= 8192);
  if (['submission-attempted', 'pending', 'submission-uncertain'].includes(record.state) || record.guid) need(record.submissionAttempted);
  return copy(record);
}

// Standalone verification uses the audited private-store durability/owner-lock
// primitive, without requiring a campaign, bridge, signing packet or wallet.
// The caller binds identity to source, plan, local build policy, exact task IDs
// and source-publication authorization; credentials never belong in identity.
export async function openExplorerJournal({ directory, identity, forbiddenRoots = [], recoverDeadOwner = false }) {
  need(identity && typeof identity === 'object' && !Array.isArray(identity) && canonicalJson(identity).length <= 65536);
  need(Array.isArray(identity.taskIds) && identity.taskIds.length > 0 && identity.taskIds.length <= 32 && new Set(identity.taskIds).size === identity.taskIds.length && identity.taskIds.every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)));
  const approved = new Set(identity.taskIds);
  const store = await openPrivateStore({ directory, campaign: { format: 'standalone-explorer-identity-v1', identity: copy(identity) }, forbiddenRoots, recoverDeadOwner });
  let state = store.snapshot ?? { format: 'standalone-explorer-journal-v1', verificationTasks: {} }, tail = Promise.resolve(), closed = false;
  try {
    need(state.format === 'standalone-explorer-journal-v1' && state.verificationTasks && typeof state.verificationTasks === 'object' && !Array.isArray(state.verificationTasks) && Object.keys(state).length === 2);
    for (const [taskId, record] of Object.entries(state.verificationTasks)) { need(approved.has(taskId)); checked(record, taskId); }
    if (!store.snapshot) await store.append(state);
  } catch (error) { await store.close(); throw error; }
  const read = taskId => { need(!closed && approved.has(taskId)); return state.verificationTasks[taskId] ? copy(state.verificationTasks[taskId]) : null; };
  return Object.freeze({
    recoveredOwner: store.recoveredOwner,
    readState: async taskId => { await tail; return read(taskId); },
    transition(next, { taskId, expectedPreviousDigest } = {}) {
      const result = tail.then(async () => {
        const previous = read(taskId), record = checked(next, taskId);
        need(expectedPreviousDigest === (previous ? sha256(canonicalJson(previous)) : null), 'EXPLORER_JOURNAL_COMPARE_AND_SWAP_FAILED');
        need(!previous?.submissionAttempted || record.submissionAttempted, 'EXPLORER_SUBMISSION_MARKER_IMMUTABLE');
        need(!previous?.guid || record.guid === previous.guid, 'EXPLORER_SUBMISSION_GUID_IMMUTABLE');
        const candidate = copy(state); candidate.verificationTasks[taskId] = record;
        await store.append(candidate); state = candidate; return copy(record);
      });
      tail = result.catch(() => {}); return result;
    },
    async close() { await tail; if (closed) return; closed = true; await store.close(); }
  });
}
