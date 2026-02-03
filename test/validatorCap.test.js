const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

async function sendSigned(manager, account, data, gas = 500000) {
  const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(account.address);
  const signed = await web3.eth.accounts.signTransaction(
    {
      to: manager.address,
      data,
      gas,
      gasPrice,
      nonce,
    },
    account.privateKey
  );
  return web3.eth.sendSignedTransaction(signed.rawTransaction);
}

async function createJob(manager, token, employer, payout) {
  await token.mint(employer, payout);
  await token.approve(manager.address, payout, { from: employer });
  const receipt = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
  return receipt.logs[0].args.jobId.toNumber();
}

contract("AGIJobManager validator cap", (accounts) => {
  const [owner, employer, agent] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 40, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
  });

  it("rejects validator thresholds that exceed the cap", async () => {
    const cap = (await manager.MAX_VALIDATORS_PER_JOB()).toNumber();

    await expectCustomError(
      manager.setRequiredValidatorApprovals.call(cap + 1, { from: owner }),
      "InvalidValidatorThresholds"
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await expectCustomError(
      manager.setRequiredValidatorDisapprovals.call(cap, { from: owner }),
      "InvalidValidatorThresholds"
    );
  });

  it("reverts additional votes once a dispute is triggered", async () => {
    const cap = (await manager.MAX_VALIDATORS_PER_JOB()).toNumber();
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(cap - 1, { from: owner });

    const payout = toBN(toWei("10"));
    const jobId = await createJob(manager, token, employer, payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const validators = Array.from({ length: cap + 1 }, () => web3.eth.accounts.create());
    for (const validator of validators) {
      await web3.eth.sendTransaction({
        from: owner,
        to: validator.address,
        value: toWei("1"),
      });
      await manager.addAdditionalValidator(validator.address, { from: owner });
    }

    const disapproveData = manager.contract.methods
      .disapproveJob(jobId, "validator", EMPTY_PROOF)
      .encodeABI();

    for (let i = 0; i < cap - 1; i += 1) {
      await sendSigned(manager, validators[i], disapproveData);
    }

    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator", EMPTY_PROOF, { from: validators[cap].address }),
      "InvalidState"
    );
  });

  it("completes successfully at the validator cap", async () => {
    const cap = (await manager.MAX_VALIDATORS_PER_JOB()).toNumber();
    await manager.setRequiredValidatorDisapprovals(0, { from: owner });
    await manager.setRequiredValidatorApprovals(cap, { from: owner });

    const payout = toBN(toWei("20"));
    const jobId = await createJob(manager, token, employer, payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const validators = Array.from({ length: cap }, () => web3.eth.accounts.create());
    for (const validator of validators) {
      await web3.eth.sendTransaction({
        from: owner,
        to: validator.address,
        value: toWei("1"),
      });
      await manager.addAdditionalValidator(validator.address, { from: owner });
    }

    const validateData = manager.contract.methods
      .validateJob(jobId, "validator", EMPTY_PROOF)
      .encodeABI();
    for (let i = 0; i < cap; i += 1) {
      await sendSigned(manager, validators[i], validateData, 2500000);
    }

    const jobCore = await manager.getJobCore(jobId);
    assert.strictEqual(jobCore.completed, true, "job should complete at the cap");
  });
});
