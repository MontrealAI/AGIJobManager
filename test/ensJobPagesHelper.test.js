const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockHookCaller = artifacts.require("MockHookCaller");

const { expectRevert } = require("@openzeppelin/test-helpers");

const { namehash, subnode } = require("./helpers/ens");

contract("ENSJobPages helper", (accounts) => {
  const [owner, employer, agent] = accounts;
  const rootName = "alpha.jobs.agi.eth";
  const rootNode = namehash(rootName);

  it("creates job pages and updates resolver records for an unwrapped root", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, helper.address, { from: owner });

    const jobId = 42;
    const specURI = "ipfs://spec.json";
    await helper.createJobPage(jobId, employer, specURI, { from: owner });

    const node = subnode(rootNode, `job-${jobId}`);
    const storedOwner = await ens.owner(node);
    const storedResolver = await ens.resolver(node);
    assert.equal(storedOwner, helper.address, "subnode owner should be helper");
    assert.equal(storedResolver, resolver.address, "resolver should be set");

    const employerAuthorised = await resolver.isAuthorised(node, employer);
    assert.equal(employerAuthorised, true, "employer should be authorised");
    const schema = await resolver.text(node, "schema");
    const specRecord = await resolver.text(node, "agijobs.spec.public");
    assert.equal(schema, "agijobmanager/v1", "schema text should be set");
    assert.equal(specRecord, specURI, "spec URI should be mirrored");

    await helper.onAgentAssigned(jobId, agent, { from: owner });
    const agentAuthorised = await resolver.isAuthorised(node, agent);
    assert.equal(agentAuthorised, true, "agent should be authorised");

    const completionURI = "ipfs://completion.json";
    await helper.onCompletionRequested(jobId, completionURI, { from: owner });
    const completionRecord = await resolver.text(node, "agijobs.completion.public");
    assert.equal(completionRecord, completionURI, "completion URI should be mirrored");

    await helper.revokePermissions(jobId, employer, agent, { from: owner });
    const employerRevoked = await resolver.isAuthorised(node, employer);
    const agentRevoked = await resolver.isAuthorised(node, agent);
    assert.equal(employerRevoked, false, "employer authorisation revoked");
    assert.equal(agentRevoked, false, "agent authorisation revoked");

    await helper.lockJobENS(jobId, employer, agent, true, { from: owner });
  });

  it("creates job pages via NameWrapper when the root is wrapped", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    const jobId = 7;
    await helper.createJobPage(jobId, employer, "ipfs://spec.json", { from: owner });

    const node = subnode(rootNode, `job-${jobId}`);
    const wrappedOwner = await nameWrapper.ownerOf(web3.utils.toBN(node));
    assert.equal(wrappedOwner, helper.address, "wrapped subnode should be owned by helper");
    const isWrapped = await nameWrapper.isWrapped(node);
    assert.equal(isWrapped, true, "subnode should be marked wrapped");

    await helper.lockJobENS(jobId, employer, agent, true, { from: owner });
    assert.equal((await nameWrapper.setChildFusesCalls()).toString(), "1", "should set child fuses");
    assert.equal(await nameWrapper.lastParentNode(), rootNode, "parent node should be jobs root");
    assert.equal(
      await nameWrapper.lastLabelhash(),
      web3.utils.keccak256(`job-${jobId}`),
      "labelhash should match job label"
    );
  });

  it("lock burn path is safe no-op when nameWrapper is unset", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, helper.address, { from: owner });
    await helper.lockJobENS(5, employer, agent, true, { from: owner });
  });

  it("burns child fuses on hook 6 even when job-manager view calls fail", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });

    const jobId = 6;
    await hookCaller.callHandleHook(helper.address, 6, jobId, { from: owner });

    assert.equal((await nameWrapper.setChildFusesCalls()).toString(), "1", "should set child fuses");
    assert.equal(await nameWrapper.lastParentNode(), rootNode, "parent node should be jobs root");
    assert.equal(await nameWrapper.lastLabelhash(), web3.utils.keccak256(`job-${jobId}`), "labelhash should match");
    assert.equal((await nameWrapper.lastChildExpiry()).toString(), web3.utils.toBN(2).pow(web3.utils.toBN(64)).subn(1).toString(), "expiry should be max uint64");
  });

  it("fails closed on unwrapped root when ENSJobPages does not own the root", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, owner, { from: owner });
    await expectRevert.unspecified(helper.createJobPage(11, employer, "ipfs://spec", { from: owner }));
  });

  it("fails closed on wrapped root when wrapper owner is not authorised", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), owner, { from: owner });
    await expectRevert.unspecified(helper.createJobPage(12, employer, "ipfs://spec", { from: owner }));
  });

  it("allows wrapped root updates when wrapper owner approves ENSJobPages", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), owner, { from: owner });
    await nameWrapper.setApprovalForAll(helper.address, true, { from: owner });

    await helper.createJobPage(13, employer, "ipfs://spec-approved", { from: owner });
    const node = subnode(rootNode, "job-13");
    assert.equal(await resolver.text(node, "agijobs.spec.public"), "ipfs://spec-approved");
  });

  it("treats resolver writes as best effort and still creates the ENS page", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      nameWrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, helper.address, { from: owner });
    await resolver.setRevertSetAuthorisation(true, { from: owner });
    await resolver.setRevertSetText(true, { from: owner });

    await helper.createJobPage(14, employer, "ipfs://spec", { from: owner });
    const node = subnode(rootNode, "job-14");
    assert.equal(await ens.owner(node), helper.address, "critical subname creation should still succeed");
  });

  it("validates constructor and setters reject EOAs", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });

    try {
      await ENSJobPages.new(owner, owner, resolver.address, rootNode, rootName, { from: owner });
      assert.fail("expected constructor revert");
    } catch (error) {
      assert.include(String(error.message), "couldn't be stored");
    }

    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await expectRevert.unspecified(helper.setENSRegistry(owner, { from: owner }));
    await expectRevert.unspecified(helper.setPublicResolver(owner, { from: owner }));
    await expectRevert.unspecified(helper.setNameWrapper(owner, { from: owner }));
    await expectRevert.unspecified(helper.setJobManager(owner, { from: owner }));
  });


  it("returns safe empty URI when root config is absent", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "",
      { from: owner }
    );

    const uri = await helper.jobEnsURI(99);
    assert.equal(uri, "");
  });

  it("locks configuration only when fully configured", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await helper.lockConfiguration({ from: owner });
    await expectRevert.unspecified(helper.setJobsRoot(namehash("new.jobs.agi.eth"), "new.jobs.agi.eth", { from: owner }));
    await expectRevert.unspecified(helper.setJobManager(owner, { from: owner }));
  });

});
