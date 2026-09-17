'use strict';

// The legacy assertions run against a real Hardhat EVM. This adapter translates
// their small Web3/Truffle API surface; it never simulates contract behavior.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ethers = require('ethers');
const BN = require('bn.js');
const root = path.resolve(__dirname, '..');
const evmRevertErrors = new WeakSet();
const isEvmRevertError = error => error && typeof error === 'object' && evmRevertErrors.has(error);
const toBN = value => BN.isBN(value) ? value : new BN(String(value).replace(/^0x/, ''), String(value).startsWith('0x') ? 16 : 10);
const normalize = value => BN.isBN(value) ? value.toString() : Array.isArray(value) ? value.map(normalize) : value;
const quantity = value => ethers.toQuantity(BigInt(value.toString()));

function decodeValues(parameters, values) {
  const convert = (parameter, value) => {
    if (parameter.baseType === 'array') return value.map(item => convert(parameter.arrayChildren, item));
    if (parameter.baseType === 'tuple') return decodeValues(parameter.components, value);
    return typeof value === 'bigint' ? toBN(value) : value;
  };
  const result = parameters.map((parameter, index) => convert(parameter, values[index]));
  parameters.forEach((parameter, index) => { if (parameter.name) result[parameter.name] = result[index]; });
  return result;
}

