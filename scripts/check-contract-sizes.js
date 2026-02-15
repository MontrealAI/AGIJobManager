const fs = require("fs");
const path = require("path");

const MAX_RUNTIME_BYTES = 24575;
const artifactsDir = path.join(__dirname, "..", "build", "contracts");
const IGNORED_CONTRACTS = new Set(["ReputationHarness"]);

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object;
  if (!deployedBytecode) {
    throw new Error(
      `Missing deployedBytecode in artifact for ${artifact.contractName || "unknown"}`
    );
  }
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  if (!hex) {
    return 0;
  }
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
  const name = artifact.contractName || path.basename(file, ".json");
  const sizeBytes = deployedSizeBytes(artifact);
  console.log(`${name} deployedBytecode size: ${sizeBytes} bytes`);
  if (sizeBytes > MAX_RUNTIME_BYTES && !IGNORED_CONTRACTS.has(name)) {
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
