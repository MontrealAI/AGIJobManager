const assert = require("assert");

const decoder = require("../docs/ui/lib/errorDecoder.js");

const customErrors = [
  "NotModerator",
  "NotAuthorized",
  "Blacklisted",
  "InvalidParameters",
  "InvalidState",
  "JobNotFound",
  "TransferFailed",
];

describe("UI error decoder", () => {
  it("maps custom error selectors to friendly messages", () => {
    customErrors.forEach((name) => {
      const selector = web3.utils.sha3(`${name}()`).slice(0, 10);
      const message = decoder.friendlyError({ data: selector }, {});

      assert.ok(
        message.includes(name),
        `Expected message to include ${name}, got: ${message}`
      );
      assert.ok(
        message.includes("Fix:") && message.split("Fix:")[1].trim().length > 0,
        `Expected non-empty fix hint for ${name}, got: ${message}`
      );
    });
  });
});
