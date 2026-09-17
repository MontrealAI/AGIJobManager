const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { AbiCoder, Interface } = require('ethers');
const { assertNetwork, fetchAgiTypes, loadManager } = require('../scripts/lib/operations');

const root = path.resolve(__dirname, '..');
const wallet = '0x0000000000000000000000000000000000000001';
const registry = '0x0000000000000000000000000000000000000002';

describe('Maintained operator tooling', () => {
  let temporary;
  beforeEach(() => { temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-operations-')); });
  afterEach(() => { fs.rmSync(temporary, { recursive: true, force: true }); });

  it('rejects a mismatched public RPC and prevents local configuration writes on public chains', async () => {
    const provider = { getNetwork: async () => ({ chainId: 1n }) };
    await assert.rejects(assertNetwork(provider, 'sepolia'), /does not match/);
    assert.equal(await assertNetwork(provider, 'mainnet'), 1n);
    await assert.rejects(loadManager(wallet, 'development', { provider, localWrite: true }), /only writes to disposable local chains/);
    await assert.rejects(loadManager(wallet, 'mainnet', { provider, localWrite: true, dryRun: true }), /only writes to disposable local chains/);
  });

  it('allows a local dry run without asking the RPC for a signing account', async () => {
    let signerCalls = 0;
    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async () => '0x6000',
      getSigner: async () => { signerCalls += 1; throw new Error('No signer'); },
    };
    const result = await loadManager(wallet, 'development', { provider, localWrite: true, dryRun: true });
    assert.equal(result.instance.target, wallet);
    assert.equal(signerCalls, 0);
  });

  it('distinguishes the public array getter boundary from an RPC failure', async () => {
    const instance = { agiTypes: async index => {
      if (index === 0) return { nftAddress: wallet, payoutPercentage: 80n };
      throw Object.assign(new Error('require(false)'), { code: 'CALL_EXCEPTION', data: '0x' });
    } };
    assert.deepEqual(await fetchAgiTypes(instance), [{ nftAddress: wallet, payoutPercentage: '80' }]);
    const broken = { agiTypes: async () => { throw Object.assign(new Error('RPC unavailable'), { code: 'NETWORK_ERROR' }); } };
    await assert.rejects(fetchAgiTypes(broken), /RPC unavailable/);
    const unexpected = { agiTypes: async () => { throw Object.assign(new Error('Unexpected revert'), { code: 'CALL_EXCEPTION', data: '0x12345678' }); } };
    await assert.rejects(fetchAgiTypes(unexpected), /Unexpected revert/);
  });

  it('encodes constructor tuples and USDC settlement wallets without Web3', () => {
    const zero = `0x${'00'.repeat(32)}`;
    const receipt = path.join(temporary, 'deployment.json');
    fs.writeFileSync(receipt, JSON.stringify({ constructorArgs: {
      usdcTokenAddress: wallet, baseIpfsUrl: 'ipfs://test/', ensConfig: [wallet, registry],
      rootNodes: [zero, zero, zero, zero], merkleRoots: [zero, zero], settlementWallets: [wallet, registry],
    } }));
    const result = spawnSync(process.execPath, ['scripts/ops/encode_constructor_args.js', '--receipt', receipt], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'string', 'tuple(address,address)', 'tuple(bytes32,bytes32,bytes32,bytes32)', 'tuple(bytes32,bytes32)', 'address[2]'],
      `0x${result.stdout.trim()}`,
    );
    assert.equal(decoded[0], wallet);
    assert.equal(decoded[1], 'ipfs://test/');
    assert.deepEqual(Array.from(decoded[5]), [wallet, registry]);
  });

  it('generates exact feedback calldata offline and refuses an unconfirmed send', () => {
    const input = path.join(temporary, 'feedback');
    fs.mkdirSync(input);
    fs.writeFileSync(path.join(input, 'entry.json'), JSON.stringify({ agentRegistry: `eip155:1:${registry}`, agentId: '9', value: '8500', valueDecimals: 2, tag1: 'successRate' }));
    const args = ['scripts/erc8004/generate_submit_actions.js', '--feedback-dir', input, '--out-dir', temporary, '--reputation-registry', registry];
    const env = { ...process.env, SEND_TX: 'false', DRY_RUN: 'true', RPC_URL: 'http://127.0.0.1:1', I_UNDERSTAND: 'false' };
    const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const [action] = JSON.parse(fs.readFileSync(path.join(temporary, 'erc8004_submit_actions.json')));
    const abi = JSON.parse(fs.readFileSync(path.join(root, 'integrations/erc8004/abis/ReputationRegistry.json')));
    const decoded = new Interface(abi).decodeFunctionData('giveFeedback', action.calldata);
    assert.equal(decoded[0], 9n);
    assert.equal(decoded[1], 8500n);
    assert.equal(decoded[2], 2n);
    assert.equal(action.chainId, 1);
    const refused = spawnSync(process.execPath, args, { cwd: root, env: { ...env, SEND_TX: 'true', DRY_RUN: 'false' }, encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /requires I_UNDERSTAND=true/);
  });
});
