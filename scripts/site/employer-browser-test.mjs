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

async function describeJob(page, overrides = {}) {
  await page.locator('[data-template="performance"]').click();
  await page.locator("#employer-next").click();
  await stage(page, 1);
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
    for (const width of [390, 768, 1440]) {
      const page = await openPage(language, {
        viewport: { width, height: 1000 },
      });
      await visit(page, language);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.locator("#employer-templates button[data-template]").count(),
        10,
      );
      assert.equal(
        await page.locator('#employer-errors[role="alert"]').count(),
        1,
      );
      assert.equal(
        await page.locator('#employer-status[role="status"]').count(),
        1,
      );
      await stage(page, 0);
      await page.locator("#employer-next").click();
      await stage(page, 0);
      assert.ok((await page.locator("#employer-errors").textContent()).trim());
      await reviewJob(page);
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
    await page.locator("#employer-title").fill("");
    await page.locator("#employer-next").click();
    await stage(page, 1);
    assert.ok((await page.locator("#employer-errors").textContent()).trim());
    await page.locator("#employer-title").fill(fields.title);
    await page
      .locator("#employer-inputs")
      .fill("https://user:password@example.com/public");
    await page.locator("#employer-next").click();
    await stage(page, 1);
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
    await page.locator("#employer-restore").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
    );
    await page.locator("#employer-title").fill("Unsaved change");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#employer-restore").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      "Unsaved change",
      "Canceled restore preserves unsaved work",
    );
    page.once("dialog", (dialog) => dialog.accept());
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
    await page.locator("#employer-clear").click();
    assert.equal(
      await page.locator("#employer-title").inputValue(),
      fields.title,
      "Canceled clear preserves the brief",
    );
    page.once("dialog", (dialog) => dialog.accept());
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
    await page.locator("#employer-save").click();
    assert.ok(
      (await page.locator("#employer-status").textContent()).trim() ||
        (await page.locator("#employer-errors").textContent()).trim(),
    );
    await page.locator("#employer-public").check();
    const before = page.url();
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
    "Employer browser checks passed: EN/FR, 390/768/1440 widths, labels, validation, safe rendering, exact JSON, draft lifecycle, language transfer, denied storage, conflict-protected console handoff, no wallet/external traffic and no-JS guide.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
