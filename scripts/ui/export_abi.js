const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const artifactPath = path.join(rootDir, "build", "contracts", "AGIJobManager.json");
const outputDir = path.join(rootDir, "docs", "ui", "abi");
const outputPath = path.join(outputDir, "AGIJobManager.json");

function readArtifact() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Missing build artifact at ${artifactPath}. Run "truffle compile" first.`,
    );
  }
  const raw = fs.readFileSync(artifactPath, "utf8");
  return JSON.parse(raw);
}

function buildAbiExport(artifact) {
  if (!Array.isArray(artifact.abi)) {
    throw new Error("Artifact ABI is missing or invalid.");
  }
  const compiler = artifact.compiler && artifact.compiler.name && artifact.compiler.version
    ? {
        name: artifact.compiler.name,
        version: artifact.compiler.version,
      }
    : undefined;
  const exportPayload = {
    contractName: artifact.contractName || "AGIJobManager",
    ...(compiler ? { compiler } : {}),
    abi: artifact.abi,
  };
  return JSON.stringify(exportPayload, null, 2) + "\n";
}

function main() {
  const artifact = readArtifact();
  const payload = buildAbiExport(artifact);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, payload);
  process.stdout.write(`Exported ABI to ${path.relative(rootDir, outputPath)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
