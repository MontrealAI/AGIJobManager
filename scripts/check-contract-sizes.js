const fs = require("fs");
const path = require("path");

const MAX_RUNTIME_BYTES = 24576;
const targets = ["AGIJobManager", "TestableAGIJobManager"];

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

let failed = false;
for (const name of targets) {
  const artifactPath = path.join(__dirname, "..", "build", "contracts", `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Missing Truffle artifact: ${artifactPath}`);
    failed = true;
    continue;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const sizeBytes = deployedSizeBytes(artifact);
  console.log(`${name} deployedBytecode size: ${sizeBytes} bytes`);
  if (name === "AGIJobManager" && sizeBytes > MAX_RUNTIME_BYTES) {
    console.error(
      `AGIJobManager deployed bytecode exceeds ${MAX_RUNTIME_BYTES} bytes: ${sizeBytes}`
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
