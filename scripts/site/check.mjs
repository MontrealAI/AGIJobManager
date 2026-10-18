import assert from "node:assert/strict";
import fs from "node:fs";
import { actualRepositoryCommit } from "../successor/source-identity.mjs";
import { loadLatestReportedDeployment } from "../../site/deployments.mjs";
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
const selectedDeployment = loadLatestReportedDeployment(root);
const latest = selectedDeployment.record;
const historical = JSON.parse(fs.readFileSync(path.join(root, "config/mainnet/agi-jobs-usdc.json"), "utf8"));
const publicRoot = "https://montrealai.github.io/AGIJobManager/";
function checkLocaleMetadata(html, file, route) {
  const language = file.startsWith("fr/") ? "fr" : "en";
  const canonical = publicRoot + (language === "fr" ? "fr/" : "") + route;
  assert.equal(html.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1], language, `${file}: document language matches its route`);
  const canonicals = [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/g)];
  assert.equal(canonicals.length, 1, `${file}: one canonical URL`);
  assert.equal(canonicals[0][0].match(/\bhref="([^"]+)"/)?.[1], canonical, `${file}: canonical preserves the route and language`);
  const alternates = [...html.matchAll(/<link\b[^>]*\brel="alternate"[^>]*>/g)].map(([tag]) => [tag.match(/\bhreflang="([^"]+)"/)?.[1], tag.match(/\bhref="([^"]+)"/)?.[1]]);
  assert.deepEqual(alternates, [["en", publicRoot + route], ["fr", publicRoot + "fr/" + route], ["x-default", publicRoot + route]], `${file}: reciprocal language alternatives retain the same destination`);
}
assert.equal(inventory.latestDeploymentPath, selectedDeployment.recordPath);
assert.equal(inventory.historicalEvidence, "config/mainnet/agi-jobs-usdc.json");
assert.deepEqual(inventory.latestDeployment, {
  recordDate: latest.recordDate, recordType: latest.recordType, notLiveState: true,
  manager: latest.manager, deployedSourceCommit: latest.source.commit,
  reportedAuthorityBlock: latest.reportedAuthoritySnapshot.blockNumber,
  exactMatches: 6, retainedSimilarMatches: 3,
});
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
  checkLocaleMetadata(html, file, file.includes("employers/") ? "employers/" : "");
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
    const footerBrand = html.match(/<footer\b[^>]*class="footer container"[^>]*>[\s\S]*?<a\b[^>]*class="brand"[^>]*>/)?.[0].match(/\bhref="([^"]+)"/)?.[1];
    assert.ok(footerBrand, `${file}: footer brand provides a homepage link`);
    const homeUrl = publicRoot + (file.startsWith("fr/") ? "fr/" : "");
    assert.equal(new URL(footerBrand, homeUrl).href, homeUrl, `${file}: footer brand preserves the selected language`);
    const primary = html.match(/<article\b[^>]*\bid="latest-deployment"[^>]*>([\s\S]*?)<\/article>/)?.[1];
    const history = html.match(/<article\b[^>]*\bid="historical-deployment"[^>]*>([\s\S]*?)<\/article>/)?.[1];
    assert.ok(primary && history, `${file}: latest and historical deployments have distinct semantic cards`);
    assert.equal(primary.match(/<code id="manager-address">([^<]+)<\/code>/)?.[1], latest.manager, `${file}: primary copy source is the latest reported Manager`);
    assert.ok(primary.includes(`data-deployment-date>${latest.recordDate}</dd>`), `${file}: primary date matches the selected report`);
    assert.ok(primary.includes(`data-deployment-block>${latest.reportedAuthoritySnapshot.blockNumber}</dd>`), `${file}: primary block matches the reported authority snapshot`);
    assert.ok(primary.includes(`data-deployment-governor>${latest.reportedAuthoritySnapshot.owner}</code>`), `${file}: governor belongs to the selected report`);
    assert.ok(primary.includes(`data-deployment-source>${latest.source.commit}</code>`), `${file}: deployed source is distinct from website source`);
    assert.ok(primary.includes(`href="${latest.verificationLinks.managerCode}"`), `${file}: primary explorer targets the latest Manager`);
    for (const recordPath of [selectedDeployment.recordPath, selectedDeployment.guidePath])
      assert.ok(primary.includes(`href="https://github.com/MontrealAI/AGIJobManager/blob/${inventory.sourceCommit}/${recordPath}"`), `${file}: primary evidence link ${recordPath}`);
    assert.ok(!primary.includes(historical.manager) && !primary.includes(historical.helper), `${file}: earlier manager and helper cannot appear as current evidence`);
    assert.equal((primary.match(/data-deployment-contract=/g) || []).length, 9, `${file}: all nine reported creations remain inspectable`);
    assert.equal((primary.match(/data-explorer-match="EXACT_MATCH"/g) || []).length, 6, `${file}: six Exact Matches`);
    assert.equal((primary.match(/data-explorer-match="SIMILAR_MATCH_SKIPPED"/g) || []).length, 3, `${file}: three retained Similar Matches`);
    for (const contract of latest.contracts) {
      assert.ok(primary.includes(`data-deployment-contract="${contract.name}" data-explorer-match="${contract.explorerMatchStatus}"`), `${file}: ${contract.name} retains its actual explorer attribution`);
      assert.ok(primary.includes(`<code>${contract.address}</code>`), `${file}: ${contract.name} address`);
      assert.ok(primary.includes(`href="${contract.explorerCodeUrl}"`) && primary.includes(`href="${contract.deploymentTransactionUrl}"`), `${file}: ${contract.name} code and creation links`);
    }
    assert.ok(history.includes(`data-historical-manager>${historical.manager}</code>`) && history.includes(`data-historical-helper>${historical.helper}</code>`), `${file}: historical manager/helper remain paired`);
    assert.ok(history.includes(historical.recordDate) && history.includes(String(historical.connection.snapshot.number)), `${file}: history retains its own date and block`);
    assert.ok(!history.includes(latest.manager), `${file}: the historical helper cannot be attached to the latest Manager by presentation`);
    assert.ok(html.indexOf('id="latest-deployment"') < html.indexOf('id="historical-deployment"'), `${file}: latest reported deployment is primary`);
    const languageCopy = JSON.parse(fs.readFileSync(path.join(root, `site/content/${file.startsWith('fr/') ? 'fr' : 'en'}.json`), 'utf8'));
    for (const key of ['evidenceState', 'explorerBoundary', 'historicalBoundary', 'noTransactionTarget'])
      assert.ok(html.includes(languageCopy[key].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')), `${file}: visible deployment boundary ${key}`);
    assert.match(languageCopy.evidenceState, file.startsWith('fr/') ? /rapport du propriétaire.*ni une lecture en direct/ : /owner-reported evidence, not a live chain query/);
    assert.match(languageCopy.historicalTitle, file.startsWith('fr/') ? /historiques/ : /Historical/);
    assert.match(languageCopy.ensText, file.startsWith('fr/') ? /ne démontre aucun rattachement/ : /establishes no ENS helper attachment/);
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
for (const file of ["workflows/index.html", "fr/workflows/index.html"]) {
  const html = fs.readFileSync(path.join(out, file), "utf8");
  checkLocaleMetadata(html, file, "workflows/");
  const language = file.startsWith("fr/") ? "fr" : "en", other = language === "fr" ? "en" : "fr";
  const switchLink = html.match(new RegExp(`<a\\b[^>]*\\blang="${other}"[^>]*>`))?.[0];
  assert.ok(switchLink, `${file}: language switch identifies its destination language`);
  assert.ok(switchLink.includes(`hreflang="${other}"`), `${file}: language switch identifies its linked content language`);
  const current = publicRoot + (language === "fr" ? "fr/" : "") + "workflows/";
  assert.equal(new URL(switchLink.match(/\bhref="([^"]+)"/)?.[1], current).href, publicRoot + (other === "fr" ? "fr/" : "") + "workflows/", `${file}: language switch retains the workflows destination`);
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
  "Pages checks passed: bilingual latest owner-reported Manager/address/date/block/source/governor and nine explorer inventories, explicit historical manager/helper separation, locale-preserving footer and workflow navigation, reciprocal current-page language metadata, four-project ecosystem routes and protocol boundaries, employer routes, guide paths, exact USDC allocations and byte-identical console aliases.",
);
