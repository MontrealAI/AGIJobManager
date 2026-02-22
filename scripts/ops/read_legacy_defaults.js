/* eslint-disable no-console */

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  if (idx + 1 >= process.argv.length) {
    throw new Error(`Missing value for ${flag}`);
  }
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}



function isRevertLikeCallError(err) {
  const msg = String(err && (err.message || err)).toLowerCase();
  return msg.includes('revert') || msg.includes('vm exception') || msg.includes('invalid opcode');
}

async function callOptionalUintGetter({ contractAddress, getterName }) {
  const selector = web3.eth.abi.encodeFunctionSignature(`${getterName}()`);
  let raw;

  try {
    raw = await web3.eth.call({ to: contractAddress, data: selector });
  } catch (err) {
    if (!isRevertLikeCallError(err)) {
      throw err;
    }

    // Legacy-unavailable getter path may revert instead of returning empty data.
    const code = await web3.eth.getCode(contractAddress);
    const hasSelectorInBytecode = typeof code === 'string' && code.toLowerCase().includes(selector.slice(2).toLowerCase());
    if (!hasSelectorInBytecode) return null;
    throw err;
  }

  // Missing getter path on legacy deployments can return empty data.
  if (!raw || raw === '0x') return null;

  // A valid uint256 ABI return should be 32 bytes (0x + 64 hex chars).
  if (typeof raw !== 'string' || raw.length !== 66) {
    throw new Error(`Unexpected ABI payload for optional getter ${getterName}(): ${raw}`);
  }

  return web3.eth.abi.decodeParameter('uint256', raw).toString();
}

module.exports = async function readLegacyDefaults(callback) {
  try {
    const legacyAddress = (parseArg('--legacy', '0x0178b6bad606aaf908f72135b8ec32fc1d5ba477') || '').trim();
    if (!web3.utils.isAddress(legacyAddress)) {
      throw new Error(`Invalid --legacy address: ${legacyAddress}`);
    }

    const abi = [
      { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'agiToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
      { type: 'function', name: 'settlementPaused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
      { type: 'function', name: 'requiredValidatorApprovals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'requiredValidatorDisapprovals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'voteQuorum', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'completionReviewPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'disputeReviewPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'validatorMerkleRoot', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'agentMerkleRoot', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'ens', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'nameWrapper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'clubRootNode', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'agentRootNode', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'alphaClubRootNode', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'alphaAgentRootNode', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
      { type: 'function', name: 'ensJobPages', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { type: 'function', name: 'withdrawableAGI', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    ];

    const c = new web3.eth.Contract(abi, legacyAddress);

    const out = {
      source: {
        address: legacyAddress,
        chainId: Number(await web3.eth.getChainId()),
      },
      values: {
        owner: await c.methods.owner().call(),
        agiToken: await c.methods.agiToken().call(),
        paused: await c.methods.paused().call(),
        settlementPaused: await c.methods.settlementPaused().call(),
        requiredValidatorApprovals: String(await c.methods.requiredValidatorApprovals().call()),
        requiredValidatorDisapprovals: String(await c.methods.requiredValidatorDisapprovals().call()),
        voteQuorum: String(await c.methods.voteQuorum().call()),
        completionReviewPeriod: String(await c.methods.completionReviewPeriod().call()),
        disputeReviewPeriod: String(await c.methods.disputeReviewPeriod().call()),
        challengePeriodAfterApproval: await callOptionalUintGetter({ contractAddress: legacyAddress, getterName: 'challengePeriodAfterApproval' }),
        validatorMerkleRoot: await c.methods.validatorMerkleRoot().call(),
        agentMerkleRoot: await c.methods.agentMerkleRoot().call(),
        ens: await c.methods.ens().call(),
        nameWrapper: await c.methods.nameWrapper().call(),
        clubRootNode: await c.methods.clubRootNode().call(),
        agentRootNode: await c.methods.agentRootNode().call(),
        alphaClubRootNode: await c.methods.alphaClubRootNode().call(),
        alphaAgentRootNode: await c.methods.alphaAgentRootNode().call(),
        ensJobPages: await c.methods.ensJobPages().call(),
        withdrawableAGI: String(await c.methods.withdrawableAGI().call()),
      },
    };

    console.log(JSON.stringify(out, null, 2));
    callback();
  } catch (err) {
    callback(err);
  }
};
