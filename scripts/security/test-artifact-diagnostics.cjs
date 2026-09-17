'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkCompilerDiagnostics } = require('../export-contract-artifacts.js');
const artifact = { buildInfoId: 'current', inputSourceName: 'project/contracts/Example.sol', contractName: 'Example' };
function fixture(run, errors) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-diagnostics-'));
  const input = { solcVersion: '0.8.37' };
  const output = { output: { contracts: { [artifact.inputSourceName]: { Example: {} } }, ...(errors === undefined ? {} : { errors }) } };
  fs.writeFileSync(path.join(directory, 'current.json'), JSON.stringify(input));
  fs.writeFileSync(path.join(directory, 'current.output.json'), JSON.stringify(output));
  try { run(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
test('accepts the referenced clean compiler output and ignores unused stale output', () => fixture(directory => {
  fs.writeFileSync(path.join(directory, 'stale.output.json'), JSON.stringify({ output: { errors: [{ severity: 'warning', message: 'obsolete build' }] } }));
  assert.equal(checkCompilerDiagnostics([artifact], directory, '0.8.37'), 1);
}));
test('rejects actual compiler warnings and errors instead of exporting artifacts', () => {
  for (const severity of ['warning', 'error']) fixture(directory => assert.throws(() => checkCompilerDiagnostics([artifact], directory, '0.8.37'), /Compiler (warning|error): dependency diagnostic/), [{ severity, message: 'dependency diagnostic' }]);
});
test('rejects malformed diagnostic payloads and unknown severity', () => {
  for (const errors of [{}, [null], [{ severity: 'warn' }]]) fixture(directory => assert.throws(() => checkCompilerDiagnostics([artifact], directory, '0.8.37'), /Malformed compiler/), errors);
});
test('rejects stale compilers and artifacts not belonging to the clean build', () => fixture(directory => {
  assert.throws(() => checkCompilerDiagnostics([artifact], directory, '0.8.23'), /Stale compiler/);
  assert.throws(() => checkCompilerDiagnostics([{ ...artifact, contractName: 'Other' }], directory, '0.8.37'), /absent from its referenced build/);
  assert.throws(() => checkCompilerDiagnostics([{ ...artifact, buildInfoId: '../current' }], directory, '0.8.37'), /invalid build-info/);
}));
