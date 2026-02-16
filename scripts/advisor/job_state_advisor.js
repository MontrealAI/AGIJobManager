#!/usr/bin/env node
/* eslint-disable no-console */

function readInput() {
  const rawArg = process.argv[2];
  if (rawArg) return JSON.parse(rawArg);
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const parsed = JSON.parse(data);
      analyze(parsed);
    } catch (e) {
      console.error(`Invalid JSON input: ${e.message}`);
      process.exit(1);
    }
  });
  return null;
}

function t(x) { return BigInt(String(x)); }

function analyze(i) {
  const now = t(i.nowTs);
  const core = i.jobCore || {};
  const val = i.jobValidation || {};
  const cfg = i.config || {};

  const assignedAt = t(core.assignedAt || 0);
  const duration = t(core.duration || 0);
  const completionRequestedAt = t(val.completionRequestedAt || 0);
  const disputedAt = t(val.disputedAt || 0);
  const approvals = t(val.validatorApprovals || 0);
  const disapprovals = t(val.validatorDisapprovals || 0);
  const reviewPeriod = t(cfg.completionReviewPeriod || 604800);
  const disputeReview = t(cfg.disputeReviewPeriod || 1209600);
  const voteQuorum = t(cfg.voteQuorum || 3);

  const totalVotes = approvals + disapprovals;
  const assigned = core.assignedAgent && core.assignedAgent !== "0x0000000000000000000000000000000000000000";

  const lines = [];
  const actions = [];

  if (core.completed) lines.push("State: COMPLETED (terminal)");
  else if (core.expired) lines.push("State: EXPIRED (terminal)");
  else if (core.disputed) lines.push("State: DISPUTED");
  else if (!assigned) lines.push("State: OPEN (unassigned)");
  else if (!val.completionRequested) lines.push("State: ASSIGNED_IN_PROGRESS");
  else lines.push("State: COMPLETION_REQUESTED");

  if (assigned && !val.completionRequested && !core.completed && !core.expired && !core.disputed) {
    const expireAt = assignedAt + duration;
    actions.push(`expireJob eligible after: ${expireAt.toString()} (now=${now.toString()})`);
  }

  if (val.completionRequested && !core.completed && !core.expired && !core.disputed) {
    const reviewEnds = completionRequestedAt + reviewPeriod;
    actions.push(`review window ends at: ${reviewEnds.toString()}`);
    actions.push(`finalizeJob after review end: ${reviewEnds.toString()}`);
    if (totalVotes < voteQuorum || approvals === disapprovals) {
      actions.push("If finalized now (after review), outcome is dispute (under quorum or tie), unless total votes = 0 then agent-win path.");
    } else if (approvals > disapprovals) {
      actions.push("If finalized after review, expected outcome: agent win.");
    } else {
      actions.push("If finalized after review, expected outcome: employer refund.");
    }
    actions.push(`disputeJob latest time: ${reviewEnds.toString()} (must be <= this timestamp).`);
  }

  if (core.disputed) {
    const staleAt = disputedAt + disputeReview;
    actions.push(`resolveStaleDispute(owner) eligible after: ${staleAt.toString()}`);
    actions.push("resolveDisputeWithCode(moderator): code 1=agent win, 2=employer refund, 0=no-op event.");
  }

  console.log("=== Offline Job State Advisor ===");
  lines.forEach((l) => console.log(l));
  console.log("\nValid actions / timing:");
  if (!actions.length) console.log("- None (already terminal or missing fields)");
  actions.forEach((a) => console.log(`- ${a}`));
}

const parsed = readInput();
if (parsed) {
  try {
    analyze(parsed);
  } catch (e) {
    console.error(`Failed to analyze input: ${e.message}`);
    process.exit(1);
  }
}
