const assert = require("assert");

const MAX_RUNTIME_BYTES = 24575;

const AGIJobManager = artifacts.require("AGIJobManager");
const TestableAGIJobManager = artifacts.require("TestableAGIJobManager");

function deployedSizeBytes(artifact) {
  const deployedBytecode =
    artifact._json?.deployedBytecode || artifact.deployedBytecode || "";
  const hex = deployedBytecode.startsWith("0x")
    ? deployedBytecode.slice(2)
    : deployedBytecode;
  return hex.length / 2;
}

contract("Bytecode size", () => {
  it("keeps runtime bytecode within the EIP-170 safety margin", () => {
    const agiSize = deployedSizeBytes(AGIJobManager);
    assert(
      agiSize <= MAX_RUNTIME_BYTES,
      `AGIJobManager runtime bytecode too large: ${agiSize} bytes`
    );

    const testableSize = deployedSizeBytes(TestableAGIJobManager);
    assert(
      testableSize <= MAX_RUNTIME_BYTES,
      `TestableAGIJobManager runtime bytecode too large: ${testableSize} bytes`
    );
  });
});
