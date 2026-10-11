'use strict';
const {ensure,Stop,sha256:hash}=require('./io.cjs');
const canonical=x=>typeof x==='bigint'?x.toString():Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
function compare(a,b,code){ensure(JSON.stringify(canonical(a))===JSON.stringify(canonical(b)),code);}
function proxyUrl(value) {
  // Only a canonical URL for this process's loopback proxy can be trusted.
  ensure(typeof value === 'string' && value.length <= 2048, 'INVALID_READ_ONLY_PROXY_URL');
  let u;
  try { u = new URL(value); } catch { throw new Stop('INVALID_READ_ONLY_PROXY_URL'); }
  ensure(u.protocol === 'http:' && u.hostname === '127.0.0.1' &&
    u.port !== '' && Number(u.port) > 0 &&
    /^\/readonly-[A-Za-z0-9-]+$/.test(u.pathname) &&
    !u.username && !u.password && !u.search && !u.hash && u.href === value,
    'FORK_MUST_USE_READ_ONLY_PROXY');
  return u.href;
}
async function resolveForkUrl(value) {
  if (typeof value === 'string') return {url:value, kind:'string'};
  // Hardhat 3 wraps even a literal string in a ResolvedConfigurationVariable.
  // Use its public, asynchronous API; never coerce an object or guess .value.
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    value._type === 'ResolvedConfigurationVariable' && typeof value.getUrl === 'function',
    'UNSUPPORTED_FORK_URL_REPRESENTATION');
  let url;
  try { url = await value.getUrl(); } catch { throw new Stop('FORK_URL_RESOLUTION_FAILED'); }
  ensure(typeof url === 'string', 'FORK_URL_RESOLVED_VALUE_MUST_BE_STRING');
  return {url, kind:'ResolvedConfigurationVariable'};
}
async function assertLocal(connection, chainId, pin, expectedProxy) {
  ensure(connection?.networkName === 'ensRehearsal' && connection?.networkConfig?.type === 'edr-simulated', 'NOT_AN_IN_PROCESS_SIMULATED_NETWORK');
  const config = connection.networkConfig;
  ensure(Number(chainId) === 31337 && Number(config.chainId) === 31337, 'REFUSING_NONLOCAL_CHAIN_ID');
  ensure(config.forking && config.forking.enabled !== false &&
    Number(config.forking.blockNumber) === pin.block.number, 'FORK_BLOCK_MISMATCH');
  ensure(config.allowUnlimitedContractSize === false, 'UNLIMITED_CONTRACT_SIZE_REFUSED');
  // Validate the launcher's own endpoint before invoking a URL resolver.
  const expected = proxyUrl(expectedProxy);
  const resolved = await resolveForkUrl(config.forking.url);
  const actual = proxyUrl(resolved.url);
  ensure(actual === expected, 'FORK_PROXY_ENDPOINT_MISMATCH');
  return {forkUrlKind:resolved.kind, exactLauncherProxyMatched:true,
    localNetworkChecked:true, pinnedBlockNumber:pin.block.number};
}

module.exports={ensure,Stop,hash,compare,canonical,proxyUrl,resolveForkUrl,assertLocal};
