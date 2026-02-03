const assert = require("assert");
const fs = require("fs");
const path = require("path");

const MAX_RUNTIME_BYTES = 24575;

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

contract("Bytecode size", () => {
  it("keeps AGIJobManager runtime bytecode within the EIP-170 guardrail", () => {
    const artifactPath = path.join(
      __dirname,
      "..",
      "build",
      "contracts",
      "AGIJobManager.json"
    );

    assert.ok(
      fs.existsSync(artifactPath),
      `Missing artifact for AGIJobManager at ${artifactPath}`
    );

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const sizeBytes = deployedSizeBytes(artifact);

    assert.ok(
      sizeBytes <= MAX_RUNTIME_BYTES,
      `AGIJobManager runtime bytecode too large: ${sizeBytes} bytes`
    );
  });
});
