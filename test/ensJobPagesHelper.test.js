const assert = require("assert");

const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { namehash } = require("./helpers/ens");

contract("ENSJobPages helper", (accounts) => {
  const [owner, employer, agent] = accounts;
  const rootName = "alpha.jobs.agi.eth";
  const rootNode = namehash(rootName);

  let ens;
  let resolver;
  let nameWrapper;
  let helper;

  beforeEach(async () => {
    ens = await MockENSRegistry.new({ from: owner });
    resolver = await MockPublicResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });
    helper = await ENSJobPages.new({ from: owner });

    await helper.setController(owner, { from: owner });
    await helper.setENSRegistry(ens.address, { from: owner });
    await helper.setNameWrapper(nameWrapper.address, { from: owner });
    await helper.setPublicResolver(resolver.address, { from: owner });
    await helper.setJobsRootNode(rootNode, { from: owner });
    await helper.setJobsRootName(rootName, { from: owner });
    await ens.setOwner(rootNode, helper.address, { from: owner });
  });

  it("creates job pages and authorises the employer with text defaults", async () => {
    const jobId = 7;
    const specURI = "ipfs://spec";

    await helper.createJobPage(jobId, employer, specURI, { from: owner });

    const node = await helper.jobEnsNode(jobId);
    const storedResolver = await ens.resolver(node);
    assert.strictEqual(storedResolver, resolver.address, "resolver should be set on the node");

    const authorised = await resolver.authorisation(node, employer);
    assert.strictEqual(authorised, true, "employer should be authorised");

    const schema = await resolver.text(node, "schema");
    assert.strictEqual(schema, "agijobmanager/v1", "schema text should be set");
    const spec = await resolver.text(node, "agijobs.spec.public");
    assert.strictEqual(spec, specURI, "spec text should be set");
  });

  it("updates agent permissions and revokes them on request", async () => {
    const jobId = 9;

    await helper.createJobPage(jobId, employer, "ipfs://spec", { from: owner });
    await helper.contract.methods["onAgentAssigned(uint256,address)"](jobId, agent).send({ from: owner });

    const node = await helper.jobEnsNode(jobId);
    const agentAuthorised = await resolver.authorisation(node, agent);
    assert.strictEqual(agentAuthorised, true, "agent should be authorised");

    await helper.contract.methods["revokePermissions(uint256,address,address)"](jobId, employer, agent).send({ from: owner });
    const employerAuthorised = await resolver.authorisation(node, employer);
    const agentAuthorisedAfter = await resolver.authorisation(node, agent);
    assert.strictEqual(employerAuthorised, false, "employer should be revoked");
    assert.strictEqual(agentAuthorisedAfter, false, "agent should be revoked");
  });
});
