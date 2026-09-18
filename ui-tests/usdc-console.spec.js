const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Interface } = require('ethers');

const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
const web3Tag = html.match(/<script src="([^"]+web3[^\"]+)" integrity="sha384-([^"]+)"/);
if (!web3Tag) throw new Error('The primary console must retain its pinned Web3 script.');
const [web3Url, web3Integrity] = web3Tag.slice(1);
const MANAGER = '0x1111111111111111111111111111111111111111';
const OTHER_MANAGER = '0x2222222222222222222222222222222222222222';
const BUYER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NEXT_BUYER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const WALLET30 = '0x3333333333333333333333333333333333333333';
const WALLET10 = '0x4444444444444444444444444444444444444444';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const ZERO = '0x' + '0'.repeat(40);

function rpcFixture() {
  const managerMethods = {
    'usdcToken()': ['address', USDC], 'wallet30()': ['address', WALLET30], 'wallet10()': ['address', WALLET10],
    'pendingOwner()': ['address', ZERO], 'owner()': ['address', WALLET30], 'ensJobPages()': ['address', ZERO],
    'settlementPausedSeconds()': ['uint256', 0], 'nextJobId()': ['uint256', 0], 'totalSupply()': ['uint256', 0],
    'requiredValidatorApprovals()': ['uint256', 3], 'requiredValidatorDisapprovals()': ['uint256', 3],
    'voteQuorum()': ['uint256', 3], 'completionReviewPeriod()': ['uint256', 604800],
    'challengePeriodAfterApproval()': ['uint256', 86400], 'disputeReviewPeriod()': ['uint256', 1209600],
    'agentBond()': ['uint256', 1000000], 'agentBondBps()': ['uint256', 500], 'agentBondMax()': ['uint256', 200000000],
    'maxActiveJobsPerAgent()': ['uint256', 5], 'validatorBondBps()': ['uint256', 100],
    'validatorBondMin()': ['uint256', 1000000], 'validatorBondMax()': ['uint256', 200000000],
    'validatorSlashBps()': ['uint256', 8000], 'validationRewardPercentage()': ['uint256', 8],
    'maxJobPayout()': ['uint256', 10000000000], 'jobDurationLimit()': ['uint256', 2592000],
    'paused()': ['bool', false], 'settlementPaused()': ['bool', false], 'agentNftRequired()': ['bool', false],
    'moderators(address)': ['bool', false], 'pendingUSDC(address)': ['uint256', 0], 'reputation(address)': ['uint256', 0],
    'withdrawableUSDC()': ['uint256', 0], 'lockedEscrow()': ['uint256', 0], 'lockedAgentBonds()': ['uint256', 0],
    'lockedValidatorBonds()': ['uint256', 0], 'lockedDisputeBonds()': ['uint256', 0], 'lockedClaims()': ['uint256', 0],
    'balanceOf(address)': ['uint256', 0]
  };
  const tokenMethods = {
    'decimals()': ['uint8', 6], 'balanceOf(address)': ['uint256', 1000000000], 'allowance(address,address)': ['uint256', 0]
  };
  function encodeReads(methods) {
    const iface = new Interface(Object.entries(methods).map(([signature, [type]]) => `function ${signature} view returns (${type})`));
    const calls = Object.fromEntries(Object.entries(methods).map(([signature, [, value]]) => {
      const fn = iface.getFunction(signature);
      return [fn.selector, iface.encodeFunctionResult(fn, [value])];
    }));
    return { iface, calls };
  }
  const manager = encodeReads(managerMethods), token = encodeReads(tokenMethods);
  return { readsByTarget: { [MANAGER]: manager.calls, [OTHER_MANAGER]: manager.calls, [USDC]: token.calls },
    tokenSelector: manager.iface.getFunction('usdcToken').selector,
    badToken: manager.iface.encodeFunctionResult('usdcToken', [OTHER_MANAGER]), manager: MANAGER, otherManager: OTHER_MANAGER, buyer: BUYER, usdc: USDC };
}

