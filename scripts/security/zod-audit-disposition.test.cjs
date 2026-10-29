const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { checkZodBackportAudit, restoreCssSource } = require('../check-zod-backport-audit.cjs');
const fixtures = path.resolve(__dirname, '../../test/fixtures/zod-backport-audit');
const repository = process.env.ZOD_AUDIT_TEST_REPOSITORY || path.resolve(__dirname, '../..');
const registry4Source = process.env.ZOD_AUDIT_TEST_REGISTRY4 || path.join(repository, 'ui/node_modules/@wagmi/connectors/node_modules/zod');
const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../zod-backport-audit-profile.json')));
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-zod-audit-controls-'));
test.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
const nameOf = node => node.split('node_modules/').at(-1);
function constructedTree(scopeName) {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'constructed-'));
  const root = path.join(directory, 'source');
  fs.mkdirSync(root);
  for (const relative of Object.keys(profile.packageFiles)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    let bytes = fs.readFileSync(path.join(repository, relative));
    if (relative === 'ui/package.json' || relative === 'ui/package-lock.json') bytes = restoreCssSource(relative, bytes);
    fs.writeFileSync(path.join(root, relative), bytes);
  }
  fs.cpSync(path.join(repository, 'ui/vendor/zod'), path.join(root, 'ui/vendor/zod'), { recursive: true });
  const scope = profile.scopes[scopeName], scopeRoot = path.resolve(root, scope.directory);
  const lock = JSON.parse(fs.readFileSync(path.join(scopeRoot, 'package-lock.json')));
  const vendor = path.join(root, 'ui/vendor/zod');
  const nodes = new Map();
  for (const [name, row] of Object.entries(scope.audit.vulnerabilities)) if (name !== 'zod') for (const node of row.nodes) nodes.set(node, name);
  for (const consumer of scope.consumers) if (consumer.node) nodes.set(consumer.node, nameOf(consumer.node));
  for (const [node, name] of nodes) {
    const entry = lock.packages[node], target = path.resolve(scopeRoot, node);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name, version: entry.version }));
  }
  for (const [node, entry] of Object.entries(lock.packages)) if (/(?:^|\/)node_modules\/zod$/.test(node)) {
    const target = path.resolve(scopeRoot, node);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (entry.link) fs.symlinkSync(path.relative(path.dirname(target), vendor), target, 'dir');
    else fs.cpSync(registry4Source, target, { recursive: true });
  }
  const auditPath = path.join(directory, 'audit.json'), stderrPath = path.join(directory, 'audit.stderr'), exitPath = path.join(directory, 'audit.exit');
  fs.copyFileSync(path.join(fixtures, scopeName + '-audit.json'), auditPath);
  fs.copyFileSync(path.join(fixtures, scopeName + '-audit.stderr'), stderrPath);
  fs.copyFileSync(path.join(fixtures, scopeName + '-audit.exit'), exitPath);
  return { directory, root, scopeRoot, vendor, auditPath, stderrPath, exitPath, options: { repositoryRoot: root, scope: scopeName, auditPath, stderrPath, exitPath } };
}
function control(name, scope, mutate, code) {
  test(name, () => { const fixture = constructedTree(scope); try { mutate(fixture); assert.throws(() => checkZodBackportAudit(fixture.options), error => !code || error.code === code); } finally { fs.rmSync(fixture.directory, { recursive: true }); } });
}
const changeAudit = (fixture, change) => { const audit = JSON.parse(fs.readFileSync(fixture.auditPath)); change(audit); fs.writeFileSync(fixture.auditPath, JSON.stringify(audit)); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function softwareEdition(root, version, only = Object.keys(profile.packageFiles)) {
  for (const name of only) {
    const filename = path.join(root, name), value = JSON.parse(fs.readFileSync(filename));
    value.version = version;
    if (name.endsWith('package-lock.json')) value.packages[''].version = version;
    fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
  }
}
for (const scope of ['root', 'ui', 'hardhat']) test(`${scope}: constructed installed-resolution control preserves registry exit1 and source PASS`, () => {
  const fixture = constructedTree(scope);
  try {
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.registryAuditExitCode, 1);
    assert.equal(report.sourceDisposition, 'PASS');
    assert.equal(report.vendorFiles, 144);
    assert.equal(report.originalAuditFailurePreserved, true);
    assert.equal(report.globalCveEradicationClaimed, false);
    if (scope === 'hardhat') assert.equal(report.hardhatEthersRangeVariant, 1);
    assert.equal(report.matchedRows.length, scope === 'root' ? 3 : scope === 'ui' ? 18 : 5);
    if (scope === 'ui') {
      const porto = report.installed.consumers.find(consumer => consumer.node.endsWith('/porto'));
      assert.deepEqual(porto.subpaths.map(entry => entry.specifier), ['zod/mini', 'zod/v4/core']);
      assert(porto.subpaths.every(entry => entry.entry.startsWith('ui/node_modules/@wagmi/connectors/node_modules/zod/')));
    }
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
for (const parents of [[], ['@reown/appkit-controllers'], ['@reown/appkit-ui'], ['@reown/appkit-utils'], ['@reown/appkit-controllers', '@reown/appkit-ui', '@reown/appkit-utils']]) test(`UI accepts valid inverse-via diagnostics without changing exact risk graph: ${parents.join(',') || 'none'}`, () => {
  const fixture = constructedTree('ui');
  try {
    changeAudit(fixture, audit => {
      for (const name of ['@reown/appkit-controllers', '@reown/appkit-ui', '@reown/appkit-utils']) {
        const other = audit.vulnerabilities[name].effects.filter(effect => effect !== '@reown/appkit-pay');
        audit.vulnerabilities[name].effects = parents.includes(name) ? [...other, '@reown/appkit-pay'] : other;
      }
    });
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.auditDiagnostics.usedForTrust, false);
    assert.equal(report.auditDiagnostics.automaticallyExecuted, false);
    const raw = JSON.parse(fs.readFileSync(fixture.auditPath));
    for (const name of parents) assert.deepEqual(report.auditDiagnostics.rows[name].effects, raw.vulnerabilities[name].effects);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
control('fails unknown diagnostic effect', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities['@reown/appkit-controllers'].effects.push('@reown/unreviewed')), 'AUDIT_DIAGNOSTIC_EFFECTS');
control('fails known row that is not an inverse-via diagnostic edge', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities.zod.effects.push('wagmi')), 'AUDIT_DIAGNOSTIC_EFFECTS');
control('fails duplicate diagnostic effects', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities.zod.effects.push(audit.vulnerabilities.zod.effects[0])), 'AUDIT_DIAGNOSTIC_EFFECTS');
for (const effects of [null, 'wagmi', [1]]) control(`fails malformed diagnostic effects ${JSON.stringify(effects)}`, 'ui', fixture => changeAudit(fixture, audit => { audit.vulnerabilities.zod.effects = effects; }), 'AUDIT_DIAGNOSTIC_EFFECTS');
control('fails missing effects field', 'ui', fixture => changeAudit(fixture, audit => { delete audit.vulnerabilities.zod.effects; }), 'AUDIT_DIAGNOSTIC_EFFECTS');
for (const fix of [false, true, { name: 'hardhat', version: '99.1000.123-alpha.1+diagnostic', isSemVerMajor: false }]) test(`valid fix metadata remains a retained nonexecuted diagnostic: ${JSON.stringify(fix)}`, () => {
  const fixture = constructedTree('hardhat');
  try {
    changeAudit(fixture, audit => { audit.vulnerabilities.zod.fixAvailable = fix; });
    const report = checkZodBackportAudit(fixture.options);
    assert.deepEqual(report.auditDiagnostics.rows.zod.fixAvailable, fix);
    assert.equal(report.auditDiagnostics.usedForTrust, false);
    assert.equal(report.auditDiagnostics.automaticallyExecuted, false);
    assert.equal(report.registryAuditExitCode, 1);
    assert.equal(report.sourceDisposition, 'PASS');
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
for (const fix of [null, [], 'true', {},
  { name: 'hardhat', version: '2.29.1', isSemVerMajor: true, execute: true },
  { name: 'hardhat', version: '2.29.1' },
  { name: '', version: '2.29.1', isSemVerMajor: true },
  { name: 'unreviewed', version: '2.29.1', isSemVerMajor: true },
  { name: '@nomicfoundation/hardhat-zod-utils', version: '2.29.1', isSemVerMajor: true },
  { name: 'hardhat', version: 'latest', isSemVerMajor: true },
  { name: 'hardhat', version: '01.2.3', isSemVerMajor: true },
  { name: 'hardhat', version: 'v1.2.3', isSemVerMajor: true },
  { name: 'hardhat', version: '1.2.3\n', isSemVerMajor: true },
  { name: 'hardhat', version: '1.2.3-01', isSemVerMajor: true },
  { name: 'hardhat', version: '2.29.1', isSemVerMajor: 'true' }]) control(`fails malformed or unrelated fix diagnostic ${JSON.stringify(fix)}`, 'hardhat', fixture => changeAudit(fixture, audit => { audit.vulnerabilities.zod.fixAvailable = fix; }), 'AUDIT_DIAGNOSTIC_FIX');
control('fails missing fixAvailable field', 'hardhat', fixture => changeAudit(fixture, audit => { delete audit.vulnerabilities.zod.fixAvailable; }), 'AUDIT_DIAGNOSTIC_FIX');
for (const scope of ['hardhat', 'ui']) test(`actual61 ${scope} raw diagnostic variation retains original exit1 and exact risk/source guards`, () => {
  const fixture = constructedTree(scope);
  try {
    for (const [extension, target] of [['json', fixture.auditPath], ['stderr', fixture.stderrPath], ['exit', fixture.exitPath]]) fs.copyFileSync(path.join(fixtures, `61-${scope}-audit.${extension}`), target);
    const before = fs.readFileSync(fixture.auditPath);
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.registryAuditExitCode, 1);
    assert.equal(report.sourceDisposition, 'PASS');
    assert.deepEqual(fs.readFileSync(fixture.auditPath), before);
    assert.equal(report.auditDiagnostics.usedForTrust, false);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
for (const scope of ['root', 'ui']) control(`${scope}: preserved ff5 actual CI audits with new advisories remain rejected`, scope, fixture => fs.copyFileSync(path.join(fixtures, `rejected-ff5-${scope}-audit.json`), fixture.auditPath), 'AUDIT_PROFILE_MISMATCH');
test('Hardhat actual Node22 captured signature is the current finite range candidate', () => {
  const fixture = constructedTree('hardhat');
  try {
    for (const [extension, target] of [['json', fixture.auditPath], ['stderr', fixture.stderrPath], ['exit', fixture.exitPath]]) fs.copyFileSync(path.join(fixtures, `fa7-hardhat-audit.${extension}`), target);
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.hardhatEthersRangeVariant, 0);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.registryAuditExitCode, 1);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
control('fails any third Hardhat ethers range string', 'hardhat', fixture => changeAudit(fixture, audit => { audit.vulnerabilities['@nomicfoundation/hardhat-ethers'].range = '3.0.7 || 3.0.8 || >=4.0.0-next.0'; }), 'AUDIT_PROFILE_MISMATCH');
control('Hardhat range alternatives do not permit a changed primitive', 'hardhat', fixture => changeAudit(fixture, audit => { audit.vulnerabilities.zod.via[0].source = 1; }), 'AUDIT_PROFILE_MISMATCH');
control('Hardhat range alternatives do not permit an additional node', 'hardhat', fixture => changeAudit(fixture, audit => audit.vulnerabilities.zod.nodes.push('node_modules/unknown/node_modules/zod')), 'AUDIT_PROFILE_MISMATCH');
control('fails new unrelated audit row', 'root', fixture => changeAudit(fixture, audit => { audit.vulnerabilities.unreviewed = { name: 'unreviewed', via: [], nodes: ['node_modules/unreviewed'] }; }), 'AUDIT_PROFILE_MISMATCH');
control('fails a new node on an otherwise known advisory', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities.zod.nodes.push('node_modules/unknown/node_modules/zod')), 'AUDIT_PROFILE_MISMATCH');
control('fails changed primitive details', 'root', fixture => changeAudit(fixture, audit => { audit.vulnerabilities.zod.via[0].source = 1; }), 'AUDIT_PROFILE_MISMATCH');
control('fails an unknown via reference', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities.wagmi.via.push('unknown')), 'AUDIT_PROFILE_MISMATCH');
control('fails changed dependency metadata', 'hardhat', fixture => changeAudit(fixture, audit => audit.metadata.dependencies.total++), 'AUDIT_PROFILE_MISMATCH');
control('fails modified reviewed runtime bytes', 'root', fixture => fs.appendFileSync(path.join(fixture.vendor, 'v3/types.cjs'), '\n'), 'VENDOR_IDENTITY');
control('fails an extra vendor file', 'root', fixture => fs.writeFileSync(path.join(fixture.vendor, 'unreviewed.js'), 'module.exports = 1'), 'VENDOR_IDENTITY');
control('fails changed package/lock bytes', 'root', fixture => fs.appendFileSync(path.join(fixture.root, 'ui/package-lock.json'), '\n'), 'PACKAGE_LOCK_IDENTITY');
control('fails registry v3 replacing the installed local fork', 'root', fixture => {
  const target = path.join(fixture.scopeRoot, 'node_modules/zod');
  fs.unlinkSync(target); fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'zod', version: '3.25.76' }));
}, 'INSTALLED_PACKAGE_IDENTITY');
control('fails unexpected installed Zod nodes', 'root', fixture => {
  const target = path.join(fixture.scopeRoot, 'node_modules/unexpected/node_modules/zod');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'zod', version: '3.25.76' }));
}, 'INSTALLED_ZOD_NODE_SET');
control('fails missing actual installed tree', 'root', fixture => fs.rmSync(path.join(fixture.scopeRoot, 'node_modules'), { recursive: true }), 'NOT_INSTALLED');
control('fails wrong separately resolved v4 version', 'ui', fixture => {
  const target = path.join(fixture.scopeRoot, 'node_modules/@wagmi/connectors/node_modules/zod/package.json');
  const value = JSON.parse(fs.readFileSync(target)); value.version = '4.6.5'; fs.writeFileSync(target, JSON.stringify(value));
}, 'INSTALLED_PACKAGE_IDENTITY');
control('fails missing authenticated Porto mini subpath', 'ui', fixture => fs.rmSync(path.join(fixture.scopeRoot, 'node_modules/@wagmi/connectors/node_modules/zod/mini/index.cjs')), 'REGISTRY4_IDENTITY');
control('fails missing authenticated Porto core subpath', 'ui', fixture => fs.rmSync(path.join(fixture.scopeRoot, 'node_modules/@wagmi/connectors/node_modules/zod/v4/core/index.cjs')), 'REGISTRY4_IDENTITY');
control('fails Porto subpath redirected outside separate v4 package', 'ui', fixture => {
  const target = path.join(fixture.scopeRoot, 'node_modules/@wagmi/connectors/node_modules/zod/mini/index.cjs');
  fs.unlinkSync(target); fs.symlinkSync(path.join(fixture.vendor, 'index.cjs'), target);
}, 'REGISTRY4_IDENTITY_LINK');
for (const relative of ['mini/index.cjs', 'v4/core/index.cjs', 'v4/core/schemas.cjs', 'package.json']) control(`fails same-version registry4 source or export mutation: ${relative}`, 'ui', fixture => {
  const target = path.join(fixture.scopeRoot, 'node_modules/@wagmi/connectors/node_modules/zod', relative);
  if (relative === 'package.json') {
    const value = JSON.parse(fs.readFileSync(target)); value.exports['./mini'] = value.exports['.']; fs.writeFileSync(target, JSON.stringify(value));
  } else fs.appendFileSync(target, '\n// same-version unreviewed mutation\n');
}, 'REGISTRY4_IDENTITY');
control('fails original exit0 with retained findings', 'root', fixture => fs.writeFileSync(fixture.exitPath, '0\n'), 'AUDIT_PROFILE_MISMATCH');
control('fails command/network exit outside0/1', 'root', fixture => fs.writeFileSync(fixture.exitPath, '2\n'), 'AUDIT_EXIT');
control('fails network error JSON', 'root', fixture => fs.writeFileSync(fixture.auditPath, JSON.stringify({ error: { code: 'ENETUNREACH' } })), 'AUDIT_PROFILE_MISMATCH');
control('fails unexpected error stderr', 'root', fixture => fs.writeFileSync(fixture.stderrPath, 'npm error code ENETUNREACH\n'), 'AUDIT_STDERR');
control('fails malformed JSON', 'root', fixture => fs.writeFileSync(fixture.auditPath, '{broken'));
control('fails duplicate JSON evidence keys', 'root', fixture => { const bytes = fs.readFileSync(fixture.auditPath, 'utf8'); fs.writeFileSync(fixture.auditPath, bytes.replace('"auditReportVersion": 2', '"auditReportVersion": 2, "auditReportVersion": 2')); }, 'DUPLICATE_JSON_KEY');
for (const scope of ['root', 'ui', 'hardhat']) test(`${scope}: captured corrected clean snapshot in a constructed tree stays separately labelled PASS_RAW`, () => {
  const fixture = constructedTree(scope);
  try {
    for (const [extension, target] of [['json', fixture.auditPath], ['stderr', fixture.stderrPath], ['exit', fixture.exitPath]]) fs.copyFileSync(path.join(fixtures, `corrected-${scope}-clean-audit.${extension}`), target);
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.registryAudit, 'PASS_RAW');
    assert.equal(report.registryAuditExitCode, 0);
    assert.equal(report.originalAuditFailurePreserved, false);
    assert.equal(report.auditDiagnostics.usedForTrust, false);
    assert.deepEqual(report.auditDiagnostics.rows, {});
    assert.deepEqual(report.matchedRows, []);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
test('fails changed finite profile before source disposition', () => {
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'profile-'));
  try {
    fs.copyFileSync(path.join(__dirname, '../check-zod-backport-audit.cjs'), path.join(directory, 'checker.cjs'));
    fs.copyFileSync(path.join(__dirname, '../zod-backport-audit-profile.json'), path.join(directory, 'zod-backport-audit-profile.json'));
    fs.appendFileSync(path.join(directory, 'zod-backport-audit-profile.json'), '\n');
    const result = spawnSync(process.execPath, [path.join(directory, 'checker.cjs'), '--repository', directory, '--scope', 'root', '--audit', 'none', '--stderr', 'none', '--exit-file', 'none', '--output', path.join(directory, 'report.json')], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).code, 'PROFILE_IDENTITY');
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'report.json'))).sourceDisposition, 'FAIL');
  } finally { fs.rmSync(directory, { recursive: true }); }
});

