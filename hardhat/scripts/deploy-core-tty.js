import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const rootRequire=createRequire(new URL('../../package.json',import.meta.url));
try {
  // Root CLI and entry must share one Hardhat instance. A workspace-local
  // import can resolve a second installed copy with no initialized runtime.
  const {default:hre}=await import(pathToFileURL(rootRequire.resolve('hardhat')).href);
  const {default:creator}=await import('./deploy-core-tty.cjs');
  await creator.main({hardhat:hre});
} catch {
  console.error('MANAGER_CREATOR_STOPPED: Preserve the session. Reconcile existing signatures or submissions before another run; no automatic replacement or resend is allowed.');
  process.exitCode=1;
}
