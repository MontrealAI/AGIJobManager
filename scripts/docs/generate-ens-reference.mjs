import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const argOut = process.argv.find((a) => a.startsWith('--out-dir='));
const outDir = argOut ? path.resolve(root, argOut.split('=')[1]) : root;

const sourceFiles = [
  'contracts/AGIJobManager.sol',
  'contracts/utils/ENSOwnership.sol',
  'contracts/ens/ENSJobPages.sol',
  'contracts/ens/IENSJobPages.sol'
].filter((rel) => fs.existsSync(path.join(root, rel)));

const ENS_PATTERNS = /(\bens\b|ENS|nameWrapper|RootNode|rootNode|Merkle|Identity|lock|EnsJobPages|subdomain|tokenURI)/;

const readLines = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').split('\n');

const matches = (rel, regex) => readLines(rel)
  .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
  .filter((row) => regex.test(row.text));

const functionsFor = (rel, predicate) => readLines(rel)
  .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
  .filter((row) => row.text.startsWith('function ') && predicate(row.text))
  .map((row) => ({ ...row, text: row.text.replace(/\s*\{$/, '') }));

const variables = [
  ...matches('contracts/AGIJobManager.sol', /^(ENS|NameWrapper|address|bool|bytes32)\s+public\s+.*(ens|nameWrapper|RootNode|Merkle|lockIdentityConfig|ensJobPages)/i),
  ...matches('contracts/ens/ENSJobPages.sol', /^(IENSRegistry|INameWrapper|IPublicResolver|bytes32|string|address|bool)\s+public\s+/)
];

const functions = [
  ...functionsFor('contracts/AGIJobManager.sol', (text) => ENS_PATTERNS.test(text)),
  ...functionsFor('contracts/utils/ENSOwnership.sol', (text) => ENS_PATTERNS.test(text) || text.includes('verifyENSOwnership')),
  ...functionsFor('contracts/ens/ENSJobPages.sol', (text) => ENS_PATTERNS.test(text) || text.includes('handleHook'))
];

const eventsAndErrors = [
  ...matches('contracts/AGIJobManager.sol', /^(event|error)\s+.*(Ens|ENS|Root|Merkle|Identity|NotAuthorized|ConfigLocked|InvalidParameters)/),
  ...matches('contracts/ens/ENSJobPages.sol', /^(event|error)\s+.*(ENS|Ens|Configured|Authorized|InvalidParameters)/)
];

const notes = sourceFiles.flatMap((rel) => readLines(rel)
  .map((text, i) => ({ file: rel, line: i + 1, text: text.trim() }))
  .filter((row) => row.text.startsWith('///') && (ENS_PATTERNS.test(row.text) || row.text.includes('best-effort') || row.text.includes('irreversible')))
  .map((row) => ({ ...row, text: row.text.replace(/^\/\/\/\s?/, '') }))
);

const uniqSorted = (arr) => {
  const seen = new Set();
  return arr
    .filter((row) => {
      const key = `${row.file}:${row.line}:${row.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.text.localeCompare(b.text));
};

const sourceFingerprint = (() => {
  const hash = crypto.createHash('sha256');
  for (const rel of sourceFiles) {
    hash.update(`${rel}\n`);
    hash.update(fs.readFileSync(path.join(root, rel), 'utf8'));
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 16);
})();

// Keep generated output deterministic across shallow/full clones and CI providers.
const generatedAtUtc = '1970-01-01T00:00:00Z';

const outFile = path.join(outDir, 'docs/REFERENCE/ENS_REFERENCE.md');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const bullet = (row) => `- \`${row.text}\` ([${row.file}#L${row.line}](../../${row.file}#L${row.line}))`;
const commentBullet = (row) => `- ${row.text} ([${row.file}#L${row.line}](../../${row.file}#L${row.line}))`;

const md = [
  '# ENS Reference (Generated)',
  '',
  `Generated at (UTC): ${generatedAtUtc}`,
  `Source fingerprint: ${sourceFingerprint}`,
  '',
  'Source files used:',
  ...sourceFiles.map((file) => `- \`${file}\``),
  '',
  '## ENS surface area',
  '',
  ...uniqSorted(variables).map(bullet),
  '',
  '## Config and locks',
  '',
  ...uniqSorted(functions).map(bullet),
  '',
  '## Events and errors',
  '',
  ...uniqSorted(eventsAndErrors).map(bullet),
  '',
  '## Notes / caveats from code comments',
  '',
  ...uniqSorted(notes).map(commentBullet),
  ''
];

fs.writeFileSync(outFile, `${md.join('\n')}\n`);
console.log(`Generated ${path.relative(root, outFile)}`);