test('original complete1.20.1 source vector keeps its unchanged profile and report semantics', () => {
  const fixture = constructedTree('root');
  try {
    softwareEdition(fixture.root, '1.20.1');
    for (const [name, digest] of Object.entries(profile.packageFiles)) assert.equal(sha(fs.readFileSync(path.join(fixture.root, name))), digest);
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.profileSha256, '37339f548db43979d3e12b42547cdce336d1c7c5462ff7a6c78f65bc1b1b6862');
    assert.deepEqual(report.packageFiles, profile.packageFiles);
    assert.equal(Object.hasOwn(report, 'packageSourceIdentity'), false);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.registryAuditExitCode, 1);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});

test('current complete1.20.2 vector preserves actual830 raw audit and reports only nine version projections', () => {
  const fixture = constructedTree('root');
  try {
    softwareEdition(fixture.root, '1.20.2');
    const raw = fs.readFileSync(fixture.auditPath);
    assert.equal(sha(raw), 'a34f1338932992967f2e1226df00b197714f7358602b2bd7267619161a824150');
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.packageSourceIdentity.version, '1.20.2');
    assert.equal(report.packageSourceIdentity.previousVersion, '1.20.1');
    assert.equal(report.packageSourceIdentity.versionFields, 9);
    assert.equal(report.packageSourceIdentity.originalProfileSha256, report.profileSha256);
    assert.deepEqual(report.packageSourceIdentity.originalPackageFiles, profile.packageFiles);
    for (const [name, digest] of Object.entries(report.packageFiles)) assert.equal(digest, sha(fs.readFileSync(path.join(fixture.root, name))));
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.registryAuditExitCode, 1);
    assert.equal(report.sourceDisposition, 'PASS');
    assert.deepEqual(fs.readFileSync(fixture.auditPath), raw);
    assert.equal(report.globalCveEradicationClaimed, false);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});

