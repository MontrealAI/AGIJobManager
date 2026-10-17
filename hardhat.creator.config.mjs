// Isolated user-run creator entry: no dotenv, stored accounts, plugins or compilation.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const creator=require('./hardhat/scripts/deploy-core-tty.cjs');
creator.requireCleanEnvironment();
// Hardhat is the in-process script runner, not the submission transport.
// A fixed unused URL prevents configuration from reading/logging an RPC secret.
// The script alone selects the bounded endpoints after offline inspection exits.
export default {networks:{mainnet:{type:'http',chainType:'l1',chainId:1,url:'https://unused.invalid',accounts:[]}}};
