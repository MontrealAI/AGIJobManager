const assert = require("assert");

const MAX_RUNTIME_BYTES = 24575;

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact.deployedBytecode || artifact.evm?.deployedBytecode?.object || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

function tryRequire(name) {
  try {
    return artifacts.require(name);
  } catch (error) {
    return null;
  }
}

describe("Runtime bytecode size", () => {
  it("keeps AGIJobManager (and test wrapper) under the EIP-170 limit", async () => {
    const targets = ["AGIJobManager", "TestableAGIJobManager"];
    for (const name of targets) {
      const Artifact = tryRequire(name);
      if (!Artifact) {
        continue;
      }
      const sizeBytes = deployedSizeBytes(Artifact);
      assert(
        sizeBytes <= MAX_RUNTIME_BYTES,
        `${name} runtime bytecode size ${sizeBytes} exceeds ${MAX_RUNTIME_BYTES} bytes`
      );
    }
  });
});