async function openConsole(page, options = {}) {
  const baseUrl = process.env.AGIJOBMANAGER_USDC_UI_URL;
  const web3Path = process.env.AGIJOBMANAGER_WEB3_PATH;
  if (!baseUrl || !web3Path) throw new Error('Set AGIJOBMANAGER_USDC_UI_URL and AGIJOBMANAGER_WEB3_PATH using the USDC browser runner.');
  const bundle = fs.readFileSync(web3Path);
  expect(crypto.createHash('sha384').update(bundle).digest('base64')).toBe(web3Integrity);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === web3Url) return route.fulfill({ status: 200, contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' }, body: bundle });
    if (url === baseUrl) return route.continue();
    if (new URL(url).hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(({ fixture, options }) => {
    const listeners = new Map();
    const state = { accounts: [], chainId: options.chainId || '0x1', requests: [], prohibited: [], failReads: false, wrongToken: false };
    const emit = async (event, value) => Promise.all([...(listeners.get(event) || [])].map(callback => callback(value)));
    window.__usdcWallet = {
      state,
      async accounts(accounts) { state.accounts = accounts; await emit('accountsChanged', accounts); },
      async chain(chainId) { state.chainId = chainId; await emit('chainChanged', chainId); },
      failReads(value) { state.failReads = value; },
      wrongToken(value) { state.wrongToken = value; }
    };
    window.ethereum = {
      isMetaMask: true,
      on(event, callback) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(callback); return this; },
      removeListener(event, callback) { listeners.get(event)?.delete(callback); return this; },
      async request({ method, params = [] }) {
        state.requests.push(method);
        if (/^eth_send|^eth_sign|^personal_sign|^wallet_send/.test(method)) {
          state.prohibited.push(method);
          throw Object.assign(new Error('Browser fixture forbids transactions and signatures.'), { code: 4001 });
        }
        if (method === 'eth_accounts') return state.accounts;
        if (method === 'eth_requestAccounts') { if (!state.accounts.length) state.accounts = [fixture.buyer]; return state.accounts; }
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'net_version') return String(parseInt(state.chainId, 16));
        if (method === 'wallet_switchEthereumChain') { state.chainId = params[0].chainId; await emit('chainChanged', state.chainId); return null; }
        if (method === 'eth_getCode') return [fixture.manager, fixture.otherManager, fixture.usdc].includes(params[0].toLowerCase()) ? '0x6000' : '0x';
        if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
        if (method === 'eth_blockNumber') return '0x1';
        if (method === 'eth_getLogs') return [];
        if (method === 'eth_call') {
          const tx = params[0], target = String(tx.to || '').toLowerCase(), selector = String(tx.data || tx.input || '').slice(0, 10);
          if (state.failReads || ![fixture.manager, fixture.otherManager, fixture.usdc].includes(target)) {
            throw Object.assign(new Error('execution reverted: unavailable fixture contract read'), { code: -32000 });
          }
          const reads = fixture.readsByTarget[target];
          if ([fixture.manager, fixture.otherManager].includes(target) && selector === fixture.tokenSelector && state.wrongToken) return fixture.badToken;
          if (Object.hasOwn(reads, selector)) return reads[selector];
          throw Object.assign(new Error(`execution reverted: unsupported fixture read ${selector}`), { code: -32000 });
        }
        throw Object.assign(new Error(`Unsupported fixture RPC: ${method}`), { code: -32601 });
      }
    };
  }, { fixture: rpcFixture(), options });
  await page.goto(baseUrl, { waitUntil: 'load' });
  await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'connect');
  await expect(page.locator('#v26MobileDock')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__usdcWallet.state.requests.filter(method => method === 'eth_accounts').length)).toBeGreaterThan(0);
  return errors;
}

