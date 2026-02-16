#!/usr/bin/env node
/* eslint-disable no-console */
function usage() {
  console.log(`Usage:
  node scripts/etherscan/cli.js --action <name> [options]

Actions:
  convert | approve | createJob | applyForJob | requestJobCompletion | validateJob | disapproveJob | resolveDisputeWithCode
`);
}
const arg = (name, d) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d;
};
const need = (name) => {
  const v = arg(name);
  if (v === undefined) throw new Error(`Missing --${name}`);
  return v;
};
const parseAmount = (human, decimals) => {
  if (!/^\d+(\.\d+)?$/.test(human)) throw new Error(`Invalid --amount: ${human}`);
  const [w, f = ""] = human.split(".");
  if (f.length > decimals) throw new Error(`Too many decimals in amount. Max ${decimals}`);
  const s = 10n ** BigInt(decimals);
  return BigInt(w) * s + BigInt((f + "0".repeat(decimals)).slice(0, decimals));
};
const parseDuration = (v) => {
  if (/^\d+$/.test(v)) return BigInt(v);
  const m = v.match(/^(\d+)([smhdw])$/);
  if (!m) throw new Error(`Invalid --duration: ${v}`);
  const mult = { s: 1n, m: 60n, h: 3600n, d: 86400n, w: 604800n };
  return BigInt(m[1]) * mult[m[2]];
};
const parseProof = (raw) => {
  const p = JSON.parse(raw || "[]");
  if (!Array.isArray(p)) throw new Error("--proof must be JSON array");
  for (const x of p) if (!/^0x[0-9a-fA-F]{64}$/.test(x)) throw new Error(`Invalid proof item: ${x}`);
  return p;
};
const checklist = (action) => {
  console.log("\nPre-flight checklist:");
  [
    "Read paused() and settlementPaused() first.",
    "Confirm AGI token balance and allowance.",
    "Read getJobCore/getJobValidation for current job status.",
    "Confirm all time windows are still open."
  ].forEach((x) => console.log(`- [ ] ${x}`));
  if (action === "resolveDisputeWithCode") console.log("- [ ] Moderator role required.");
};
const block = (title, data) => {
  console.log(`\n=== ${title} ===`);
  Object.entries(data).forEach(([k, v]) => console.log(`${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`));
};

(function main() {
  try {
    const action = arg("action");
    if (!action) return usage();
    const decimals = Number(arg("decimals", "18"));
    const amount = arg("amount");
    const duration = arg("duration");
    const amountBase = amount ? parseAmount(amount, decimals).toString() : null;
    const durSecs = duration ? parseDuration(duration).toString() : null;

    if (action === "convert") {
      return block("Conversion", {
        decimals,
        ...(amount ? { humanAmount: amount, baseUnits: amountBase } : {}),
        ...(duration ? { durationInput: duration, durationSeconds: durSecs } : {})
      });
    }

    if (action === "approve") {
      checklist(action);
      return block("Copy/paste into ERC20 approve(spender,amount)", {
        spender: need("spender"),
        amount: amountBase,
        amountHuman: `${amount} @ ${decimals} decimals`
      });
    }

    if (action === "createJob") {
      checklist(action);
      return block("Copy/paste into AGIJobManager.createJob", {
        _jobSpecURI: need("jobSpecURI"),
        _payout: amountBase,
        _duration: durSecs,
        _details: need("details")
      });
    }

    if (["applyForJob", "validateJob", "disapproveJob"].includes(action)) {
      checklist(action);
      return block(`Copy/paste into AGIJobManager.${action}`, {
        _jobId: need("jobId"),
        subdomain: arg("subdomain", ""),
        proof: parseProof(arg("proof", "[]"))
      });
    }

    if (action === "requestJobCompletion") {
      checklist(action);
      return block("Copy/paste into AGIJobManager.requestJobCompletion", {
        _jobId: need("jobId"),
        _jobCompletionURI: need("jobCompletionURI")
      });
    }

    if (action === "resolveDisputeWithCode") {
      checklist(action);
      const code = need("resolutionCode");
      if (!["0", "1", "2"].includes(code)) throw new Error("resolutionCode must be 0, 1, or 2");
      return block("Copy/paste into AGIJobManager.resolveDisputeWithCode", {
        _jobId: need("jobId"),
        resolutionCode: code,
        reason: need("reason")
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
