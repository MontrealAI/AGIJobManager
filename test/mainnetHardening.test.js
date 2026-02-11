const { time, BN } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockERC1155Lite = artifacts.require("MockERC1155Lite");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPagesMalformed = artifacts.require("MockENSJobPagesMalformed");
const RevertingENSRegistry = artifacts.require("RevertingENSRegistry");
const RevertingNameWrapper = artifacts.require("RevertingNameWrapper");
const RevertingResolver = artifacts.require("RevertingResolver");
const ForceSendETH = artifacts.require("ForceSendETH");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

contract("AGIJobManager mainnet hardening", (accounts) => {
  const [owner, employer, agent, validator, treasury] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(token, ensAddress, nameWrapperAddress, baseIpfs = "ipfs://base") {
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        baseIpfs,
        ensAddress,
        nameWrapperAddress,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
    return manager;
  }

  async function prepareSimpleSettlement(manager, token, jobCreator = employer, createViaContract) {
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(jobCreator, payout, { from: owner });

    if (createViaContract) {
      await createViaContract(payout);
    } else {
      await token.approve(manager.address, payout, { from: jobCreator });
      await manager.createJob("ipfs://spec", payout, 100, "details", { from: jobCreator });
    }

    await token.mint(agent, web3.utils.toWei("3"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("3"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCompletion", { from: agent });
    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
  }

  it("does not allow malformed ENS tokenURI payloads to brick settlement", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const malformed = await MockENSJobPagesMalformed.new({ from: owner });

    await manager.setEnsJobPages(malformed.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    await prepareSimpleSettlement(manager, token);
    await malformed.setTokenURIBytes("0x1234", { from: owner });
    let receipt = await manager.finalizeJob(0, { from: employer });
    let issued = receipt.logs.find((l) => l.event === "NFTIssued");
    assert.equal(await manager.tokenURI(issued.args.tokenId), "ipfs://base/QmCompletion");

    const manager2 = await deployManager(token, ens.address, wrapper.address);
    await manager2.setEnsJobPages(malformed.address, { from: owner });
    await manager2.setUseEnsJobTokenURI(true, { from: owner });
    await prepareSimpleSettlement(manager2, token);
    await malformed.setTokenURIBytes(web3.eth.abi.encodeParameter("string", "ens://job.valid"), { from: owner });
    receipt = await manager2.finalizeJob(0, { from: employer });
    issued = receipt.logs.find((l) => l.event === "NFTIssued");
    assert.equal(await manager2.tokenURI(issued.args.tokenId), "ens://job.valid");

    const manager3 = await deployManager(token, ens.address, wrapper.address);
    await manager3.setEnsJobPages(malformed.address, { from: owner });
    await manager3.setUseEnsJobTokenURI(true, { from: owner });
    await prepareSimpleSettlement(manager3, token);
    await malformed.setTokenURIBytes(
      "0x"
      + "0000000000000000000000000000000000000000000000000000000000000020"
      + "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0"
      + "0000000000000000000000000000000000000000000000000000000000000000",
      { from: owner }
    );
    receipt = await manager3.finalizeJob(0, { from: employer });
    issued = receipt.logs.find((l) => l.event === "NFTIssued");
    assert.equal(await manager3.tokenURI(issued.args.tokenId), "ipfs://base/QmCompletion");
  });

  it("keeps apply/validate authorization stable when ENS integrations revert", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await RevertingENSRegistry.new({ from: owner });
    const wrapper = await RevertingNameWrapper.new({ from: owner });
    const resolver = await RevertingResolver.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });

    await ens.setResolverAddress(resolver.address, { from: owner });
    await ens.setRevertResolver(true, { from: owner });
    await wrapper.setRevertOwnerOf(true, { from: owner });
    await resolver.setRevertAddr(true, { from: owner });

    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });

    await token.mint(employer, web3.utils.toWei("10"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("10"), { from: employer });
    await manager.createJob("ipfs://spec", web3.utils.toWei("10"), 1000, "details", { from: employer });

    await expectCustomError(manager.applyForJob.call(0, "agent", [], { from: agent }), "NotAuthorized");

    await manager.addAdditionalAgent(agent, { from: owner });
    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });

    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });
    await expectCustomError(manager.validateJob.call(0, "validator", [], { from: validator }), "NotAuthorized");
    await manager.addAdditionalValidator(validator, { from: owner });
    await token.mint(validator, web3.utils.toWei("20"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("20"), { from: validator });
    await manager.validateJob(0, "validator", [], { from: validator });
  });

  it("settlement remains live when ENS hook target reverts with ENS URI mode enabled", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const malformed = await MockENSJobPagesMalformed.new({ from: owner });

    await malformed.setRevertOnHook(true, { from: owner });
    await manager.setEnsJobPages(malformed.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    await prepareSimpleSettlement(manager, token);
    await manager.finalizeJob(0, { from: employer });
    const core = await manager.getJobCore(0);
    assert.equal(core.completed, true);
  });

  it("rescues force-sent ETH to owner", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);

    const sender = await ForceSendETH.new({ from: owner, value: web3.utils.toWei("1") });
    await sender.destroy(manager.address, { from: owner });

    const beforeManagerBalance = new BN(await web3.eth.getBalance(manager.address));
    assert.equal(beforeManagerBalance.toString(), web3.utils.toWei("1"));

    const tx = await manager.rescueETH(web3.utils.toWei("1"), { from: owner });
    assert.equal(tx.receipt.status, true);

    const afterManagerBalance = new BN(await web3.eth.getBalance(manager.address));
    assert.equal(afterManagerBalance.toString(), "0");
  });

  it("rescues non-AGI tokens via calldata and rejects AGI token rescue", async () => {
    const agi = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(agi, ens.address, wrapper.address);
    const erc20 = await MockERC20.new({ from: owner });
    const erc721 = await MockERC721.new({ from: owner });
    const erc1155 = await MockERC1155Lite.new({ from: owner });

    await erc20.mint(manager.address, web3.utils.toWei("5"), { from: owner });
    await erc721.mint(manager.address, { from: owner });
    await erc1155.mint(manager.address, 7, 3, { from: owner });

    await manager.rescueToken(
      erc20.address,
      erc20.contract.methods.transfer(treasury, web3.utils.toWei("2")).encodeABI(),
      { from: owner }
    );
    await manager.rescueToken(
      erc721.address,
      erc721.contract.methods.safeTransferFrom(manager.address, treasury, 1).encodeABI(),
      { from: owner }
    );
    await manager.rescueToken(
      erc1155.address,
      erc1155.contract.methods.safeTransferFrom(manager.address, treasury, 7, 2, "0x").encodeABI(),
      { from: owner }
    );

    assert.equal((await erc20.balanceOf(treasury)).toString(), web3.utils.toWei("2"));
    assert.equal(await erc721.ownerOf(1), treasury);
    assert.equal((await erc1155.balanceOf(treasury, 7)).toString(), "2");

    await expectCustomError(
      manager.rescueToken.call(
        agi.address,
        agi.contract.methods.transfer(treasury, 1).encodeABI(),
        { from: owner }
      ),
      "InvalidParameters"
    );
  });
});
