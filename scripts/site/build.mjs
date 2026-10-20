import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actualRepositoryCommit } from "../successor/source-identity.mjs";
import { createHash } from "node:crypto";
import { render } from "../../site/template.mjs";
import { loadLatestReportedDeployment } from "../../site/deployments.mjs";
import { renderWorkflows } from "../../site/workflows.mjs";
import { renderEmployer } from "../../site/employers.mjs";
import { buildSuccessor } from "../successor/build.mjs";
import { renderComputerReceipt } from '../../site/computer-receipt.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const output = path.join(root, "build/pages");
const commit = actualRepositoryCommit(root);
if (!/^[a-f0-9]{40}$/.test(commit))
  throw Error("Cannot identify source commit");
const pkg = json("package.json"),
  registry = json("config/usdc-deployment.json");
const { record: latestDeployment, recordPath: latestDeploymentPath, guidePath: latestDeploymentGuide } = loadLatestReportedDeployment(root);
const historicalEvidencePath = "config/mainnet/agi-jobs-usdc.json";
const historicalEvidence = json(historicalEvidencePath);
const snapshot = latestDeployment.reportedAuthoritySnapshot;
const address = /^0x[a-fA-F0-9]{40}$/;
if (snapshot.intakePaused !== true || snapshot.identityLocked !== false || snapshot.exactNftCount !== 0 ||
  snapshot.agentNftRequired !== false || snapshot.moderator.enabled !== true ||
  latestDeployment.explorerVerification.exactMatches !== 6 || latestDeployment.explorerVerification.retainedSimilarMatches !== 3 ||
  Object.values(latestDeployment.boundaries).some(value => value !== false))
  throw Error("Review homepage narrative against the changed reported deployment state");
if (historicalEvidence.chainId !== 1 || historicalEvidence.notLiveState !== true ||
  historicalEvidence.notDefaultConfiguration !== true || !address.test(historicalEvidence.manager) ||
  !address.test(historicalEvidence.helper) || historicalEvidence.manager === latestDeployment.manager ||
  historicalEvidence.connection.observed.helper.jobManager !== historicalEvidence.manager ||
  historicalEvidence.connection.observed.manager.ensJobPages !== historicalEvidence.helper ||
  !Number.isSafeInteger(historicalEvidence.connection.snapshot.number) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(historicalEvidence.recordDate) ||
  historicalEvidence.recordDate >= latestDeployment.recordDate)
  throw Error("Historical manager/helper evidence must remain a separate dated instance");
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
const successor = buildSuccessor(path.join(output, 'successor/downloads'));
fs.cpSync(path.join(root,'site/assets/computer-receipt'),path.join(output,'assets/computer-receipt'),{recursive:true,dereference:false});
fs.mkdirSync(path.join(output,'assets/successor'),{recursive:true});
fs.copyFileSync(path.join(root,'site/assets/successor/safe.mjs'),path.join(output,'assets/successor/safe.mjs'));
for (const name of ["app.mjs", "payments.mjs", "style.css", "home.css", "mark.svg", "employer.mjs", "employer-model.mjs", "employer.css", "workflows.css"])
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
    latestDeployment,
    latestDeploymentPath,
    latestDeploymentGuide,
    historicalEvidence,
    historicalEvidencePath,
  });
  const directory = lang === "en" ? output : path.join(output, lang);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html);
  const employerDirectory = path.join(directory, "employers");
  fs.mkdirSync(employerDirectory, { recursive: true });
  fs.writeFileSync(path.join(employerDirectory, "index.html"), renderEmployer(lang, { commit, version: pkg.version }));
  const workflowDirectory = path.join(directory, "workflows");
  fs.mkdirSync(workflowDirectory, { recursive: true });
  fs.writeFileSync(path.join(workflowDirectory, "index.html"), renderWorkflows(lang, { commit, version: pkg.version, sources: json("site/workflow-sources.json") }));
  const successorDirectory = path.join(directory, 'successor');
  fs.mkdirSync(successorDirectory, { recursive: true });
  fs.writeFileSync(path.join(successorDirectory, 'index.html'), successor.pages[lang]);
  const computerDirectory=path.join(directory,'computer-receipt');
  fs.mkdirSync(computerDirectory,{recursive:true});
  fs.writeFileSync(path.join(computerDirectory,'index.html'),renderComputerReceipt(lang,{commit,version:pkg.version}));
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
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://montrealai.github.io/AGIJobManager/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/fr/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/employers/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/fr/employers/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/workflows/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/fr/workflows/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/successor/</loc></url><url><loc>https://montrealai.github.io/AGIJobManager/fr/successor/</loc></url></urlset>',
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
// upload-pages-artifact intentionally omits dotfiles. Preserve local build
// markers separately instead of promising that they are deployed public files.
const buildOnlyFiles = { ".nojekyll": { ...files[".nojekyll"], reason: "Local branch-publishing marker; excluded by upload-pages-artifact." } };
delete files[".nojekyll"];
fs.writeFileSync(
  path.join(output, "build-info.json"),
  JSON.stringify(
    {
      sourceCommit: commit,
      sourceVersion: pkg.version,
      historicalEvidence: historicalEvidencePath,
      latestDeploymentPath,
      latestDeployment: {
        recordDate: latestDeployment.recordDate,
        recordType: latestDeployment.recordType,
        notLiveState: latestDeployment.notLiveState,
        manager: latestDeployment.manager,
        deployedSourceCommit: latestDeployment.source.commit,
        reportedAuthorityBlock: snapshot.blockNumber,
        exactMatches: latestDeployment.explorerVerification.exactMatches,
        retainedSimilarMatches: latestDeployment.explorerVerification.retainedSimilarMatches,
      },
      consoleSource: "ui/agijobmanager-usdc.html",
      successorSource: successor.sourceManifest,
      successorSourceVerification: successor.identityVerification,
      files,
      buildOnlyFiles,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built ${Object.keys(files).length} static files at build/pages from ${commit}`,
);
