'use strict';
// Disposable-only PTY integration. Never loaded by the production entrypoint.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { sha, canonical, writeNew } = require('../safety.cjs');
function run(executable, args, env, input) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(Error('DISPOSABLE_CLI_TIMEOUT')); }, 55000);
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr }); }); child.stdin.end(input || '');
  });
}
async function cliRoundTrip({ config, privateRoot, managerRoot, url, cert, key }) {
  const terminal = path.resolve(__dirname, '../terminal.cjs'), sources = ['hardhat.cjs', 'native.cjs', 'prompt.cjs', 'safety.cjs', 'send.cjs', 'terminal.cjs'];
  const toolSourceSha256 = sha(Buffer.from(canonical(Object.fromEntries(sources.map(n => [n, sha(fs.readFileSync(path.resolve(__dirname, '..', n)))])))));
  const c = { schema: 'ubuntu-hardhat-terminal-v1', ...config, runtimeCheckout: managerRoot, nodeSha256: sha(fs.readFileSync(process.execPath)), toolSourceSha256, rpcUrl: url };
  const file = path.join(privateRoot, 'cli-config.json'), reviewFile = path.join(privateRoot, 'cli-review.json'); writeNew(file, c);
  const common = ['--config', file, '--config-sha', sha(fs.readFileSync(file))], env = { ...process.env, NODE_EXTRA_CA_CERTS: cert };
  for (const k of ['NODE_OPTIONS', 'NODE_PATH', 'HARDHAT_CONFIG', 'DEBUG']) delete env[k];
  const prepared = await run(process.execPath, [terminal, 'review', ...common, '--out', reviewFile], env); assert.equal(prepared.code, 0, prepared.stderr);
  const secret = key.toString('hex'), helper = path.join(__dirname, 'pty-runner.py');
  const sent = await run('python3', [helper, process.execPath, terminal, 'send', ...common, '--review', reviewFile, '--initiate-mainnet', sha(fs.readFileSync(reviewFile))], env, JSON.stringify({ entry: secret + '\r', secrets: [secret] }));
  assert.equal(sent.code, 0, sent.stderr); const pty = JSON.parse(sent.stdout); assert.equal(pty.code, 0, pty.output); assert(pty.echoRestored && pty.secretAbsent && pty.promptObserved);
  assert(![prepared.stdout, prepared.stderr, sent.stdout, sent.stderr].some(s => s.includes(secret)));
  // The provider receives only a signed transaction; the key is never in argv/env.
  const lines = pty.output.split(/\r?\n/).filter(x => x.startsWith('{')).map(x => JSON.parse(x)); const result = lines.find(x => x.transactionHash);
  assert(result && result.resendAllowed === false); key.fill(0);
  const reconciled = path.join(privateRoot, 'cli-reconciled.json');
  const checked = await run(process.execPath, [terminal, 'reconcile', ...common, '--out', reconciled], env); assert.equal(checked.code, 0, checked.stderr);
  return { transactionHash: result.transactionHash, reviewCommand: true, hiddenTerminalSendCommand: true, reconciliationCommand: true, keyAbsentFromCapturedOutput: true, echoRestored: true, toolSourceSha256 };
}
module.exports = { cliRoundTrip };
