const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [index, count] = process.argv.slice(2).map(Number);
if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || count < 1 || index < 0 || index >= count) {
  throw new Error('Usage: node scripts/test-contract-shard.js <zero-based index> <shard count>');
}
const root = path.resolve(__dirname, '..');
const collect = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
  const filename = path.posix.join(directory, entry.name);
  return entry.isDirectory() ? collect(filename) : /\.(js|ts|es|es6|jsx|sol)$/.test(entry.name) ? [filename] : [];
});
const all = collect('test').sort();
const selected = all.filter((_, position) => position % count === index);
if (!selected.length) throw new Error('Empty shard: reduce the shard count.');
console.log(JSON.stringify({ shard: index, count, totalFiles: all.length, files: selected }, null, 2));
const run = args => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run([require.resolve('truffle/build/cli.bundled.js'), 'test', ...selected, '--network', 'test', '--compile-none']);
run(['test/AGIJobManager.test.js']);
run(['scripts/check-contract-sizes.js']);
