#!/usr/bin/env node
'use strict';
try{
  const I=require('./lib/io.cjs'),path=require('node:path');
  const args=process.argv.slice(2),o={};
  while(args.length){const k=args.shift(),v=args.shift();I.ensure(['--artifact','--build-input','--build-output','--receipt','--out'].includes(k)&&v&&!o[k],'BUILD_EXPORT_USAGE');o[k]=v;}
  I.ensure(Object.keys(o).length===5,'BUILD_EXPORT_REQUIRES_ARTIFACT_BUILD_INPUT_BUILD_OUTPUT_RECEIPT_OUT');
  const records=Object.fromEntries(Object.entries(o).filter(([k])=>k!=='--out').map(([k,v])=>[k,I.read(v,64*1024*1024)]));
  const artifact=records['--artifact'].value,input=records['--build-input'].value,output=records['--build-output'].value,receipt=records['--receipt'].value;
  I.ensure(artifact.contractName==='AGIJobManager'&&input.input&&output.output&&receipt.libraries,'BUILD_EXPORT_INPUT_SHAPES');
  const value={schema:'agijobmanager-reviewed-build-v1',artifact,buildInfo:{...input,output:output.output},libraries:receipt.libraries,
    provenance:Object.fromEntries(Object.entries(records).map(([k,v])=>[k,{sha256:v.sha256,bytes:v.bytes}]))};
  I.write(o['--out'],value);console.log('BUILD_BUNDLE_WRITTEN: Review provenance; inspection will replay the compiler and match deployed code.');
}catch{console.error('STOP: BUILD_EXPORT_INPUT_OR_OUTPUT_INVALID. Supply the saved manager artifact, Hardhat build input/output and receipt in a private directory.');process.exitCode=2;}
