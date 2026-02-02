const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const artifactPath = path.join(rootDir, "build", "contracts", "AGIJobManager.json");
const requiredPath = path.join(rootDir, "docs", "ui", "abi", "ui_required_interface.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function buildFunctionIndex(abi) {
  const index = new Map();
  for (const item of abi) {
    if (item.type !== "function") continue;
    const name = item.name;
    const count = Array.isArray(item.inputs) ? item.inputs.length : 0;
    if (!index.has(name)) {
      index.set(name, new Set());
    }
    index.get(name).add(count);
  }
  return index;
}

function buildEventIndex(abi) {
  const events = new Set();
  for (const item of abi) {
    if (item.type === "event" && item.name) {
      events.add(item.name);
    }
  }
  return events;
}

function buildErrorIndex(abi) {
  const errors = new Set();
  for (const item of abi) {
    if (item.type === "error" && item.name) {
      errors.add(item.name);
    }
  }
  return errors;
}

function main() {
  const required = readJson(requiredPath);
  const artifact = readJson(artifactPath);
  const abi = artifact.abi;

  if (!Array.isArray(abi)) {
    throw new Error("ABI missing from build artifact.");
  }

  const functionsIndex = buildFunctionIndex(abi);
  const eventsIndex = buildEventIndex(abi);
  const errorsIndex = buildErrorIndex(abi);

  const missingFunctions = [];
  const missingEvents = [];
  const missingErrors = [];

  const requiredFunctions = required.functions || {};
  for (const [name, inputCount] of Object.entries(requiredFunctions)) {
    const counts = functionsIndex.get(name);
    if (!counts || !counts.has(Number(inputCount))) {
      missingFunctions.push(`${name}(${inputCount})`);
    }
  }

  const requiredEvents = required.events || [];
  for (const name of requiredEvents) {
    if (!eventsIndex.has(name)) {
      missingEvents.push(name);
    }
  }

  const requiredErrors = required.errors || [];
  for (const name of requiredErrors) {
    if (!errorsIndex.has(name)) {
      missingErrors.push(name);
    }
  }

  if (missingFunctions.length || missingEvents.length || missingErrors.length) {
    const lines = ["UI ABI drift detected:"];
    if (missingFunctions.length) {
      lines.push(`- Missing functions: ${missingFunctions.join(", ")}`);
    }
    if (missingEvents.length) {
      lines.push(`- Missing events: ${missingEvents.join(", ")}`);
    }
    if (missingErrors.length) {
      lines.push(`- Missing errors: ${missingErrors.join(", ")}`);
    }
    lines.push("Rebuild artifacts with `truffle compile` and update UI ABI if needed.");
    throw new Error(lines.join("\n"));
  }

  process.stdout.write("UI ABI check passed.\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
