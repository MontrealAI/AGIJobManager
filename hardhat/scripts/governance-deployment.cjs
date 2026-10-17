'use strict';
const E = require('ethers');
const { createHash } = require('node:crypto');
const SCHEMA = 'agi-manager-deployment-v2';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function buildDigest(buildInfo) {
  if (!buildInfo?.input || !buildInfo.solcLongVersion) throw Error('Intact compiler input and exact compiler version required.');
  return createHash('sha256').update(JSON.stringify(canonical({ input: buildInfo.input, solcLongVersion: buildInfo.solcLongVersion }))).digest('hex');
}
function requireDeploymentSchema(receipt) {
  if (!receipt || typeof receipt !== 'object') throw Error('Deployment receipt is required.');
  if (receipt.schema === undefined && receipt.constructorArgs?.initialGovernor === undefined && receipt.ownershipInitialization === undefined) return false;
  if (receipt.schema !== SCHEMA || receipt.ownershipInitialization !== 'explicit-constructor') throw Error('Unsupported deployment ownership schema; preserve the original receipt.');
  const governor = receipt.constructorArgs?.initialGovernor;
  if (!E.isAddress(governor) || governor === E.ZeroAddress || governor.toLowerCase() !== receipt.finalOwner?.toLowerCase()) throw Error('Constructor governor must be explicit, nonzero and equal finalOwner.');
  return true;
}
function deploymentConstructor(receipt, artifact) {
  const explicit = requireDeploymentSchema(receipt), args = receipt.constructorArgs;
  const constructor = artifact.abi.find(entry => entry.type === 'constructor');
  const types = ['address','string','address[2]','bytes32[4]','bytes32[2]','address[2]', ...(explicit ? ['address'] : [])];
  if (JSON.stringify(constructor?.inputs.map(input => input.type)) !== JSON.stringify(types)) throw Error('Receipt constructor schema differs from the exact artifact ABI. Historical receipts require their original six-argument build; never recompile them with new source.');
  return [args.usdcTokenAddress,args.baseIpfsUrl,args.ensConfig,args.rootNodes,args.merkleRoots,args.settlementWallets,...(explicit ? [args.initialGovernor] : [])];
}
async function readCreationAuthority(manager, { governor, creator, requireUnconfigured = true }) {
  if (![governor,creator].every(E.isAddress)) throw Error('Explicit governor and creator addresses required.');
  const [owner,pendingOwner,paused,moderator,agentException,validatorException,helper,metadataEnabled] = await Promise.all([
    manager.owner(),manager.pendingOwner(),manager.paused(),manager.moderators(creator),manager.additionalAgents(creator),
    manager.additionalValidators(creator),manager.ensJobPages(),manager.useEnsJobTokenURI(),
  ]);
  if (owner.toLowerCase() !== governor.toLowerCase() || pendingOwner !== E.ZeroAddress || paused !== true) throw Error('Explicit governor, empty pendingOwner and paused intake must match.');
  if (moderator || agentException || validatorException) throw Error('Creator has an unreviewed moderator/agent/validator exemption.');
  if (requireUnconfigured && (helper !== E.ZeroAddress || metadataEnabled !== false)) throw Error('Creation stage must remain unattached with ENS token URI disabled.');
  return {owner,pendingOwner,intakePaused:paused,creator,creatorIsExplicitGovernor:owner.toLowerCase() === creator.toLowerCase(),
    creatorRoles:{moderator,agentException,validatorException},ensJobPages:helper,useEnsJobTokenURI:metadataEnabled,
    scope:'Direct creation-granted authority only; complete governor setup history and indirect ENS authority require separate finalization.',activationAuthorized:false};
}
module.exports = { SCHEMA, buildDigest, requireDeploymentSchema, deploymentConstructor, readCreationAuthority };