async function createRuntime(rawProvider) {
  const rpc = async (method, params = []) => {
    try { return await rawProvider.request({ method, params }); } catch (error) {
      if (typeof error?.data === 'string' && /^0x[0-9a-f]*$/i.test(error.data) && /revert|invalid opcode/i.test(error.message)) evmRevertErrors.add(error);
      throw error;
    }
  };
  const accounts = (await rpc('eth_accounts')).map(ethers.getAddress);
  assert(accounts.length >= 10, 'Regression suite requires ten funded local accounts');
  const currentProvider = {
    request: args => rawProvider.request(args),
    send: (payload, callback) => rpc(payload.method, payload.params || []).then(result => callback(null, { jsonrpc: '2.0', id: payload.id, result }), callback),
  };
  const artifacts = new Map();
  const deployedLibraries = new Map();
  const allInterfaces = new Map();
  const txOptions = (input = {}) => {
    const result = { from: input.from || accounts[0] };
    for (const key of ['to', 'data']) if (input[key] !== undefined) result[key] = input[key];
    for (const key of ['value', 'gas', 'gasPrice', 'nonce', 'maxFeePerGas', 'maxPriorityFeePerGas']) {
      if (input[key] !== undefined) result[key] = quantity(input[key]);
    }
    return result;
  };
  const decodeLog = (log, iface) => {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) return null;
      const args = decodeValues(parsed.fragment.inputs, parsed.args);
      return { ...log, event: parsed.name, args, returnValues: args, blockNumber: Number(log.blockNumber), logIndex: Number(log.logIndex), transactionHash: log.transactionHash };
    } catch { return null; }
  };
  const receiptFor = async (hash, iface, emitter) => {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    assert(receipt, `Missing locally mined transaction receipt ${hash}`);
    assert.equal(BigInt(receipt.status), 1n, `Transaction reverted: ${hash}`);
    const logs = receipt.logs.flatMap(log => {
      if (emitter && log.address.toLowerCase() !== emitter.toLowerCase()) return [];
      const candidates = iface ? [iface] : [...allInterfaces.values()];
      for (const candidate of candidates) { const decoded = decodeLog(log, candidate); if (decoded) return [decoded]; }
      return [];
    });
    return { tx: hash, transactionHash: hash, receipt: { ...receipt, gasUsed: Number(receipt.gasUsed), blockNumber: Number(receipt.blockNumber), rawLogs: receipt.logs }, logs };
  };
  const send = async (input, iface) => {
    const transaction = txOptions(input);
    if (!transaction.gas) transaction.gas = quantity(16_777_216);
    return receiptFor(await rpc('eth_sendTransaction', [transaction]), iface, input.to);
  };
  const makeInstance = (artifact, address) => {
    const iface = artifact.interface;
    const instance = { address: ethers.getAddress(address), abi: artifact.abi, constructor: artifact };
    const methods = {};
    for (const fragment of iface.fragments.filter(item => item.type === 'function')) {
      const signature = fragment.format('sighash');
      const split = args => {
        const values = [...args];
        const options = values.length > fragment.inputs.length ? values.pop() : {};
        assert.equal(values.length, fragment.inputs.length, `Wrong argument count for ${signature}`);
        return { values: values.map(normalize), options };
      };
      const call = async (...args) => {
        const { values, options } = split(args);
        const result = await rpc('eth_call', [{ ...txOptions(options), to: address, data: iface.encodeFunctionData(fragment, values) }, 'latest']);
        const decoded = decodeValues(fragment.outputs, iface.decodeFunctionResult(fragment, result));
        return decoded.length === 1 ? decoded[0] : decoded;
      };
      const invoke = async (...args) => {
        if (fragment.constant) return call(...args);
        const { values, options } = split(args);
        return send({ ...options, to: address, data: iface.encodeFunctionData(fragment, values) }, iface);
      };
      invoke.call = call;
      invoke.estimateGas = async (...args) => {
        const { values, options } = split(args);
        return Number(await rpc('eth_estimateGas', [{ ...txOptions(options), to: address, data: iface.encodeFunctionData(fragment, values) }]));
      };
      instance[signature] = invoke;
      if (!instance[fragment.name]) instance[fragment.name] = invoke;
      const method = (...values) => ({ encodeABI: () => iface.encodeFunctionData(fragment, values.map(normalize)), call: options => call(...values, options || {}), send: options => invoke(...values, options || {}) });
      methods[signature] = method;
      if (!methods[fragment.name]) methods[fragment.name] = method;
    }
    instance.contract = { methods, options: { address: instance.address, jsonInterface: artifact.abi } };
    instance.getPastEvents = async (event, options = {}) => {
      const fragment = iface.getEvent(event);
      const filter = { address, fromBlock: options.fromBlock === undefined ? '0x0' : quantity(options.fromBlock), toBlock: options.toBlock === undefined || options.toBlock === 'latest' ? 'latest' : quantity(options.toBlock), topics: [fragment.topicHash] };
      return (await rpc('eth_getLogs', [filter])).map(log => decodeLog(log, iface));
    };
    return instance;
  };
  const requireArtifact = name => {
    if (artifacts.has(name)) return artifacts.get(name);
    const file = path.join(root, 'build/contracts', `${name}.json`);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const artifact = { ...json, _json: json, interface: new ethers.Interface(json.abi), links: new Map() };
    allInterfaces.set(name, artifact.interface);
    artifact.link = (library, address) => artifact.links.set(typeof library === 'string' ? library : library.contractName, address);
    artifact.at = async address => makeInstance(artifact, address);
    artifact.new = async (...input) => {
      const args = [...input];
      const options = args.length > artifact.interface.deploy.inputs.length ? args.pop() : {};
      assert.equal(args.length, artifact.interface.deploy.inputs.length, `Wrong constructor argument count for ${name}`);
      let bytecode = artifact.bytecode.replace(/^0x/, '');
      for (const libraries of Object.values(artifact.linkReferences || {})) {
        for (const [library, references] of Object.entries(libraries)) {
          let address = artifact.links.get(library) || deployedLibraries.get(library);
          if (!address) { address = (await requireArtifact(library).new()).address; deployedLibraries.set(library, address); }
          for (const reference of references) bytecode = bytecode.slice(0, reference.start * 2) + address.slice(2).toLowerCase() + bytecode.slice((reference.start + reference.length) * 2);
        }
      }
      const receipt = await send({ ...options, data: `0x${bytecode}${artifact.interface.encodeDeploy(args.map(normalize)).slice(2)}` }, artifact.interface);
      const instance = makeInstance(artifact, receipt.receipt.contractAddress);
      instance.transactionHash = receipt.tx;
      return instance;
    };
    artifacts.set(name, artifact);
    return artifact;
  };
  const hash = value => ethers.keccak256(typeof value === 'string' && value.startsWith('0x') ? value : ethers.toUtf8Bytes(value));
  const web3 = {
    currentProvider,
    utils: {
      toBN, keccak256: hash, sha3: hash, isAddress: ethers.isAddress,
      randomHex: length => ethers.hexlify(ethers.randomBytes(length)),
      asciiToHex: value => ethers.hexlify(ethers.toUtf8Bytes(value)),
      padRight: (value, length) => `0x${value.replace(/^0x/, '').padEnd(length, '0')}`,
      toWei: (value, unit = 'ether') => ethers.parseUnits(String(value), unit).toString(),
      soliditySha3: (...values) => {
        const typed = values.map(value => typeof value === 'object' && !BN.isBN(value) ? { type: value.type || value.t, value: normalize(value.value ?? value.v) } : { type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' || BN.isBN(value) ? 'uint256' : String(value).startsWith('0x') ? 'bytes' : 'string', value: normalize(value) });
        return ethers.solidityPackedKeccak256(typed.map(item => item.type), typed.map(item => item.value));
      },
    },
    eth: {
      abi: {
        encodeFunctionCall: (fragment, args) => new ethers.Interface([{ type: 'function', ...fragment }]).encodeFunctionData(fragment.name, args.map(normalize)),
        encodeParameter: (type, value) => ethers.AbiCoder.defaultAbiCoder().encode([type], [normalize(value)]),
        decodeParameter: (type, value) => { const result = ethers.AbiCoder.defaultAbiCoder().decode([type], value)[0]; return typeof result === 'bigint' ? result.toString() : result; },
      },
      getCode: address => rpc('eth_getCode', [address, 'latest']),
      getBalance: async address => BigInt(await rpc('eth_getBalance', [address, 'latest'])).toString(),
      getBlockNumber: async () => Number(await rpc('eth_blockNumber')),
      getTransactionCount: async address => Number(await rpc('eth_getTransactionCount', [address, 'latest'])),
      getTransaction: async hash => { const tx = await rpc('eth_getTransactionByHash', [hash]); return { ...tx, gasPrice: BigInt(tx.gasPrice).toString() }; },
      getGasPrice: async () => BigInt(await rpc('eth_gasPrice')).toString(),
      getChainId: async () => Number(await rpc('eth_chainId')),
      getTransactionReceipt: hash => rpc('eth_getTransactionReceipt', [hash]),
      sendTransaction: send,
      call: input => rpc('eth_call', [txOptions(input), 'latest']),
      accounts: {
        create: () => { const wallet = ethers.Wallet.createRandom(); return { address: wallet.address, privateKey: wallet.privateKey }; },
        signTransaction: async (input, privateKey) => {
          const transaction = { ...input, gasLimit: input.gas, chainId: Number(await rpc('eth_chainId')) };
          delete transaction.gas;
          return { rawTransaction: await new ethers.Wallet(privateKey).signTransaction(transaction) };
        },
      },
      sendSignedTransaction: async serialized => receiptFor(await rpc('eth_sendRawTransaction', [serialized])),
    },
  };
  return { web3, artifacts: { require: requireArtifact }, accounts, rpc, decodeLog, receiptFor };
}
module.exports = { createRuntime, toBN, BN, isEvmRevertError };
