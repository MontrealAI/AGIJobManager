import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadLatestReportedDeployment } from "../../site/deployments.mjs";
const { default: AxeBuilder } = await import('../../ui/node_modules/@axe-core/playwright/dist/index.mjs');
const ecosystemProjects = {
  alpha: 'https://montrealai.github.io/AGI-Alpha-Agent-v0/',
  jobs: 'https://montrealai.github.io/AGIJobsv0/',
  manager: 'https://montrealai.github.io/AGIJobManager/',
  fleet: 'https://montrealai.github.io/AGI-Fleet-Linux/',
};
const output = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../build/pages",
);
const repositoryRoot = path.resolve(output, "../..");
const latestDeployment = loadLatestReportedDeployment(repositoryRoot).record;
const historicalDeployment = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "config/mainnet/agi-jobs-usdc.json"), "utf8"));
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost"),
    relative = decodeURIComponent(url.pathname).replace(
      /^\/AGIJobManager\//,
      "",
    );
  const target = path.resolve(
    output,
    relative === "" || relative.endsWith("/") ? relative + "index.html" : relative,
  );
  if (
    !url.pathname.startsWith("/AGIJobManager/") ||
    !target.startsWith(output + path.sep) ||
    !fs.existsSync(target)
  ) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".mjs": "text/javascript",
      ".svg": "image/svg+xml",
    }[path.extname(target)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(target));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/AGIJobManager/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});

async function checkEmployerEntries(page, language, label) {
  for (const placement of ['header', 'hero', 'welcome', 'footer']) {
    const entry = page.locator(`[data-employer-entry="${placement}"]`);
    assert.equal(await entry.count(), 1, `${label}: one ${placement} employer entry`);
    assert.equal(await entry.isVisible(), true, `${label}: ${placement} employer entry is visible`);
    assert.equal(await entry.evaluate((element) => element.href), base + language + 'employers/', `${label}: ${placement} entry preserves the chosen language`);
    const box = await entry.boundingBox();
    assert.ok(box.width >= 48 && box.height >= 48, `${label}: ${placement} entry is at least 48 × 48 px`);
    assert.ok(await entry.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1), `${label}: ${placement} entry text is not clipped`);
    assert.ok((await entry.textContent()).trim(), `${label}: ${placement} entry has an understandable text label`);
  }
  assert.equal(await page.locator('#employer-welcome').isVisible(), true, `${label}: newcomer welcome is visible`);
  assert.equal(await page.locator('#employer-welcome h2').count(), 1, `${label}: newcomer welcome has a heading`);
  assert.equal(await page.locator('#ecosystem').isVisible(), true, `${label}: ecosystem is visible`);
  assert.equal(await page.locator('.ecosystem-card').count(), 4, `${label}: four ecosystem projects`);
  assert.equal(await page.locator('.ecosystem-current').count(), 1, `${label}: current project is identified`);
  assert.equal(await page.locator('.ecosystem-boundary').isVisible(), true, `${label}: protocol boundaries remain visible`);
  for (const [project, url] of Object.entries(ecosystemProjects)) {
    const entry = page.locator(`[data-ecosystem-project="${project}"]`);
    assert.equal(await entry.count(), 1, `${label}: one ${project} ecosystem link`);
    assert.equal(await entry.getAttribute('href'), url, `${label}: exact ${project} URL`);
    assert.ok((await entry.textContent()).trim(), `${label}: ${project} has a text label`);
    const box = await entry.boundingBox();
    assert.ok(box.width >= 48 && box.height >= 48, `${label}: ${project} link has a 48px target`);
    assert.ok(await entry.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1), `${label}: ${project} text is not clipped`);
  }
}

async function checkReflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    width: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('main *, header *, footer *')].map((element) => {
      const box = element.getBoundingClientRect();
      return { element: element.id || `${element.tagName}.${element.className}`, right: Math.round(box.right), width: Math.round(box.width) };
    }).filter((element) => element.right > window.innerWidth + 1).sort((a, b) => b.right - a.right).slice(0, 10),
  }));
  assert.ok(layout.width <= layout.viewport + 1, `No horizontal page overflow: ${label}: ${JSON.stringify(layout)}`);
}

