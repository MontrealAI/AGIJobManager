import { readFile, readdir, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const rows = [], copies = new Set();
await rm('third-party-licenses', { recursive: true, force: true });
await mkdir('third-party-licenses', { recursive: true });
for (const [path, value] of Object.entries(lock.packages)) {
  if (!path) continue;
  const name = path.split('node_modules/').at(-1);
  const id = `${name}@${value.version}`;
  rows.push({ name, version: value.version, license: value.license ?? 'SEE_PACKAGE', path, integrity: value.integrity ?? null, resolved: value.resolved ?? null, optional: value.optional ?? false, dev: value.dev ?? false });
  if (copies.has(id)) continue;
  copies.add(id);
  try {
    const entries = await readdir(path);
    for (const file of entries.filter(x => /^(license|licence|notice|copying)(\.|$)/i.test(x))) {
      await copyFile(`${path}/${file}`, `third-party-licenses/${id.replaceAll('/', '__')}-${file}`);
    }
  } catch {}
}
await writeFile('DEPENDENCIES.json', JSON.stringify(rows, null, 2));
await writeFile('THIRD_PARTY.md', '# Dependency inventory\n\nExact resolved versions and integrity are in package-lock.json and DEPENDENCIES.json. This table includes optional packages recorded in the lock, some of which are not installed on this platform. Available installed license and notice files are retained in third-party-licenses/.\n\n| Package | Version | Declared license | Scope |\n|---|---|---|---|\n' + rows.map(x => `| ${x.name} | ${x.version} | ${x.license} | ${x.dev ? 'build' : 'runtime'}${x.optional ? ', optional' : ''} |`).join('\n') + '\n');
