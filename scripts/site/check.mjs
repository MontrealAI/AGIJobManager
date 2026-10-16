import assert from "node:assert/strict";
import fs from "node:fs";
import { actualRepositoryCommit } from "../successor/source-identity.mjs";
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
const inventory = JSON.parse(fs.readFileSync(path.join(out, "build-info.json"), "utf8"));
const builderSelector = JSON.parse(fs.readFileSync(path.join(root, 'config/successor-builder-source.json'), 'utf8'));
assert.equal(inventory.sourceCommit, actualRepositoryCommit(root), 'Outer website qualification must identify the actual checkout');
assert.equal(inventory.successorSource.commit, builderSelector.commit);
assert.equal(inventory.successorSource.engineSha256, builderSelector.engineSha256);
assert.deepEqual(inventory.successorSourceVerification, { mode: 'git-object-pin', sourceCommit: builderSelector.commit, sourceTree: builderSelector.tree, completeSourceFiles: inventory.successorSource.files.length });
assert.equal(Object.hasOwn(inventory.files, ".nojekyll"), false, "Build-only marker must not claim public deployment coverage");
assert.deepEqual(Object.keys(inventory.buildOnlyFiles), [".nojekyll"]);
assert.equal(inventory.buildOnlyFiles[".nojekyll"].bytes, 0);
assert.equal(inventory.buildOnlyFiles[".nojekyll"].sha256, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
assert.equal(fs.readFileSync(path.join(out, ".nojekyll")).length, 0);
assert.ok(inventory.buildOnlyFiles[".nojekyll"].reason.includes("excluded"));
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
  if (!file.includes("employers/")) {
    assert.equal((html.match(/class="resource"/g) || []).length, 12);
    for (const placement of ['header', 'hero', 'welcome', 'footer']) {
      const entries = [...html.matchAll(new RegExp(`<a\\b[^>]*\\bdata-employer-entry="${placement}"[^>]*>`, 'g'))];
      assert.equal(entries.length, 1, `${file}: one ${placement} employer entry`);
      assert.equal(entries[0][0].match(/\bhref="([^"]+)"/)?.[1], './employers/', `${file}: ${placement} employer entry keeps the selected language`);
    }
    for (const id of ['employer-welcome', 'home-larger-text', 'advanced-console-link'])
      assert.ok(ids.includes(id), `${file}: missing newcomer navigation ${id}`);
    assert.ok(html.indexOf('id="ecosystem"') < html.indexOf('id="successor-welcome"'), `${file}: ecosystem map appears near the beginning`);
    assert.ok(html.includes('href="#ecosystem"'), `${file}: navigation reaches the ecosystem map`);
    assert.equal((html.match(/data-ecosystem-project=/g) || []).length, 4, `${file}: exactly four ecosystem links`);
    const ecosystemUrls = {
      alpha: 'https://montrealai.github.io/AGI-Alpha-Agent-v0/',
      jobs: 'https://montrealai.github.io/AGIJobsv0/',
      manager: 'https://montrealai.github.io/AGIJobManager/',
      fleet: 'https://montrealai.github.io/AGI-Fleet-Linux/',
    };
    for (const [project, url] of Object.entries(ecosystemUrls)) {
      assert.ok(html.includes(`data-ecosystem-project="${project}" href="${url}"`), `${file}: ${project} has its exact public project URL`);
      assert.ok(ids.includes(`ecosystem-${project}-title`), `${file}: ${project} has an accessible heading`);
    }
    const language = file.startsWith('fr/') ? 'fr' : 'en';
    const copy = JSON.parse(fs.readFileSync(path.join(root, `site/content/${language}.json`), 'utf8')).ecosystem;
    assert.deepEqual(copy.cards.map(card => card.id), ['alpha', 'jobs', 'manager', 'fleet']);
    assert.match(copy.cards.find(card => card.id === 'jobs').description, /AGIALPHA/);
    assert.match(copy.cards.find(card => card.id === 'manager').role, /USDC/);
    assert.match(copy.boundary, /AGIALPHA.*USDC/);
    assert.match(copy.boundary, language === 'fr' ? /ne transfèrent ni fonds, ni travaux, ni autorité/ : /do not transfer funds, jobs or authority/);
    assert.match(copy.boundary, language === 'fr' ? /ne prouvent pas la disponibilité opérationnelle/ : /do not establish live readiness/);
    assert.ok(html.includes('href="#employer-welcome"'), `${file}: navigation reaches the newcomer welcome`);
    assert.ok(html.includes('id="home-larger-text" aria-pressed="false"') || /id="home-larger-text"[^>]*aria-pressed="false"/.test(html), `${file}: text size control declares its initial state`);
  }
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
  "Pages checks passed: bilingual pages, four-project ecosystem routes and protocol boundaries, prominent locale-preserving employer routes, newcomer navigation, guide paths, exact USDC allocations, invalid inputs and byte-identical console aliases.",
);
