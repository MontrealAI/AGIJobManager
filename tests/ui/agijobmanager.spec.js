const { test, expect } = require('@playwright/test');

const baseUrl = process.env.UI_BASE_URL;
const contractAddress = process.env.CONTRACT_ADDRESS;
const rpcUrl = process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545';

if (!baseUrl) {
  throw new Error('UI_BASE_URL is required');
}
if (!contractAddress) {
  throw new Error('CONTRACT_ADDRESS is required');
}

async function rpcCall(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || 'RPC error');
  }
  return payload.result;
}

test.describe('AGIJobManager UI smoke', () => {
  test.setTimeout(120_000);

  test('connects, refreshes, and creates a job', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(new Error(msg.text()));
      }
    });

    await page.addInitScript(({ rpcUrl }) => {
      const callRpc = async (method, params) => {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        });
        const payload = await response.json();
        if (payload.error) {
          throw new Error(payload.error.message || 'RPC error');
        }
        return payload.result;
      };

      window.ethereum = {
        isMetaMask: false,
        request: async ({ method, params }) => {
          if (method === 'eth_requestAccounts') {
            return callRpc('eth_accounts', []);
          }
          return callRpc(method, params || []);
        },
        on: () => {},
        removeListener: () => {},
      };
    }, { rpcUrl });

    const [owner] = await rpcCall('eth_accounts');

    await page.goto(`${baseUrl}?contract=${contractAddress}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#activityLog')).toContainText('External ABI loaded', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Connect Wallet' }).click();
    await expect(page.locator('#networkPill')).toContainText('Connected', { timeout: 10_000 });
    await expect(page.locator('#walletAddress')).toContainText(owner);

    await page.getByRole('button', { name: 'Refresh snapshot' }).click();
    await expect(page.locator('#contractOwner')).toContainText(owner);
    await expect(page.locator('#agiToken')).toContainText('0x');

    await page.fill('#approveAmount', '1');
    await page.getByRole('button', { name: 'Approve token' }).click();
    await expect(page.locator('#activityLog')).toContainText('Employer approve confirmed', { timeout: 15_000 });

    await page.fill('#jobIpfs', 'QmTestHash');
    await page.fill('#jobPayout', '1');
    await page.fill('#jobDuration', '3600');
    await page.fill('#jobDetails', 'UI smoke test');
    await page.getByRole('button', { name: 'Create job' }).click();
    await expect(page.locator('#activityLog')).toContainText('Create job confirmed', { timeout: 15_000 });

    await page.getByRole('button', { name: 'Load jobs' }).click();
    await expect(page.locator('#jobsTable tr')).toHaveCount(1, { timeout: 10_000 });

    if (jsErrors.length) {
      throw new Error(`UI logged ${jsErrors.length} error(s): ${jsErrors.map((err) => err.message).join('; ')}`);
    }
  });
});
