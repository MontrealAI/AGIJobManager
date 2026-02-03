const assert = require("assert");
const fs = require("fs");
const path = require("path");

const MAX_DEPLOYED_BYTES = 24575;

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

function loadArtifact(name) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "build",
    "contracts",
    `${name}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    return null;
  }
  return require(artifactPath);
}

contract("Bytecode size guard", () => {
  it("keeps deployed bytecode within the EIP-170 safety margin", () => {
    ["AGIJobManager", "TestableAGIJobManager"].forEach((name) => {
      const artifact = loadArtifact(name);
      if (!artifact) {
        return;
      }
      const sizeBytes = deployedSizeBytes(artifact);
      assert(
        sizeBytes <= MAX_DEPLOYED_BYTES,
        `${name} deployedBytecode size ${sizeBytes} bytes exceeds ${MAX_DEPLOYED_BYTES} bytes`
      );
    });
  });
});
