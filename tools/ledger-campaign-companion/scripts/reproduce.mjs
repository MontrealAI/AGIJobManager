import { mkdtemp, cp, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
const target = await mkdtemp(join(tmpdir(), 'ledger-campaign-clean-'));
try {
  const filter = async source => !relative(process.cwd(), source).split(sep).some(part => ['node_modules', 'dist', 'manual-ledger-evidence', '.git'].includes(part)) && !(await lstat(source)).isSymbolicLink();
  for (const path of ['package.json', 'package-lock.json', 'src', 'scripts', 'test', 'bridge', 'coordinators', 'verification', 'index.html', 'style.css', 'campaign.html', 'campaign-signer.html', 'campaign.css']) await cp(path, join(target, path), { recursive: true, filter });
  for (const [command, args] of [['npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-retries=0', '--fetch-timeout=20000']], [process.execPath, ['scripts/browser-regression-check.mjs']], ['npm', ['run', 'build']], [process.execPath, ['scripts/browser-check-production.mjs']]]) {
    const child = spawnSync(command, args, { cwd: target, stdio: 'inherit' });
    if (child.status !== 0) { process.exitCode = child.status || 1; break; }
  }
  if (!process.exitCode) process.stdout.write('Clean temporary extraction: npm ci, deterministic tests, three bundle builds and production fixture exclusion PASS.\n');
} finally { await rm(target, { recursive: true, force: true }); }
