const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const PROFILE_SHA256 = '0cb43cf9d6037a46f7fe61b18f01c7618cbbc3683e1b705f3a8028ccb2b292e1';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, function (_key, entry) { return entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry; });
function requireThat(condition, code, message) { if (!condition) throw Object.assign(new Error(message), { code }); }
function readRegular(filename) {
  const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try { const before = fs.fstatSync(descriptor); requireThat(before.isFile(), 'NOT_REGULAR', filename); const bytes = fs.readFileSync(descriptor), after = fs.fstatSync(descriptor); requireThat(before.size === bytes.length && after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, 'FILE_CHANGED_DURING_CAPTURE', filename); return bytes; }
  finally { fs.closeSync(descriptor); }
}
function parseJson(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const value = JSON.parse(text), stack = [];
  for (const token of text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g) || []) {
    if (token === '{') stack.push({ object: true, key: true, keys: new Set() });
    else if (token === '[') stack.push({ object: false });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && stack.at(-1)?.object) stack.at(-1).key = true;
    else if (token === ':' && stack.at(-1)?.object) stack.at(-1).key = false;
    else if (token.startsWith('"') && stack.at(-1)?.object && stack.at(-1).key) {
      const key = JSON.parse(token), current = stack.at(-1);
      requireThat(!current.keys.has(key), 'DUPLICATE_JSON_KEY', key);
      current.keys.add(key); current.key = false;
    }
  }
  return value;
}
function loadProfile() {
  const bytes = readRegular(path.join(__dirname, 'zod-backport-audit-profile.json'));
  requireThat(sha(bytes) === PROFILE_SHA256, 'PROFILE_IDENTITY', 'The reviewed finite profile changed');
  return parseJson(bytes);
}
function inside(root, filename) {
  const relative = path.relative(root, filename);
  requireThat(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'OUTSIDE_REPOSITORY', filename);
  return filename;
}
function verifyComponent(directory, expected, identityCode) {
  const actual = {};
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      requireThat(!entry.isSymbolicLink(), identityCode + '_LINK', filename);
      if (entry.isDirectory()) visit(filename);
      else { requireThat(entry.isFile(), identityCode + '_SPECIAL_FILE', filename); const bytes = readRegular(filename); actual[path.relative(directory, filename).split(path.sep).join('/')] = { bytes: bytes.length, sha256: sha(bytes) }; }
    }
  }
  visit(directory);
  requireThat(canonical(actual) === canonical(expected), identityCode, 'The complete selected component file manifest differs');
  return sha(Buffer.from(canonical(actual)));
}
function verifyVendor(directory, expected) { return verifyComponent(directory, expected, 'VENDOR_IDENTITY'); }
function verifyRegistry4(directory, profile) { return verifyComponent(directory, profile.registry4.files, 'REGISTRY4_IDENTITY'); }
function lockEntry(lock, node) {
  const entry = lock.packages[node];
  requireThat(entry, 'LOCK_NODE_MISSING', node);
  if (!entry.link) return entry;
  requireThat(typeof entry.resolved === 'string' && lock.packages[entry.resolved], 'LOCK_LINK_MISSING', node);
  return lock.packages[entry.resolved];
}
const packageName = node => node.split('node_modules/').at(-1);
function installedPackage(root, scopeRoot, lock, node, expectedName) {
  const directory = inside(root, fs.realpathSync(path.resolve(scopeRoot, node)));
  const actual = parseJson(readRegular(path.join(directory, 'package.json'))), expected = lockEntry(lock, node);
  requireThat(actual.name === expectedName && actual.version === expected.version, 'INSTALLED_PACKAGE_IDENTITY', node);
  return { directory, actual };
}
function zodNodes(root, scopeRoot) {
  const result = [], visited = new Set();
  function visitModules(directory) {
    requireThat(fs.existsSync(directory), 'NOT_INSTALLED', directory);
    const real = inside(root, fs.realpathSync(directory));
    if (visited.has(real)) return;
    visited.add(real);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const location = path.join(directory, entry.name);
      if (entry.name.startsWith('@')) { for (const child of fs.readdirSync(location)) visitPackage(path.join(location, child)); }
      else visitPackage(location);
    }
  }
  function visitPackage(directory) {
    if (!fs.statSync(directory).isDirectory()) return;
    inside(root, fs.realpathSync(directory));
    if (path.basename(directory) === 'zod') result.push(path.relative(scopeRoot, directory).split(path.sep).join('/'));
    if (fs.existsSync(path.join(directory, 'node_modules'))) visitModules(path.join(directory, 'node_modules'));
  }
  visitModules(path.join(scopeRoot, 'node_modules'));
  return result.sort();
}
function verifyInstalled(root, scope, profile, vendorDirectory, lock) {
  const scopeRoot = path.resolve(root, scope.directory);
  requireThat(lock.lockfileVersion === 3, 'LOCK_SCHEMA', 'Expected the selected lock v3');
  const expectedNodes = Object.keys(lock.packages).filter(node => /(?:^|\/)node_modules\/zod$/.test(node)).sort();
  requireThat(canonical(zodNodes(root, scopeRoot)) === canonical(expectedNodes), 'INSTALLED_ZOD_NODE_SET', 'Installed Zod nodes differ from the selected lock');
  const observedNodes = [];
  for (const node of expectedNodes) {
    const { directory, actual } = installedPackage(root, scopeRoot, lock, node, 'zod');
    let installedManifestSha256;
    if (actual.version === profile.forkVersion) installedManifestSha256 = verifyVendor(directory, profile.vendorFiles);
    else {
      requireThat(scope.registry4Nodes[node] === actual.version && actual.version === profile.registry4.version, 'REGISTRY_OR_UNKNOWN_ZOD', node);
      installedManifestSha256 = verifyRegistry4(directory, profile);
    }
    observedNodes.push({ node, directory: path.relative(root, directory), version: actual.version, sourceFiles: actual.version === profile.forkVersion ? Object.keys(profile.vendorFiles).length : Object.keys(profile.registry4.files).length, installedManifestSha256, registryArchiveIntegrity: actual.version === profile.registry4.version ? profile.registry4.integrity : null });
  }
  const consumers = [];
  for (const consumer of scope.consumers) {
    const directory = consumer.node ? installedPackage(root, scopeRoot, lock, consumer.node, packageName(consumer.node)).directory : scopeRoot;
    const resolve = createRequire(path.join(directory, 'package.json'));
    const packagePath = inside(root, fs.realpathSync(resolve.resolve('zod/package.json'))), actual = parseJson(readRegular(packagePath));
    const entry = inside(root, fs.realpathSync(resolve.resolve('zod')));
    requireThat(path.dirname(entry) === path.dirname(packagePath), 'ZOD_ENTRY_RESOLUTION', consumer.node);
    requireThat(actual.version === consumer.version, 'CONSUMER_ZOD_RESOLUTION', consumer.node);
    if (consumer.version === profile.forkVersion) verifyVendor(path.dirname(packagePath), profile.vendorFiles);
    else { requireThat(consumer.version === profile.registry4.version, 'UNKNOWN_ZOD_MAJOR', consumer.node); verifyRegistry4(path.dirname(packagePath), profile); }
    const subpaths = [];
    for (const specifier of consumer.specifiers || []) {
      const resolved = inside(path.dirname(packagePath), fs.realpathSync(resolve.resolve(specifier)));
      const bytes = readRegular(resolved);
      subpaths.push({ specifier, entry: path.relative(root, resolved), sha256: sha(bytes) });
    }
    consumers.push({ node: consumer.node || '.', version: actual.version, package: path.relative(root, packagePath), entry: path.relative(root, entry), subpaths });
  }
  for (const [name, row] of Object.entries(scope.audit.vulnerabilities)) for (const node of row.nodes) {
    if (name === 'zod') {
      const directory = inside(root, fs.realpathSync(path.resolve(scopeRoot, node)));
      requireThat(directory === vendorDirectory || expectedNodes.includes(node), 'AUDIT_ZOD_NODE_RESOLUTION', node);
      verifyVendor(directory, profile.vendorFiles);
    } else installedPackage(root, scopeRoot, lock, node, name);
  }
  return { kind: 'ACTUAL_INSTALLED_FILESYSTEM_AND_NODE_RESOLUTION', zodNodes: observedNodes, consumers, auxiliaryGraphs: 'Only this captured scope is audited; other selected package/lock hashes are identity bindings.' };
}
function verifyClosure(audit, expectedPrimitive) {
  const rows = audit.vulnerabilities, names = new Set(Object.keys(rows)), primitives = [];
  for (const [name, row] of Object.entries(rows)) {
    requireThat(row.name === name, 'AUDIT_ROW_NAME', name);
    for (const via of row.via) {
      if (typeof via === 'string') requireThat(names.has(via), 'UNKNOWN_VIA', via);
      else primitives.push(via);
    }
    for (const effect of row.effects) requireThat(names.has(effect), 'UNKNOWN_EFFECT', effect);
  }
  requireThat(primitives.length === 1 && canonical(primitives[0]) === canonical(expectedPrimitive), 'UNKNOWN_PRIMITIVE', 'Expected only the reviewed constrained-collection primitive');
  const reaches = new Set(['zod']);
  let prior;
  do { prior = reaches.size; for (const [name, row] of Object.entries(rows)) if (row.via.some(via => typeof via === 'string' && reaches.has(via))) reaches.add(name); } while (reaches.size !== prior);
  requireThat(reaches.size === names.size, 'UNRELATED_METAVULNERABILITY', 'Every captured row must reach the one primitive, including legitimate cycles');
}
function checkZodBackportAudit({ repositoryRoot, scope: scopeName, auditPath, stderrPath, exitPath }) {
  const profile = loadProfile(), scope = profile.scopes[scopeName];
  requireThat(scope, 'UNKNOWN_SCOPE', 'Only exact captured root, UI or Hardhat scope is eligible');
  const root = fs.realpathSync(repositoryRoot), auditBytes = readRegular(auditPath), stderrBytes = readRegular(stderrPath), exitBytes = readRegular(exitPath);
  requireThat(/^[01]\n?$/.test(exitBytes.toString()), 'AUDIT_EXIT', 'Network/command failure or missing original exit code');
  const auditExitCode = Number(exitBytes.toString().trim()), stderr = stderrBytes.toString();
  requireThat(stderr === '' || profile.knownNpmWarnings.includes(stderr), 'AUDIT_STDERR', 'Unexpected stderr is not a vulnerability disposition');
  const audit = parseJson(auditBytes), clean = auditExitCode === 0;
  const expected = clean ? scope.cleanAudit : scope.audit;
  let candidates = !clean && scope.coupledEffectsVariants ? scope.coupledEffectsVariants.map(variant => ({ ...expected, vulnerabilities: { ...expected.vulnerabilities, ...Object.fromEntries(Object.entries(variant).map(([name, effects]) => [name, { ...expected.vulnerabilities[name], effects }])) } })) : [expected];
  if (!clean && scopeName === 'hardhat' && scope.hardhatEthersRangeVariants) candidates = scope.hardhatEthersRangeVariants.map(range => ({ ...expected, vulnerabilities: { ...expected.vulnerabilities, '@nomicfoundation/hardhat-ethers': { ...expected.vulnerabilities['@nomicfoundation/hardhat-ethers'], range } } }));
  const matchedAuditVariant = candidates.findIndex(candidate => canonical(audit) === canonical(candidate));
  requireThat(matchedAuditVariant !== -1, 'AUDIT_PROFILE_MISMATCH', 'Raw audit has new, missing or changed findings, nodes, via/effects, metadata or an error response');
  if (!clean) verifyClosure(audit, profile.primitive);
  const packageBytes = {};
  for (const [relative, expectedHash] of Object.entries(profile.packageFiles)) { const bytes = readRegular(path.join(root, relative)); requireThat(sha(bytes) === expectedHash, 'PACKAGE_LOCK_IDENTITY', relative); packageBytes[relative] = bytes; }
  const rootPackage = parseJson(packageBytes['package.json']), spec = rootPackage.devDependencies?.zod || rootPackage.dependencies?.zod;
  requireThat(typeof spec === 'string' && spec.startsWith('file:'), 'LOCAL_BACKPORT_NOT_SELECTED', 'Root must select its exact reviewed local component');
  const vendorDirectory = inside(root, fs.realpathSync(path.resolve(root, spec.slice(5))));
  const vendorManifestSha256 = verifyVendor(vendorDirectory, profile.vendorFiles);
  for (const [relative, expectedHash] of Object.entries(profile.runtimeFiles)) requireThat(sha(readRegular(path.join(vendorDirectory, relative))) === expectedHash, 'RUNTIME_IDENTITY', relative);
  const lockRelative = scope.directory ? scope.directory + '/package-lock.json' : 'package-lock.json';
  const installed = verifyInstalled(root, scope, profile, vendorDirectory, parseJson(packageBytes[lockRelative]));
  return { schema: 'manager/zod-bounded-source-audit-disposition/v1', registryAudit: clean ? 'PASS_RAW' : 'FAILED_KNOWN_BACKPORT_MATCH', registryAuditExitCode: auditExitCode, sourceDisposition: 'PASS', coupledEffectsVariant: !clean && scope.coupledEffectsVariants ? matchedAuditVariant : null, hardhatEthersRangeVariant: !clean && scopeName === 'hardhat' && scope.hardhatEthersRangeVariants ? matchedAuditVariant : null, category: 'CODE_BACKPORT_EQUIVALENT_TO_6652_BOUNDED_ONLY', scope: scopeName, raw: { auditSha256: sha(auditBytes), stderrSha256: sha(stderrBytes), exitCodeSha256: sha(exitBytes) }, profileSha256: PROFILE_SHA256, vendorManifestSha256, vendorFiles: Object.keys(profile.vendorFiles).length, runtimeFiles: profile.runtimeFiles, packageFiles: profile.packageFiles, matchedPrimitive: clean ? null : profile.primitive, matchedRows: clean ? [] : Object.keys(audit.vulnerabilities), installed, limits: profile.limits, originalAuditFailurePreserved: !clean, unboundedContainersQualified: false, globalCveEradicationClaimed: false };
}
if (require.main === module) {
  const args = process.argv.slice(2), options = {};
  const fields = { '--repository': 'repositoryRoot', '--scope': 'scope', '--audit': 'auditPath', '--stderr': 'stderrPath', '--exit-file': 'exitPath', '--output': 'outputPath' };
  let outputPath;
  try {
    requireThat(args.length === 12, 'USAGE', 'Supply --repository --scope --audit --stderr --exit-file --output');
    for (let index = 0; index < args.length; index += 2) { const field = fields[args[index]]; requireThat(field && !options[field] && args[index + 1], 'USAGE', args[index]); options[field] = args[index + 1]; }
    outputPath = options.outputPath;
    const report = checkZodBackportAudit(options);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ registryAudit: report.registryAudit, registryAuditExitCode: report.registryAuditExitCode, sourceDisposition: report.sourceDisposition, output: outputPath }));
  } catch (error) {
    const report = { schema: 'manager/zod-bounded-source-audit-disposition/v1', registryAudit: 'NOT_CLEARED', sourceDisposition: 'FAIL', code: error.code || 'INVALID_INPUT_OR_NOT_INSTALLED', error: error.message, globalCveEradicationClaimed: false };
    if (outputPath && !fs.existsSync(outputPath)) fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.error(JSON.stringify(report)); process.exitCode = 1;
  }
}
module.exports = { checkZodBackportAudit };
