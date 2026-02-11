const assert = require("assert");
const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "..", "build", "contracts", "AGIJobManager.json");

assert.ok(
  fs.existsSync(artifactPath),
  "Missing build artifact. Run `npm run build` before executing tests."
);

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

assert.ok(artifact.bytecode && artifact.bytecode.length > 2, "Missing contract bytecode.");
assert.ok(Array.isArray(artifact.abi), "ABI should be an array.");

const functionNames = new Set(
  artifact.abi.filter((item) => item.type === "function").map((item) => item.name)
);

["createJob", "applyForJob", "resolveDisputeWithCode"].forEach((name) => {
  assert.ok(functionNames.has(name), `Missing expected function: ${name}`);
});

const eventNames = new Set(
  artifact.abi.filter((item) => item.type === "event").map((item) => item.name)
);

["JobCreated", "JobCompleted", "DisputeResolvedWithCode"].forEach((name) => {
  assert.ok(eventNames.has(name), `Missing expected event: ${name}`);
});

console.log("ABI smoke test passed.");
