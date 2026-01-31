const assert = require("assert");
const { evaluateInvariants, CHECK } = require("../scripts/ops/validate-params");

describe("validate-params invariant evaluator", () => {
  it("flags invalid combined payout percentage", () => {
    const results = evaluateInvariants({
      requiredValidatorApprovals: 2,
      requiredValidatorDisapprovals: 2,
      maxValidators: 50,
      validationRewardPercentage: 20,
      maxJobPayout: 1,
      jobDurationLimit: 1,
      maxAgentPayoutPercentage: 90,
      agiToken: "0x0000000000000000000000000000000000000001",
      ens: "0x0000000000000000000000000000000000000001",
      nameWrapper: "0x0000000000000000000000000000000000000001",
    });

    const combined = results.find((result) => result.key === "combinedPayouts");
    assert.strictEqual(combined.status, CHECK.FAIL);
  });
});
