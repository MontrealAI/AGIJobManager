'use strict';
const {ensure, Stop, parse} = require('./io.cjs');
const Q = x => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x);
const H = x => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x);
const A = x => typeof x === 'string' && /^0x[0-9a-f]{40}$/i.test(x);
const B = x => typeof x === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(x);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const tag = x => Q(x) || ['latest','earliest','safe','finalized','pending'].includes(x);
const canonical = x => object(x) && Object.keys(x).length === 2 && H(x.blockHash) && x.requireCanonical === true;
const at = x => tag(x) || canonical(x);
const METHODS = new Set(['eth_chainId','net_version','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getCode','eth_getBalance','eth_getStorageAt','eth_getTransactionCount','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getLogs','eth_getProof','eth_feeHistory','eth_call']);
function validateMember(r) {
  ensure(object(r) && Object.keys(r).every(k => ['jsonrpc','id','method','params'].includes(k)) && r.jsonrpc === '2.0' &&
    ((Number.isSafeInteger(r.id) && r.id >= 0) || (typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 80)) &&
    METHODS.has(r.method) && Array.isArray(r.params), 'RPC_METHOD_OR_SHAPE_REFUSED');
  const p = r.params; let ok = false;
  switch (r.method) {
    case 'eth_chainId': case 'net_version': case 'eth_blockNumber': ok = p.length === 0; break;
    // EDR requests full transactions when constructing the pinned fork block.
    // Both forms are reads and remain subject to the streamed response limit.
    case 'eth_getBlockByNumber': ok = p.length === 2 && tag(p[0]) && typeof p[1] === 'boolean'; break;
    case 'eth_getBlockByHash': ok = p.length === 2 && H(p[0]) && typeof p[1] === 'boolean'; break;
    case 'eth_getCode': case 'eth_getBalance': case 'eth_getTransactionCount': ok = p.length === 2 && A(p[0]) && at(p[1]); break;
    case 'eth_getStorageAt': ok = p.length === 3 && A(p[0]) && (Q(p[1]) || H(p[1])) && BigInt(p[1]) < 2n**256n && at(p[2]); break;
    case 'eth_getTransactionByHash': case 'eth_getTransactionReceipt': ok = p.length === 1 && H(p[0]); break;
    case 'eth_getProof': ok = p.length === 3 && A(p[0]) && Array.isArray(p[1]) && p[1].length <= 64 && p[1].every(H) && at(p[2]); break;
    case 'eth_call': ok = p.length === 2 && object(p[0]) && Object.keys(p[0]).every(k=>['to','data','from'].includes(k)) &&
      A(p[0].to) && B(p[0].data) && p[0].data.length <= 131074 && (!p[0].from || /^0x0{40}$/.test(p[0].from)) && canonical(p[1]); break;
    case 'eth_feeHistory': ok = p.length === 3 && Q(p[0]) && BigInt(p[0]) > 0n && BigInt(p[0]) <= 1024n && tag(p[1]) &&
      Array.isArray(p[2]) && p[2].length <= 100 && p[2].every((v,i)=>Number.isFinite(v) && v>=0 && v<=100 && (i===0 || v>=p[2][i-1])); break;
    case 'eth_getLogs': {
      const f = p[0];
      ok = p.length === 1 && object(f) && Object.keys(f).every(k=>['address','topics','fromBlock','toBlock'].includes(k)) && A(f.address) &&
        Q(f.fromBlock) && Q(f.toBlock) && BigInt(f.toBlock) >= BigInt(f.fromBlock) && BigInt(f.toBlock)-BigInt(f.fromBlock)<5000n &&
        Array.isArray(f.topics) && f.topics.length > 0 && f.topics.length <= 4 && f.topics.every(H);
      break;
    }
  }
  ensure(ok, 'RPC_PARAMETERS_REFUSED');
}
function requestAllowed(request) {
  const list = Array.isArray(request) ? request : [request];
  ensure(list.length > 0 && list.length <= 100, 'RPC_BATCH_SIZE_INVALID');
  const ids = new Set();
  for (const r of list) { validateMember(r); ensure(!ids.has(r.id), 'RPC_DUPLICATE_ID'); ids.add(r.id); }
}
async function boundedBody(response, limit = 8*1024*1024) {
  const length = response.headers?.get('content-length');
  ensure(!length || (/^\d+$/.test(length) && Number(length) <= limit), 'RPC_RESPONSE_SIZE_LIMIT');
  ensure(response.body && typeof response.body[Symbol.asyncIterator] === 'function', 'RPC_STREAM_REQUIRED');
  let size = 0; const chunks = [];
  for await (const chunk of response.body) { size += chunk.length; ensure(size <= limit, 'RPC_RESPONSE_SIZE_LIMIT'); chunks.push(Buffer.from(chunk)); }
  return parse(Buffer.concat(chunks).toString('utf8'), limit);
}
function validateResponse(request, response) {
  const req = Array.isArray(request) ? request : [request], res = Array.isArray(response) ? response : [response];
  ensure(Array.isArray(request) === Array.isArray(response) && req.length === res.length, 'RPC_RESPONSE_IDENTITY');
  const ids = new Set(req.map(r=>r.id));
  for (const r of res) {
    ensure(object(r) && r.jsonrpc === '2.0' && ids.delete(r.id) &&
      Object.keys(r).every(k=>['jsonrpc','id','result','error'].includes(k)) &&
      (Object.hasOwn(r,'result') !== Object.hasOwn(r,'error')), 'RPC_RESPONSE_IDENTITY');
    ensure(!Object.hasOwn(r,'error'), 'RPC_PROVIDER_REJECTED_READ');
  }
  return response;
}
function makeTransport(url, {fetchImpl = fetch, limit = 8*1024*1024, maxRequests = 30000} = {}) {
  let endpoint; try { endpoint = new URL(url); } catch { throw new Stop('RPC_URL_INVALID'); }
  ensure(endpoint.protocol === 'https:' && endpoint.hostname && !endpoint.username && !endpoint.password && !endpoint.hash, 'RPC_HTTPS_WITHOUT_USERINFO_REQUIRED');
  const audit = {requests:0, methods:{}, rejections:0, upstreamFailures:0, publicTransactionsBroadcast:0};
  async function request(payload) {
    try { requestAllowed(payload); } catch(e) { audit.rejections++; throw e; }
    ensure(Buffer.byteLength(JSON.stringify(payload)) <= 1048576, 'RPC_REQUEST_SIZE_LIMIT');
    ensure(++audit.requests <= maxRequests, 'RPC_REQUEST_LIMIT');
    for (const r of Array.isArray(payload)?payload:[payload]) audit.methods[r.method]=(audit.methods[r.method]||0)+1;
    try {
      const response = await fetchImpl(endpoint, {method:'POST', redirect:'error', signal:AbortSignal.timeout(25000),
        headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
      ensure(response.ok, 'RPC_HTTP_FAILURE');
      return validateResponse(payload, await boundedBody(response, limit));
    } catch(e) { audit.upstreamFailures++; if(e instanceof Stop) throw e; throw new Stop('RPC_TRANSPORT_FAILURE'); }
  }
  let id=0;
  const rpc = async (method, params) => (await request({jsonrpc:'2.0',id:++id,method,params})).result;
  return {rpc, request, audit};
}
module.exports = {makeTransport, requestAllowed, validateResponse, boundedBody, METHODS, Q, H, A, B};
