'use strict';
// Pure exact-envelope validation. This module never signs or submits a transaction.
const E=require('ethers'),crypto=require('node:crypto');
const MAX_GAS=16777216n;
const canonical=x=>JSON.stringify(stable(x));
function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]));return x;}
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
function need(ok,message){if(!ok)throw Error(message);}
function exact(x,keys){need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.slice().sort().join(),'Missing or unsupported fields.');}
function address(x){need(typeof x==='string'&&E.isAddress(x)&&E.getAddress(x)!==E.ZeroAddress,'Nonzero address required.');return E.getAddress(x);}
function quantity(x){need(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**256n,'Exact decimal quantity required.');return BigInt(x);}
function integer(x,min=0){need(Number.isSafeInteger(x)&&x>=min,'Safe integer required.');return x;}
function hash(x){need(typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!==E.ZeroHash,'Nonzero canonical hash required.');return x;}
function sha(x){need(typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)&&!/^0+$/.test(x),'Nonzero SHA256 required.');return x;}
function bytes(x){need(typeof x==='string'&&/^0x(?:[0-9a-f]{2})*$/.test(x),'Canonical lowercase bytes required.');return x;}
function validateEnvelope(x){
 exact(x,['type','chainId','from','nonce','to','value','data','gasLimit','maxFeePerGas','maxPriorityFeePerGas','accessList']);
 need(x.type===2&&x.chainId===1&&x.to===null&&x.value==='0','Only direct Ethereum type-2 zero-value CREATE is supported.');
 need(x.from===address(x.from),'Checksummed creator required.');integer(x.nonce);bytes(x.data);need(x.data.length>2&&(x.data.length-2)/2<=49152,'Creation initcode length is invalid.');
 need(quantity(x.gasLimit)>=53000n&&quantity(x.gasLimit)<=MAX_GAS,'EIP-7825 creation gas limit exceeded or insufficient.');
 need(quantity(x.maxFeePerGas)>0n&&quantity(x.maxPriorityFeePerGas)<=quantity(x.maxFeePerGas),'Invalid reviewed fee envelope.');
 need(Array.isArray(x.accessList)&&x.accessList.length===0,'Explicit empty access list required.');return x;
}
function unsignedTransaction(envelope){validateEnvelope(envelope);const {from,...tx}=envelope;return E.Transaction.from(tx);}
function decodeSigned(raw,envelope){
 validateEnvelope(envelope);bytes(raw);need(raw.startsWith('0x02')&&raw.length<=200000,'Only bounded signed type-2 payloads are supported.');
 let tx;try{tx=E.Transaction.from(raw);need(tx.isSigned()&&tx.serialized===raw,'Noncanonical or unsigned transaction.');}catch{throw Error('Invalid canonical signed transaction.');}
 const actual={type:tx.type,chainId:Number(tx.chainId),from:tx.from,nonce:tx.nonce,to:tx.to,value:String(tx.value),data:tx.data,gasLimit:String(tx.gasLimit),maxFeePerGas:String(tx.maxFeePerGas),maxPriorityFeePerGas:String(tx.maxPriorityFeePerGas),accessList:tx.accessList};
 need(tx.authorizationList===null&&tx.blobVersionedHashes===null&&canonical(actual)===canonical(envelope),'Signed transaction differs from every reviewed envelope field or sender.');
 need(tx.hash===E.keccak256(raw),'Signed transaction hash mismatch.');
 return {hash:tx.hash,from:tx.from,envelopeSha256:digest(envelope),rawSha256:digest(raw)};
}
function rpcTransactionRaw(tx){
 need(tx&&tx.type==='0x2','Observed transaction is not type 2.');
 const parsed={type:2,chainId:BigInt(tx.chainId),nonce:Number(BigInt(tx.nonce)),to:tx.to,value:BigInt(tx.value),data:tx.input,gasLimit:BigInt(tx.gas),maxFeePerGas:BigInt(tx.maxFeePerGas),maxPriorityFeePerGas:BigInt(tx.maxPriorityFeePerGas),accessList:tx.accessList,signature:{r:tx.r,s:tx.s,yParity:Number(BigInt(tx.yParity??tx.v))}};
 need(!tx.authorizationList&&!tx.blobVersionedHashes,'Unexpected transaction authorization/blob fields.');return E.Transaction.from(parsed).serialized;
}
module.exports={MAX_GAS,canonical,digest,need,exact,address,quantity,integer,hash,sha,bytes,validateEnvelope,unsignedTransaction,decodeSigned,rpcTransactionRaw};
