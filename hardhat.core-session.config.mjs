// Disposable in-process Osaka chain only. No public provider selection or coverage bypass.
import base from './hardhat/hardhat.config.js';
export default {...base,networks:{hardhat:{...base.networks.hardhat,chainId:1,hardfork:'osaka',blockGasLimit:30000000,allowUnlimitedContractSize:false}}};
