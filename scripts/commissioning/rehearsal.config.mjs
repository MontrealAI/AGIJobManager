import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const work=process.env.ENS_REHEARSAL_WORK,repo=process.env.ENS_REHEARSAL_REPO;
if(!work||!repo||process.env.PRIVATE_KEY!==''||process.env.DEPLOY_CONFIRM_MAINNET!=='')throw new Error('ISOLATED_LAUNCHER_REQUIRED');
const local=createRequire(path.join(work,'hardhat.config.mjs'));
const I=local(path.join(repo,'scripts/commissioning/lib/io.cjs'));
const S=local(path.join(repo,'scripts/commissioning/lib/isolation.cjs'));
const input=I.read(path.join(work,'INPUT.json')).value;
const {default:plugin}=await import(pathToFileURL(local.resolve('@nomicfoundation/hardhat-ethers')).href);
export default {plugins:[plugin],paths:{sources:path.join(work,'unused-sources'),artifacts:path.join(repo,'hardhat/artifacts'),cache:path.join(work,'cache')},
  networks:{ensRehearsal:{type:'edr-simulated',chainType:'l1',chainId:31337,hardfork:'osaka',accounts:[],allowUnlimitedContractSize:false,blockGasLimit:100000000,
    forking:{url:S.proxyUrl(process.env.ENS_REHEARSAL_PROXY),blockNumber:input.snapshot.number}}}};
