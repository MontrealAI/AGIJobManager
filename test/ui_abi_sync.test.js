const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const artifactPath = path.join(rootDir, "build", "contracts", "AGIJobManager.json");
const exportedAbiPath = path.join(rootDir, "docs", "ui", "abi", "AGIJobManager.json");
const requiredInterfacePath = path.join(rootDir, "docs", "ui", "abi", "ui_required_interface.json");

function loadJson(filePath, missingMessage) {
  if (!fs.existsSync(filePath)) {
    assert.fail(missingMessage);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAbiFromExport(exportPayload) {
  if (Array.isArray(exportPayload)) return exportPayload;
  return exportPayload.abi;
}

describe("UI ABI sync", () => {
  it("matches the exported ABI with the Truffle artifact", () => {
    const artifact = loadJson(
      artifactPath,
      `Missing Truffle artifact at ${artifactPath}. Run "truffle compile" first.`,
    );
    const exportPayload = loadJson(
      exportedAbiPath,
      `Missing exported ABI at ${exportedAbiPath}. Run "npm run ui:abi" and commit the result.`,
    );
    const exportedAbi = getAbiFromExport(exportPayload);
    assert.ok(Array.isArray(artifact.abi), "Artifact ABI missing.");
    assert.ok(Array.isArray(exportedAbi), "Exported ABI missing.");
    assert.deepStrictEqual(
      exportedAbi,
      artifact.abi,
      "ABI mismatch. Run npm run ui:abi and commit the updated docs/ui/abi/AGIJobManager.json",
    );
  });

  it("includes the UI-required interface", () => {
    const artifact = loadJson(
      artifactPath,
      `Missing Truffle artifact at ${artifactPath}. Run "truffle compile" first.`,
    );
    const requiredInterface = loadJson(
      requiredInterfacePath,
      `Missing UI interface spec at ${requiredInterfacePath}.`,
    );
    const abi = artifact.abi || [];
    const functions = abi.filter((item) => item.type === "function");
    const events = abi.filter((item) => item.type === "event");
    const errors = abi.filter((item) => item.type === "error");

    for (const [name, inputCount] of Object.entries(requiredInterface.functions || {})) {
      const match = functions.find(
        (item) => item.name === name && item.inputs && item.inputs.length === inputCount,
      );
      assert.ok(
        match,
        `Missing function ${name}(${inputCount} inputs) required by UI.`,
      );
    }

    for (const name of requiredInterface.events || []) {
      const match = events.find((item) => item.name === name);
      assert.ok(match, `Missing event ${name} required by UI.`);
    }

    for (const name of requiredInterface.errors || []) {
      const match = errors.find((item) => item.name === name);
      assert.ok(match, `Missing error ${name} required by UI.`);
    }
  });
});
