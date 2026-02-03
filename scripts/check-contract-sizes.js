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

const oversized = [];
const artifacts = fs.readdirSync(artifactsDir).filter((file) => file.endsWith(".json"));
for (const file of artifacts) {
  const artifactPath = path.join(artifactsDir, file);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  if (artifact.sourcePath && artifact.sourcePath.includes(`${path.sep}contracts${path.sep}test${path.sep}`)) {
    continue;
  }
  const name = artifact.contractName || path.basename(file, ".json");
  const sizeBytes = deployedSizeBytes(artifact);
  console.log(`${name} deployedBytecode size: ${sizeBytes} bytes`);
  if (sizeBytes > MAX_RUNTIME_BYTES) {
    oversized.push({ name, sizeBytes });
  }
}

if (oversized.length) {
  console.error(`Contracts exceeding ${MAX_RUNTIME_BYTES} bytes:`);
  for (const { name, sizeBytes } of oversized) {
    console.error(`- ${name}: ${sizeBytes} bytes`);
  }
  process.exit(1);
}
