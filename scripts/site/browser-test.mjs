import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
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

try {
  for (const language of ["", "fr/"]) {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + language);
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
      assert.equal(await page.locator(".resource:visible").count(), 12);
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
    await checkEmployerEntries(page, language, `${language || 'en'} without JavaScript`);
    await checkReflow(page, `${language || 'en'} without JavaScript`);
    assert.equal(await page.locator(".role-panel:visible").count(), 4);
    assert.equal(await page.locator(".resource:visible").count(), 12);
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
    assert.ok(page.url().endsWith('#main'), 'The skip link reaches the main content');
    await page.locator('.header a[href="#ecosystem"]').focus();
    await page.keyboard.press('Enter');
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
      const audit = await new AxeBuilder({ page }).include('#ecosystem').include('.home-hero-shell').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations, [], `${language || 'en'} ${width}px: hero and ecosystem accessibility`);
    }
    await context.close();
  }
  console.log(
    "Pages browser checks passed: English/French, four-project ecosystem links and keyboard/Back navigation, hero/ecosystem WCAG checks, 320/390/768/1440 widths, larger text and 200% text reflow, prominent locale-preserving employer routes, 48px primary links, keyboard entry, four role routes, calculator, search, FAQ, no-JS onboarding and advanced console navigation.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
