'use strict';
// Fixed Solidity C API driver. No npm solc wrapper, import callback, network,
// shell command or caller-selected compiler arguments are accepted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const fail = () => { throw Error('SOLJSON_DRIVER_REJECTED'); };
try {
  if (process.argv.length !== 2) fail();
  const bytes = fs.readFileSync(0); if (bytes.length > 64 * 1024 * 1024) fail();
  const request = JSON.parse(bytes.toString('utf8'));
  if (!request || Object.keys(request).sort().join(',') !== 'compilerPath,compilerSha256,expectedVersion,input' || typeof request.compilerPath !== 'string' || !path.isAbsolute(request.compilerPath) || fs.realpathSync(request.compilerPath) !== request.compilerPath || !/^[a-f0-9]{64}$/.test(request.compilerSha256)) fail();
  const stat = fs.lstatSync(request.compilerPath); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) fail();
  const fd = fs.openSync(request.compilerPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let compilerBytes; try { compilerBytes = fs.readFileSync(fd); } finally { fs.closeSync(fd); }
  if (compilerBytes.length > 64 * 1024 * 1024 || crypto.createHash('sha256').update(compilerBytes).digest('hex') !== request.compilerSha256) fail();
  const compilerModule = new Module(request.compilerPath); compilerModule.filename = request.compilerPath; compilerModule.paths = [];
  compilerModule._compile(compilerBytes.toString('utf8'), request.compilerPath);
  const soljson = compilerModule.exports;
  if (typeof soljson.cwrap !== 'function') fail();
  const version = soljson.cwrap('solidity_version', 'string', [])(); if (version !== request.expectedVersion || !/^0\.8\.37\+commit\.f401782d\.Emscripten\.clang$/.test(version)) fail();
  if (!request.input || request.input.language !== 'Solidity' || !request.input.sources || Object.values(request.input.sources).some(source => !source || typeof source.content !== 'string' || Object.keys(source).some(key => key !== 'content'))) fail();
  const output = soljson.cwrap('solidity_compile', 'string', ['string', 'number', 'number'])(JSON.stringify(request.input), 0, 0);
  const result = JSON.parse(output); if (soljson._solidity_reset) soljson._solidity_reset();
  process.stdout.write(JSON.stringify({ version, output: result }));
} catch { process.stderr.write('SOLJSON_DRIVER_REJECTED\n'); process.exitCode = 1; }
