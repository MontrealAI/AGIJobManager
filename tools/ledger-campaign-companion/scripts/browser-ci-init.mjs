import { mkdir, writeFile, realpath, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const result={schema:'ledger-companion-browser-evidence-v1',status:'NOT_RUN',sourceCommit:/^[a-f0-9]{40}$/.test(process.env.COMPANION_SOURCE_COMMIT??'')?process.env.COMPANION_SOURCE_COMMIT:null,workflowRunId:/^[0-9]+$/.test(process.env.GITHUB_RUN_ID??'')?process.env.GITHUB_RUN_ID:null,chromiumSandbox:true,syntheticDeviceOnly:true,physicalAcceptance:'NOT_PERFORMED',tests:[],passCount:0,failCount:0};
await mkdir('manual-ledger-evidence',{recursive:true});await writeFile('manual-ledger-evidence/browser-acceptance.json',`${JSON.stringify(result,null,2)}\n`);
process.stdout.write('Initialized sanitized browser metadata: NOT_RUN.\n');

// macOS temporary-directory aliases must resolve to their canonical path before strict no-symlink tests.
if (process.env.GITHUB_ENV) { const directory=await realpath(tmpdir()); if (/[\r\n]/.test(directory)) throw new Error('INVALID_CI_TEMPORARY_DIRECTORY'); await appendFile(process.env.GITHUB_ENV,`TMPDIR=${directory}\n`); }
