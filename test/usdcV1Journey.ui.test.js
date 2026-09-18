const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
const roles = ['employer', 'agent', 'validator'];
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `Missing boundary: ${start}`);
  return html.slice(a, b);
}
function harness(overrides = {}) {
  const elements = new Map(), meters = new Map(), navigations = [];
  function el(id) {
    if (!elements.has(id)) elements.set(id, { id, value: '', textContent: '', dataset: {}, attributes: {},
      classList: { toggle(name, active) { this[name] = active; } },
      setAttribute(name, value) { this.attributes[name] = value; } });
    return elements.get(id);
  }
  const tabs = roles.map(role => Object.assign(el(`tab-${role}`), { dataset: { role } }));
  const panels = roles.map(role => el(`role-${role}`));
  el('missionRole').value = 'employer';
  const ctx = vm.createContext({
    el, document: { querySelectorAll: selector => selector === '.roleTab' ? tabs : selector === '.rolePanel' ? panels : [] },
    userAccount: '0xbuyer', isMainnet: true, hasAcceptedTerms: true, usdcDeploymentValidated: true,
    verified: {}, APP_STATE: { identity: { preview: null } },
    shortAddr: String, renderPulse() {}, scrollToId: id => navigations.push(id),
    setMeter: (id, textId, percent, label) => meters.set(id, { percent, label }),
    completionAssistantState: { jobId: null }, ...overrides
  });
  vm.runInContext(section('function setMissionButtons(', 'function parseDisplayedNumber('), ctx);
  vm.runInContext(section('function selectedMissionRole(', 'function buildCommandPaletteItems('), ctx);
  vm.runInContext(section('function updateReadinessUI(', 'async function updateDynamicInsights('), ctx);
  vm.runInContext(section('function missionAction(', 'function selectedMissionRole('), ctx);
  vm.runInContext(section('function updatePrimaryActionHints(', 'function updateWriteGate('), ctx);
  return { ctx, el, tabs, panels, meters, navigations };
}
function primary(h) { return h.el('missionPrimaryBtn').dataset.action; }

