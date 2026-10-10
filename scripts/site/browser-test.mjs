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
const browser = await chromium.launch({ headless: true });
try {
  for (const language of ["", "fr/"]) {
    for (const width of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + language);
      await page.locator('[data-role="agent"]').click();
      assert.equal(await page.locator("#role-agent").isVisible(), true);
      assert.equal(await page.locator("#role-employer").isVisible(), false);
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
      await page.locator("summary").first().click();
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
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.goto(base + language);
    assert.equal(await page.locator(".role-panel:visible").count(), 4);
    assert.equal(await page.locator(".resource:visible").count(), 12);
    await page.close();
  }
  const page = await browser.newPage();
  await page.route("https://**/*", route => route.abort());
  await page.goto(base);
  await page.locator("a.language").click();
  assert.ok(page.url().endsWith("/fr/"));
  await page.locator(".nav-actions .button").click();
  assert.ok(page.url().endsWith("/agijobmanager-usdc.html"));
  console.log(
    "Pages browser checks passed: English/French, 390/768/1440 widths, role routes, calculator, search, FAQ, no-JS content and console navigation.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