async function chooseManager(page, manager = MANAGER) {
  await page.locator('#usdcManagerAddress').fill(manager);
  await page.locator('#saveUsdcManagerBtn').click();
}
async function connectReadyBuyer(page) {
  await chooseManager(page);
  await expect(page.locator('#usdcDeploymentStatus')).toContainText('USDC settlement check passed');
  await expect(page.locator('#lastRefreshAtLabel')).not.toHaveText('Never');
  await expect(page.locator('#createJobBtn')).toBeDisabled();
  await page.locator('#termsAccepted').check();
  await expect(page.locator('#createJobBtn')).toBeEnabled();
  await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'create');
}
async function openPostingReview(page) {
  await page.locator('#jobSpecURI').fill('https://example.invalid/job-spec.json');
  await page.locator('#jobDetails').fill('Return the requested report and satisfy the acceptance checks.');
  await page.locator('#jobPayout').fill('100');
  await page.locator('#jobDuration').fill('86400');
  await page.locator('#createJobBtn').click();
  await expect(page.locator('#actionReviewModal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#actionReviewFacts')).toContainText('52 USDC');
}
async function assertNoExecution(page, errors) {
  expect(await page.evaluate(() => window.__usdcWallet.state.prohibited)).toEqual([]);
  expect(errors).toEqual([]);
}