describe('v1 role-aware console guidance', () => {
  it('keeps all role guides locked without a wallet, even with stale successful flags', () => {
    const h = harness({ userAccount: null });
    for (const role of roles) {
      h.ctx.selectMissionRole(role);
      assert.equal(primary(h), 'connect');
      assert.equal(h.el('missionWriteStatus').textContent, 'Locked');
      assert.equal(h.meters.get('meterRole').percent, 0);
    }
  });
  it('prioritizes the correct network before terms, deployment and role advice', () => {
    const h = harness({ isMainnet: false, hasAcceptedTerms: false, usdcDeploymentValidated: false });
    for (const role of roles) {
      h.ctx.selectMissionRole(role);
      assert.equal(primary(h), 'switch-mainnet');
      assert.equal(h.el('missionWriteStatus').textContent, 'Locked');
    }
  });
  it('requires terms acceptance before any configured role journey', () => {
    const h = harness({ hasAcceptedTerms: false });
    for (const role of roles) {
      h.ctx.selectMissionRole(role);
      assert.equal(primary(h), 'terms');
      assert.equal(h.el('missionWriteStatus').textContent, 'Locked');
    }
  });
  it('never claims setup is complete for an unverified or malformed deployment flag', () => {
    for (const flag of [false, undefined, null, 'true', 1]) {
      const h = harness({ usdcDeploymentValidated: flag });
      for (const role of roles) {
        h.ctx.selectMissionRole(role);
        assert.equal(primary(h), 'deployment');
        assert.equal(h.el('missionWriteStatus').textContent, 'Locked');
        h.ctx.updatePrimaryActionHints();
        assert.match(h.el('createJobReadinessNote').textContent, /locked: verify the manager deployment/);
      }
    }
  });
  it('lets a buyer prepare work without ENS and ignores unrelated identity mint or claim availability', () => {
    const h = harness({ APP_STATE: { identity: { preview: { claimable: true, registrable: true } } } });
    h.ctx.updateReadinessUI();
    assert.equal(primary(h), 'create');
    assert.match(h.el('readyRole').textContent, /ENS not required/);
    assert.equal(h.meters.get('meterRole').percent, 100);
    assert.equal(h.el('missionSecondaryBtn').dataset.action, 'jobs');
    assert.match(h.el('missionNextActionBody').textContent, /dispute poor work before the displayed cutoff/);
    assert.doesNotMatch(h.el('missionPosturePill').textContent, /production/i);
  });
  it('guides an existing eligible agent to jobs without requiring an alpha credential', () => {
    const h = harness({ verified: { agent: 'existing-agent', agentAlpha: false } });
    h.ctx.selectMissionRole('agent');
    assert.equal(primary(h), 'jobs');
    assert.match(h.el('missionNextActionBody').textContent, /own NFT requirement/);
    assert.equal(h.meters.get('meterRole').percent, 100);
  });
  it('guides an unverified agent to credential verification before optional identity exploration', () => {
    const h = harness();
    h.ctx.selectMissionRole('agent');
    assert.equal(primary(h), 'verify');
    assert.equal(h.meters.get('meterRole').percent, 0);
    assert.equal(h.el('missionSecondaryBtn').dataset.action, 'mint-alpha');
    assert.match(h.el('missionNextActionBody').textContent, /owner-approved allowlist or Merkle-proof authorization through contract tooling/);
  });
  it('does not treat an agent credential as reviewer authorization', () => {
    const h = harness({ verified: { agent: 'existing-agent' } });
    h.ctx.selectMissionRole('validator');
    assert.equal(primary(h), 'verify');
    assert.equal(h.meters.get('meterRole').percent, 0);
    assert.match(h.el('readyRole').textContent, /Verify validator/);
    assert.match(h.el('missionNextActionBody').textContent, /owner-approved allowlist or Merkle-proof authorization through contract tooling/);
  });
  it('guides a verified reviewer to evidence and mentions independence and economic exposure', () => {
    const h = harness({ verified: { club: 'reviewer' } });
    h.ctx.selectMissionRole('validator');
    assert.equal(primary(h), 'jobs');
    assert.match(h.el('missionNextActionBody').textContent, /bond and reward budget/);
    assert.match(h.el('missionNextActionBody').textContent, /Only independent reviewers/);
  });
  it('role selection synchronizes accessible playbook state without granting wallet or contract authority', () => {
    const h = harness({ usdcDeploymentValidated: false });
    h.ctx.selectMissionRole('validator');
    assert.equal(h.el('missionRole').value, 'validator');
    for (const tab of h.tabs) assert.equal(tab.attributes['aria-pressed'], String(tab.dataset.role === 'validator'));
    for (const panel of h.panels) assert.equal(panel.classList.active, panel.id === 'role-validator');
    assert.equal(h.ctx.usdcDeploymentValidated, false);
    assert.equal(h.ctx.hasAcceptedTerms, true);
    assert.equal(h.ctx.verified.club, undefined);
    assert.equal(primary(h), 'deployment');
  });
  it('falls back to the buyer guide for unsupported role values', () => {
    const h = harness();
    h.ctx.selectMissionRole('owner');
    assert.equal(h.el('missionRole').value, 'employer');
    assert.equal(primary(h), 'create');
  });
  it('opens and focuses the existing payment-protection explanation without a wallet or transaction', () => {
    const h = harness({ userAccount: null });
    let focused = false;
    h.el('buyerProtectionGuide').querySelector = selector => {
      assert.equal(selector, 'summary');
      return { focus: options => { assert.equal(options.preventScroll, true); focused = true; } };
    };
    h.ctx.missionAction('buyer-protection');
    assert.equal(h.el('buyerProtectionGuide').open, true);
    assert.deepEqual(h.navigations, ['buyerProtectionGuide']);
    assert.equal(focused, true);
    assert.equal(h.ctx.userAccount, null);
  });
  it('shows the missing deployment in the posting hint and routes its setup action correctly', () => {
    const h = harness({ usdcDeploymentValidated: false });
    h.ctx.updatePrimaryActionHints();
    assert.match(h.el('createJobReadinessNote').textContent, /locked: verify the manager deployment/);
    h.ctx.missionAction(primary(h));
    assert.deepEqual(h.navigations, ['usdcDeploymentSection']);
  });
});
