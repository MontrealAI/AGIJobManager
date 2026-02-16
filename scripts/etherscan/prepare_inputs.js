#!/usr/bin/env node

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function parseAmountToBaseUnits(input, decimals) {
  const text = String(input).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Invalid amount: ${input}`);
  const [whole, frac = ''] = text.split('.');
  if (frac.length > decimals) {
    throw new Error(`Too many decimal places for decimals=${decimals}: ${input}`);
  }
  const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const base = `${whole}${paddedFrac}`.replace(/^0+/, '') || '0';
  return base;
}

function parseDurationToSeconds(input) {
  const text = String(input).trim().toLowerCase();
  if (/^\d+$/.test(text)) return BigInt(text).toString();
  const match = text.match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new Error(`Invalid duration: ${input}. Use forms like 3600, 12h, 7d`);
  }
  const value = BigInt(match[1]);
  const unit = match[2];
  const scale = {
    s: 1n,
    m: 60n,
    h: 3600n,
    d: 86400n,
    w: 604800n,
  }[unit];
  return (value * scale).toString();
}

function printBlock(title, lines) {
  console.log(`\n=== ${title} ===`);
  for (const line of lines) console.log(line);
}

function checklist(action) {
  const common = [
    '- Read: paused() and settlementPaused()',
    '- Read: job state (getJobCore/getJobValidation) if action is job-specific',
    '- Check wallet AGI balance and ERC20 allowance',
    '- Confirm you are using token base units and seconds',
  ];
  if (action === 'create-job') common.push('- Confirm intake is not paused');
  if (action === 'finalize') common.push('- Confirm review/challenge windows are elapsed or early-approval criteria met');
  if (action === 'resolve-dispute') common.push('- Confirm disputed=true and your address is a moderator/owner');
  return common;
}

function asProofArray(input) {
  if (!input) return '[]';
  if (input.trim().startsWith('[')) return input;
  return JSON.stringify(input.split(',').map((x) => x.trim()).filter(Boolean));
}

function parseDecimals(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`Invalid decimals: ${raw}. Expected a whole number between 0 and 255.`);
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`Invalid decimals: ${raw}. Expected a whole number between 0 and 255.`);
  }
  return value;
}

function run() {
  const args = parseArgs(process.argv);
  const action = args.action || 'help';
  const decimals = parseDecimals(args.decimals || '18');

  if (action === 'help' || args.help) {
    console.log('Usage: node scripts/etherscan/prepare_inputs.js --action <action> [options]');
    console.log('Actions: convert, approve, create-job, apply, request-completion, validate, disapprove, resolve-dispute, finalize');
    process.exit(0);
  }

  if (action === 'convert') {
    const amount = args.amount || '0';
    const duration = args.duration || '0';
    printBlock('Conversions', [
      `amount(${amount}) with decimals=${decimals} => ${parseAmountToBaseUnits(amount, decimals)}`,
      `duration(${duration}) => ${parseDurationToSeconds(duration)}`,
    ]);
  }

  if (action === 'approve') {
    const spender = args.spender || '<AGIJobManagerAddress>';
    const amountHuman = args.amount || '0';
    const amountBase = parseAmountToBaseUnits(amountHuman, decimals);
    printBlock('Copy/paste into Etherscan: ERC20 approve(spender, amount)', [
      `spender: ${spender}`,
      `amount: ${amountBase}  // ${amountHuman} tokens @ ${decimals} decimals`,
    ]);
  }

  if (action === 'create-job') {
    const payoutHuman = args.payout || '0';
    const payoutBase = parseAmountToBaseUnits(payoutHuman, decimals);
    const durationSeconds = parseDurationToSeconds(args.duration || '0');
    printBlock('Copy/paste into Etherscan: createJob(jobSpecURI, payout, duration, details)', [
      `jobSpecURI: ${args.jobSpecURI || 'ipfs://<job-spec.json>'}`,
      `payout: ${payoutBase}  // ${payoutHuman} tokens`,
      `duration: ${durationSeconds}  // from ${args.duration || '0'}`,
      `details: ${args.details || 'short plain-language job summary'}`,
    ]);
  }

  if (action === 'apply') {
    printBlock('Copy/paste into Etherscan: applyForJob(jobId, subdomain, proof)', [
      `jobId: ${args.jobId || '0'}`,
      `subdomain: ${args.subdomain || 'alice-agent'}`,
      `proof: ${asProofArray(args.proof)}`,
    ]);
  }

  if (action === 'request-completion') {
    printBlock('Copy/paste into Etherscan: requestJobCompletion(jobId, jobCompletionURI)', [
      `jobId: ${args.jobId || '0'}`,
      `jobCompletionURI: ${args.jobCompletionURI || 'ipfs://<job-completion.json>'}`,
    ]);
  }

  if (action === 'validate' || action === 'disapprove') {
    printBlock(`Copy/paste into Etherscan: ${action === 'validate' ? 'validateJob' : 'disapproveJob'}(jobId, subdomain, proof)`, [
      `jobId: ${args.jobId || '0'}`,
      `subdomain: ${args.subdomain || 'validator-1'}`,
      `proof: ${asProofArray(args.proof)}`,
    ]);
  }

  if (action === 'resolve-dispute') {
    printBlock('Copy/paste into Etherscan: resolveDisputeWithCode(jobId, resolutionCode, reason)', [
      `jobId: ${args.jobId || '0'}`,
      `resolutionCode: ${args.code || '1'}  // 0=NO_ACTION, 1=AGENT_WIN, 2=EMPLOYER_WIN`,
      `reason: ${args.reason || 'EVIDENCE:v1|summary:...|links:...|moderator:...|ts:...'} `,
    ]);
  }

  if (action === 'finalize') {
    printBlock('Copy/paste into Etherscan: finalizeJob(jobId)', [`jobId: ${args.jobId || '0'}`]);
  }

  printBlock(`Pre-flight checklist for action=${action}`, checklist(action));
}

run();
