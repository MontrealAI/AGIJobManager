const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockHookCaller = artifacts.require("MockHookCaller");
const MockAGIJobManagerView = artifacts.require("MockAGIJobManagerView");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

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

    const node = subnode(rootNode, `agijob${jobId}`);
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

    await nameWrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    const jobId = 7;
    await helper.createJobPage(jobId, employer, "ipfs://spec.json", { from: owner });

    const node = subnode(rootNode, `agijob${jobId}`);
    const wrappedOwner = await nameWrapper.ownerOf(web3.utils.toBN(node));
    assert.equal(wrappedOwner, helper.address, "wrapped subnode should be owned by helper");
    const isWrapped = await nameWrapper.isWrapped(node);
    assert.equal(isWrapped, true, "subnode should be marked wrapped");

    await helper.lockJobENS(jobId, employer, agent, true, { from: owner });
    assert.equal((await nameWrapper.setChildFusesCalls()).toString(), "1", "should set child fuses");
    assert.equal(await nameWrapper.lastParentNode(), rootNode, "parent node should be jobs root");
    assert.equal(
      await nameWrapper.lastLabelhash(),
      web3.utils.keccak256(`agijob${jobId}`),
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
    await helper.createJobPage(5, employer, "ipfs://spec5", { from: owner });
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

    await nameWrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, nameWrapper.address, { from: owner });
    await nameWrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });

    const jobId = 6;
    await helper.createJobPage(jobId, employer, "ipfs://spec6", { from: owner });
    await hookCaller.callHandleHook(helper.address, 6, jobId, { from: owner });

    assert.equal((await nameWrapper.setChildFusesCalls()).toString(), "1", "should set child fuses");
    assert.equal(await nameWrapper.lastParentNode(), rootNode, "parent node should be jobs root");
    assert.equal(await nameWrapper.lastLabelhash(), web3.utils.keccak256(`agijob${jobId}`), "labelhash should match");
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
    const node = subnode(rootNode, "agijob13");
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
    const node = subnode(rootNode, "agijob14");
    assert.equal(await ens.owner(node), helper.address, "critical subname creation should still succeed");
  });

  it("emits contextual best-effort failure metadata for resolver write failures", async () => {
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
    await resolver.setRevertSetText(true, { from: owner });

    const receipt = await helper.createJobPage(15, employer, "ipfs://spec", { from: owner });
    expectEvent(receipt, "ENSHookBestEffortFailure", {
      hook: "1",
      jobId: "15",
      operation: web3.utils.padRight(web3.utils.asciiToHex("SET_TEXT"), 64),
    });
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
    const hookCaller = await MockHookCaller.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, helper.address, { from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });
    await helper.lockConfiguration({ from: owner });
    await expectRevert.unspecified(helper.setJobsRoot(namehash("new.jobs.agi.eth"), "new.jobs.agi.eth", { from: owner }));
    await expectRevert.unspecified(helper.setJobManager(hookCaller.address, { from: owner }));
  });


  it("cannot lock before job manager is configured", async () => {
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
    await expectRevert.unspecified(helper.lockConfiguration({ from: owner }));
  });

  it("cannot lock wrapped mode unless nameWrapper wiring and authority are ready", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });

    const missingWrapper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await missingWrapper.setJobManager(hookCaller.address, { from: owner });
    await expectRevert.unspecified(missingWrapper.lockConfiguration({ from: owner }));

    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );
    await helper.setJobManager(hookCaller.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), owner, { from: owner });
    await expectRevert.unspecified(helper.lockConfiguration({ from: owner }));

    await wrapper.setApprovalForAll(helper.address, true, { from: owner });
    await helper.lockConfiguration({ from: owner });
  });

  it("accepts NameWrapper getApproved authorization for wrapped roots", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });

    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), owner, { from: owner });
    await wrapper.setApproved(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });
    await helper.lockConfiguration({ from: owner });
    await helper.createJobPage(77, employer, "ipfs://spec77", { from: owner });
  });

  it("keeps operator authorization path live when getApproved reverts", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });

    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), owner, { from: owner });
    await wrapper.setRevertGetApproved(true, { from: owner });
    await wrapper.setApprovalForAll(helper.address, true, { from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });
    await helper.lockConfiguration({ from: owner });
    await helper.createJobPage(78, employer, "ipfs://spec78", { from: owner });
  });



  it("reuses existing wrapped node when ENSJobPages remains effective manager", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    const first = await helper.createJobPage(79, employer, "ipfs://spec79", { from: owner });
    const second = await helper.createJobPage(79, employer, "ipfs://spec79b", { from: owner });

    assert.equal(first.logs.filter((l) => l.event === "JobENSPageCreated").length, 1, "first call should create");
    assert.equal(second.logs.filter((l) => l.event === "JobENSPageCreated").length, 0, "second call should reuse");
  });

  it("refuses wrapped-node reuse when ENSJobPages is not effective manager", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    const node = subnode(rootNode, "agijob80");
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await ens.setOwner(node, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(node), owner, { from: owner });

    await expectRevert.unspecified(helper.createJobPage(80, employer, "ipfs://spec80", { from: owner }));
  });

  it("uses NameWrapper resolver path for wrapped node updates", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    const jobId = 81;
    await helper.createJobPage(jobId, employer, "ipfs://spec81", { from: owner });
    const node = subnode(rootNode, `agijob${jobId}`);

    assert.equal((await wrapper.setResolverCalls()).toString(), "1", "should set resolver through wrapper");
    assert.equal(await wrapper.lastResolverNode(), node, "resolver node should match wrapped subnode");
    assert.equal(await wrapper.lastResolver(), resolver.address, "resolver address should match public resolver");
    assert.equal(await ens.resolver(node), "0x0000000000000000000000000000000000000000", "ENS resolver should not be written directly for wrapped node");
  });

  it("burn fuse path uses wrapped lock fuse mask", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    await helper.createJobPage(82, employer, "ipfs://spec82", { from: owner });
    await helper.lockJobENS(82, employer, agent, true, { from: owner });

    assert.equal((await wrapper.lastChildFuses()).toString(), "65561", "lock fuses must include unwrap/parent control/resolver/ttl bits");
  });


  it("uses agijob as default prefix and lets owner update prefix previews", async () => {
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

    assert.equal(await helper.jobLabelPrefix(), "agijob");
    assert.equal(await helper.jobEnsLabel(1), "agijob1");

    await helper.setJobLabelPrefix("job-", { from: owner });
    assert.equal(await helper.jobLabelPrefix(), "job-");
    assert.equal(await helper.jobEnsLabel(2), "job-2");
  });

  it("rejects invalid label prefixes and blocks prefix updates when config is locked", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    for (const invalid of ["", "-job", "Job", "job.", "job_", "agijob1", "a".repeat(33)]) {
      await expectRevert.unspecified(helper.setJobLabelPrefix(invalid, { from: owner }));
    }

    await ens.setOwner(rootNode, helper.address, { from: owner });
    await helper.setJobManager(hookCaller.address, { from: owner });
    await helper.lockConfiguration({ from: owner });
    await expectRevert.unspecified(helper.setJobLabelPrefix("job-", { from: owner }));
  });

  it("snapshots created labels so old jobs remain stable after prefix changes", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    await helper.createJobPage(91, employer, "ipfs://spec91", { from: owner });
    const oldNode = subnode(rootNode, "agijob91");
    assert.equal(await helper.jobEnsLabel(91), "agijob91");
    assert.equal(await helper.jobEnsNode(91), oldNode);

    await helper.setJobLabelPrefix("job-", { from: owner });
    assert.equal(await helper.jobEnsLabel(91), "agijob91");
    assert.equal(await helper.jobEnsNode(91), oldNode);

    await helper.onAgentAssigned(91, agent, { from: owner });
    assert.equal(await resolver.isAuthorised(oldNode, agent), true, "assign should target snapshotted node");

    await helper.revokePermissions(91, employer, agent, { from: owner });
    assert.equal(await resolver.isAuthorised(oldNode, agent), false, "revoke should target snapshotted node");

    await helper.lockJobENS(91, employer, agent, true, { from: owner });
    assert.equal(await wrapper.lastLabelhash(), web3.utils.keccak256("agijob91"), "lock should use snapshotted label");

    assert.equal(await helper.jobEnsLabel(92), "job-92", "future jobs should preview new prefix");
    await helper.createJobPage(92, employer, "ipfs://spec92", { from: owner });
    assert.equal(await helper.jobEnsLabel(92), "job-92", "newly created jobs should snapshot new prefix");
    assert.equal(await helper.jobEnsNode(92), subnode(rootNode, "job-92"));
  });


  it("fails fast on post-create writes for legacy jobs until exact label is snapshotted", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });

    await helper.setJobLabelPrefix("job-", { from: owner });
    await wrapper.setSubnodeOwner(
      rootNode,
      "agijob200",
      helper.address,
      0,
      web3.utils.toBN(2).pow(web3.utils.toBN(64)).subn(1),
      { from: owner }
    );

    await expectRevert.unspecified(helper.onAgentAssigned(200, agent, { from: owner }));
    await expectRevert.unspecified(helper.onCompletionRequested(200, "ipfs://completion-200", { from: owner }));
    await expectRevert.unspecified(helper.revokePermissions(200, employer, agent, { from: owner }));
    await expectRevert.unspecified(helper.lockJobENS(200, employer, agent, true, { from: owner }));
  });

  it("does not overwrite a snapshotted label when recreating a missing node", async () => {
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
    await helper.createJobPage(93, employer, "ipfs://spec93", { from: owner });
    const originalNode = subnode(rootNode, "agijob93");

    await helper.setJobLabelPrefix("job-", { from: owner });
    await ens.setOwner(originalNode, "0x0000000000000000000000000000000000000000", { from: owner });

    await helper.createJobPage(93, employer, "ipfs://spec93b", { from: owner });
    assert.equal(await helper.jobEnsLabel(93), "agijob93", "snapshot should remain unchanged");
    assert.equal(await helper.jobEnsNode(93), originalNode, "recreated node should keep original label");
    assert.equal(await ens.owner(originalNode), helper.address, "missing original node should be recreated");
  });

  it("rejects prefixes that end in a digit to keep label boundaries unambiguous", async () => {
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
    await helper.createJobPage(12, employer, "ipfs://spec12", { from: owner });
    await expectRevert.unspecified(helper.setJobLabelPrefix("agijob1", { from: owner }));
    assert.equal(await helper.jobEnsLabel(12), "agijob12", "job 12 label remains canonical");
    assert.equal(await helper.jobEnsLabel(2), "agijob2", "default prefix remains active for future jobs");
    assert.equal(await resolver.text(subnode(rootNode, "agijob12"), "agijobs.spec.public"), "ipfs://spec12");
  });

  it("preserves auth for disputed-but-unresolved jobs during legacy migration", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNode, rootName, { from: owner });

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });

    const jobId = 21;
    await manager.setJob(jobId, employer, agent, "ipfs://legacy-spec-21", { from: owner });
    await manager.setJobTerminalState(jobId, false, true, false, { from: owner });

    const node = subnode(rootNode, "job-21");
    await helper.migrateLegacyWrappedJobPage(jobId, "job-21", { from: owner });

    assert.equal(await resolver.isAuthorised(node, employer), true, "employer should remain authorised for unresolved disputes");
    assert.equal(await resolver.isAuthorised(node, agent), true, "agent should remain authorised for unresolved disputes");
  });

  it("keeps expired jobs revoked during migration while restoring completion text", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });

    const jobId = 111;
    await manager.setJob(jobId, employer, agent, "ipfs://legacy-spec-111", { from: owner });
    await manager.setCompletionURI(jobId, "ipfs://legacy-completion-111", { from: owner });
    await manager.setJobTerminalState(jobId, false, false, true, { from: owner });

    const node = subnode(rootNode, "job-111");
    await resolver.setAuthorisation(node, employer, true, { from: owner });
    await resolver.setAuthorisation(node, agent, true, { from: owner });

    await helper.migrateLegacyWrappedJobPage(jobId, "job-111", { from: owner });

    assert.equal(await resolver.isAuthorised(node, employer), false, "employer should stay revoked for expired jobs");
    assert.equal(await resolver.isAuthorised(node, agent), false, "agent should stay revoked for expired jobs");
    assert.equal(
      await resolver.text(node, "agijobs.completion.public"),
      "ipfs://legacy-completion-111",
      "completion URI should still be restored"
    );
  });


  it("migrates a missing legacy wrapped page with an exact label without changing default prefix", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });

    await manager.setJob(0, employer, agent, "ipfs://legacy-spec-0", { from: owner });

    const receipt = await helper.migrateLegacyWrappedJobPage(0, "job-0", { from: owner });
    expectEvent(receipt, "LegacyJobPageMigrated", { jobId: "0", label: "job-0", adopted: false, created: true });

    const node = subnode(rootNode, "job-0");
    const snapshot = await helper.jobLabelSnapshot(0);
    assert.equal(snapshot[0], true, "label should be snapshotted");
    assert.equal(snapshot[1], "job-0", "snapshot should match imported label");
    assert.equal(await helper.jobLabelPrefix(), "agijob", "global prefix should remain unchanged");
    assert.equal(await helper.jobEnsLabel(0), "job-0", "job should resolve to imported exact label");
    assert.equal(await wrapper.ownerOf(web3.utils.toBN(node)), helper.address, "wrapped node should be owned by helper");
    assert.equal(await resolver.text(node, "agijobs.spec.public"), "ipfs://legacy-spec-0", "spec should be repaired from manager");
  });

  it("adopts an existing wrapped legacy page and routes write hooks through the imported exact label", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });

    const legacyNode = subnode(rootNode, "job-10");
    await wrapper.setSubnodeOwner(rootNode, "job-10", owner, 0, web3.utils.toBN(2).pow(web3.utils.toBN(64)).subn(1), { from: owner });
    assert.equal(await wrapper.ownerOf(web3.utils.toBN(legacyNode)), owner, "legacy node starts under old manager owner");

    await manager.setJob(10, employer, agent, "ipfs://legacy-spec-10", { from: owner });
    const migrateReceipt = await helper.migrateLegacyWrappedJobPage(10, "job-10", { from: owner });
    expectEvent(migrateReceipt, "LegacyJobPageMigrated", { jobId: "10", label: "job-10", adopted: true, created: false });

    assert.equal(await wrapper.ownerOf(web3.utils.toBN(legacyNode)), helper.address, "node should be adopted by helper");
    assert.equal(await resolver.isAuthorised(legacyNode, employer), true, "employer auth repaired on adopted node");

    await helper.onAgentAssigned(10, agent, { from: owner });
    assert.equal(await resolver.isAuthorised(legacyNode, agent), true, "assign should use imported exact label");

    await helper.revokePermissions(10, employer, agent, { from: owner });
    assert.equal(await resolver.isAuthorised(legacyNode, employer), false, "revoke should use imported exact label");
    assert.equal(await resolver.isAuthorised(legacyNode, agent), false, "revoke should target imported node");

    await helper.lockJobENS(10, employer, agent, true, { from: owner });
    assert.equal(await wrapper.lastLabelhash(), web3.utils.keccak256("job-10"), "lock should use imported exact label");
  });


  it("keeps terminal jobs revoked during migration while restoring completion text", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });

    const jobId = 11;
    await manager.setJob(jobId, employer, agent, "ipfs://legacy-spec-11", { from: owner });
    await manager.setCompletionURI(jobId, "ipfs://legacy-completion-11", { from: owner });
    await manager.setJobTerminalState(jobId, true, false, false, { from: owner });

    const node = subnode(rootNode, "job-11");
    await resolver.setAuthorisation(node, employer, true, { from: owner });
    await resolver.setAuthorisation(node, agent, true, { from: owner });

    await helper.migrateLegacyWrappedJobPage(jobId, "job-11", { from: owner });

    assert.equal(await resolver.isAuthorised(node, employer), false, "employer should stay revoked for terminal jobs");
    assert.equal(await resolver.isAuthorised(node, agent), false, "agent should stay revoked for terminal jobs");
    assert.equal(
      await resolver.text(node, "agijobs.completion.public"),
      "ipfs://legacy-completion-11",
      "completion URI should still be restored"
    );
  });

  it("rejects invalid exact legacy labels for a job", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await MockAGIJobManagerView.new({ from: owner });
    const helper = await ENSJobPages.new(
      ens.address,
      wrapper.address,
      resolver.address,
      rootNode,
      rootName,
      { from: owner }
    );

    await wrapper.setENSRegistry(ens.address, { from: owner });
    await ens.setOwner(rootNode, wrapper.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(rootNode), helper.address, { from: owner });
    await helper.setJobManager(manager.address, { from: owner });
    await manager.setJob(5, employer, agent, "ipfs://legacy-spec-5", { from: owner });

    for (const bad of ["", "Job-5", "job-", "job-6", "job-15", "-job5", "job.5"]) {
      await expectRevert.unspecified(helper.migrateLegacyWrappedJobPage(5, bad, { from: owner }));
    }
  });

  it("rejects oversized root names to keep ENS URIs bounded", async () => {
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

    const tooLongRoot = "a".repeat(241);
    await expectRevert.unspecified(helper.setJobsRoot(rootNode, tooLongRoot, { from: owner }));
  });

});
