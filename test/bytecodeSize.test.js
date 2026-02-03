const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");

contract("AGIJobManager bytecode size", () => {
  it("stays within the EIP-170 safety margin", async () => {
    const deployedBytecode = AGIJobManager.deployedBytecode || "";
    const hex = deployedBytecode.startsWith("0x")
      ? deployedBytecode.slice(2)
      : deployedBytecode;
    const byteLength = hex.length / 2;

    assert.ok(
      byteLength <= 24575,
      `AGIJobManager deployedBytecode is ${byteLength} bytes (limit: 24575)`
    );
  });
});
