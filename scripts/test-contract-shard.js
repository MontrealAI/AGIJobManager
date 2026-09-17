'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

async function main() {
  const [index, count] = process.argv.slice(2).map(Number);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || count < 1 || index < 0 || index >= count) throw new Error('Usage: node scripts/test-contract-shard.js <zero-based index> <shard count>');
  const collect = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const filename = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? collect(filename) : /\.(js|cjs)$/.test(entry.name) ? [filename] : [];
  });
  const all = collect('test').sort();
  const selected = all.filter((_, position) => position % count === index);
  if (!selected.length) throw new Error('Empty shard: reduce the shard count.');
  console.log(JSON.stringify({ shard: index, count, totalFiles: all.length, files: selected }, null, 2));

  // Load the dedicated, explicitly local Hardhat network. This runner cannot
  // select a public network or read a deployer private key.
  const config = path.join(root, 'hardhat.config.mjs');
  const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(require.resolve('hardhat/hre', { paths: [path.join(root, 'hardhat')] })));
  const configModule = await import(pathToFileURL(config));
  const hre = await createHardhatRuntimeEnvironment(configModule.default, { config }, root);
  const connection = await hre.network.connect('hardhat');
  try {
    const { createRuntime } = require('./test-runtime.cjs');
    const runtime = await createRuntime(connection.provider);
    global.__contractTestRuntime = runtime;
    global.web3 = runtime.web3;
    global.artifacts = runtime.artifacts;
    global.assert = Object.assign(require('node:assert'), {
      isTrue: (value, message) => require('node:assert/strict').equal(value, true, message),
      isAtMost: (value, maximum, message) => require('node:assert').ok(value <= maximum, message),
      include: (value, expected, message) => require('node:assert').ok(value.includes(expected), message),
    });
    const { Mocha } = require('mocha');
    const mocha = new Mocha({ timeout: 100_000, forbidOnly: true, forbidPending: true, failZero: true, reporter: process.env.TEST_REPORTER || 'spec' });
    mocha.suite.emit('pre-require', global, 'contract-test-runtime', mocha);
    global.contract = (name, callback) => global.describe(name, () => callback(runtime.accounts));
    for (const file of selected) mocha.addFile(path.join(root, file));
    mocha.loadFiles();
    const collected = [];
    mocha.suite.eachTest(test => collected.push(test.fullTitle()));
    if (!collected.length) throw new Error('Shard collected no tests');
    const failures = await new Promise(resolve => {
      const runner = mocha.run(resolve);
      let executed = 0;
      runner.on('test end', () => { executed += 1; });
      runner.once('end', () => {
        console.log(JSON.stringify({ collectedTests: collected.length, executedTests: executed, passedTests: runner.stats.passes }));
        if (executed !== collected.length) process.exitCode = 1;
      });
    });
    if (failures) process.exitCode = 1;
  } finally {
    await connection.close();
  }
  if (process.exitCode) return;
  for (const file of ['test/AGIJobManager.test.js', 'scripts/check-contract-sizes.js']) {
    const result = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; return; }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
