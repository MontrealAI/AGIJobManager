const { Interface, Fragment, isAddress } = require('ethers');
const { resolveInputSource } = require('./deployment-safety.cjs');
const API = 'https://api.etherscan.io/v2/api';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const comparableABI = abi => abi.map(entry => JSON.stringify(canonical(JSON.parse(Fragment.from(entry).format('json'))))).sort();

async function verifyEtherscan({ chainId, address, artifact, buildInfo, constructorArguments = [], libraries = {}, apiKey,
  fetchImpl = fetch, pollDelayMs = 3000, maxPolls = 20 }) {
  if (![1, 11155111].includes(Number(chainId)) || !isAddress(address)) throw new Error('Explorer verification requires a supported chain and valid deployed address.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('ETHERSCAN_API_KEY is required for source verification.');
  if (!Number.isSafeInteger(maxPolls) || maxPolls < 1 || !Number.isSafeInteger(pollDelayMs) || pollDelayMs < 0) throw new Error('Invalid explorer polling bounds.');
  const inputSource = artifact.inputSourceName || buildInfo.userSourceNameMap?.[artifact.sourceName] || artifact.sourceName;
  if (!buildInfo.input?.sources?.[inputSource] || !/^0\.8\.\d+\+commit\.[a-f0-9]+(?:\..*)?$/.test(buildInfo.solcLongVersion)) throw new Error('Exact source and compiler build information is required for verification.');
  const version = `v${buildInfo.solcLongVersion.match(/^0\.8\.\d+\+commit\.[a-f0-9]+/)[0]}`;
  const sourceCode = structuredClone(buildInfo.input);
  sourceCode.settings.libraries = { ...(sourceCode.settings.libraries || {}) };
  for (const [fqn, libraryAddress] of Object.entries(libraries)) {
    const separator = fqn.lastIndexOf(':');
    if (separator < 0 || !isAddress(libraryAddress)) throw new Error('Explorer verification requires fully qualified linked library addresses.');
    const source = fqn.slice(0, separator), name = fqn.slice(separator + 1);
    const inputName = resolveInputSource(buildInfo, source);
    sourceCode.settings.libraries[inputName] = { ...(sourceCode.settings.libraries[inputName] || {}), [name]: libraryAddress };
  }
  const encodedArgs = new Interface(artifact.abi).encodeDeploy(constructorArguments).slice(2);
  async function request(action, fields = {}, post = false) {
    const url = new URL(API);
    url.search = new URLSearchParams({ chainid: String(chainId), module: 'contract', action, apikey: apiKey,
      ...(post ? {} : fields) }).toString();
    try {
      const response = await fetchImpl(url, { method: post ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
        ...(post ? { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() } : {}) });
      if (!response.ok) throw new Error('HTTP response failed');
      const result = await response.json();
      if (!result || !['0', '1'].includes(result.status) || typeof result.message !== 'string' || (result.status === '1' && result.message !== 'OK')) throw new Error('Malformed explorer response');
      return result;
    } catch {
      throw new Error(`Etherscan ${action} request failed or returned malformed data. No successful verification was established.`);
    }
  }
  async function observedVerification() {
    const response = await request('getsourcecode', { address });
    if (response.status !== '1' || !Array.isArray(response.result) || response.result.length !== 1) throw new Error('Etherscan source lookup did not return one checked contract record.');
    const record = response.result[0];
    if (record?.SourceCode === '' && record.ABI === 'Contract source code not verified') return false;
    let abi, publishedInput;
    try {
      abi = JSON.parse(record?.ABI);
      const text = record?.SourceCode;
      publishedInput = JSON.parse(typeof text === 'string' && text.startsWith('{{') && text.endsWith('}}') ? text.slice(1, -1) : text);
    } catch { throw new Error('Etherscan returned invalid verified source or ABI.'); }
    if (!Array.isArray(abi) || abi.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry)) ||
      (record.SimilarMatch !== undefined && record.SimilarMatch !== '') || record.ContractName !== artifact.contractName || record.CompilerVersion !== version ||
      typeof record.ConstructorArguments !== 'string' || record.ConstructorArguments.replace(/^0x/, '').toLowerCase() !== encodedArgs.toLowerCase()) {
      throw new Error('Etherscan verified source identity differs from the reviewed contract/compiler/constructor.');
    }
    if (JSON.stringify(canonical(publishedInput)) !== JSON.stringify(canonical(sourceCode)) ||
      JSON.stringify(comparableABI(abi)) !== JSON.stringify(comparableABI(artifact.abi))) {
      throw new Error('Etherscan published source, compiler settings, linked libraries or ABI differs from the reviewed build.');
    }
    return true;
  }
  if (await observedVerification()) return true;
  const submission = await request('verifysourcecode', {
    contractaddress: address, sourceCode: JSON.stringify(sourceCode), codeformat: 'solidity-standard-json-input',
    contractname: `${inputSource}:${artifact.contractName}`, compilerversion: version, constructorArguments: encodedArgs,
  }, true);
  if (submission.status !== '1' || typeof submission.result !== 'string' || !/^[a-zA-Z0-9]{20,100}$/.test(submission.result)) {
    throw new Error('Etherscan did not accept source verification with a valid submission identifier. Retry from the saved journal.');
  }
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (pollDelayMs) await wait(pollDelayMs);
    const result = await request('checkverifystatus', { guid: submission.result });
    if (result.status === '1' && result.result === 'Pass - Verified') {
      if (!(await observedVerification())) throw new Error('Etherscan completion lacks the verified source record. Retry from the saved journal.');
      return true;
    }
    if (result.status !== '0' || result.result !== 'Pending in queue') throw new Error('Etherscan source verification failed or returned an unrecognized status. Retry from the saved journal.');
  }
  throw new Error('Etherscan source verification remains pending. Retry from the saved journal; do not redeploy.');
}

module.exports = { verifyEtherscan };
