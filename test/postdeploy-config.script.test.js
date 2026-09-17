const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { deployActive, buildInitConfig } = require('./helpers/deploy');

contract('Local owner configuration CLI', accounts => {
  it('previews without sending, applies and verifies local changes, and preserves two-step ownership', async () => {
    const [owner, moderator, nextOwner] = accounts;
    const token = await artifacts.require('MockERC20').new({ from: owner });
    const ens = await artifacts.require('MockENS').new({ from: owner });
    const wrapper = await artifacts.require('MockNameWrapper').new({ from: owner });
    const zero = `0x${'00'.repeat(32)}`;
    const manager = await deployActive(artifacts.require('AGIJobManager'), ...buildInitConfig(
      token.address, 'ipfs://test/', ens.address, wrapper.address, zero, zero, zero, zero, zero, zero,
    ), { from: owner });
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-owner-cli-'));
    let sent = 0;
    const server = http.createServer(async (request, response) => {
      try {
        let body = '';
        for await (const chunk of request) body += chunk;
        const input = JSON.parse(body);
        const answer = async item => {
          if (item.method === 'eth_sendTransaction') sent += 1;
          try {
            const result = await web3.currentProvider.request({ method: item.method, params: item.params });
            return { jsonrpc: '2.0', id: item.id, result };
          } catch (error) {
            return { jsonrpc: '2.0', id: item.id, error: { code: error.code || -32603, message: error.message, data: error.data } };
          }
        };
        const output = Array.isArray(input) ? await Promise.all(input.map(answer)) : await answer(input);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(output));
      } catch (error) {
        response.statusCode = 500;
        response.end(error.message);
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const configFile = path.join(temporary, 'config.json');
      fs.writeFileSync(configFile, JSON.stringify({ agentNftRequired: false, premiumReputationThreshold: '123', moderators: [moderator], transferOwnershipTo: nextOwner, expectedOwner: owner }));
      const env = { ...process.env, RPC_URL: `http://127.0.0.1:${server.address().port}`, TX_FROM: owner };
      const options = { cwd: path.resolve(__dirname, '..'), env, timeout: 60_000 };
      const args = ['--network', 'development', '--address', manager.address, '--config-path', configFile];
      const preview = await promisify(execFile)(process.execPath, ['scripts/postdeploy-config.js', ...args, '--dry-run'], options);
      assert.match(preview.stdout, /Post-deploy configuration plan/);
      assert.equal(sent, 0);
      assert.equal(await manager.agentNftRequired(), true);
      assert.equal(await manager.moderators(moderator), false);
      await promisify(execFile)(process.execPath, ['scripts/postdeploy-config.js', ...args], options);
      assert.equal(sent, 4);
      assert.equal(await manager.agentNftRequired(), false);
      assert.equal((await manager.premiumReputationThreshold()).toString(), '123');
      assert.equal(await manager.moderators(moderator), true);
      assert.equal(await manager.owner(), owner);
      assert.equal(await manager.pendingOwner(), nextOwner);
      const verified = await promisify(execFile)(process.execPath, ['scripts/verify-config.js', ...args], options);
      assert.match(verified.stdout, /PASS premiumReputationThreshold: 123/);
      assert.match(verified.stdout, /PASS owner:/);
      assert.match(verified.stdout, /PASS agentNftRequired: false/);
    } finally {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
