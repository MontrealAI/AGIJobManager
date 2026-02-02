const fs = require("fs");
const path = require("path");

const MAX_RUNTIME_BYTES = 24576;
const artifactsDir = path.join(__dirname, "..", "build", "contracts");

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

if (!fs.existsSync(artifactsDir)) {
  console.error(`Missing Truffle artifacts directory: ${artifactsDir}`);
  process.exit(1);
}

const failures = [];
for (const file of fs.readdirSync(artifactsDir)) {
  if (!file.endsWith(".json")) continue;
  const artifactPath = path.join(artifactsDir, file);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const sizeBytes = deployedSizeBytes(artifact);
  if (!sizeBytes) continue;
  const name = artifact.contractName || path.basename(file, ".json");
  console.log(`${name} deployedBytecode size: ${sizeBytes} bytes`);
  if (sizeBytes > MAX_RUNTIME_BYTES) {
    failures.push({ name, sizeBytes });
  }
}

if (failures.length) {
  console.error(`Deployed bytecode exceeds ${MAX_RUNTIME_BYTES} bytes:`);
  for (const { name, sizeBytes } of failures) {
    console.error(`- ${name}: ${sizeBytes} bytes`);
  }
  process.exit(1);
}
