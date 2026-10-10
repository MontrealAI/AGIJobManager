import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const output = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../build/pages",
);
const draftKey = "agijobmanager_employer_onboarding_v1";
const consoleKey = "agijobmanager_usdc_v096_builder_draft_v11_1";
const fields = {
  title: "Public software performance improvement",
  summary:
    "Improve the documented public project and provide a reproducible before-and-after benchmark.",
  inputs: "https://github.com/MontrealAI/AGIJobManager",
  deliverables:
    "A public pull request with source code, benchmark commands, test results and a concise README.",
  acceptance:
    "All existing tests pass. A reviewer can reproduce the benchmark from a clean checkout using the supplied commands.",
  requirements:
    "Use public, licensed or synthetic inputs only. Preserve compatibility and document the runtime version.",
};
const server = createServer((req, res) => {
  let relative;
  try {
    relative = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!relative.startsWith("/AGIJobManager/")) {
    res.writeHead(404).end();
    return;
  }
  relative = relative.slice("/AGIJobManager/".length);
  const target = path.resolve(
    output,
    relative.endsWith("/") || !relative ? relative + "index.html" : relative,
  );
  if (
    !target.startsWith(output + path.sep) ||
    !fs.existsSync(target) ||
    !fs.statSync(target).isFile()
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
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/AGIJobManager/`;
let browser;
const observed = [];

async function openPage(language = "", options = {}) {
  const page = await browser.newPage(options);
  const errors = [],
    external = [];
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== origin
    )
      external.push(request.url());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin)
      return route.abort();
    return route.continue();
  });
  await page.addInitScript(() => {
    window.__employerWalletCalls = 0;
    window.ethereum = {
      request() {
        window.__employerWalletCalls++;
        throw new Error("Onboarding must not request a wallet");
      },
    };
  });
  observed.push({ page, errors, external });
  return page;
}

async function visit(page, language = "") {
  const response = await page.goto(base + language + "employers/");
  assert.equal(response.status(), 200);
  await page.locator("#employer-form").waitFor({ state: "visible" });
}

async function stage(page, index) {
  assert.equal(
    await page.locator(`[data-employer-panel="${index}"]`).isVisible(),
    true,
    `Stage ${index} is visible`,
  );
  assert.equal(
    await page.locator("[data-employer-panel]:visible").count(),
    1,
    "Only the active step is visible",
  );
}

async function inspectLayout(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) => element.getClientRects().length > 0;
    const targets = [...document.querySelectorAll(
      '#employer-next, #employer-next-top, #employer-back, #employer-download-text, #employer-print, #employer-larger-text, #employer-templates button, #employer-more-templates button, [data-employer-step]',
    )].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      smallTargets: targets.filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width < 48 || box.height < 48;
      }).map((element) => element.id || element.dataset.template),
      clippedTargets: targets.filter((element) =>
        element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1,
      ).map((element) => element.id || element.dataset.template),
      smallInputText: [...document.querySelectorAll('#employer-form textarea, #employer-form input:not([type="checkbox"])')]
        .filter(visible).filter((element) => parseFloat(getComputedStyle(element).fontSize) < 18)
        .map((element) => element.id),
      hiddenFocus: document.activeElement !== document.body &&
        (!visible(document.activeElement) || !!document.activeElement.closest('[hidden]')),
    };
  });
  assert.equal(result.overflow, false, `No horizontal page overflow: ${label}`);
  assert.deepEqual(result.smallTargets, [], `Primary controls are at least 48 × 48 px: ${label}`);
  assert.deepEqual(result.clippedTargets, [], `Primary control text is not clipped: ${label}`);
  assert.deepEqual(result.smallInputText, [], `Editable text is at least 18px: ${label}`);
  assert.equal(result.hiddenFocus, false, `Focus stays in visible content: ${label}`);
}

async function reveal(page, selector) {
  await page.locator(selector).evaluate((element) => {
    let parent = element.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
  });
}

async function describeJob(page, overrides = {}) {
  await page.locator('[data-template="website"]').click();
  await page.locator("#employer-next-top").click();
  await stage(page, 1);
  await page.locator("#employer-extra-details > summary").click();
  for (const [name, value] of Object.entries({ ...fields, ...overrides })) {
    await page.locator(`#employer-${name}`).fill(value);
  }
}

async function reviewJob(page, overrides = {}) {
  await describeJob(page, overrides);
  await page.locator("#employer-next").click();
  await stage(page, 2);
  await page.locator("#employer-budget").fill("1500.123456");
  await page.locator("#employer-days").fill("7");
  await page.locator("#employer-next").click();
  await stage(page, 3);
}

async function downloadJSON(page) {
  await reveal(page, '#employer-export');
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#employer-export").click(),
  ]);
  assert.match(download.suggestedFilename(), /\.json$/);
  const stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function downloadText(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#employer-download-text").click(),
  ]);
  assert.match(download.suggestedFilename(), /\.txt$/);
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function closeChecked(page) {
  const record = observed.find((item) => item.page === page);
  assert.deepEqual(record.errors, [], "No uncaught browser errors");
  assert.deepEqual(
    record.external,
    [],
    "Onboarding performs no third-party requests",
  );
  assert.equal(
    await page.evaluate(() => window.__employerWalletCalls),
    0,
    "Onboarding never calls the wallet",
  );
  await page.close();
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });

  for (const language of ["", "fr/"]) {
    for (const width of [320, 390, 768, 1440]) {
      const page = await openPage(language, {
        viewport: { width, height: 1000 },
      });
      await visit(page, language);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.locator("#employer-templates button[data-template]").count(),
        6,
      );
      assert.deepEqual(
        await page.locator('#employer-templates button[data-template]').evaluateAll(
          (buttons) => buttons.map((button) => button.dataset.template),
        ),
        ['website', 'intelligence', 'presentation', 'report', 'dashboard', 'custom'],
        'Everyday examples are shown first',
      );
      assert.equal(await page.locator('#employer-more-templates button[data-template]').count(), 8);
      assert.equal(await page.locator('#more-examples').getAttribute('open'), null);
      assert.equal(
        await page.locator('#employer-errors[role="alert"]').count(),
        1,
      );
      assert.equal(
        await page.locator('#employer-status[role="status"]').count(),
        1,
      );
      assert.equal(await page.locator('#employer-step-status[role="status"]').count(), 1);
      await stage(page, 0);
      await inspectLayout(page, `${language || 'en'} ${width}px examples`);
      await page.locator('#more-examples > summary').click();
      assert.equal(await page.locator('[data-template="performance"]').isVisible(), true);
      await inspectLayout(page, `${language || 'en'} ${width}px extra examples`);
      await page.locator('#more-examples > summary').click();
      await page.locator("#employer-next").click();
      await stage(page, 0);
      assert.ok((await page.locator("#employer-errors").textContent()).trim());
      await describeJob(page);
      await inspectLayout(page, `${language || 'en'} ${width}px description`);
      await page.locator('#employer-next').click();
      await stage(page, 2);
      await inspectLayout(page, `${language || 'en'} ${width}px budget`);
      await page.locator('#employer-budget').fill('1500.123456');
      await page.locator('#employer-days').fill('7');
      await page.locator('#employer-next').click();
      await stage(page, 3);
      await inspectLayout(page, `${language || 'en'} ${width}px review`);
      assert.ok(
        (await page.locator("#employer-review").textContent()).includes(
          fields.title,
        ),
      );
      assert.equal(
        await page.locator("#employer-public").isChecked(),
        false,
        "Public-content consent is explicit",
      );
      assert.ok(
        await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "#employer-form input[id], #employer-form textarea[id]",
            ),
          ].every((field) => field.labels?.length),
        ),
        "Every form input has an associated label",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `Review overflow: ${language} ${width}`,
      );
      await page.locator("#employer-back").click();
      await stage(page, 2);
      assert.equal(
        await page.locator("#employer-budget").inputValue(),
        "1500.123456",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `Budget overflow: ${language} ${width}`,
      );
      await closeChecked(page);
    }
  }

  {
    const page = await openPage();
    await visit(page);
    await page.locator('[data-employer-step="3"]').click();
    await stage(page, 0);
    assert.ok(
      (await page.locator("#employer-errors").textContent()).trim(),
      "Step navigation cannot bypass validation",
    );
    await describeJob(page);
    await page.locator("#employer-summary").fill("");
    await page.locator("#employer-next").click();
    await stage(page, 1);
    assert.ok((await page.locator("#employer-errors").textContent()).trim());
    await page.locator("#employer-summary").fill(fields.summary);
    await page
      .locator("#employer-inputs")
      .fill("https://user:password@example.com/public");
    await page.locator('#employer-extra-details > summary').click();
    await page.locator("#employer-next").click();
    await stage(page, 1);
    await page.locator('#employer-errors a[href="#employer-inputs"]').click();
    assert.equal(await page.locator('#employer-extra-details').evaluate((details) => details.open), true, 'An error link opens the affected optional field');
    assert.equal(await page.locator('#employer-inputs').evaluate((field) => document.activeElement === field), true, 'The error link focuses the field to correct');
    await page.locator("#employer-inputs").fill(fields.inputs);
    await page.locator("#employer-next").click();
    await stage(page, 2);
    await page.locator("#employer-days").fill("7");
    for (const value of ["0", "-1", "1.1234567", "1e3"]) {
      await page.locator("#employer-budget").fill(value);
      await page.locator("#employer-next").click();
      await stage(page, 2);
      assert.ok(
        (await page.locator("#employer-errors").textContent()).trim(),
        `Invalid budget ${value}`,
      );
    }
    await page.locator("#employer-budget").fill("100");
    for (const value of ["0", "-1", "1.5"]) {
      await page.locator("#employer-days").fill(value);
      await page.locator("#employer-next").click();
      await stage(page, 2);
    }
    await closeChecked(page);
  }

  for (const language of ['', 'fr/']) {
    const page = await openPage(language, { viewport: { width: 720, height: 1000 } });
    await visit(page, language);
    await page.locator('#employer-larger-text').click();
    assert.equal(await page.locator('#employer-larger-text').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('large-text')), true);
    await inspectLayout(page, `${language || 'en'} larger text`);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await inspectLayout(page, `${language || 'en'} 200% text, examples`);
    await describeJob(page);
    await inspectLayout(page, `${language || 'en'} 200% text, description`);
    await page.locator('#employer-larger-text').click();
    assert.equal(await page.locator('#employer-larger-text').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#employer-summary').inputValue(), fields.summary, 'Text size changes preserve work');
    await page.locator('#employer-next').click();
    await stage(page, 2);
    await inspectLayout(page, `${language || 'en'} 200% text, budget`);
    await page.locator('#employer-budget').fill('100');
    await page.locator('#employer-days').fill('7');
    await page.locator('#employer-next').click();
    await stage(page, 3);
    await inspectLayout(page, `${language || 'en'} 200% text, review`);
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await visit(page);
    await page.locator('[data-template="website"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-template="website"]').getAttribute('aria-pressed'), 'true');
    assert.ok((await page.locator('#employer-selection').textContent()).trim(), 'Selection is announced');
    await page.locator('#employer-next-top').focus();
    await page.keyboard.press('Enter');
    await stage(page, 1);
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('[data-employer-panel="1"]')), 'Keyboard progression focuses the new panel');
    assert.ok((await page.locator('#employer-step-status').textContent()).trim(), 'Step progression is announced');
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('[hidden]') || document.activeElement.getClientRects().length === 0), false, 'Tab never lands in hidden content');
    }
    await page.locator('#employer-summary').fill(fields.summary);
    await page.locator('#employer-deliverables').fill(fields.deliverables);
    await page.locator('#employer-acceptance').fill(fields.acceptance);
    await reveal(page, '#employer-title');
    await page.locator('#employer-title').fill('');
    await page.locator('#employer-inputs').fill('');
    await page.locator('#employer-extra-details > summary').click();
    await page.locator('#employer-next').click();
    await stage(page, 2);
    await page.locator('#employer-budget').fill('100');
    await page.locator('#employer-days').fill('7');
    await page.locator('#employer-next').click();
    await stage(page, 3);
    await page.locator('#employer-public').check();
    const spec = await downloadJSON(page);
    assert.ok(spec.properties.title.trim(), 'A missing optional title gets a usable title');
    assert.deepEqual(spec.properties.inputURLs, [], 'A job can start without public source links');
    await closeChecked(page);
  }

  for (const language of ['', 'fr/']) {
    const page = await openPage(language);
    await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
    await visit(page, language);
    await reviewJob(page);
    let count = 0;
    page.on('download', () => count++);
    await page.locator('#employer-download-text').click();
    assert.equal(count, 0, 'Text export requires review consent');
    await page.locator('#employer-print').click();
    assert.equal(await page.evaluate(() => window.__printCalls), 0, 'Printing requires review consent');
    await page.locator('#employer-public').check();
    const text = await downloadText(page);
    for (const value of [fields.title, fields.summary, fields.deliverables, fields.acceptance, fields.inputs, '1500.123456'])
      assert.ok(text.includes(value), `Plain-text brief preserves ${value}`);
    assert.ok(text.includes(language ? 'Aucune demande n’a été publiée et aucun paiement n’a été effectué.' : 'No request has been published and no payment has been made.'), 'The downloaded copy clearly states that nothing was published or paid');
    await page.locator('#employer-print').click();
    assert.equal(await page.evaluate(() => window.__printCalls), 1, 'The reviewed brief can be printed');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#employer-review').isVisible(), true, 'Print retains the complete brief');
    assert.equal(await page.locator('#employer-next').isVisible(), false, 'Print omits navigation');
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await visit(page);
    const payload = '<img src=x onerror="window.__employerInjected=true">';
    await reviewJob(page, { title: payload });
    assert.ok(
      (await page.locator("#employer-review").textContent()).includes(payload),
    );
    assert.equal(
      await page
        .locator("#employer-review img, #employer-review script")
        .count(),
      0,
    );
    assert.equal(
      await page.evaluate(() => window.__employerInjected),
      undefined,
    );
    let downloadCount = 0;
    page.on("download", () => downloadCount++);
    await reveal(page, '#employer-export');
    await page.locator("#employer-export").click();
    assert.ok((await page.locator("#employer-errors").textContent()).trim());
    assert.equal(
      downloadCount,
      0,
      "Export is blocked until public-content consent",
    );
    await page.locator("#employer-public").check();
    const spec = await downloadJSON(page);
    assert.equal(spec.properties.schema, "agijobmanager/job-spec/v1");
    assert.equal(spec.properties.kind, "job-spec");
    assert.equal(spec.properties.payoutUSDC, "1500.123456");
    assert.equal(spec.properties.durationSeconds, 604800);
    assert.deepEqual(spec.properties.inputURLs, [fields.inputs]);
    assert.equal(
      spec.properties.title,
      payload,
      "Export preserves untrusted text as JSON data",
    );
    await page.locator('[data-employer-step="1"]').click();
    await page
      .locator("#employer-summary")
      .fill(fields.summary + " Include the updated baseline.");
    await page.locator('[data-employer-step="3"]').click();
    await stage(page, 3);
    assert.equal(
      await page.locator("#employer-public").isChecked(),
      false,
      "Editing the brief requires renewed review consent",
    );
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await visit(page);
    await describeJob(page);
    await reveal(page, "#employer-save");
    await page.locator("#employer-save").click();
    const saved = await page.evaluate(
      (key) => localStorage.getItem(key),
      draftKey,
    );
    assert.ok(saved?.includes(fields.title), "Explicit save stores the draft");
    await page.reload();
    await page.locator("#employer-form").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      "",
      "Saved content is restored only by explicit action",
    );
    await reveal(page, "#employer-restore");
    await page.locator("#employer-restore").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
    );
    await reveal(page, '#employer-title');
    await page.locator("#employer-title").fill("Unsaved change");
    page.once("dialog", (dialog) => dialog.dismiss());
    await reveal(page, "#employer-restore");
    await page.locator("#employer-restore").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      "Unsaved change",
      "Canceled restore preserves unsaved work",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await reveal(page, "#employer-restore");
    await page.locator("#employer-restore").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
    );
    await page.evaluate((key) => {
      localStorage.setItem(key, '{"jobTitle":"Existing console draft"}');
      localStorage.setItem("employer-test-unrelated", "preserve");
    }, consoleKey);
    page.once("dialog", (dialog) => dialog.dismiss());
    await reveal(page, "#employer-clear");
    await page.locator("#employer-clear").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
      "Canceled clear preserves the brief",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await reveal(page, "#employer-clear");
    await page.locator("#employer-clear").click();
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), draftKey),
      null,
    );
    assert.equal(await page.locator("#employer-title").inputValue(), "");
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).jobTitle,
        consoleKey,
      ),
      "Existing console draft",
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("employer-test-unrelated"),
      ),
      "preserve",
    );
    await page.evaluate(
      (key) => localStorage.setItem(key, "{malformed"),
      draftKey,
    );
    await reveal(page, "#employer-restore");
    await page.locator("#employer-restore").click();
    assert.ok(
      (await page.locator("#employer-status").textContent()).trim() ||
        (await page.locator("#employer-errors").textContent()).trim(),
    );
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await visit(page);
    await describeJob(page);
    await page.locator("[data-employer-language]").click();
    await page.waitForURL(base + "fr/employers/");
    await page.locator("#employer-form").waitFor({ state: "visible" });
    assert.equal(await page.locator("html").getAttribute("lang"), "fr");
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), draftKey),
      null,
      "Changing language does not opt into permanent saving",
    );
    await page.locator("[data-employer-language]").click();
    await page.waitForURL(base + "employers/");
    await page.locator("#employer-form").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
    );
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await page.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Storage denied", "SecurityError");
        },
      }),
    );
    await visit(page);
    await reviewJob(page);
    await reveal(page, "#employer-save");
    await page.locator("#employer-save").click();
    assert.ok(
      (await page.locator("#employer-status").textContent()).trim() ||
        (await page.locator("#employer-errors").textContent()).trim(),
    );
    await page.locator("#employer-public").check();
    const before = page.url();
    await reveal(page, '#employer-handoff');
    await page.locator("#employer-handoff").click();
    assert.equal(
      page.url(),
      before,
      "Denied storage must not navigate with a missing draft",
    );
    const spec = await downloadJSON(page);
    assert.equal(
      spec.properties.payoutUSDC,
      "1500.123456",
      "JSON export works when browser storage is denied",
    );
    await closeChecked(page);
  }

  {
    const page = await openPage();
    await visit(page);
    const existing = '{"jobTitle":"Existing paid work","jobPayout":"8000"}';
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: consoleKey,
      value: existing,
    });
    await reviewJob(page);
    await page.locator("#employer-public").check();
    await reveal(page, '#employer-handoff');
    await page.locator("#employer-handoff").click();
    assert.ok(page.url().endsWith("/employers/"));
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), consoleKey),
      existing,
      "Existing console draft is preserved",
    );
    assert.equal(await page.locator("#employer-conflict").isVisible(), true);
    assert.equal(await page.locator("#employer-replace").isChecked(), false);
    await page.locator("#employer-replace").check();
    const changed = '{"jobTitle":"Newer console draft from another tab"}';
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: consoleKey,
      value: changed,
    });
    await page.locator("#employer-handoff").click();
    assert.ok(page.url().endsWith("/employers/"));
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), consoleKey),
      changed,
      "Changed console draft requires fresh replacement consent",
    );
    assert.equal(await page.locator("#employer-replace").isChecked(), false);
    await page.locator("#employer-replace").check();
    await page.route("**/agijobmanager-usdc.html", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body>Console handoff target</body></html>",
      }),
    );
    await page.locator("#employer-handoff").click();
    await page.waitForURL(/\/agijobmanager-usdc\.html#createJobSection$/);
    const draft = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      consoleKey,
    );
    assert.equal(draft.jobTitle, fields.title);
    assert.equal(draft.jobPayout, "1500.123456");
    assert.equal(String(draft.jobDuration), "604800");
    assert.equal(
      draft.jobSpecURI,
      "",
      "Handoff must not imply a published specification",
    );
    await closeChecked(page);
  }

  for (const language of ["", "fr/"]) {
    const page = await openPage(language, {
      javaScriptEnabled: false,
      viewport: { width: 390, height: 1000 },
    });
    await page.goto(base + language + "employers/");
    assert.equal(await page.locator("#employer-form").isVisible(), false);
    assert.ok((await page.locator("noscript").textContent()).trim());
    assert.ok(
      await page.locator('a[href*="agijobmanager-usdc.html"]:visible').count(),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    const record = observed.find((item) => item.page === page);
    assert.deepEqual(record.errors, []);
    assert.deepEqual(record.external, []);
    await page.close();
  }
  console.log(
    "Employer browser checks passed: EN/FR, 320/390/768/1440 widths, 200% text, larger-text controls, 48px primary targets, keyboard focus, labels, six everyday + eight technical examples, optional title/links, validation, text/print/JSON exports, safe rendering, draft lifecycle, language transfer, denied storage, protected console handoff, no wallet/external traffic and no-JS guide.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
