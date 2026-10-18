import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadLatestReportedDeployment } from "../../site/deployments.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = JSON.parse(fs.readFileSync(path.join(root, "config/mainnet/manager-8815-2026-10-17.json"), "utf8"));
const datedGuide = fs.readFileSync(path.join(root, "docs/deployments/MAINNET_MANAGER_2026-10-17.md"));
const historicalGuide = fs.readFileSync(path.join(root, "docs/deployments/MAINNET_USDC_2026-10-10.md"));
function fixture(t, records = [current]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "manager-deployment-selection-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "config/mainnet"), { recursive: true });
  fs.mkdirSync(path.join(directory, "docs/deployments"), { recursive: true });
  fs.writeFileSync(path.join(directory, "docs/deployments/MAINNET_USDC_2026-10-10.md"), historicalGuide);
  records.forEach((record, index) => {
    const name = index === 0 && record.recordDate === current.recordDate ? "manager-8815-2026-10-17.json" : `report-${index}.json`;
    fs.writeFileSync(path.join(directory, "config/mainnet", name), JSON.stringify(record, null, 2) + "\n");
    fs.writeFileSync(path.join(directory, `docs/deployments/MAINNET_MANAGER_${record.recordDate}.md`), record.recordDate === current.recordDate ? datedGuide : "Unreviewed future guide\n");
  });
  return directory;
}

test("current primary selection is the October 17 owner report, separate from the October 10 schema", () => {
  const selected = loadLatestReportedDeployment(root);
  assert.equal(selected.record.manager, "0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8");
  assert.equal(selected.record.reportedAuthoritySnapshot.blockNumber, 26214525);
  assert.equal(selected.recordPath, "config/mainnet/manager-8815-2026-10-17.json");
  assert.equal(selected.guidePath, "docs/deployments/MAINNET_MANAGER_2026-10-17.md");
  assert.equal(selected.evidenceRevision, "d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2");
});

test("a coherent later report requires a reviewed immutable evidence pin before becoming public", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18";
  const directory = fixture(t, [later, current]);
  assert.throws(() => loadLatestReportedDeployment(directory), /explicitly reviewed immutable evidence pin/);
});

test("equal latest dates are ambiguous rather than silently resolved by filename", t => {
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, current])), /Ambiguous latest/);
});

test("an invalid matching report blocks fallback to an older valid report", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18"; later.notLiveState = false;
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /must not imply live state/);
});

test("a recognized future owner report with an unsupported schema blocks stale fallback", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18"; later.schema = "agijobmanager-recorded-deployment-v3";
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /Unsupported owner-reported deployment schema/);
});

test("unrelated configuration and the historical October 10 schema remain separate", t => {
  const directory = fixture(t);
  fs.writeFileSync(path.join(directory, "config/mainnet/generic.json"), JSON.stringify({ schema: "generic-config-v3", recordType: "configuration" }));
  fs.copyFileSync(path.join(root, "config/mainnet/agi-jobs-usdc.json"), path.join(directory, "config/mainnet/agi-jobs-usdc.json"));
  assert.equal(loadLatestReportedDeployment(directory).record.manager, current.manager);
});

