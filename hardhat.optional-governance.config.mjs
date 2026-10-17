// Disposable in-process chain only. This config never selects a remote provider.
import base from './hardhat/hardhat.config.js';
export default {...base,networks:{hardhat:{...base.networks.hardhat,chainId:1}}};