test('source identity refuses every mixed six-file edition in both directions', () => {
  for (const version of ['1.20.1', '1.20.2']) for (const name of Object.keys(profile.packageFiles)) {
    const fixture = constructedTree('root');
    try {
      softwareEdition(fixture.root, version);
      softwareEdition(fixture.root, version === '1.20.1' ? '1.20.2' : '1.20.1', [name]);
      assert.throws(() => checkZodBackportAudit(fixture.options), error => error.code === 'PACKAGE_LOCK_IDENTITY', name);
    } finally { fs.rmSync(fixture.directory, { recursive: true }); }
  }
});

test('source identity refuses a lock with mixed top-level and package-root version fields', () => {
  for (const name of Object.keys(profile.packageFiles).filter(name => name.endsWith('package-lock.json'))) {
    const fixture = constructedTree('root');
    try {
      softwareEdition(fixture.root, '1.20.2');
      const filename = path.join(fixture.root, name), value = JSON.parse(fs.readFileSync(filename));
      value.packages[''].version = '1.20.1'; fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
      assert.throws(() => checkZodBackportAudit(fixture.options), error => error.code === 'PACKAGE_LOCK_IDENTITY', name);
    } finally { fs.rmSync(fixture.directory, { recursive: true }); }
  }
});

control('source identity refuses an unreviewed future software edition', 'root', fixture => softwareEdition(fixture.root, '1.20.3'), 'PACKAGE_LOCK_IDENTITY');
control('version projection does not normalize an unrelated1.20.1 UI dependency', 'root', fixture => {
  const filename = path.join(fixture.root, 'ui/package-lock.json'), value = JSON.parse(fs.readFileSync(filename));
  const dependency = Object.entries(value.packages).find(([name, entry]) => name && entry.version === '1.20.1');
  assert.ok(dependency); dependency[1].version = '1.20.2';
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}, 'PACKAGE_LOCK_IDENTITY');

