// Destructive test fixture edit, immediately restored. Use only disposable detached clones.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { MANAGER_CURRENT, MANAGER_CORRECTED } from '../coordinators/manager.mjs';
import { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { observeSource, sha256 } from '../coordinators/common.mjs';
const checkout = process.env.SOURCE_ACCEPT_CHECKOUT, output = process.env.SOURCE_ACCEPT_REPORT;
const profile = process.env.SOURCE_ACCEPT_PROFILE || 'current';
assert.ok(['current', 'corrected'].includes(profile) && (process.env.SOURCE_ACCEPT_PROJECT === 'manager' || profile === 'current'));
const supported = ({ manager: profile === 'corrected' ? MANAGER_CORRECTED : MANAGER_CURRENT, alpha: ALPHA_CURRENT })[process.env.SOURCE_ACCEPT_PROJECT];
assert.ok(supported && checkout && path.isAbsolute(checkout) && output && path.isAbsolute(output));
assert.ok(path.basename(checkout).endsWith('-source-drift-v3'), 'Dedicated disposable clone name required');
assert.throws(() => execFileSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: checkout, stdio: 'pipe' }));
const expected = { repository: supported.repository, commit: supported.commit, tree: supported.tree };
assert.deepEqual(observeSource({ checkout }, supported), expected);
const file = path.join(checkout, 'README.md'), before = fs.readFileSync(file), checksum = sha256(before);
let rejected = false;
try { fs.appendFileSync(file, '\nDISPOSABLE_SOURCE_OBSERVER_NEGATIVE\n'); assert.throws(() => observeSource({ checkout }, supported), error => { rejected = error.code === 'SOURCE_BYTES_DRIFT'; return rejected; }); }
finally { fs.writeFileSync(file, before); }
assert.deepEqual(observeSource({ checkout }, supported), expected); assert.equal(sha256(fs.readFileSync(file)), checksum);
fs.writeFileSync(output, JSON.stringify({ schema: 'manual-ledger-actual-source-drift-acceptance-v1', source: expected, fixture: 'Separate disposable detached clone; README mutation restored exactly', beforeSourceAccepted: true, changedTrackedBytesRejected: rejected, restoredSourceAccepted: true, nativeCommandsExecuted: 0, signatures: 0, submissions: 0, passed: true, completedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
console.log('Actual exact-source drift observer acceptance passed; no native command or chain effect.');
