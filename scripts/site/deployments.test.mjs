import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadLatestReportedDeployment } from "../../site/deployments.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = JSON.parse(fs.readFileSync(path.join(root, "config/mainnet/manager-8815-2026-10-17.json"), "utf8"));
function fixture(t, records = [current]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "manager-deployment-selection-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "config/mainnet"), { recursive: true });
  fs.mkdirSync(path.join(directory, "docs/deployments"), { recursive: true });
  records.forEach((record, index) => {
    fs.writeFileSync(path.join(directory, `config/mainnet/report-${index}.json`), JSON.stringify(record));
    fs.writeFileSync(path.join(directory, `docs/deployments/MAINNET_MANAGER_${record.recordDate}.md`), "Dated report fixture\n");
  });
  return directory;
}

test("current primary selection is the October 17 owner report, separate from the October 10 schema", () => {
  const selected = loadLatestReportedDeployment(root);
  assert.equal(selected.record.manager, "0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8");
  assert.equal(selected.record.reportedAuthoritySnapshot.blockNumber, 26214525);
  assert.equal(selected.recordPath, "config/mainnet/manager-8815-2026-10-17.json");
  assert.equal(selected.guidePath, "docs/deployments/MAINNET_MANAGER_2026-10-17.md");
});

test("a later valid report becomes primary regardless of filename or directory order", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18";
  const directory = fixture(t, [later, current]);
  const selected = loadLatestReportedDeployment(directory);
  assert.equal(selected.record.recordDate, later.recordDate);
  assert.equal(selected.recordPath, "config/mainnet/report-0.json");
  assert.equal(selected.guidePath, "docs/deployments/MAINNET_MANAGER_2026-10-18.md");
});

test("equal latest dates are ambiguous rather than silently resolved by filename", t => {
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, current])), /Ambiguous latest/);
});

test("an invalid matching report blocks fallback to an older valid report", t => {
  const later = structuredClone(current); later.recordDate = "2026-10-18"; later.notLiveState = false;
  assert.throws(() => loadLatestReportedDeployment(fixture(t, [current, later])), /must not imply live state/);
});

for (const [name, change] of [
  ["chain", record => { record.chainId = 11155111; }],
  ["report provenance", record => { record.recordType = "fresh-rpc-observation"; }],
  ["default target", record => { record.notDefaultConfiguration = false; }],
  ["invalid date", record => { record.recordDate = "2026-02-30"; }],
  ["source", record => { record.source.commit = "main"; }],
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
  fs.unlinkSync(path.join(directory, "config/mainnet/report-0.json"));
  assert.throws(() => loadLatestReportedDeployment(directory), /No valid owner-reported/);
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
