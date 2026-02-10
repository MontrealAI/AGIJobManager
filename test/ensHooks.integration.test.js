const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPages = artifacts.require("MockENSJobPages");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");
const { expectCustomError } = require("./helpers/errors");

const ZERO32 = "0x" + "00".repeat(32);

contract("AGIJobManager ENS hooks integration", (accounts) => {
  const [owner, employer, agent, outsider] = accounts;

  async function deployStack() {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32), { from: owner });
    const pages = await MockENSJobPages.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });

    await manager.setEnsJobPages(pages.address, { from: owner });
    await manager.addAGIType(nft.address, 80, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    return { token, manager, pages };
  }

  it("fires best-effort hooks for create/assign/completion/revoke without bricking core flow", async () => {
    const { token, manager, pages } = await deployStack();

    const payout = web3.utils.toWei("8");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await pages.setRevertHook(1, true, { from: owner });
    await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });
    await manager.applyForJob(0, "", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://done", { from: agent });

    await time.increase((await manager.completionReviewPeriod()).addn(1));
    await manager.finalizeJob(0, { from: employer });

    assert.equal((await pages.assignCalls()).toString(), "1");
    assert.equal((await pages.completionCalls()).toString(), "1");
    assert.equal((await pages.revokeCalls()).toString(), "1");
  });

  it("restricts fuse burn to owner and tolerates hook failure", async () => {
    const { token, manager, pages } = await deployStack();
    const payout = web3.utils.toWei("5");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec", payout, 1, "details", { from: employer });
    await manager.applyForJob(0, "", [], { from: agent });
    await time.increase(2);
    await manager.expireJob(0, { from: employer });

    await expectCustomError(manager.lockJobENS.call(0, true, { from: outsider }), "NotAuthorized");

    await pages.setRevertHook(6, true, { from: owner });
    const tx = await manager.lockJobENS(0, true, { from: owner });
    const lockEvent = tx.logs.find((l) => l.event === "EnsHookAttempted" && l.args.hook.toString() === "6");
    assert(lockEvent, "burn fuse attempt should be emitted");
    assert.equal(lockEvent.args.success, false, "fuse burn failure must be best-effort only");
  });
});
