import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { render } from "../../site/template.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const output = path.join(root, "build/pages");
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!/^[a-f0-9]{40}$/.test(commit))
  throw Error("Cannot identify source commit");
const pkg = json("package.json"),
  registry = json("config/usdc-deployment.json");
const evidencePath = "docs/releases/v1.14.0/MAINNET_EVIDENCE.json";
const evidence = json(evidencePath);
if (
  evidence.chainId !== 1 ||
  evidence.intakePaused !== true ||
  !/^0x[a-fA-F0-9]{40}$/.test(evidence.manager)
)
  throw Error(
    "Review historical evidence wording before publishing changed evidence",
  );
if (
  !Number.isSafeInteger(evidence.blockNumber) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(evidence.observedDate)
)
  throw Error("Invalid historical evidence provenance");
if (
  registry.usdc.decimals !== 6 ||
  registry.settlement.wallet30Percentage !== 30 ||
  registry.settlement.wallet10Percentage !== 10 ||
  registry.settlement.defaultValidatorPercentage !== 8
)
  throw Error(
    "Review homepage payment assumptions against the changed protocol",
  );
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, "assets"), { recursive: true });
for (const name of ["app.mjs", "payments.mjs", "style.css", "mark.svg"])
  fs.copyFileSync(
    path.join(root, "site/assets", name),
    path.join(output, "assets", name),
  );
for (const lang of ["en", "fr"]) {
  const t = json(`site/content/${lang}.json`);
  if (t.lang !== lang) throw Error("Language content mismatch");
  const html = render(t, {
    commit,
    version: pkg.version,
    registry,
    evidence,
    evidencePath,
  });
  const directory = lang === "en" ? output : path.join(output, lang);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html);
}
const consoleHtml = read("ui/agijobmanager-usdc.html");
for (const name of ["agijobmanager-usdc.html", "agijobmanagerv0.html"])
  fs.writeFileSync(path.join(output, name), consoleHtml);
fs.copyFileSync(
  path.join(root, "ui/dist-ipfs/agijobmanager.html"),
  path.join(output, "agijobmanager.html"),
);
// Preserve optional standards pages without publishing source/configuration directories.
const standards = path.join(root, "site/standards");
if (fs.existsSync(standards))
  fs.cpSync(standards, path.join(output, "standards"), {
    recursive: true,
    dereference: false,
  });
fs.writeFileSync(path.join(output, ".nojekyll"), "");
fs.writeFileSync(
  path.join(output, "404.html"),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · AGI Jobs</title><link rel="stylesheet" href="/AGIJobManager/assets/style.css"><main class="container section"><p class="eyebrow">AGI JOBS · 404</p><h1>This page could not be found.</h1><p>Cette page est introuvable.</p><p><a class="button" href="/AGIJobManager/">Return to AGI Jobs / Accueil</a></p></main></html>',
);
fs.writeFileSync(
  path.join(output, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://montrealai.github.io/AGIJobManager/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/fr/</loc></url></urlset>',
);
const files = {};
function inventory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink())
      throw Error("Pages must not contain symbolic links: " + full);
    if (entry.isDirectory()) inventory(full);
    else {
      const bytes = fs.readFileSync(full);
      files[path.relative(output, full)] = {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }
  }
}
inventory(output);
fs.writeFileSync(
  path.join(output, "build-info.json"),
  JSON.stringify(
    {
      sourceCommit: commit,
      sourceVersion: pkg.version,
      historicalEvidence: evidencePath,
      consoleSource: "ui/agijobmanager-usdc.html",
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built ${Object.keys(files).length} static files at build/pages from ${commit}`,
);