async function checkDeploymentRecords(page, language, label, copy = true) {
  const primary = page.locator('#latest-deployment'), historical = page.locator('#historical-deployment');
  assert.equal(await primary.count(), 1, `${label}: one primary deployment record`);
  assert.equal(await primary.locator('#manager-address').textContent(), latestDeployment.manager, `${label}: primary address is the latest reported Manager`);
  assert.equal(await primary.locator('[data-deployment-date]').textContent(), latestDeployment.recordDate, `${label}: latest report date`);
  assert.equal(await primary.locator('[data-deployment-block]').textContent(), String(latestDeployment.reportedAuthoritySnapshot.blockNumber), `${label}: latest reported authority block`);
  assert.equal(await primary.locator('[data-deployment-governor]').textContent(), latestDeployment.reportedAuthoritySnapshot.owner, `${label}: governor belongs to the latest Manager`);
  assert.equal(await primary.locator('[data-deployment-source]').textContent(), latestDeployment.source.commit, `${label}: deployed source is retained`);
  assert.equal(await primary.locator(`a[href="${latestDeployment.verificationLinks.managerCode}"]`).count(), 2, `${label}: primary and inventory code links point to the latest Manager`);
  assert.equal(await primary.locator('[data-deployment-contract]').count(), 9, `${label}: all nine contracts are represented`);
  assert.equal(await primary.locator('[data-explorer-match="EXACT_MATCH"]').count(), 6, `${label}: six Exact Matches`);
  assert.equal(await primary.locator('[data-explorer-match="SIMILAR_MATCH_SKIPPED"]').count(), 3, `${label}: three retained Similar Matches`);
  for (const contract of latestDeployment.contracts) {
    const row = primary.locator(`[data-deployment-contract="${contract.name}"]`);
    assert.equal(await row.locator('code').textContent(), contract.address, `${label}: ${contract.name} address`);
    assert.equal(await row.locator(`a[href="${contract.explorerCodeUrl}"]`).count(), 1, `${label}: ${contract.name} code link`);
    assert.equal(await row.locator(`a[href="${contract.deploymentTransactionUrl}"]`).count(), 1, `${label}: ${contract.name} creation link`);
  }
  assert.equal(await historical.locator('[data-historical-manager]').textContent(), historicalDeployment.manager, `${label}: historical Manager remains separate`);
  assert.equal(await historical.locator('[data-historical-helper]').textContent(), historicalDeployment.helper, `${label}: helper belongs only to the historical Manager`);
  assert.ok(!(await primary.textContent()).includes(historicalDeployment.manager) && !(await primary.textContent()).includes(historicalDeployment.helper), `${label}: no previous address is primary`);
  assert.ok(!(await historical.textContent()).includes(latestDeployment.manager), `${label}: no implied helper attachment to the latest Manager`);
  assert.match(await primary.locator('[data-deployment-state]').textContent(), language ? /rapport du propriétaire.*ni une lecture en direct/ : /owner-reported evidence, not a live chain query/);
  assert.match(await page.locator('#latest-ens-boundary').textContent(), language ? /ne démontre aucun rattachement/ : /establishes no ENS helper attachment/);
  if (copy) {
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedManagerForTest = value; } } }));
    await primary.locator('#copy-address').click();
    await page.waitForFunction(expected => window.__copiedManagerForTest === expected, latestDeployment.manager);
    assert.equal(await page.evaluate(() => window.__copiedManagerForTest), latestDeployment.manager, `${label}: actual copy action uses the latest address`);
  } else assert.equal(await primary.locator('#copy-address').isDisabled(), true, `${label}: no-JS copy is disabled without changing readable evidence`);
  await primary.locator('#deployment-contracts summary').click();
  assert.equal(await primary.locator('[data-deployment-contract]:visible').count(), 9, `${label}: all contract details are readable`);
  await checkReflow(page, `${label}: expanded deployment inventory`);
  await primary.locator('#deployment-contracts summary').click();
}

