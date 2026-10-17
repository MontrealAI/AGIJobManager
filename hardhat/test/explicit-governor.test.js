import assert from 'node:assert/strict';
import fs from 'node:fs';
import runtime from '../scripts/runtime.cjs';
import deployment from '../scripts/deploy.cjs';
import governance from '../scripts/governance-deployment.cjs';
import routerDeployment from '../scripts/deploy-job-pages.cjs';
const { ethers, artifacts } = await runtime.getRuntime();
const { FQNS, LIBRARIES } = deployment;
const { readCreationAuthority } = governance;
const TARGET = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('Explicit governor and genuine metadata ABI integration', function () {
  this.timeout(120000);
  let creator, secondCreator, governor, recipient30, recipient10, token, links, registry, wrapper, resolver;
  const zero = ethers.ZeroAddress;
  before(async () => {
    [creator, secondCreator, governor, recipient30, recipient10] = await ethers.getSigners();
    token = await (await ethers.getContractFactory('MockERC20')).deploy(); await token.waitForDeployment();
    await ethers.provider.send('hardhat_setCode', [USDC, await ethers.provider.getCode(await token.getAddress())]);
    links = {};
    for (const name of LIBRARIES) {
      const lib = await (await ethers.getContractFactory(name, {libraries:links})).deploy(); await lib.waitForDeployment(); links[FQNS[name]] = await lib.getAddress();
    }
    registry = await (await ethers.getContractFactory('MockENSRegistry')).deploy();
    wrapper = await (await ethers.getContractFactory('MockNameWrapper')).deploy();
    resolver = await (await ethers.getContractFactory('MockPublicResolver')).deploy();
    await Promise.all([registry.waitForDeployment(),wrapper.waitForDeployment(),resolver.waitForDeployment()]);
  });
  const args = gov => [USDC,'ipfs://',[zero,zero],Array(4).fill(ethers.ZeroHash),Array(2).fill(ethers.ZeroHash),[recipient30.address,recipient10.address],gov];
  async function managerFrom(signer, gov = governor.address) {
    const instance = await (await ethers.getContractFactory('AGIJobManager',{libraries:links,signer})).deploy(...args(gov));
    await instance.waitForDeployment(); return instance;
  }
  it('two unrelated creators yield the same explicit governance, fees, paused and exception state', async () => {
    const instances = await Promise.all([managerFrom(creator),managerFrom(secondCreator)]);
    for (const [i,manager] of instances.entries()) {
      const sender = [creator,secondCreator][i];
      const observed = await readCreationAuthority(manager,{governor:governor.address,creator:sender.address});
      assert.equal(observed.owner,governor.address); assert.equal(observed.pendingOwner,zero); assert.equal(observed.intakePaused,true);
      assert.equal(await manager.wallet30(),recipient30.address); assert.equal(await manager.wallet10(),recipient10.address);
      assert.equal(await manager.lockIdentityConfig(),false); assert.equal(await manager.agentNftRequired(),false);
      await assert.rejects(manager.connect(sender).unpauseIntake());
      await assert.rejects(manager.connect(sender).transferOwnership(sender.address));
      await assert.rejects(manager.connect(sender).addModerator(sender.address));
      await assert.rejects(manager.connect(sender).addAdditionalAgent(sender.address));
      await assert.rejects(manager.connect(sender).addAdditionalValidator(sender.address));
      await assert.rejects(manager.connect(sender).setUseEnsJobTokenURI(true));
    }
  });
  it('binds the requested Ledger address without claiming signing access or changing either fee wallet', async () => {
    const manager = await managerFrom(creator,TARGET);
    assert.equal(await manager.owner(),TARGET);assert.equal(await manager.pendingOwner(),zero);
    assert.equal(await manager.wallet30(),recipient30.address);assert.equal(await manager.wallet10(),recipient10.address);
    const receipt = await manager.deploymentTransaction().wait();
    const transfers = receipt.logs.flatMap(log=>{try{const e=manager.interface.parseLog(log);return e?.name==='OwnershipTransferred'?[e.args]:[];}catch{return [];}});
    assert.equal(transfers[0].previousOwner,zero); assert.equal(transfers[0].newOwner,creator.address);
    assert.equal(transfers.at(-1).newOwner,TARGET); // OZ4 base event does not imply a runtime control window.
  });
  it('requires nonzero explicit governors, allows designated creator and contract governors, preserves later two-step changes', async () => {
    await assert.rejects(managerFrom(creator,zero));
    const own = await managerFrom(creator,creator.address); assert.equal(await own.owner(),creator.address);
    const contractGov = await managerFrom(secondCreator,await registry.getAddress()); assert.equal(await contractGov.owner(),await registry.getAddress());
    const manager = await managerFrom(creator);
    await (await manager.connect(governor).transferOwnership(secondCreator.address)).wait();
    assert.equal(await manager.owner(),governor.address);assert.equal(await manager.pendingOwner(),secondCreator.address);
    await assert.rejects(manager.connect(creator).acceptOwnership());
    await (await manager.connect(secondCreator).acceptOwnership()).wait();
    assert.equal(await manager.owner(),secondCreator.address);assert.equal(await manager.pendingOwner(),zero);assert.equal(await manager.paused(),true);
  });
  it('initializes helper/router under governor with no manager attachment, creator powers or ENS custody grant', async () => {
    const root='jobs.example.eth',node=ethers.namehash(root);
    const helperArgs=[await registry.getAddress(),await wrapper.getAddress(),await resolver.getAddress(),node,root,governor.address];
    const helperFactory=await ethers.getContractFactory('ENSJobPages');
    const routerFactory=await ethers.getContractFactory('AGIJobPages');
    await assert.rejects(helperFactory.deploy(...helperArgs.slice(0,-1),zero));
    await assert.rejects(routerFactory.deploy('ipfs://','',zero));
    const helper=await helperFactory.deploy(...helperArgs), router=await routerFactory.deploy('ipfs://','',governor.address);
    await Promise.all([helper.waitForDeployment(),router.waitForDeployment()]);
    const manager=await managerFrom(creator);
    for(const target of [helper,router]) {
      assert.equal(await target.owner(),governor.address);assert.equal(await target.jobManager(),zero);
      await assert.rejects(target.connect(creator).setJobManager(await manager.getAddress()));
      await assert.rejects(target.connect(creator).transferOwnership(creator.address));
      await (await target.connect(governor).setJobManager(await manager.getAddress())).wait();
      assert.equal(await target.jobManager(),await manager.getAddress());
    }
    await assert.rejects(helper.connect(creator).setJobLabelPrefix('creator-'));
    await assert.rejects(helper.connect(creator).lockConfiguration());
    await assert.rejects(router.connect(creator).setBaseMetadataURI('https://creator.invalid/'));
    assert.equal(await registry.owner(node),zero);
    assert.equal(await manager.ensJobPages(),zero);assert.equal(await manager.useEnsJobTokenURI(),false);
  });
  it('the real manager getter reads the actual slot and the actual router preflight can query it', async () => {
    const manager=await managerFrom(creator);
    const config={chainId:1,owner:governor.address,manager:await manager.getAddress(),managerCodeHash:ethers.keccak256(await ethers.provider.getCode(await manager.getAddress()))};
    // Calls remain genuine EVM calls. Only the read-only adapter avoids EDR lacking EIP-1898 object tags.
    const reader={getCode:address=>ethers.provider.getCode(address),contract:(address,abi)=>new ethers.Contract(address,abi,ethers.provider)};
    assert.equal((await routerDeployment.checkManager(reader,config)).useEnsJobTokenURI,false);
    await (await manager.connect(governor).setUseEnsJobTokenURI(true)).wait();
    assert.equal((await routerDeployment.checkManager(reader,config)).useEnsJobTokenURI,true);
    await assert.rejects(readCreationAuthority(manager,{governor:governor.address,creator:creator.address}),/unattached/);
    await assert.rejects(manager.connect(creator).setUseEnsJobTokenURI(false));
    assert.equal(await manager.useEnsJobTokenURI(),true);
  });
  it('all ownable mutating APIs reject the unrelated creator on genuine instances', async () => {
    const manager=await managerFrom(creator);
    const source=fs.readFileSync(new URL('../../contracts/AGIJobManager.sol',import.meta.url),'utf8');
    const names=[...source.matchAll(/function\s+(\w+)\s*\([^)]*\)[^{;]*\bonlyOwner\b/g)].map(m=>m[1]);
    names.push('transferOwnership');
    function empty(p){if(p.baseType==='array')return Array(p.arrayLength<0?0:p.arrayLength).fill(null).map(()=>empty(p.arrayChildren));if(p.type==='address')return creator.address;if(p.type==='bool')return false;if(p.type==='string')return '';if(p.type==='bytes')return '0x';if(p.type.startsWith('bytes'))return '0x'+'00'.repeat(Number(p.type.slice(5)));return 0;}
    assert.ok(names.length>30,'enumeration must include the owner-controlled APIs');
    for(const name of new Set(names)){const f=manager.interface.getFunction(name);await assert.rejects(manager.connect(creator).getFunction(f.format('sighash')).staticCall(...f.inputs.map(empty)),`${name} must reject creator`);}
  });
});
