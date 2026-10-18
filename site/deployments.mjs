import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const evidenceRevision = "d5d4ad93f00a3dfe6439b0f32edb1a2fcf70e0c2";
const reviewedEvidence = {
  recordPath: "config/mainnet/manager-8815-2026-10-17.json",
  guidePath: "docs/deployments/MAINNET_MANAGER_2026-10-17.md",
  files: {
    "config/mainnet/manager-8815-2026-10-17.json": "06def03f2844edeb2f93203edb028a37085c83f79aedd91857e8b1ae9af922c0",
    "docs/deployments/MAINNET_MANAGER_2026-10-17.md": "0d95f18e6b25dea3a514dd1c32ae421a1d527567daab6b90689f347cb13af14e",
    "docs/deployments/MAINNET_USDC_2026-10-10.md": "b67f530d31b35b54e18621ea195f9a36663166e926a9bdad8767afb201cce411",
  },
};

const address = /^0x[a-fA-F0-9]{40}$/;
const hash = /^0x[a-fA-F0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const requireRecord = (condition, recordPath, message) => {
  if (!condition) throw Error(`${recordPath}: ${message}`);
};

function validate(record, recordPath) {
  const check = (condition, message) => requireRecord(condition, recordPath, message);
  check(record.chainId === 1 && record.recordType === "owner-reported-execution-and-readback-projection", "Expected an Ethereum owner-reported deployment");
  check(record.notLiveState === true && record.notDefaultConfiguration === true, "Reported evidence must not imply live state or transaction defaults");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(record.recordDate) ? new Date(record.recordDate + "T00:00:00.000Z") : null;
  check(date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === record.recordDate, "Invalid record date");
  check(address.test(record.manager) && commit.test(record.source?.commit) && commit.test(record.source?.tree), "Invalid Manager or deployed-source identity");
  const snapshot = record.reportedAuthoritySnapshot;
  check(snapshot && Number.isSafeInteger(snapshot.blockNumber) && snapshot.blockNumber > 0 && hash.test(snapshot.blockHash) && snapshot.blockReportedFinalized === true, "Invalid reported authority block");
  check(address.test(snapshot.owner) && address.test(snapshot.pendingOwner) && address.test(snapshot.moderator?.address), "Invalid reported authority address");
  check(snapshot.owner === "0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99" && snapshot.pendingOwner === "0x0000000000000000000000000000000000000000", "Reported authority requires review of governor wording");
  check([snapshot.intakePaused, snapshot.identityLocked, snapshot.agentNftRequired, snapshot.moderator.enabled].every(value => typeof value === "boolean") && Number.isSafeInteger(snapshot.exactNftCount) && snapshot.exactNftCount >= 0, "Invalid reported configuration");
  check(record.provenance?.evidenceType === "owner-supplied-terminal-reports" && record.provenance.independentlyReobservedForThisRecord === false, "Owner reports must retain their observation limits");
  const boundaries = ["intakeActivationAuthorized", "livePaidWorkQualified", "latestSourceReleaseQualified", "ensHelperAttachmentEstablishedByThisRecord", "fullFinancialAndPolicyReadinessEstablished", "previousDeploymentsChanged"];
  check(record.boundaries && boundaries.every(name => Object.hasOwn(record.boundaries, name) && typeof record.boundaries[name] === "boolean") && Object.values(record.boundaries).every(value => typeof value === "boolean"), "Missing deployment evidence boundaries");
  check(snapshot.intakePaused === true && snapshot.identityLocked === false && snapshot.agentNftRequired === false && snapshot.exactNftCount === 0 && snapshot.moderator.enabled === true && Object.values(record.boundaries).every(value => value === false), "Reported state requires review of deployment display wording");
  const contracts = record.contracts;
  check(Array.isArray(contracts) && contracts.length === 9 && record.deployment?.createdCount === 9 && record.deployment.finalizedCount === 9, "Expected nine reported finalized creations");
  const addresses = new Set(), transactions = new Set(), names = new Set();
  for (const [index, contract] of contracts.entries()) {
    check(contract.index === index && typeof contract.name === "string" && contract.name.length > 0 && !names.has(contract.name), "Contract names or ordered indices differ");
    check(address.test(contract.address) && !addresses.has(contract.address.toLowerCase()) && hash.test(contract.deploymentTransactionHash) && !transactions.has(contract.deploymentTransactionHash.toLowerCase()) && hash.test(contract.reportedRuntimeCodeHash) && contract.reportedFinalized === true, "Invalid or duplicate reported creation");
    check(contract.explorerCodeUrl === `https://etherscan.io/address/${contract.address}#code` && contract.deploymentTransactionUrl === `https://etherscan.io/tx/${contract.deploymentTransactionHash}`, "Contract explorer links differ from its identity");
    check(["EXACT_MATCH", "SIMILAR_MATCH_SKIPPED"].includes(contract.explorerMatchStatus), "Unsupported explorer match status");
    if (contract.explorerMatchStatus === "EXACT_MATCH") check(contract.verificationSubmissionAttempted === true && contract.explorerAcceptedSubmission === true, "Exact Match submission evidence differs");
    else check(contract.verificationSubmissionAttempted === false && contract.explorerAcceptedSubmission === false && address.test(contract.similarMatchTarget) && contract.publishedBundleComparison === "NOT_EVALUATED_FOR_SKIPPED_SIMILAR_MATCH", "Retained Similar Match must not imply exact verification");
    names.add(contract.name); addresses.add(contract.address.toLowerCase()); transactions.add(contract.deploymentTransactionHash.toLowerCase());
  }
  check(contracts.at(-1).name === "AGIJobManager" && contracts.at(-1).address === record.manager, "Manager is not the final recorded creation");
  const exact = contracts.filter(contract => contract.explorerMatchStatus === "EXACT_MATCH").length;
  const similar = contracts.length - exact, explorer = record.explorerVerification;
  check(explorer?.total === contracts.length && explorer.exactMatches === exact && explorer.retainedSimilarMatches === similar && explorer.allNineAccountedFor === true && explorer.allNineExact === (exact === contracts.length), "Explorer summary differs from per-contract evidence");
  check(exact === 6 && similar === 3, "Explorer results require review of deployment display wording");
  check(record.verificationLinks?.managerCode === `https://etherscan.io/address/${record.manager}#code` && record.verificationLinks.authorityBlock === `https://etherscan.io/block/${snapshot.blockNumber}`, "Manager or authority-block explorer link differs");
}

export function loadLatestReportedDeployment(root) {
  const directory = path.join(root, "config/mainnet");
  const candidates = [];
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort()) {
    const recordPath = "config/mainnet/" + name, filename = path.join(root, recordPath);
    if (!fs.statSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) throw Error(`${recordPath}: Deployment records must be regular files`);
    const record = JSON.parse(fs.readFileSync(filename, "utf8"));
    requireRecord(record.recordType !== "owner-reported-execution-and-readback-projection" || record.schema === "agijobmanager-recorded-deployment-v2", recordPath, "Unsupported owner-reported deployment schema requires review");
    if (record.schema !== "agijobmanager-recorded-deployment-v2") continue;
    validate(record, recordPath);
    const guidePath = `docs/deployments/MAINNET_MANAGER_${record.recordDate}.md`, guide = path.join(root, guidePath);
    requireRecord(fs.existsSync(guide) && fs.lstatSync(guide).isFile() && !fs.lstatSync(guide).isSymbolicLink(), recordPath, "Dated deployment guide is missing or indirect");
    candidates.push({ record, recordPath, guidePath });
  }
  if (candidates.length === 0) throw Error("No valid owner-reported Ethereum Manager deployment is recorded");
  const latestDate = candidates.map(candidate => candidate.record.recordDate).sort().at(-1);
  const latest = candidates.filter(candidate => candidate.record.recordDate === latestDate);
  if (latest.length !== 1) throw Error(`Ambiguous latest Manager deployment reports for ${latestDate}`);
  const selected = latest[0];
  requireRecord(selected.recordPath === reviewedEvidence.recordPath && selected.guidePath === reviewedEvidence.guidePath, selected.recordPath, "Selected report requires an explicitly reviewed immutable evidence pin");
  for (const [name, digest] of Object.entries(reviewedEvidence.files)) {
    const filename = path.join(root, name);
    requireRecord(fs.existsSync(filename) && fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), selected.recordPath, "Pinned evidence is missing or indirect: " + name);
    requireRecord(createHash("sha256").update(fs.readFileSync(filename)).digest("hex") === digest, selected.recordPath, "Pinned evidence bytes differ: " + name);
  }
  return { ...selected, evidenceRevision };
}
