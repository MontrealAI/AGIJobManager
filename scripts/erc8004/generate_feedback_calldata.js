/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function argValue(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function buildSignals(agent) {
  const totals = agent.totals || {};
  const rates = agent.rates || {};

  return [
    { tag1: "successRate", ...rates.successRate },
    { tag1: "disputeRate", ...rates.disputeRate },
    { tag1: "jobsCompleted", value: totals.jobsCompleted || 0, valueDecimals: 0 },
    { tag1: "jobsAssigned", value: totals.jobsAssigned || 0, valueDecimals: 0 },
    { tag1: "agentWins", value: totals.agentWins || 0, valueDecimals: 0 },
    { tag1: "employerWins", value: totals.employerWins || 0, valueDecimals: 0 },
    { tag1: "revenues", value: totals.revenues?.value || "0", valueDecimals: 0 },
  ].filter((signal) => signal.value !== undefined);
}

function requireFile(filePath) {
  if (!filePath) throw new Error("Missing METRICS_JSON (or --metrics).");
  if (!fs.existsSync(filePath)) throw new Error(`Metrics JSON not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  if (process.env.SEND_TX && process.env.SEND_TX.toLowerCase() === "true") {
    throw new Error("On-chain submission is not implemented in this helper. Use official ERC-8004 tooling instead.");
  }

  const metricsPath = argValue("metrics") || process.env.METRICS_JSON;
  const outDir = argValue("out-dir") || process.env.OUT_DIR || path.join("integrations", "erc8004", "output");

  const metrics = requireFile(metricsPath);
  const agents = metrics.agents || [];

  const actions = agents.map((agent) => ({
    agentAddress: agent.address,
    identityLookup: {
      type: "erc8004Registry",
      strategy: "resolveByOwnerAddress",
      notes: "Resolve the ERC-8004 identity token owned by this address before submitting feedback.",
    },
    signals: buildSignals(agent).map((signal) => ({
      ...signal,
      evidence: "TODO: add evidence hash or URI",
    })),
  }));

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceMetrics: metricsPath,
      chainId: metrics.metadata?.chainId,
      networkId: metrics.metadata?.networkId,
      network: metrics.metadata?.network,
      sourceContract: metrics.metadata?.sourceContract,
    },
    actions,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `erc8004-feedback-actions-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Generated feedback actions at ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
