import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fail, parseStrict, publicOnly } from '../../site/assets/successor/safe.mjs';
import { builderArtifacts } from './build.mjs';

import { ALPHA_SOURCE, importAlphaProject as portableImport, inspectAlphaProject as portableInspect, advanceAlphaProject as portableAdvance } from '../../site/assets/successor/alpha-project.mjs';
export { ALPHA_SOURCE };
function checkedCheckout(directory) {
  fail(typeof directory === 'string' && path.isAbsolute(directory), 'ALPHA_CHECKOUT');
  let root;
  try { root = fs.realpathSync(directory); } catch { fail(false, 'ALPHA_CHECKOUT'); }
  const gitBytes = args => {
    try { return execFileSync('git', ['-C', root, ...args], { stdio: 'pipe', timeout: 10000, maxBuffer: 100000 }); }
    catch { fail(false, 'ALPHA_CHECKOUT'); }
  };
  const git = args => gitBytes(args).toString('utf8').trim();
  fail(git(['rev-parse', 'HEAD']) === ALPHA_SOURCE.commit && git(['rev-parse', 'HEAD^{tree}']) === ALPHA_SOURCE.tree, 'ALPHA_SOURCE_PIN');
  fail(git(['status', '--porcelain', '--untracked-files=no']) === '', 'ALPHA_SOURCE_DIRTY');
  // Git status can hide edits behind skip-worktree/assume-unchanged. Read the
  // validator's complete closed source inventory from the pinned Git object,
  // then verify the actual files Node will load, including symlink boundaries.
  const manifestPath = 'docs/successor/mission/sources.json';
  const trustedBytes = gitBytes(['show', `${ALPHA_SOURCE.commit}:${manifestPath}`]);
  const fileBytes = relative => {
    fail(typeof relative === 'string' && /^[A-Za-z0-9_./-]+$/.test(relative) && !relative.split('/').includes('..') && !path.isAbsolute(relative), 'ALPHA_SOURCE_BYTES');
    const file = path.join(root, relative);
    try {
      fail(fs.lstatSync(file).isFile() && fs.realpathSync(file) === file, 'ALPHA_SOURCE_BYTES');
      return fs.readFileSync(file);
    } catch { fail(false, 'ALPHA_SOURCE_BYTES'); }
  };
  fail(fileBytes(manifestPath).equals(trustedBytes), 'ALPHA_SOURCE_BYTES');
  const manifest = JSON.parse(trustedBytes.toString('utf8'));
  fail(manifest.schema === 'successor-mission-source/v1' && Object.keys(manifest.sources).length === 17, 'ALPHA_SOURCE_BYTES');
  for (const [relative, expected] of Object.entries(manifest.sources)) {
    fail(createHash('sha256').update(fileBytes(relative)).digest('hex') === expected, 'ALPHA_SOURCE_BYTES');
  }
  return root;
}
async function validateNative(raw, directory) {
  parseStrict(raw, 2_000_000); publicOnly(raw);
  const root = checkedCheckout(directory);
  const program = `import {pathToFileURL} from 'node:url';
const {validateProject}=await import(pathToFileURL(process.cwd()+'/examples/successor-project/engine.mjs'));
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const project=await validateProject(Buffer.concat(chunks).toString('utf8'));process.stdout.write(JSON.stringify(project));`;
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', program], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); reject(Error('ALPHA_VALIDATION_TIMEOUT')); }, 15000);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 2_000_000) { failed = true; child.kill(); reject(Error('ALPHA_VALIDATION_SIZE')); } else chunks.push(chunk); });
    // Never expose a supplied dossier or local checkout details in error logs.
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(Error('ALPHA_VALIDATOR_UNAVAILABLE')); });
    child.on('close', code => { clearTimeout(timer); if (failed) return; try { fail(code === 0, 'ALPHA_NATIVE_INVALID'); resolve(parseStrict(Buffer.concat(chunks).toString('utf8'), 2_000_000)); } catch (error) { reject(error); } });
    child.stdin.end(raw);
  });
}

function context(alphaCheckout) {
  const sourceManifest = builderArtifacts().sourceManifest;
  return { sourceManifest, managerSource: { repository: 'MontrealAI/AGIJobManager', adapterSha256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'), engineSha256: sourceManifest.engineSha256 }, validateNative: raw => validateNative(raw, alphaCheckout) };
}
export async function importAlphaProject(raw, options) { return portableImport(raw, options, context(options.alphaCheckout)); }
export async function inspectAlphaProject(raw, options) { return portableInspect(raw, context(options.alphaCheckout)); }
export async function advanceAlphaProject(raw, options) { return portableAdvance(raw, options, context(options.alphaCheckout)); }
