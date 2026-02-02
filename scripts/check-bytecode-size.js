const fs = require("fs");
const path = require("path");

const MAX_RUNTIME_BYTES = 24576;
const TARGET_CONTRACTS = ["AGIJobManager"];
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
for (const contractName of TARGET_CONTRACTS) {
  const artifactPath = path.join(artifactsDir, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Missing artifact for ${contractName}: ${artifactPath}`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const sizeBytes = deployedSizeBytes(artifact);
  console.log(`${contractName} deployedBytecode size: ${sizeBytes} bytes`);
  if (sizeBytes > MAX_RUNTIME_BYTES) {
    oversized.push({ name: contractName, sizeBytes });
  }
}

if (oversized.length) {
  console.error(`Contracts exceeding ${MAX_RUNTIME_BYTES} bytes:`);
  for (const { name, sizeBytes } of oversized) {
    console.error(`- ${name}: ${sizeBytes} bytes`);
  }
  process.exit(1);
}