test.describe('Published USDC console in a real browser', () => {
  test('boots disconnected and keeps write actions locked while navigating guides', async ({ page }) => {
    const errors = await openConsole(page);
    await expect(page.locator('#missionRole')).toHaveValue('employer');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await expect(page.locator('#missionWriteStatus')).toHaveText('Locked');
    await page.getByLabel('What would you like to do?').selectOption('validator');
    await expect(page.locator('.roleTab[data-role="validator"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'connect');
    await assertNoExecution(page, errors);
  });

  test('keyboard users can select a role and open the focused buyer-protection explanation', async ({ page }) => {
    const errors = await openConsole(page);
    const role = page.getByLabel('What would you like to do?');
    await role.focus();
    await role.press('End');
    await role.press('Enter');
    await expect(role).toHaveValue('validator');
    await page.locator('#missionBuyerProtectionBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#buyerProtectionGuide')).toHaveAttribute('open', '');
    await expect(page.locator('#buyerProtectionGuide summary')).toBeFocused();
    await expect(page.locator('#buyerProtectionGuide')).toContainText('Buyer wins:');
    await expect(page.locator('#buyerProtectionGuide')).toContainText('Acceptance is final.');
    await assertNoExecution(page, errors);
  });

  test('a connected wallet and accepted terms cannot bypass a missing deployment', async ({ page }) => {
    const errors = await openConsole(page);
    await page.locator('#connectBtn').click();
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'terms');
    await page.locator('#termsAccepted').check();
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'deployment');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await expect(page.locator('#createJobReadinessNote')).toContainText('verify the manager deployment');
    await chooseManager(page, ZERO);
    await expect(page.locator('#toast')).toContainText('non-zero deployed manager');
    await assertNoExecution(page, errors);
  });

  test('checks real Web3 decoding and guides a buyer without requiring ENS', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await expect(page.locator('#settlementWallets')).toContainText(WALLET30);
    await expect(page.locator('#readyRole')).toHaveText('Buyer · ENS not required');
    await expect(page.locator('#agentPill')).toContainText('not verified');
    await expect(page.locator('#missionPosturePill')).not.toContainText('production');
    await page.locator('#termsAccepted').uncheck();
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await assertNoExecution(page, errors);
  });

  test('role selection changes guidance without granting agent or validator eligibility', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    for (const role of ['agent', 'validator']) {
      await page.locator('#missionRole').selectOption(role);
      await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'verify');
      await expect(page.locator('#missionNextActionBody')).toContainText('allowlist or Merkle-proof');
      await expect(page.locator(`#role-${role}`)).toHaveClass(/active/);
    }
    await page.locator('.roleTab[data-role="employer"]').click();
    await expect(page.locator('#missionRole')).toHaveValue('employer');
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'create');
    await assertNoExecution(page, errors);
  });

  test('shows the real payment review and allows keyboard cancellation before wallet execution', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await openPostingReview(page);
    await expect(page.locator('#actionReviewFacts')).toContainText('30 USDC');
    await expect(page.locator('#actionReviewFacts')).toContainText('10 USDC');
    await expect(page.locator('#actionReviewFacts')).toContainText('8 USDC');
    await expect(page.locator('#actionReviewModal')).toContainText('No votes, insufficient votes or a tie');
    await page.keyboard.press('Escape');
    await expect(page.locator('#actionReviewModal')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#createJobBtn')).toBeFocused();
    await assertNoExecution(page, errors);
  });

  test('changing account invalidates a pending review and requires fresh terms acceptance', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await openPostingReview(page);
    await page.evaluate(account => window.__usdcWallet.accounts([account]), NEXT_BUYER);
    await expect(page.locator('#actionReviewModal')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#termsAccepted')).not.toBeChecked();
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'terms');
    await expect(page.locator('#walletStatus')).toContainText(/0xbbbb/i);
    await assertNoExecution(page, errors);
  });

  test('disconnecting clears accepted terms and deployment-dependent write access', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await page.evaluate(() => window.__usdcWallet.accounts([]));
    await expect(page.locator('#walletStatus')).toHaveText('Not connected');
    await expect(page.locator('#termsAccepted')).not.toBeChecked();
    await expect(page.locator('#missionWriteStatus')).toHaveText('Locked');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'connect');
    await assertNoExecution(page, errors);
  });

  test('network changes enforce chain 1 and clear the previous authorization context', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await page.evaluate(() => window.__usdcWallet.chain('0xaa36a7'));
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'switch-mainnet');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await expect(page.locator('#termsAccepted')).not.toBeChecked();
    await page.locator('#missionPrimaryBtn').click();
    await expect(page.locator('#missionNetworkStatus')).toHaveText('Ethereum Mainnet');
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'terms');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await assertNoExecution(page, errors);
  });

  test('a replacement deployment with the wrong token stays locked even after terms acceptance', async ({ page }) => {
    const errors = await openConsole(page);
    await connectReadyBuyer(page);
    await page.evaluate(() => window.__usdcWallet.wrongToken(true));
    await chooseManager(page, OTHER_MANAGER);
    await expect(page.locator('#usdcDeploymentStatus')).toContainText('not native Circle USDC');
    await page.locator('#termsAccepted').check();
    await expect(page.locator('#missionPrimaryBtn')).toHaveAttribute('data-action', 'deployment');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await assertNoExecution(page, errors);
  });

  test('unavailable deployment reads fail closed in the actual browser', async ({ page }) => {
    const errors = await openConsole(page);
    await page.evaluate(() => window.__usdcWallet.failReads(true));
    await chooseManager(page);
    await expect(page.locator('#usdcDeploymentStatus')).toContainText('Transactions disabled');
    await page.locator('#termsAccepted').check();
    await expect(page.locator('#missionWriteStatus')).toHaveText('Locked');
    await expect(page.locator('#createJobBtn')).toBeDisabled();
    await assertNoExecution(page, errors);
  });

  test('mobile guide and navigation stay usable without horizontal page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await openConsole(page);
    await page.locator('#v26MobileDock [data-v26-target="missionControlSection"]').click();
    await expect(page.locator('#missionRole')).toBeInViewport();
    await page.locator('#missionRole').selectOption('agent');
    await page.locator('#missionBuyerProtectionBtn').click();
    await expect(page.locator('#buyerProtectionGuide summary')).toBeFocused();
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      width: document.documentElement.scrollWidth,
      overflowing: [...document.body.querySelectorAll('*')].filter(node => node.getClientRects().length)
        .map(node => { const bounds = node.getBoundingClientRect(), css = getComputedStyle(node); return {
          element: node.tagName.toLowerCase() + (node.id ? '#' + node.id : '.' + String(node.className).split(' ').join('.')),
          left: Math.round(bounds.left), right: Math.round(bounds.right), width: Math.round(bounds.width),
          sizing: css.boxSizing, minWidth: css.minWidth, padding: css.padding, overflowX: css.overflowX
        }; }).filter(node => node.right > window.innerWidth + 1 || node.left < -1)
        .sort((a, b) => b.right - a.right).slice(0, 16)
    }));
    expect(layout.width - layout.viewport, JSON.stringify(layout)).toBeLessThanOrEqual(1);
    await page.locator('#v26MobileDock [data-v26-open-sheet]').click();
    await expect(page.getByRole('dialog', { name: 'Mobile control sheet' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#v26MobileSheet')).toHaveAttribute('aria-hidden', 'true');
    await assertNoExecution(page, errors);
  });
});
