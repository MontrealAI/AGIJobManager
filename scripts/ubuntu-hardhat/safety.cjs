'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const GOVERNOR = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
const SOURCES = Object.freeze({
  manager: ['d371d95cfcc44b9133cda4bba55304f727917f18', '93faf6e9a6875026c1eb9bc2f0f9bdada308d296'],
  alpha: ['38064bec3423218f87c6b81760ac6768b3e7d4e5', '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68'],
  jobs: ['9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5', '720312acac83eddeeb76644e1e22f53578e91784'],
});
const need = (yes, code) => { if (!yes) throw Error(code); };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function real(file, directory = false) {
  need(path.isAbsolute(file) && path.resolve(file) === file && fs.realpathSync(file) === file, 'REAL_ABSOLUTE_PATH_REQUIRED');
  const s = fs.lstatSync(file);
  need(!s.isSymbolicLink() && (directory ? s.isDirectory() : s.isFile() && s.nlink === 1), 'ORDINARY_PATH_REQUIRED');
  return s;
}
function pin(file, privateFile = true) {
  const s = real(file); if (privateFile) need(s.uid === process.getuid() && !(s.mode & 0o077), 'OWNER_ONLY_INPUT_REQUIRED');
  need(s.size <= 16 * 1024 * 1024, 'BOUNDED_INPUT_REQUIRED');
  const bytes = fs.readFileSync(file), digest = sha(bytes);
  return { bytes, digest, assert() { const now = real(file); need(now.dev === s.dev && now.ino === s.ino && now.mode === s.mode && sha(fs.readFileSync(file)) === digest, 'INPUT_CHANGED'); } };
}
function writeNew(file, value) {
  real(path.dirname(file), true);
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, canonical(value) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
}
function sourceGuard(root, project) {
  real(root, true); const expected = SOURCES[project]; need(expected, 'SOURCE_PROJECT_REQUIRED');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' });
  const git = (...args) => cp.execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', ...args], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
  function assert() {
    need(fs.realpathSync(git('rev-parse', '--show-toplevel').trim()) === root && git('rev-parse', 'HEAD').trim() === expected[0] && git('rev-parse', 'HEAD^{tree}').trim() === expected[1], 'EXACT_SOURCE_REQUIRED');
    const entries = git('ls-tree', '-r', '-z', '--full-tree', 'HEAD').split('\0').filter(Boolean).map(e => /^([0-7]{6}) blob ([0-9a-f]{40})\t([\s\S]+)$/.exec(e));
    need(entries.length && entries.every(Boolean), 'COMPLETE_SOURCE_REQUIRED');
    const index = git('ls-files', '--stage', '-z').split('\0').filter(Boolean).map(e => /^([0-7]{6}) ([0-9a-f]{40}) 0\t([\s\S]+)$/.exec(e));
    const map = new Map(entries.map(e => [e[3], `${e[1]}:${e[2]}`]));
    need(index.length === entries.length && index.every(e => e && map.get(e[3]) === `${e[1]}:${e[2]}`), 'CLEAN_SOURCE_INDEX_REQUIRED');
    need(git('ls-files', '-v', '-z').split('\0').filter(Boolean).every(e => e[0] !== 'S' && !/[a-z]/.test(e[0])) && !git('ls-files', '--others', '--exclude-standard', '-z'), 'CLEAN_COMPLETE_SOURCE_REQUIRED');
    for (const [, mode, hash, name] of entries) {
      const file = path.join(root, name), stat = fs.lstatSync(file);
      need(fs.realpathSync(path.dirname(file)) === path.dirname(file), 'SOURCE_PARENT_ALIAS');
      need(['100644', '100755', '120000'].includes(mode), 'UNSUPPORTED_SOURCE_TYPE');
      let bytes;
      if (mode === '120000') { need(stat.isSymbolicLink(), 'SOURCE_TYPE_CHANGED'); bytes = Buffer.from(fs.readlinkSync(file)); }
      else { need(stat.isFile() && !stat.isSymbolicLink() && Boolean(stat.mode & 0o100) === (mode === '100755'), 'SOURCE_TYPE_CHANGED'); bytes = fs.readFileSync(file); }
      const blobMatches = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === hash;
      // Exact data normalization emitted by the supported native Jobs loader;
      // independently recorded in hosted qualification artifact 12072489816.
      // No Solidity/script/dependency or other tracked change is accepted.
      const qualifiedEnsNormalization = project === 'jobs' && name === 'config/ens.json' && sha(bytes) === '395ea0a49d70f8e6777c0d611c40546cc7dc24ab1b71eeafbb765099fed8eb61';
      need(blobMatches || qualifiedEnsNormalization, 'SOURCE_BYTES_CHANGED');
    }
  }
  assert(); return { assert, commit: expected[0], tree: expected[1] };
}
function environment(env = process.env) {
  for (const [k, v] of Object.entries(env)) if (v) need(!/(?:^|_)(PRIVATE_?KEYS?|MNEMONIC|SEED_PHRASE|KEYSTORE|ACCOUNTS|UNLOCKED(?:_ACCOUNTS?)?|SIGNING_PROVIDER|SIGNER_PROVIDER)(?:_|$)/i.test(k) && !['NODE_OPTIONS', 'NODE_PATH', 'HARDHAT_CONFIG', 'DEBUG', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'HARDHAT_VERBOSE', 'NODE_V8_COVERAGE'].includes(k), 'UNSAFE_SIGNING_ENVIRONMENT');
}
function toolSourcePin(expected) {
  const files = ['hardhat.cjs', 'native.cjs', 'prompt.cjs', 'safety.cjs', 'send.cjs', 'terminal.cjs'];
  const entries = files.map(name => [name, pin(path.join(__dirname, name), false)]);
  const digest = sha(Buffer.from(canonical(Object.fromEntries(entries.map(([name, p]) => [name, p.digest])))));
  need(digest === expected, 'INDEPENDENTLY_REVIEWED_TERMINAL_SOURCE_REQUIRED');
  return { assert() { for (const [, p] of entries) p.assert(); } };
}
function terminalProcess() {
  environment(); need(process.platform === 'linux' && process.version === 'v22.23.3', 'QUALIFIED_UBUNTU_NODE_REQUIRED');
  need(!process.execArgv.length && !process.report.reportOnFatalError && !process.report.reportOnSignal && !process.report.reportOnUncaughtException, 'RUNTIME_DIAGNOSTICS_FORBIDDEN');
  need(/^Max core file size\s+0\s/m.test(fs.readFileSync('/proc/self/limits', 'utf8')), 'DISABLE_CORE_DUMPS_BEFORE_START');
}
module.exports = { GOVERNOR, SOURCES, need, sha, canonical, real, pin, writeNew, sourceGuard, environment, toolSourcePin, terminalProcess };
