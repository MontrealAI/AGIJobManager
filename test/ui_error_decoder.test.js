const assert = require("assert");

const decoder = require("../docs/ui/lib/errorDecoder.js");

const { customErrorCatalog, friendlyError } = decoder;

describe("UI error decoder", () => {
  it("maps AGIJobManager custom errors to friendly messages", () => {
    const errorNames = Object.keys(customErrorCatalog);

    for (const name of errorNames) {
      const selector = web3.utils.sha3(`${name}()`).slice(0, 10);
      const err = { data: selector };
      const message = friendlyError(err, {});

      assert.ok(
        message.includes(name),
        `Expected friendlyError to include error name ${name}`,
      );
      assert.ok(
        message.includes("Fix:"),
        `Expected friendlyError to include a fix hint for ${name}`,
      );
    }
  });
});