for (const [name, change] of [
  ["chain", record => { record.chainId = 11155111; }],
  ["report provenance", record => { record.recordType = "fresh-rpc-observation"; }],
  ["default target", record => { record.notDefaultConfiguration = false; }],
  ["invalid date", record => { record.recordDate = "2026-02-30"; }],
  ["source", record => { record.source.commit = "main"; }],
  ["different governor", record => { record.reportedAuthoritySnapshot.owner = "0x1111111111111111111111111111111111111111"; }],
  ["pending handover", record => { record.reportedAuthoritySnapshot.pendingOwner = "0x2222222222222222222222222222222222222222"; }],
  ["authority block", record => { record.reportedAuthoritySnapshot.blockHash = "0x00"; }],
  ["independent observation claim", record => { record.provenance.independentlyReobservedForThisRecord = true; }],
  ["missing activation boundary", record => { delete record.boundaries.intakeActivationAuthorized; }],
  ["missing creation", record => { record.contracts.pop(); }],
  ["duplicate address", record => { record.contracts[1].address = record.contracts[0].address; }],
  ["duplicate transaction", record => { record.contracts[1].deploymentTransactionHash = record.contracts[0].deploymentTransactionHash; }],
  ["wrong contract code link", record => { record.contracts[0].explorerCodeUrl = record.verificationLinks.managerCode; }],
  ["wrong creation link", record => { record.contracts[0].deploymentTransactionUrl = record.contracts[1].deploymentTransactionUrl; }],
  ["Similar Match relabeled exact", record => { record.contracts[2].explorerMatchStatus = "EXACT_MATCH"; }],
  ["all-Exact summary", record => { record.explorerVerification.allNineExact = true; }],
  ["wrong match count", record => { record.explorerVerification.exactMatches = 9; }],
  ["wrong primary explorer", record => { record.verificationLinks.managerCode = record.contracts[0].explorerCodeUrl; }],
]) test(`reject changed ${name} before rendering deployment evidence`, t => {
  const record = structuredClone(current); change(record);
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [record])));
});

test("a missing dated guide and a missing v2 report fail closed", t => {
  const directory = fixture(t);
  fs.unlinkSync(path.join(directory, "docs/deployments/MAINNET_MANAGER_2026-10-17.md"));
  assert.throws(() => loadLatestReportedDeployment(directory), /guide is missing/);
  fs.unlinkSync(path.join(directory, "config/mainnet/manager-8815-2026-10-17.json"));
  assert.throws(() => loadLatestReportedDeployment(directory), /No valid owner-reported/);
});

test("the reviewed fixture exposes only the immutable revision whose evidence bytes match", t => {
  assert.equal(loadLatestReportedDeployment(fixture(t)).evidenceRevision, "d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2");
});

for (const name of ["config/mainnet/manager-8815-2026-10-17.json", "docs/deployments/MAINNET_MANAGER_2026-10-17.md", "docs/deployments/MAINNET_USDC_2026-10-10.md"]) test(`changed pinned evidence is rejected: ${name}`, t => {
  const directory = fixture(t), filename = path.join(directory, name);
  fs.appendFileSync(filename, "\n");
  assert.throws(() => loadLatestReportedDeployment(directory), /Pinned evidence bytes differ/);
});

test("an unreviewed alias for the same report cannot generate links at the pinned revision", t => {
  const directory = fixture(t);
  fs.renameSync(path.join(directory, "config/mainnet/manager-8815-2026-10-17.json"), path.join(directory, "config/mainnet/alias.json"));
  assert.throws(() => loadLatestReportedDeployment(directory), /explicitly reviewed immutable evidence pin/);
});

for (const field of ["owner", "pendingOwner"]) test(`a future ${field} change blocks the fixed Ledger-governor wording`, t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18";
  later.reportedAuthoritySnapshot[field] = "0x1111111111111111111111111111111111111111";
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /review of governor wording/);
});

for (const [name, change] of [
  ["open intake", record => { record.reportedAuthoritySnapshot.intakePaused = false; }],
  ["locked identity", record => { record.reportedAuthoritySnapshot.identityLocked = true; }],
  ["required Agent NFT", record => { record.reportedAuthoritySnapshot.agentNftRequired = true; }],
  ["registered NFT collection", record => { record.reportedAuthoritySnapshot.exactNftCount = 1; }],
  ["disabled moderator", record => { record.reportedAuthoritySnapshot.moderator.enabled = false; }],
  ...Object.keys(current.boundaries).map(name => [name, record => { record.boundaries[name] = true; }]),
]) test(`a future report with ${name} requires reviewed presentation wording`, t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18"; change(later);
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /review of deployment display wording/);
});

test("a coherent future all-Exact inventory also requires reviewed presentation wording", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18";
  for (const contract of later.contracts) {
    contract.explorerMatchStatus = "EXACT_MATCH";
    contract.verificationSubmissionAttempted = true;
    contract.explorerAcceptedSubmission = true;
  }
  Object.assign(later.explorerVerification, { exactMatches: 9, retainedSimilarMatches: 0, allNineExact: true });
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /review of deployment display wording/);
});
