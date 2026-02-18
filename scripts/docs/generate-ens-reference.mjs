import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const argOut = process.argv.find((a) => a.startsWith('--out-dir='));
const outDir = argOut ? path.resolve(root, argOut.split('=')[1]) : root;

const sourceFiles = [
  'contracts/AGIJobManager.sol',
  'contracts/utils/ENSOwnership.sol',
  'contracts/ens/ENSJobPages.sol',
  'contracts/ens/IENSJobPages.sol'
];
const existingSourceFiles = sourceFiles.filter((rel) => fs.existsSync(path.join(root, rel)));

const ensPatterns = /(\bens\b|ENS|nameWrapper|RootNode|rootNode|Merkle|Identity|lock|EnsJobPages|subdomain|tokenURI)/;

function fileLines(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
}

function pickByRegex(rel, regex) {
  return fileLines(rel)
    .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
    .filter((x) => regex.test(x.text));
}

function pickFunctions(rel, predicate) {
  return fileLines(rel)
    .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
    .filter((x) => x.text.startsWith('function ') && predicate(x.text))
    .map((x) => ({ ...x, text: x.text.replace(/\s*\{$/, '') }));
}

const variables = [
  ...(fs.existsSync(path.join(root, 'contracts/AGIJobManager.sol'))
    ? pickByRegex('contracts/AGIJobManager.sol', /^(ENS|NameWrapper|address|bool|bytes32)\s+public\s+.*(ens|nameWrapper|RootNode|Merkle|lockIdentityConfig|ensJobPages)/i)
    : []),
  ...(fs.existsSync(path.join(root, 'contracts/ens/ENSJobPages.sol'))
    ? pickByRegex('contracts/ens/ENSJobPages.sol', /^(IENSRegistry|INameWrapper|IPublicResolver|bytes32|string|address|bool)\s+public\s+/)
    : [])
];

const functions = [
  ...(fs.existsSync(path.join(root, 'contracts/AGIJobManager.sol'))
    ? pickFunctions('contracts/AGIJobManager.sol', (t) => ensPatterns.test(t))
    : []),
  ...(fs.existsSync(path.join(root, 'contracts/utils/ENSOwnership.sol'))
    ? pickFunctions('contracts/utils/ENSOwnership.sol', (t) => ensPatterns.test(t) || t.includes('verifyENSOwnership'))
    : []),
  ...(fs.existsSync(path.join(root, 'contracts/ens/ENSJobPages.sol'))
    ? pickFunctions('contracts/ens/ENSJobPages.sol', (t) => ensPatterns.test(t) || t.includes('handleHook'))
    : [])
];

const eventsAndErrors = [
  ...(fs.existsSync(path.join(root, 'contracts/AGIJobManager.sol'))
    ? pickByRegex('contracts/AGIJobManager.sol', /^(event|error)\s+.*(Ens|ENS|Root|Merkle|Identity|NotAuthorized|ConfigLocked|InvalidParameters)/)
    : []),
  ...(fs.existsSync(path.join(root, 'contracts/ens/ENSJobPages.sol'))
    ? pickByRegex('contracts/ens/ENSJobPages.sol', /^(event|error)\s+.*(ENS|Ens|Configured|Authorized|InvalidParameters)/)
    : [])
];

const notes = existingSourceFiles.flatMap((rel) =>
  fileLines(rel)
    .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
    .filter((x) => x.text.startsWith('///') && (ensPatterns.test(x.text) || x.text.includes('best-effort') || x.text.includes('irreversible')))
    .map((x) => ({ ...x, text: x.text.replace(/^\/\/\/\s?/, '') }))
);

const sourceFingerprint = (() => {
  const hash = crypto.createHash('sha256');
  for (const rel of existingSourceFiles) {
    hash.update(`${rel}\n`);
    hash.update(fs.readFileSync(path.join(root, rel), 'utf8'));
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 16);
})();

function generatedAtIsoUtc() {
  if (!existingSourceFiles.length) return '1970-01-01T00:00:00Z';
  const envEpoch = process.env.SOURCE_DATE_EPOCH;
  if (envEpoch && /^\d+$/.test(envEpoch)) {
    return new Date(Number(envEpoch) * 1000).toISOString().replace('.000', '');
  }
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...existingSourceFiles], {
      cwd: root,
      encoding: 'utf8'
    }).trim();
    if (output) return output;
  } catch {
    // Fall back deterministically when git metadata is unavailable.
  }
  const latestMtime = existingSourceFiles
    .map((rel) => fs.statSync(path.join(root, rel)).mtimeMs)
    .sort((a, b) => b - a)[0] ?? 0;
  return new Date(Math.floor(latestMtime)).toISOString().replace('.000', '');
}

const uniq = (arr) => {
  const seen = new Set();
  return arr.filter((x) => {
    const key = `${x.file}:${x.line}:${x.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const outFile = path.join(outDir, 'docs/REFERENCE/ENS_REFERENCE.md');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const toBullet = (x) => `- \`${x.text}\` (${x.file}:${x.line})`;
const md = [
  '# ENS Reference (Generated)',
  '',
  `Generated at (UTC): ${generatedAtIsoUtc()}`,
  '',
  `Source fingerprint: ${sourceFingerprint}`,
  '',
  'Source files used:',
  ...existingSourceFiles.map((f) => `- \`${f}\``),
  '',
  '## ENS surface area',
  '',
  ...uniq(variables).map(toBullet),
  '',
  '## Config and locks',
  '',
  ...uniq(functions).map(toBullet),
  '',
  '## Events and errors',
  '',
  ...uniq(eventsAndErrors).map(toBullet),
  '',
  '## Notes / caveats from code comments',
  '',
  ...uniq(notes).map((x) => `- ${x.text} (${x.file}:${x.line})`),
  ''
];

fs.writeFileSync(outFile, `${md.join('\n')}\n`);
console.log(`Generated ${path.relative(root, outFile)}`);
