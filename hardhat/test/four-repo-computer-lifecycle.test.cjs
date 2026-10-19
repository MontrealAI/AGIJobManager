'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertDisposableConfig,assertFixtureAmount}=require('../scripts/four-repo-computer-lifecycle.cjs');
const fixture=()=>({networks:{hardhat:{type:'edr-simulated',chainId:31337,accounts:{mnemonic:'test test test test test test test test test test test junk',count:10}}}});
test('only isolated EDR chain with known fixture accounts passes the signing boundary',()=>{assert.doesNotThrow(()=>assertDisposableConfig(fixture()));});
for(const [name,mutate] of Object.entries({
  mainnet:v=>v.networks.hardhat.chainId=1,
  http:v=>v.networks.hardhat.type='http',
  url:v=>v.networks.hardhat.url='https://public-network.invalid',
  fork:v=>v.networks.hardhat.forking={url:'https://public-network.invalid'},
  additionalNetwork:v=>v.networks.mainnet={type:'http',chainId:1},
  privateAccountSelection:v=>v.networks.hardhat.accounts=[{privateKey:'PUBLIC_TEST_SENTINEL_NOT_A_KEY'}],
}))test('refuses '+name+' before creating a provider or signer',()=>{const value=fixture();mutate(value);assert.throws(()=>assertDisposableConfig(value));});

test('bounded demonstration accepts both exact qualified amount boundaries',()=>{assert.equal(assertFixtureAmount('25000000'),25000000n);assert.equal(assertFixtureAmount('100000000'),100000000n);});
for(const amount of ['0','1','24999999','100000001','500000001',((1n<<128n)-1n).toString()])test('out-of-range demo amount '+amount+' is refused before provider/signers exist',()=>assert.throws(()=>assertFixtureAmount(amount),/FIXTURE_BUDGET|canonical/));
