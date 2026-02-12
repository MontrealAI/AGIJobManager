const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPagesMalformed = artifacts.require("MockENSJobPagesMalformed");
const MockLoopingERC721 = artifacts.require("MockLoopingERC721");
const ERC721ReceiverEmployer = artifacts.require("ERC721ReceiverEmployer");
const NonReceiverEmployer = artifacts.require("NonReceiverEmployer");
const TokenURIReaderReceiver = artifacts.require("TokenURIReaderReceiver");
const GasGriefingReceiverEmployer = artifacts.require("GasGriefingReceiverEmployer");
const MockGasGriefERC721 = artifacts.require("MockGasGriefERC721");
const RevertingENSRegistry = artifacts.require("RevertingENSRegistry");
const RevertingNameWrapper = artifacts.require("RevertingNameWrapper");
const RevertingResolver = artifacts.require("RevertingResolver");
const MalformedENSRegistry = artifacts.require("MalformedENSRegistry");
const MalformedNameWrapper = artifacts.require("MalformedNameWrapper");
const MalformedResolver = artifacts.require("MalformedResolver");
const ForceSendETH = artifacts.require("ForceSendETH");
const MockRescueERC20 = artifacts.require("MockRescueERC20");
const MockRescueERC721 = artifacts.require("MockRescueERC721");
const MockRescueERC1155 = artifacts.require("MockRescueERC1155");
const MockRescueERC20False = artifacts.require("MockRescueERC20False");
const MockRescueMalformedReturn = artifacts.require("MockRescueMalformedReturn");

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

  it("treats malformed ENS responses as not-owned without reverting", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MalformedENSRegistry.new({ from: owner });
    const wrapper = await MalformedNameWrapper.new({ from: owner });
    const resolver = await MalformedResolver.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);

    await ens.setResolverAddress(resolver.address, { from: owner });

    await token.mint(employer, web3.utils.toWei("1"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("1"), { from: employer });
    await manager.createJob("ipfs://spec", web3.utils.toWei("1"), 100, "details", { from: employer });
    await expectCustomError(manager.applyForJob.call(0, "agent", [], { from: agent }), "NotAuthorized");
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

  it("rescues forced ETH to owner", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const sender = await ForceSendETH.new({ from: owner, value: web3.utils.toWei("1") });

    await sender.boom(manager.address, { from: owner });
    const ownerBefore = BigInt(await web3.eth.getBalance(owner));
    const tx = await manager.rescueETH(web3.utils.toWei("1"), { from: owner });
    const gasSpent = BigInt(tx.receipt.gasUsed) * BigInt((await web3.eth.getTransaction(tx.tx)).gasPrice);
    const ownerAfter = BigInt(await web3.eth.getBalance(owner));
    assert.equal(ownerAfter - ownerBefore + gasSpent, BigInt(web3.utils.toWei("1")));
  });

  it("rescues non-AGI tokens via calldata and blocks AGI token rescue", async () => {
    const agi = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(agi, ens.address, wrapper.address);

    const erc20 = await MockRescueERC20.new({ from: owner });
    const erc721 = await MockRescueERC721.new({ from: owner });
    const erc1155 = await MockRescueERC1155.new({ from: owner });

    await erc20.mint(manager.address, 7, { from: owner });
    await erc721.mint(manager.address, 9, { from: owner });
    await erc1155.mint(manager.address, 11, 13, { from: owner });

    const erc20Data = web3.eth.abi.encodeFunctionCall(
      { name: "transfer", type: "function", inputs: [
        { type: "address", name: "to" },
        { type: "uint256", name: "amount" }
      ] },
      [owner, "7"]
    );
    await manager.rescueToken(erc20.address, erc20Data, { from: owner });
    assert.equal((await erc20.balanceOf(owner)).toString(), "7");

    const erc721Data = web3.eth.abi.encodeFunctionCall(
      { name: "transferFrom", type: "function", inputs: [
        { type: "address", name: "from" },
        { type: "address", name: "to" },
        { type: "uint256", name: "tokenId" }
      ] },
      [manager.address, owner, "9"]
    );
    await manager.rescueToken(erc721.address, erc721Data, { from: owner });
    assert.equal(await erc721.ownerOf(9), owner);

    const erc1155Data = web3.eth.abi.encodeFunctionCall(
      { name: "safeTransferFrom", type: "function", inputs: [
        { type: "address", name: "from" },
        { type: "address", name: "to" },
        { type: "uint256", name: "id" },
        { type: "uint256", name: "amount" },
        { type: "bytes", name: "data" }
      ] },
      [manager.address, owner, "11", "13", "0x"]
    );
    await manager.rescueToken(erc1155.address, erc1155Data, { from: owner });
    assert.equal((await erc1155.balanceOf(owner, 11)).toString(), "13");

    const agiData = web3.eth.abi.encodeFunctionCall(
      { name: "transfer", type: "function", inputs: [
        { type: "address", name: "to" },
        { type: "uint256", name: "amount" }
      ] },
      [owner, "1"]
    );
    await expectCustomError(manager.rescueToken.call(agi.address, agiData, { from: owner }), "InvalidParameters");
  });


  it("reverts rescueToken when token returns false or malformed returndata", async () => {
    const agi = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(agi, ens.address, wrapper.address);
    const falseToken = await MockRescueERC20False.new({ from: owner });
    const malformedToken = await MockRescueMalformedReturn.new({ from: owner });

    const transferData = web3.eth.abi.encodeFunctionCall(
      { name: "transfer", type: "function", inputs: [
        { type: "address", name: "to" },
        { type: "uint256", name: "amount" }
      ] },
      [owner, "1"]
    );

    await expectCustomError(manager.rescueToken.call(falseToken.address, transferData, { from: owner }), "TransferFailed");
    await expectCustomError(manager.rescueToken.call(malformedToken.address, transferData, { from: owner }), "TransferFailed");
  });


  it("keeps old jobs settleable after later validation reward config changes", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });
    const payout = web3.utils.toBN(web3.utils.toWei("10"));

    await manager.setAgentBondParams(0, 0, 0, { from: owner });
    await manager.setValidationRewardPercentage(5, { from: owner });
    await manager.addAGIType(nft.address, 95, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    await token.mint(employer, payout.toString(), { from: owner });
    await token.approve(manager.address, payout.toString(), { from: employer });
    await manager.createJob("ipfs://spec", payout.toString(), 100, "details", { from: employer });

    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCompletion", { from: agent });

    await manager.disableAGIType(nft.address, { from: owner });
    await manager.setValidationRewardPercentage(80, { from: owner });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    await manager.finalizeJob(0, { from: employer });

    assert.equal((await token.balanceOf(agent)).toString(), payout.muln(95).divn(100).toString());
    assert.equal((await token.balanceOf(employer)).toString(), payout.muln(5).divn(100).toString());
  });

  it("does not auto-dispute when disapproval threshold is disabled", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });

    await manager.addAGIType(nft.address, 90, { from: owner });
    await manager.setAgentBondParams(0, 0, 0, { from: owner });
    await manager.setRequiredValidatorDisapprovals(0, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });

    await token.mint(validator, web3.utils.toWei("20"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("20"), { from: validator });
    await manager.disapproveJob(0, "validator", [], { from: validator });

    let core = await manager.getJobCore(0);
    assert.equal(core.disputed, false);

    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec-2", payout, 1000, "details", { from: employer });
    await manager.applyForJob(1, "agent", [], { from: agent });
    await manager.requestJobCompletion(1, "ipfs://completion-2", { from: agent });
    await manager.disapproveJob(1, "validator", [], { from: validator });

    core = await manager.getJobCore(1);
    assert.equal(core.disputed, true);
  });

  it("rejects overlong URIs and baseIpfsUrl", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });

    const tooLongSpec = `ipfs://${"a".repeat(2050)}`;
    await token.mint(employer, web3.utils.toWei("1"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("1"), { from: employer });
    await expectCustomError(
      manager.createJob.call(tooLongSpec, web3.utils.toWei("1"), 100, "details", { from: employer }),
      "InvalidParameters"
    );

    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.createJob("ipfs://spec", web3.utils.toWei("1"), 100, "details", { from: employer });
    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });

    const tooLongCompletion = `ipfs://${"b".repeat(1030)}`;
    await expectCustomError(manager.requestJobCompletion.call(0, tooLongCompletion, { from: agent }), "InvalidParameters");

    const tooLongBase = `ipfs://${"c".repeat(520)}`;
    await expectCustomError(manager.setBaseIpfsUrl.call(tooLongBase, { from: owner }), "InvalidParameters");
  });

  it("fails fast on invalid constructor wiring", async () => {
    const token = await MockERC20.new({ from: owner });
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const zeroTokenArgs = buildInitConfig(
      zeroAddress,
      "ipfs://base",
      zeroAddress,
      zeroAddress,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32
    );
    try {
      await AGIJobManager.new(...zeroTokenArgs, { from: owner });
      assert.fail("expected constructor revert");
    } catch (error) {
      assert.include(String(error.message), "could not decode");
    }

    const nonZeroRootNoEns = buildInitConfig(
      token.address,
      "ipfs://base",
      zeroAddress,
      zeroAddress,
      "0x" + "11".repeat(32),
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32
    );
    try {
      await AGIJobManager.new(...nonZeroRootNoEns, { from: owner });
      assert.fail("expected constructor revert");
    } catch (error) {
      assert.include(String(error.message), "could not decode");
    }


    const wrapperOnly = await MockNameWrapper.new({ from: owner });
    const rootWithNameWrapperOnly = buildInitConfig(
      token.address,
      "ipfs://base",
      zeroAddress,
      wrapperOnly.address,
      "0x" + "22".repeat(32),
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32,
      ZERO32
    );
    const wrapperOnlyManager = await AGIJobManager.new(...rootWithNameWrapperOnly, { from: owner });
    assert.equal(await wrapperOnlyManager.nameWrapper(), wrapperOnly.address);
  });

  it("rejects EOA addresses in token/ENS/namewrapper setters", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);

    await expectCustomError(manager.updateAGITokenAddress.call(owner, { from: owner }), "InvalidParameters");
    await expectCustomError(manager.updateEnsRegistry.call(owner, { from: owner }), "InvalidParameters");
    await expectCustomError(manager.updateNameWrapper.call(owner, { from: owner }), "InvalidParameters");
    await manager.updateNameWrapper("0x0000000000000000000000000000000000000000", { from: owner });
    assert.equal(await manager.nameWrapper(), "0x0000000000000000000000000000000000000000");
  });


  it("uses bounded gas for NFT balance checks", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const loopingNft = await MockLoopingERC721.new({ from: owner });
    const griefNft = await MockGasGriefERC721.new({ from: owner });

    await manager.addAGIType(loopingNft.address, 90, { from: owner });
    await expectCustomError(manager.addAGIType.call(griefNft.address, 1, { from: owner }), "InvalidParameters");
    assert.equal((await manager.getHighestPayoutPercentage(agent)).toString(), "0");
  });

  it("safe-mints to ERC721 receivers, falls back for non-receivers, and blocks wrapper misuse", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const receiverEmployer = await ERC721ReceiverEmployer.new(manager.address, token.address, { from: owner });
    const nonReceiverEmployer = await NonReceiverEmployer.new(manager.address, token.address, { from: owner });
    const payout = web3.utils.toWei("10");

    await token.mint(receiverEmployer.address, payout, { from: owner });
    await receiverEmployer.createJob("ipfs://spec-safe", payout, 100, "details", { from: owner });
    await token.mint(agent, web3.utils.toWei("4"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("4"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion-safe", { from: agent });
    await time.increase((await manager.completionReviewPeriod()).addn(1));
    await manager.finalizeJob(0, { from: owner });
    assert.equal((await receiverEmployer.receivedCount()).toString(), "1");

    await token.mint(nonReceiverEmployer.address, payout, { from: owner });
    await nonReceiverEmployer.createJob("ipfs://spec-unsafe", payout, 100, "details", { from: owner });
    await token.mint(agent, web3.utils.toWei("4"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("4"), { from: agent });
    await manager.applyForJob(1, "agent", [], { from: agent });
    await manager.requestJobCompletion(1, "ipfs://completion-unsafe", { from: agent });
    await time.increase((await manager.completionReviewPeriod()).addn(1));
    await manager.finalizeJob(1, { from: owner });
    assert.equal(await manager.ownerOf(1), nonReceiverEmployer.address);

    await expectCustomError(
      manager.safeMintCompletionNFT.call(nonReceiverEmployer.address, 999, { from: owner }),
      "NotAuthorized"
    );
  });


  it("keeps settlement live when safe-mint receiver gas-griefs", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const gasGriefer = await GasGriefingReceiverEmployer.new(manager.address, token.address, { from: owner });
    const payout = web3.utils.toWei("10");
    await token.mint(gasGriefer.address, payout, { from: owner });
    await gasGriefer.createJob("ipfs://spec-grief", payout, 100, "details", { from: owner });

    await token.mint(agent, web3.utils.toWei("4"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("4"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion-grief", { from: agent });
    await time.increase((await manager.completionReviewPeriod()).addn(1));

    await manager.finalizeJob(0, { from: owner });
    assert.equal(await manager.ownerOf(0), gasGriefer.address);
  });

  it("stores tokenURI before safe-mint callback", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens.address, wrapper.address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const receiver = await TokenURIReaderReceiver.new(manager.address, token.address, { from: owner });
    const payout = web3.utils.toWei("10");
    await token.mint(receiver.address, payout, { from: owner });
    await receiver.createJob("ipfs://spec-reader", payout, 100, "details", { from: owner });

    await token.mint(agent, web3.utils.toWei("4"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("4"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCallbackURI", { from: agent });
    await time.increase((await manager.completionReviewPeriod()).addn(1));

    await manager.finalizeJob(0, { from: owner });
    assert.equal(await receiver.seenTokenUri(), "ipfs://base/QmCallbackURI");
  });


});
