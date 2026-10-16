import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerActorLockDirectory } from '../bridge/actor-lock-policy.mjs';
async function fixture(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'companion-actor-policy-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return { root, policyDirectory: path.join(root, 'operator'), directory: path.join(root, 'shared-actors') }; }
test('one per-operator lock policy registers exclusively and same directory is idempotent', async t => { const f = await fixture(t); await Promise.all([registerActorLockDirectory(f), registerActorLockDirectory(f)]); const file = path.join(f.policyDirectory, 'actor-lock-policy.json'); assert.equal((await fs.stat(file)).mode & 0o777, 0o600); assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).actorLockDirectory, f.directory); });
test('a second campaign cannot choose another actor lock directory under the same operator policy', async t => { const f = await fixture(t); await registerActorLockDirectory(f); await assert.rejects(registerActorLockDirectory({ ...f, directory: path.join(f.root, 'alternate-actors') }), { code: 'ACTOR_LOCK_DIRECTORY_ALREADY_PINNED' }); });
test('actor policy refuses symlink directory and nonprivate registry mode', async t => { const f = await fixture(t); await fs.mkdir(f.directory, { mode: 0o700 }); const link = path.join(f.root, 'link'); await fs.symlink(f.directory, link); await assert.rejects(registerActorLockDirectory({ ...f, directory: link })); await registerActorLockDirectory(f); await fs.chmod(path.join(f.policyDirectory, 'actor-lock-policy.json'), 0o644); await assert.rejects(registerActorLockDirectory(f), { code: 'ACTOR_LOCK_POLICY_REJECTED' }); });
