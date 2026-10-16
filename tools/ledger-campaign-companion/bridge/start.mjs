import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manager from '../coordinators/manager.mjs';
import alpha from '../coordinators/alpha.mjs';
import jobs from '../coordinators/jobs.mjs';
import { createCampaignEngine } from './campaign-engine.mjs';
import { createBridgeServer } from './http-server.mjs';
import { sha256 } from './private-store.mjs';
import { createVerificationAutomation } from '../verification/automation.mjs';
import { registerActorLockDirectory } from './actor-lock-policy.mjs';
import { observeSource, readJson } from '../coordinators/common.mjs';
import { assertTrustedSigningHost, createTrustedCampaignContext } from '../trust/local-build.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const adapters = Object.freeze({ manager, alpha, jobs });
const usage = 'node bridge/start.mjs --campaign /absolute/private/reviewed-campaign.json --reviewed-campaign-sha256 EXACT_INDEPENDENTLY_REVIEWED_DIGEST --trust-policy /absolute/private/mac-build-policy.json --reviewed-trust-policy-sha256 INDEPENDENT_MAC_REVIEW_DIGEST --actor-lock-directory /absolute/private/shared-actor-locks --state /absolute/private/campaign-state [--port 8787] [--signer-port 8788] [--relay] [--recover-dead-bridge-owner]';
function options(argv) {
  if (argv.length === 1 && argv[0] === '--help') return null;
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i], value = argv[i + 1];
    if (['--relay', '--recover-dead-bridge-owner'].includes(key)) { if (result[key] !== undefined) throw new Error(); result[key] = true; continue; }
    if (!['--campaign', '--reviewed-campaign-sha256', '--trust-policy', '--reviewed-trust-policy-sha256', '--actor-lock-directory', '--state', '--port', '--signer-port'].includes(key) || result[key] !== undefined || typeof value !== 'string' || value.startsWith('--')) throw new Error();
    result[key] = value; i += 1;
  }
  if (!result['--campaign'] || !result['--state'] || !result['--actor-lock-directory'] || !result['--trust-policy'] || !path.isAbsolute(result['--campaign']) || !path.isAbsolute(result['--state']) || !path.isAbsolute(result['--actor-lock-directory']) || !path.isAbsolute(result['--trust-policy'])) throw new Error();
  const port = key => { const text = result[key] ?? '0'; if (!/^(0|[1-9][0-9]{0,4})$/.test(text) || Number(text) > 65535) throw new Error(); return Number(text); };
  if (!/^[0-9a-f]{64}$/.test(result['--reviewed-campaign-sha256'] ?? '') || !/^[0-9a-f]{64}$/.test(result['--reviewed-trust-policy-sha256'] ?? '')) throw new Error();
  return { campaignPath: result['--campaign'], reviewedCampaignSha256: result['--reviewed-campaign-sha256'], trustPolicyPath: result['--trust-policy'], reviewedTrustPolicySha256: result['--reviewed-trust-policy-sha256'], actorLockDirectory: result['--actor-lock-directory'], privateDirectory: result['--state'], port: port('--port'), signerPort: port('--signer-port'), relayRequested: result['--relay'] === true, recoverDeadOwner: result['--recover-dead-bridge-owner'] === true };
}
async function privateJson(filename) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024 || (stat.mode & 0o077) !== 0 || await fs.realpath(filename) !== filename || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) throw new Error();
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}
async function main() {
  const configuration = options(process.argv.slice(2)); if (!configuration) { process.stdout.write(`${usage}\n`); return; }
  assertTrustedSigningHost();
  const campaign = await privateJson(configuration.campaignPath), dispatcher = adapters[campaign.adapter]; if (!dispatcher) throw new Error();
  const adapter = typeof dispatcher.forCampaign === 'function' ? dispatcher.forCampaign(campaign) : dispatcher;
  if (sha256(campaign) !== configuration.reviewedCampaignSha256) throw new Error();
  const governor = '0xd76ad27a1bcf8652e7e46be603fa742fd1c10a99';
  if (campaign.actors?.governor?.toLowerCase() !== governor || campaign.actors?.creator?.toLowerCase() === governor) throw new Error();
  if (campaign.adapter === 'manager' && campaign.reviewedManifest?.source?.commit === 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699') throw Object.assign(new Error(), { code: 'MANAGER_NATIVE_ENS_ROOT_ORDER_CORRECTION_REQUIRED' });
  await adapter.inspectCampaign(campaign);
  const policy = await privateJson(configuration.trustPolicyPath);
  const trustedContext = createTrustedCampaignContext({ campaign, plan: readJson(campaign.coordinator.planPath), policy, expectedPolicySha256: configuration.reviewedTrustPolicySha256, sourceRoot: campaign.coordinator.checkout, observeSource: () => observeSource(campaign.coordinator, adapter.supported), nativePlanValidated: true });
  if (campaign.coordinator?.lockDirectory !== configuration.actorLockDirectory) throw new Error();
  await registerActorLockDirectory({ directory: configuration.actorLockDirectory });
  if (configuration.relayRequested && campaign.relayPolicy?.enabled !== true) throw new Error();
  const relayEnabled = configuration.relayRequested;
  const afterVerified = createVerificationAutomation({ apiKey: process.env.ETHERSCAN_API_KEY, serviceAuthorization: campaign.verification?.serviceAuthorization });
  const engine = await createCampaignEngine({ campaign, adapter, privateDirectory: configuration.privateDirectory, forbiddenRoots: [packageRoot], relayEnabled, afterVerified, recoverDeadOwner: configuration.recoverDeadOwner, trustedContext });
  let servers;
  try { servers = await createBridgeServer({ engine, staticRoot: path.join(packageRoot, 'dist'), port: configuration.port, signerPort: configuration.signerPort }); }
  catch (error) { await engine.close(); throw error; }
  let closing = false;
  const close = async () => { if (closing) return; closing = true; await servers.close(); await engine.close(); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { close().then(() => { process.exitCode = 0; }).catch(() => { process.stderr.write('COMPANION_STOP_REQUIRES_RECOVERY\n'); process.exitCode = 1; }); });
  process.stdout.write(`Open ${servers.parentOrigin}/ on this trusted Mac.\nSigner isolation: ${servers.signerOrigin}\nLocal source/compiler/build and every transaction byte revalidated.\nRelay ${relayEnabled ? 'requires exact per-step coordinator acknowledgement' : 'disabled'}. Each real transaction requires explicit owner review and manual Ledger approval; activation remains separate.\n`);
}
main().catch(error => { if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.code)) process.stderr.write(`${error.code}\n`); process.stderr.write('COMPANION_START_BLOCKED: preserve private state and review the exact campaign/source configuration.\n'); process.exitCode = 1; });
