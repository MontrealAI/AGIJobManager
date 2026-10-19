import assert from 'node:assert/strict';

export function syntheticMarkerReports(scope, digest) {
  const fixtureHash = label => digest('SYNTHETIC LOCAL NATIVE HARNESS INPUT ONLY: ' + label);
  return {
    consensusEvidenceSha256: { schema: 'manager-direct-consensus-report-v1', disposition: 'direct-type2-create-does-not-invoke-origin-code', scope,
      reviewReference: 'SYNTHETIC LOCAL INPUT ONLY; no independent consensus review, public account, custody or production readiness asserted.',
      artifacts: { consensusSourceSha256: fixtureHash('consensus source placeholder'), analysisSha256: fixtureHash('consensus analysis placeholder') } },
    directExecutionEvidenceSha256: { schema: 'manager-direct-execution-report-v1', disposition: 'nine-direct-creates-no-creator-or-target-invocation', scope,
      reviewReference: 'SYNTHETIC INPUT ONLY; genuine local post-execution traces are separate outputs and do not retroactively qualify this input.',
      artifacts: { sourceCallGraphSha256: fixtureHash('source graph placeholder'), initcodeCallGraphSha256: fixtureHash('initcode graph placeholder'), traceSha256: fixtureHash('trace placeholder') },
      invocations: { creator: 0, target: 0 } }
  };
}

// Same bounded trace conditions as the reviewed direct-origin test. This is
// local execution evidence only, never a public-provider or consensus claim.
export function callsFromTrace(trace, E) {
  assert.deepEqual(Object.keys(trace).sort(), ['failed', 'gas', 'returnValue', 'structLogs']); assert.equal(trace.failed, false);
  assert(Number.isSafeInteger(trace.gas) && trace.gas > 0); assert.equal(typeof trace.returnValue, 'string');
  assert(Buffer.byteLength(JSON.stringify(trace)) <= 32 * 1024 * 1024, 'Trace byte bound exceeded');
  assert(Array.isArray(trace.structLogs) && trace.structLogs.length > 0 && trace.structLogs.length <= 100000, 'Complete bounded trace required');
  assert.equal(trace.structLogs[0].depth, 1); const last = trace.structLogs.at(-1); assert.equal(last.depth, 1); assert(['RETURN', 'STOP'].includes(last.op), 'Top-level trace termination missing');
  for (let i = 0; i < trace.structLogs.length; i++) {
    const x = trace.structLogs[i]; assert(Number.isSafeInteger(x.pc) && x.pc >= 0 && Number.isSafeInteger(x.depth) && x.depth >= 1 && x.depth <= 1024);
    assert(Number.isSafeInteger(x.gas) && x.gas >= 0 && Number.isSafeInteger(x.gasCost) && x.gasCost >= 0);
    assert(Array.isArray(x.stack) && x.stack.length <= 1024 && x.stack.every(v => /^(?:0x)?[0-9a-f]{1,64}$/.test(v)), 'Complete bounded stack required');
    assert(!['CREATE', 'CREATE2', 'SELFDESTRUCT'].includes(x.op), 'Nested creation/destruction is unsupported in this narrow trace proof');
    if (i) { const previous = trace.structLogs[i - 1]; assert(x.depth <= previous.depth + 1, 'Trace frame transition missing'); if (x.depth === previous.depth + 1) assert(['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL'].includes(previous.op), 'Unexplained trace frame entry'); }
  }
  return trace.structLogs.filter(x => ['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL'].includes(x.op)).map(x => {
    assert(x.stack.length >= 2); return { op: x.op, depth: x.depth, pc: x.pc, target: E.getAddress('0x' + x.stack.at(-2).replace(/^0x/, '').slice(-40).padStart(40, '0')) };
  });
}
export function assertNoOriginCalls(calls, creator, target, observations, E) {
  for (const call of calls) {
    assert(![creator.toLowerCase(), target.toLowerCase()].includes(call.target.toLowerCase()), `Forbidden origin/marker-target execution: ${call.op} ${call.target}`);
    const found = observations.find(x => x.address === call.target);
    assert(found && found.codeHash === E.keccak256(found.code), 'Missing or mismatched callee runtime observation');
    assert(!/^0xef0100[0-9a-f]{40}$/.test(found.code) && found.resolvedMarkerTarget === null, 'Marker-bearing callee can hide indirect code execution');
  }
}

// Test-only EDR state mutation isolation. Never used by production code.
export async function advanceFixtureHeadBeyondPlanPin(rpc, pin) {
  const tag = '0x' + BigInt(pin.number).toString(16);
  const assertPin = async () => {
    const block = await rpc('eth_getBlockByNumber', [tag, false]);
    assert(block && block.hash === pin.hash, 'Reviewed fixture pin changed');
  };
  await assertPin();
  const before = await rpc('eth_getBlockByNumber', ['latest', false]);
  assert(before && BigInt(before.number) >= BigInt(pin.number), 'Fixture head precedes reviewed pin');
  await rpc('hardhat_mine', ['0x1']);
  const after = await rpc('eth_getBlockByNumber', ['latest', false]);
  assert(after && BigInt(after.number) > BigInt(pin.number) && BigInt(after.number) > BigInt(before.number), 'Fixture head did not advance beyond reviewed pin');
  await assertPin();
  return { reviewedPin: pin, before: { number: before.number, hash: before.hash }, after: { number: after.number, hash: after.hash }, purpose: 'Synthetic latest-state mutation isolation; no source or production observer bypass' };
}
