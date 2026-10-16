import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const target = await mkdtemp(join(tmpdir(), 'ledger-signer-clean-'));
try {
  for (const path of ['package.json', 'package-lock.json', 'src', 'scripts', 'test', 'index.html', 'style.css']) await cp(path, join(target, path), { recursive: true });
  for (const args of [['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-retries=0', '--fetch-timeout=20000'], ['test'], ['run', 'build']]) {
    const child = spawnSync('npm', args, { cwd: target, stdio: 'inherit' });
    if (child.status !== 0) { process.exitCode = child.status || 1; break; }
  }
  if (!process.exitCode) process.stdout.write('Clean temporary extraction: npm ci, tests and bundle build PASS.\n');
} finally { await rm(target, { recursive: true, force: true }); }