test('even a mistaken current hash refresh cannot project away a non-version source edit', () => {
  const fixture = constructedTree('root');
  try {
    softwareEdition(fixture.root, '1.20.2');
    const filename = path.join(fixture.root, 'package.json'), raw = fs.readFileSync(filename), value = JSON.parse(raw);
    value.scripts.test = 'unreviewed-command'; fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
    const currentHash = sha(raw), changedHash = sha(fs.readFileSync(filename));
    const original = fs.readFileSync(path.join(__dirname, '../check-zod-backport-audit.cjs'), 'utf8');
    assert.equal(original.split(currentHash).length, 2);
    const checker = path.join(fixture.directory, 'source-projection-checker.cjs');
    fs.writeFileSync(checker, original.replace(currentHash, changedHash));
    fs.copyFileSync(path.join(__dirname, '../zod-backport-audit-profile.json'), path.join(fixture.directory, 'zod-backport-audit-profile.json'));
    assert.throws(() => require(checker).checkZodBackportAudit(fixture.options), error => error.code === 'PACKAGE_VERSION_PROJECTION');
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});

// The old suite above retains original exact source vectors; this suite selects
// the separately reviewed dependency replacement with real installed resolution.
function cssFixture() {
  const fixture = constructedTree('ui');
  for (const name of ['ui/package.json', 'ui/package-lock.json']) fs.copyFileSync(path.join(repository, name), path.join(fixture.root, name));
  for (const name of ['@vanilla-extract/css', 'deepmerge-ts', 'modern-ahocorasick']) {
    const target = path.join(fixture.scopeRoot, 'node_modules', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repository, 'ui/node_modules', name), target, { recursive: true });
  }
  return fixture;
}
test('exact CSS replacement restores old six-file identity and verifies installed removal without an audit waiver', () => {
  const fixture = cssFixture();
  try {
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.cssInstalled.deepmergeInstalled, false);
    assert.equal(report.cssInstalled.installedResolutionVerified, true);
    assert.equal(report.packageSourceIdentity.cssDependencyReplacement.lockNodesChanged, 4);
    assert.equal(report.packageSourceIdentity.cssDependencyReplacement.vulnerabilityWaiver, false);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
    assert.equal(report.globalCveEradicationClaimed, false);
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
for (const mutation of ['unknown-advisory', 'unaffected-lock', 'mixed-vector', 'stale-css', 'hidden-deepmerge']) test('CSS replacement rejects ' + mutation, () => {
  const fixture = cssFixture();
  try {
    if (mutation === 'unknown-advisory') { const value = JSON.parse(fs.readFileSync(fixture.auditPath)); value.vulnerabilities.zod.via[0].source++; fs.writeFileSync(fixture.auditPath, JSON.stringify(value)); }
    if (mutation === 'unaffected-lock') { const file = path.join(fixture.scopeRoot, 'package-lock.json'), value = JSON.parse(fs.readFileSync(file)); value.packages['node_modules/viem'].version = '99.0.0'; fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
    if (mutation === 'mixed-vector') { const file = path.join(fixture.scopeRoot, 'package.json'); fs.writeFileSync(file, restoreCssSource('ui/package.json', fs.readFileSync(file))); }
    if (mutation === 'stale-css') { const file = path.join(fixture.scopeRoot, 'node_modules/@vanilla-extract/css/package.json'), value = JSON.parse(fs.readFileSync(file)); value.version = '1.20.1'; fs.writeFileSync(file, JSON.stringify(value)); }
    if (mutation === 'hidden-deepmerge') { const folder = path.join(fixture.scopeRoot, 'node_modules/@vanilla-extract/css/node_modules/deepmerge'); fs.mkdirSync(folder, { recursive: true }); fs.writeFileSync(path.join(folder, 'package.json'), '{"name":"deepmerge","version":"4.3.1"}'); }
    assert.throws(() => checkZodBackportAudit(fixture.options));
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
