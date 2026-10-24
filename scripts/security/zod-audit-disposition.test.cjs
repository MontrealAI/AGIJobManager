const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { checkZodBackportAudit } = require('../check-zod-backport-audit.cjs');
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
    fs.copyFileSync(path.join(repository, relative), path.join(root, relative));
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
test('UI permits only the other authenticated coupled Appkit effects mapping', () => {
  const fixture = constructedTree('ui');
  try {
    const raw = JSON.parse(fs.readFileSync(fixture.auditPath));
    const variants = profile.scopes.ui.coupledEffectsVariants;
    const current = variants.findIndex(variant => Object.entries(variant).every(([name, effects]) => JSON.stringify(raw.vulnerabilities[name].effects) === JSON.stringify(effects)));
    assert.notEqual(current, -1);
    const alternate = 1 - current;
    changeAudit(fixture, audit => { for (const [name, effects] of Object.entries(variants[alternate])) audit.vulnerabilities[name].effects = effects; });
    const report = checkZodBackportAudit(fixture.options);
    assert.equal(report.coupledEffectsVariant, alternate);
    assert.equal(report.registryAudit, 'FAILED_KNOWN_BACKPORT_MATCH');
  } finally { fs.rmSync(fixture.directory, { recursive: true }); }
});
for (const state of ['both', 'neither']) control(`fails third coupled Appkit effects combination: ${state}`, 'ui', fixture => changeAudit(fixture, audit => {
  for (const name of ['@reown/appkit-controllers', '@reown/appkit-ui']) {
    const withoutPay = audit.vulnerabilities[name].effects.filter(name => name !== '@reown/appkit-pay');
    audit.vulnerabilities[name].effects = state === 'both' ? [...withoutPay, '@reown/appkit-pay'].sort() : withoutPay;
  }
}), 'AUDIT_PROFILE_MISMATCH');
control('fails unknown Appkit effect despite permitted coupled alternatives', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities['@reown/appkit-controllers'].effects.push('@reown/unreviewed')), 'AUDIT_PROFILE_MISMATCH');
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
control('fails changed effects closure', 'ui', fixture => changeAudit(fixture, audit => audit.vulnerabilities.zod.effects.push('wagmi')), 'AUDIT_PROFILE_MISMATCH');
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
    assert.equal(report.coupledEffectsVariant, null);
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