try {
  for (const language of ["", "fr/"]) {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + language);
      await checkDeploymentRecords(page, language, `${language || 'en'} ${width}px`);
      await checkEmployerEntries(page, language, `${language || 'en'} ${width}px`);
      await checkReflow(page, `${language || 'en'} ${width}px`);
      const textSize = await page.locator('.hero-intro').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      await page.locator('#home-larger-text').click();
      assert.equal(await page.locator('#home-larger-text').getAttribute('aria-pressed'), 'true');
      assert.ok(await page.locator('.hero-intro').evaluate((element) => parseFloat(getComputedStyle(element).fontSize)) > textSize, 'Larger text changes the actual reading size');
      await checkEmployerEntries(page, language, `${language || 'en'} ${width}px larger text`);
      await checkReflow(page, `${language || 'en'} ${width}px larger text`);
      await page.locator('#home-larger-text').click();
      assert.equal(await page.locator('#home-larger-text').getAttribute('aria-pressed'), 'false');
      for (const role of ['agent', 'validator', 'operator', 'employer']) {
        await page.locator(`[data-role="${role}"]`).click();
        assert.equal(await page.locator(`#role-${role}`).isVisible(), true);
        assert.equal(await page.locator('.role-panel:visible').count(), 1, 'Role selection shows exactly one route');
        assert.equal(await page.locator(`[data-role="${role}"]`).getAttribute('aria-pressed'), 'true');
      }
      await page.locator('[data-cost="100"]').click();
      assert.equal(
        await page.locator("#amount-agent").textContent(),
        "52 USDC",
      );
      await page.locator("#validator-rate").fill("60");
      assert.equal(await page.locator("#amount-agent").textContent(), "0 USDC");
      await page.locator("#job-cost").fill("-1");
      assert.equal(await page.locator("#amount-agent").textContent(), "—");
      assert.ok((await page.locator("#calc-error").textContent()).length > 0);
      await page.locator("#validator-rate").fill("8");
      await page.locator("#job-cost").fill("0.000001");
      assert.equal(
        await page.locator("#amount-agent").textContent(),
        language ? "0,000001 USDC" : "0.000001 USDC",
      );
      await page.locator("#guide-search").fill("USDC");
      assert.ok((await page.locator(".resource:visible").count()) > 0);
      await page.locator("#guide-search").fill("zzznomatch");
      assert.equal(await page.locator("#no-results").isVisible(), true);
      await page.locator("#guide-search").fill("");
      assert.equal(await page.locator(".resource:visible").count(), 13);
      await page.locator(".faq-section summary").first().click();
      assert.equal(await page.locator("details[open]").count(), 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `Overflow: ${language} ${width}`,
      );
      assert.deepEqual(errors, [], `Browser errors: ${language} ${width}`);
      await page.close();
    }
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 1000 } });
    await page.goto(base + language);
    await checkDeploymentRecords(page, language, `${language || 'en'} without JavaScript`, false);
    await checkEmployerEntries(page, language, `${language || 'en'} without JavaScript`);
    await checkReflow(page, `${language || 'en'} without JavaScript`);
    assert.equal(await page.locator(".role-panel:visible").count(), 4);
    assert.equal(await page.locator(".resource:visible").count(), 13);
    await page.locator('[data-employer-entry="hero"]').click();
    await page.waitForURL(base + language + 'employers/');
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'fr' : 'en');
    assert.equal(await page.locator('#employer-form').isVisible(), false);
    assert.ok((await page.locator('noscript').textContent()).trim(), 'The no-JS path reaches the onboarding fallback guide');
    await page.close();
  }
  for (const language of ['', 'fr/']) {
    const page = await browser.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.goto(base + language);
    await page.setViewportSize({ width: 720, height: 1000 });
    const normalReadingSize = await page.locator('.hero-intro').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.ok(await page.locator('.hero-intro').evaluate((element) => parseFloat(getComputedStyle(element).fontSize)) >= normalReadingSize * 2, '200% text sizing doubles the reading text');
    await checkEmployerEntries(page, language, `${language || 'en'} 200% text`);
    await checkReflow(page, `${language || 'en'} 200% text`);
    await page.locator('[data-employer-entry="header"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(base + language + 'employers/');
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'fr' : 'en');
    assert.equal(await page.locator('#employer-form').isVisible(), true, 'The primary header entry opens guided onboarding');
    await page.goto(base + language);
    await page.locator('.footer a.brand').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(base + language);
    assert.equal(page.url(), base + language, 'The footer brand returns to the selected-language homepage');
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'fr' : 'en', 'Footer navigation preserves the document language');
    assert.equal(await page.locator('#employer-welcome').isVisible(), true, 'Footer navigation reaches the working homepage');
    await page.locator('a.language').click();
    await page.waitForURL(base + (language ? '' : 'fr/'));
    await page.locator('#advanced-console-link').evaluate((element) => {
      let ancestor = element.parentElement;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
    });
    await page.locator('#advanced-console-link').click();
    assert.ok(page.url().endsWith('/agijobmanager-usdc.html'), 'The advanced console remains available');
    await page.close();
  }
  // Exercise semantic links with the keyboard and Back without contacting the public sites.
  for (const language of ['', 'fr/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.route('https://montrealai.github.io/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Project route test</title><h1>Project route test</h1></html>',
    }));
    await page.goto(base + language);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip', 'The skip link remains the first keyboard stop');
    assert.ok(await page.locator('.skip').evaluate(element => element.getBoundingClientRect().top >= 0 && getComputedStyle(element).clipPath === 'none'), 'The focused skip link is fully available');
    await page.keyboard.press('Enter');
    await page.waitForURL(base + language + '#main', { timeout: 5000 });
    assert.ok(page.url().endsWith('#main'), 'The skip link reaches the main content');
    await page.locator('.header a[href="#ecosystem"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(base + language + '#ecosystem', { timeout: 5000 });
    assert.ok(page.url().endsWith('#ecosystem'), 'Keyboard navigation reaches the ecosystem');
    for (const [project, url] of Object.entries(ecosystemProjects)) {
      await page.locator(`[data-ecosystem-project="${project}"]`).focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(url);
      await page.goBack();
      assert.ok(page.url().startsWith(base + language), `${project}: Back returns to the chosen language`);
      assert.equal(await page.locator('#ecosystem').isVisible(), true);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const audit = await new AxeBuilder({ page }).include('#ecosystem').include('.home-hero-shell').include('#deployment').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations, [], `${language || 'en'} ${width}px: hero, ecosystem and deployment accessibility`);
    }
    await context.close();
  }
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage(), externalRequests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => { externalRequests.push(route.request().url()); return route.abort(); });
    await page.goto(base + 'agijobmanager.html#/deployment');
    const route = page.getByTestId('route-deployment'), latest = route.getByTestId('latest-reported-deployment'), history = route.getByTestId('historical-deployment');
    assert.equal(await latest.isVisible(), true, `${width}px: advanced route renders its latest panel, not merely embedded source`);
    assert.equal(await latest.locator(`a[href="${latestDeployment.verificationLinks.managerCode}"]`).count(), 1, `${width}px: advanced route explorer targets the latest Manager`);
    const latestText = await latest.textContent();
    assert.ok(latestText.includes(latestDeployment.manager) && latestText.includes(latestDeployment.recordDate), `${width}px: advanced route presents latest identity and date`);
    assert.match(latestText, /6 Exact Match and 3 retained Similar Match/);
    assert.ok(latestText.includes('26,214,525') && latestText.includes('Owner-reported evidence, not live state'), `${width}px: advanced route retains dated authority provenance`);
    assert.ok(latestText.includes('does not establish an ENS helper attachment or select a transaction target'), `${width}px: advanced record is display-only`);
    assert.ok(!latestText.includes(historicalDeployment.manager) && !latestText.includes(historicalDeployment.helper), `${width}px: old addresses cannot be primary`);
    assert.match(await history.textContent(), /Historical instance/);
    assert.ok((await history.textContent()).includes(historicalDeployment.manager) && (await history.textContent()).includes(historicalDeployment.helper), `${width}px: advanced route retains the historical pair`);
    await history.locator('summary').click();
    await checkReflow(page, `${width}px: rendered advanced deployment route`);
    assert.equal(await route.locator('input, button').count(), 0, `${width}px: recorded deployment panels expose no target-selection action`);
    assert.deepEqual(externalRequests, [], `${width}px: viewing the advanced deployment record makes no RPC requests`);
    assert.deepEqual(errors, [], `${width}px: advanced deployment route has no script errors`);
    await context.close();
  }
  for (const language of ['', 'fr/']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + language + 'workflows/');
    const publicRoot = 'https://montrealai.github.io/AGIJobManager/';
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'fr' : 'en');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), publicRoot + language + 'workflows/', 'Workflow canonical retains the selected language and route');
    assert.deepEqual(await page.locator('link[rel="alternate"]').evaluateAll(nodes => nodes.map(node => [node.getAttribute('hreflang'), node.href])), [
      ['en', publicRoot + 'workflows/'], ['fr', publicRoot + 'fr/workflows/'], ['x-default', publicRoot + 'workflows/'],
    ], 'Workflow language alternatives identify reciprocal live routes');
    const otherLanguage = language ? '' : 'fr/';
    const switchLink = page.locator('body > nav a[hreflang]');
    assert.equal(await switchLink.getAttribute('lang'), language ? 'en' : 'fr');
    await switchLink.click();
    await page.waitForURL(base + otherLanguage + 'workflows/');
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'en' : 'fr', 'The workflow language switch opens the equivalent translated page');
    assert.deepEqual(await page.locator('article').evaluateAll(nodes => nodes.map(node => node.id)), ['successor', 'employer', 'roles', 'workforce', 'economics', 'genesis', 'erc8004', 'specifications', 'computer-receipt']);
    await page.goBack();
    await page.waitForURL(base + language + 'workflows/');
    assert.equal(await page.locator('article').count(), 9);
    assert.equal(new URL(await page.locator('#computer-receipt .button').getAttribute('href'), page.url()).href, base + language + 'computer-receipt/', 'The evidence inspector preserves the selected language');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const scale of [100, 200]) {
        await page.evaluate(scale => document.documentElement.style.fontSize = scale + '%', scale);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} workflows ${width}/${scale}`);
      }
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '100%');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(audit.violations, []);
    for (const href of await page.locator('a[href^="../"]').evaluateAll(nodes => nodes.map(a => a.href)))
      assert.equal((await page.request.get(href)).status(), 200, href);
    await page.locator('summary').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('details').first().getAttribute('open'), '');
    await page.locator('body > nav a').first().click();
    await page.waitForURL(base + language);
    assert.equal(await page.locator('html').getAttribute('lang'), language ? 'fr' : 'en', 'Workflow home navigation preserves the chosen language');
    assert.equal(await page.locator('#employer-welcome').isVisible(), true);
    await context.close();
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJS.newPage();
    await staticPage.goto(base + language + 'workflows/');
    assert.equal(await staticPage.locator('article').count(), 9);
    await noJS.close();
  }
  console.log(
    "Pages browser checks passed: English/French latest Manager copy action and nine-contract explorer inventory, explicit historical helper separation, deployment/hero/ecosystem WCAG checks, 320/390/768/1440 widths, larger and 200% text reflow, locale-preserving footer and workflow navigation with reciprocal language metadata, ecosystem and employer navigation, calculator, search, FAQ, no-JS evidence and advanced console navigation.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
