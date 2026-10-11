#!/usr/bin/env node
'use strict';
// Keep initialization inside the caught boundary. The shell entrypoint guards preloads BEFORE Node startup.
(async()=>{
  const path=require('node:path'),root=path.resolve(__dirname,'../..');
  const I=require('./lib/io.cjs');
  I.ensure(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'NODE_PRELOAD_SETTINGS_REQUIRE_REVIEW');
  I.ensure(!process.env.PRIVATE_KEY&&!process.env.DEPLOY_CONFIRM_MAINNET,'SIGNING_ENVIRONMENT_REFUSED');
  const args=process.argv.slice(2),mode=args.shift();
  const names=['evidence','inspect','ens','rehearse','activation','recover','plan'];
  if(mode==='help'||mode==='--help'||!mode||args.includes('--help')){
    console.log(`AGIJobManager supported commissioning commands (repository root or hardhat npm aliases)
  mainnet:evidence                 Offline historical consistency; never current state
  mainnet:inspect -- --instance recorded-2026-10-10 --out /private/new.json
  ens:inspect     -- --instance recorded-2026-10-10 --out /private/new.json
  ens:rehearse    -- --instance recorded-2026-10-10 --input /private/observation.json --out /private/new.json
  ens:recover     -- --instance recorded-2026-10-10 --journal /private/DEPLOYMENT_REVIEW.json --out /private/new.json
  ens:plan -- --input /private/namespace-plan.json --out /private/new.json
  activation:review -- --template  Offline blank A1–A5 input; redirect to a private file
  activation:review -- --input /private/activation.json --out /private/new.json

Read modes require MAINNET_RPC_URL (HTTPS), no wallet/private key and no dotenv loading.
Optional inspect: --build /private/reviewed-build.json --approval-start 0 --participants 0x...,0x...
Optional recovery: --artifact /private/ENSJobPages.json
Paths are relative to the invoking process directory. Prefer absolute paths with npm --prefix.
Output parent must already exist, be owned by you and mode 700. Files are exclusive mode 600.
Exit 0: scoped PASS / template. Exit 1: failed check. Exit 2: setup/input error.
Exit 3: missing evidence / operator input / collection awaiting separate approval.
See docs/OPERATIONS/COMMISSIONING.md. No command authorizes public writes or intake.`);return;
  }
  I.ensure(names.includes(mode),'COMMAND_UNKNOWN');
  const options={};
  while(args.length){const key=args.shift();I.ensure(/^--[a-z-]+$/.test(key)&&!Object.hasOwn(options,key),'ARGUMENT_INVALID_OR_DUPLICATED');
    if(key==='--template'){options[key]=true;continue;}const val=args.shift();I.ensure(val&&!val.startsWith('--'),'ARGUMENT_VALUE_REQUIRED');options[key]=val;}
  const allowed={evidence:[],inspect:['--instance','--out','--build','--approval-start','--participants'],ens:['--instance','--out','--approval-start'],
    rehearse:['--instance','--out','--input'],activation:['--template','--input','--out'],recover:['--instance','--out','--journal','--artifact'],plan:['--input','--out']};
  I.ensure(Object.keys(options).every(k=>allowed[mode].includes(k)),'ARGUMENT_NOT_ALLOWED');
  let report;
  if(mode==='evidence'){const H=require('./mainnet-evidence.cjs');report=H.validate(H.load());}
  else if(mode==='activation'&&options['--template']){
    I.ensure(Object.keys(options).length===1,'TEMPLATE_FLAGS_INVALID');report=require('./lib/activation.cjs').template();
  }else{
    I.ensure(options['--out'],'OUTPUT_REQUIRED');
    const sourceBefore=I.source(root);
    if(mode==='activation'){
      I.ensure(options['--input'],'ACTIVATION_INPUT_REQUIRED');const input=I.read(options['--input']);
      report=require('./lib/activation.cjs').review(input.value,{base:path.dirname(path.resolve(options['--input']))});
      report.inputs.unshift({role:'activation-input',sha256:input.sha256,bytes:input.bytes});
    }else{
      I.ensure(mode==='plan'||options['--instance']==='recorded-2026-10-10','EXPLICIT_RECORDED_INSTANCE_REQUIRED');
      I.ensure(process.env.MAINNET_RPC_URL,'MAINNET_RPC_URL_REQUIRED_SEE_COMMISSIONING_GUIDE');
      if(mode==='rehearse') report=await require('./lib/rehearsal.cjs').rehearse({root,input:options['--input'],url:process.env.MAINNET_RPC_URL});
      else{
        const transport=require('./lib/transport.cjs').makeTransport(process.env.MAINNET_RPC_URL);
        if(mode==='plan'){I.ensure(options['--input'],'NAMESPACE_INPUT_REQUIRED');const config=I.read(options['--input']);report=await require('./lib/namespace.cjs').plan({rpc:transport.rpc,config:config.value});report.inputs=[{role:'namespace-plan',sha256:config.sha256,bytes:config.bytes}];}
        else if(mode==='recover'){I.ensure(options['--journal'],'ORIGINAL_JOURNAL_REQUIRED');report=await require('./lib/recovery.cjs').recover({rpc:transport.rpc,journal:options['--journal'],artifact:options['--artifact']});}
        else{
          const start=options['--approval-start'];I.ensure(start===undefined||/^(0|[1-9][0-9]*)$/.test(start),'APPROVAL_START_INVALID');
          report=await require('./lib/inspect.cjs').inspect({rpc:transport.rpc,mode:mode==='ens'?'ens':'mainnet',build:options['--build'],approvalStart:start===undefined?undefined:Number(start),participants:options['--participants']?.split(',')||[]});
        }
        report.transport=transport.audit;
      }
    }
    const sourceAfter=I.source(root);
    report.source=sourceBefore;
    if(!I.sameSource(sourceBefore,sourceAfter)){
      report.status='FAIL';report.code='SOURCE_CHANGED_DURING_COMMAND';report.sourceAfter=sourceAfter;
    }
    I.write(options['--out'],report);
  }
  console.log(I.stringify(report));
  process.exitCode=report.status==='FAIL'?1:['NEEDS_OPERATOR_INPUT','NOT_RUN','COLLECTION_COMPLETE_REVIEW_REQUIRED'].includes(report.status)?3:0;
})().catch(error=>{
  // Never forward provider, parser, module loader, path, or arbitrary thrown text.
  const code=error?.constructor?.name==='Stop'&&typeof error.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?error.code:'LOCAL_MODULE_INPUT_OR_IO_FAILURE';
  console.error('STOP: '+code);process.exitCode=2;
});
