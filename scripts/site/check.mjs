import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  splitPayment,
  parseUSDC,
  formatUSDC,
} from "../../site/assets/payments.mjs";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  out = path.join(root, "build/pages");
const examples = [
  ["100", 8, [52000000n, 8000000n, 30000000n, 10000000n]],
  ["1000", 8, [520000000n, 80000000n, 300000000n, 100000000n]],
  ["10000", 8, [5200000000n, 800000000n, 3000000000n, 1000000000n]],
  ["100", 60, [0n, 60000000n, 30000000n, 10000000n]],
  ["0.000001", 8, [1n, 0n, 0n, 0n]],
  ["1.234567", 1, [728396n, 12345n, 370370n, 123456n]],
];
for (const [cost, rate, expected] of examples) {
  const s = splitPayment(cost, rate);
  assert.deepEqual([s.agent, s.validators, s.wallet30, s.wallet10], expected);
  assert.equal(s.agent + s.validators + s.wallet30 + s.wallet10, s.cost);
}
assert.throws(() => parseUSDC("1,000"));
assert.equal(formatUSDC(1250001n), "1.250001 USDC");
assert.equal(formatUSDC(1250001n, "fr"), "1,250001 USDC");
for (const value of [
  "",
  "0",
  "-1",
  "1e6",
  "1.0000001",
  "1,000.00",
  "NaN",
  "Infinity",
  "<script>",
  "1.2.3",
])
  assert.throws(() => parseUSDC(value));
for (const rate of [0, 61, -1, 8.5, "", "8e0"])
  assert.throws(() => splitPayment("100", rate));
const huge = splitPayment("999999999999999999.999999", 8);
assert.equal(huge.cost, 999999999999999999999999n);
assert.equal(
  huge.agent + huge.validators + huge.wallet30 + huge.wallet10,
  huge.cost,
);
for (const file of ["index.html", "fr/index.html", "employers/index.html", "fr/employers/index.html"]) {
  const full = path.join(out, file),
    html = fs.readFileSync(full, "utf8");
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one h1`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate ids`);
  assert.ok(
    !/\{\{|undefined|\[object Object\]/.test(html),
    `${file}: unresolved template`,
  );
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith("#")) {
      assert.ok(ids.includes(url.slice(1)), `${file}: missing anchor ${url}`);
      continue;
    }
    const github = url.match(
      /^https:\/\/github\.com\/MontrealAI\/AGIJobManager\/blob\/[a-f0-9]{40}\/(.+)$/,
    );
    if (github) {
      assert.ok(
        fs.existsSync(path.join(root, github[1].split("#")[0])),
        `Missing repo guide: ${github[1]}`,
      );
      continue;
    }
    if (url.startsWith("https://")) continue;
    assert.ok(!/^\w+:/.test(url), `Unsupported link protocol: ${url}`);
    const dest = path.resolve(path.dirname(full), url.split("#")[0]);
    assert.ok(
      dest.startsWith(out + path.sep) || dest === out,
      `Link escapes Pages: ${url}`,
    );
    assert.ok(fs.existsSync(dest), `Missing Pages asset: ${url}`);
  }
  assert.ok(html.includes("connect-src 'none'"));
  if (!file.includes("employers/")) assert.equal((html.match(/class="resource"/g) || []).length, 12);
  else {
    assert.ok(html.includes('id="employer-form"'));
    assert.ok(html.includes('Load saved draft'));
    assert.ok(html.includes('data-employer-language="'));
  }
}
for (const alias of ["agijobmanager-usdc.html", "agijobmanagerv0.html"])
  assert.equal(
    fs.readFileSync(path.join(out, alias), "utf8"),
    fs.readFileSync(path.join(root, "ui/agijobmanager-usdc.html"), "utf8"),
    `${alias}: console must be unchanged`,
  );
assert.equal(
  fs.readFileSync(path.join(out, "agijobmanager.html"), "utf8"),
  fs.readFileSync(path.join(root, "ui/dist-ipfs/agijobmanager.html"), "utf8"),
);
assert.ok(
  !fs.existsSync(path.join(out, "content")) &&
    !fs.existsSync(path.join(out, ".git")),
);
console.log(
  "Pages checks passed: bilingual pages, navigation, guide paths, exact USDC allocations, invalid inputs and byte-identical console aliases.",
);
