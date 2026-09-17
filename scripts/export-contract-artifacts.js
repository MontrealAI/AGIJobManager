'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);

function checkCompilerDiagnostics(artifacts, directory, expectedVersion) {
  const builds = new Map();
  for (const artifact of artifacts) {
    const id = artifact.buildInfoId;
    assert(typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id), `Missing or invalid build-info ID for ${artifact.contractName}`);
    let output = builds.get(id);
    if (!output) {
      const input = JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'));
      assert.equal(input.solcVersion, expectedVersion, `Stale compiler version in ${id}`);
      const result = JSON.parse(fs.readFileSync(path.join(directory, `${id}.output.json`), 'utf8'));
      assert(result.output && typeof result.output === 'object', `Missing compiler output in ${id}`);
      output = result.output;
      const diagnostics = output.errors === undefined ? [] : output.errors;
      assert(Array.isArray(diagnostics), `Malformed compiler diagnostics in ${id}`);
      for (const diagnostic of diagnostics) {
        assert(diagnostic && ['info', 'warning', 'error'].includes(diagnostic.severity), `Malformed compiler diagnostic in ${id}`);
        assert.equal(diagnostic.severity, 'info', `Compiler ${diagnostic.severity}: ${diagnostic.formattedMessage || diagnostic.message || diagnostic.errorCode || 'unspecified diagnostic'}`);
      }
      builds.set(id, output);
    }
    const source = artifact.inputSourceName || artifact.sourceName;
    assert(output.contracts?.[source]?.[artifact.contractName], `Artifact ${artifact.contractName} is absent from its referenced build-info`);
  }
  return builds.size;
}

function main() {
  const source = path.join(root, 'hardhat/artifacts');
  const target = path.join(root, 'build/contracts');
  const artifacts = walk(source).filter(file => file.endsWith('.json') && !file.endsWith('.dbg.json') && !file.includes(`${path.sep}build-info${path.sep}`)).map(file => JSON.parse(fs.readFileSync(file, 'utf8'))).filter(artifact => artifact.contractName && artifact.abi && artifact.bytecode !== undefined);
  if (!artifacts.length) throw new Error('No compiled Hardhat contract artifacts found');
  const names = new Set();
  for (const artifact of artifacts) {
    if (names.has(artifact.contractName)) throw new Error(`Ambiguous contract artifact: ${artifact.contractName}`);
    names.add(artifact.contractName);
  }
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).devDependencies.solc;
  const builds = checkCompilerDiagnostics(artifacts, path.join(source, 'build-info'), version);
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(target)) if (file.endsWith('.json')) fs.unlinkSync(path.join(target, file));
  for (const artifact of artifacts) fs.writeFileSync(path.join(target, `${artifact.contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Exported ${artifacts.length} Hardhat artifacts from ${builds} builds: zero compiler warnings or errors.`);
}
if (require.main === module) main();
module.exports = { checkCompilerDiagnostics };
