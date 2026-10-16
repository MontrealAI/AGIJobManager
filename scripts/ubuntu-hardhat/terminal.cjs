#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path');
const S = require('./safety.cjs'), { connectHardhat } = require('./hardhat.cjs'), { loadNative } = require('./native.cjs'), { review, sendOne, fresh } = require('./send.cjs');
function flags(args) {
  const [action, ...rest] = args; S.need(['review', 'send', 'reconcile'].includes(action) && rest.length % 2 === 0, 'EXACT_COMMAND_REQUIRED');
  const values = {};
  for (let i = 0; i < rest.length; i += 2) { S.need(/^--[a-z-]+$/.test(rest[i]) && !Object.hasOwn(values, rest[i].slice(2)), 'EXACT_COMMAND_REQUIRED'); values[rest[i].slice(2)] = rest[i + 1]; }
  const keys = action === 'review' ? ['config', 'config-sha', 'out'] : action === 'send' ? ['config', 'config-sha', 'review', 'initiate-mainnet'] : ['config', 'config-sha', 'out'];
  S.need(Object.keys(values).sort().join() === keys.sort().join(), 'EXACT_COMMAND_REQUIRED'); return { action, ...values };
}
function validateConfig(c) {
  const common = ['schema', 'project', 'checkout', 'runtimeCheckout', 'nodeSha256', 'toolSourceSha256', 'rpcUrl'];
  const extra = { manager: ['planFile', 'sessionPath', 'catalogPath', 'catalogSha256', 'buildId'], alpha: ['planFile', 'sessionPath'], jobs: ['profilePath', 'profileSha256', 'deploymentConfigPath'] };
  S.need(extra[c.project] && Object.keys(c).sort().join() === [...common, ...extra[c.project]].sort().join() && c.schema === 'ubuntu-hardhat-terminal-v1', 'EXACT_PUBLIC_CONFIG_REQUIRED');
  const url = new URL(c.rpcUrl); S.need(url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'REVIEWED_HTTPS_RPC_REQUIRED');
  S.need(c.nodeSha256 === S.sha(fs.readFileSync(process.execPath)), 'NODE_EXECUTABLE_CHANGED');
  for (const [k, v] of Object.entries(c)) if (/(Path|File|Checkout)$/.test(k) || k === 'checkout') S.real(v, ['checkout', 'runtimeCheckout'].includes(k) || k === 'sessionPath' && c.project === 'manager');
}
async function main(argv = process.argv.slice(2)) {
  S.terminalProcess(); const options = flags(argv), configPin = S.pin(options.config);
  S.need(configPin.digest === options['config-sha'], 'REVIEWED_CONFIG_HASH_REQUIRED');
  const config = JSON.parse(configPin.bytes); validateConfig(config); const tooling = S.toolSourcePin(config.toolSourceSha256);
  let runtime;
  try {
    runtime = await connectHardhat(config.runtimeCheckout, config.rpcUrl);
    const native = await loadNative(config, runtime);
    const assertInputs = () => { configPin.assert(); tooling.assert(); validateConfig(config); S.environment(); };
    if (options.action === 'review') {
      const operation = await native.prepare(); await fresh(runtime, native, operation); assertInputs();
      const result = review(native, operation, runtime.E); S.writeNew(options.out, result);
      console.log(JSON.stringify({ reviewSha256: S.sha(fs.readFileSync(options.out)), ...result }));
    } else if (options.action === 'send') {
      S.need(process.stdin.isTTY && process.stdout.isTTY, 'LOCAL_TERMINAL_REQUIRED');
      const reviewPin = S.pin(options.review);
      S.need(reviewPin.digest === options['initiate-mainnet'], 'EXPLICIT_EXACT_MAINNET_INITIATION_REQUIRED');
      const expectedReview = JSON.parse(reviewPin.bytes);
      console.log(JSON.stringify({ project: expectedReview.project, creator: expectedReview.creator, governor: expectedReview.governor, index: expectedReview.index, unsignedHash: expectedReview.unsignedHash, maximumFeeWei: expectedReview.maximumFeeWei }));
      const result = await sendOne({ runtime, native, expectedReview, assertInputs: () => { assertInputs(); reviewPin.assert(); } });
      console.log(JSON.stringify(result));
    } else {
      const result = await native.reconcile(); assertInputs(); S.writeNew(options.out, result);
      console.log('Native read-only reconciliation written. Source verification and complete authority acceptance remain required.');
    }
  } finally { if (runtime) await runtime.close(); }
}
if (require.main === module) main().catch(() => {
  // Never render an exception, stack, provider response, wallet object or key.
  console.error('UBUNTU_HARDHAT_STOPPED: Preserve the native session and attempt record. Reconcile before continuing; never resend an uncertain transaction.'); process.exitCode = 1;
});
module.exports = { main, flags, validateConfig };
