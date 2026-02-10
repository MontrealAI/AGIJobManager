const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

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
});
