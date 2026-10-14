import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renderSuccessor } from '../../site/successor.mjs';
import { canonical } from '../../site/assets/successor/safe.mjs';
import { sourceZip } from '../../site/assets/successor/archive.mjs';
import { STYLE } from '../../site/assets/successor/missions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = (value, encoding = 'hex') => createHash('sha256').update(value).digest(encoding);
export const SOURCE_FILES = ['site/assets/payments.mjs', 'site/assets/employer-model.mjs', ...['safe', 'legacy-missions', 'legacy-checker', 'mapping', 'missions', 'checker', 'model', 'jobs', 'archive', 'app'].map(name => `site/assets/successor/${name}.mjs`), 'site/assets/successor/style.css', 'site/successor.mjs', 'scripts/successor/build.mjs', 'scripts/successor/portable.test.mjs'];

// A deliberately small closed-module bundler for reviewed repository source.
// It never processes imported capsules or downloaded source text.
export function bundle(entrypoints) {
  const modules = new Map(); let output = '';
  function visit(file) {
    if (modules.has(file)) return modules.get(file);
    if (!SOURCE_FILES.includes(file)) throw Error('Unreviewed bundle dependency: ' + file);
    const name = 'module' + modules.size; modules.set(file, name);
    const source = read(file), exported = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(m => m[1]);
    let body = source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, names, reference) => {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), reference));
      return `const {${names.replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$1: $2')}} = ${visit(dependency)};`;
    }).replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '');
    if (/^import\s/m.test(body)) throw Error('Unsupported import in ' + file);
    output += `\nconst ${name} = (() => {\n${body}\nreturn { ${exported.join(', ')} };\n})();\n`;
    return name;
  }
  const names = entrypoints.map(visit); return { code: output, names };
}
export function builderArtifacts({ commit, version } = {}) {
  if (!commit) {
    if (fs.existsSync(path.join(root, 'SOURCE.json'))) ({ commit, version } = JSON.parse(read('SOURCE.json')));
    else { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); version = JSON.parse(read('package.json')).version; }
  }
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(version)) throw Error('Invalid source identity');
  const files = SOURCE_FILES.map(file => ({ path: file, sha256: hash(read(file)) }));
  const sourceManifest = { repository: 'MontrealAI/AGIJobManager', commit, engineSha256: hash(canonical(files)), files, license: 'MIT' };
  const main = bundle(['site/assets/successor/app.mjs']);
  const script = ("'use strict';\n(() => {" + main.code + '\n' + main.names[0] + '.initialize();\n})();').replace(/<\/script/gi, '<\\/script');
  const worker = bundle(['site/assets/successor/model.mjs', 'site/assets/successor/jobs.mjs']);
  const workerSource = "'use strict';\n" + worker.code + `\nself.onmessage = async ({data}) => { try { let result; const p = data.payload;
    if (data.operation === 'run') result = await ${worker.names[0]}.runCandidate(p.state, p.variant, p.sourceIdentity);
    else if (data.operation === 'inspect') result = await ${worker.names[0]}.inspectCapsule(p.raw);
    else if (data.operation === 'continue-history') result = await ${worker.names[0]}.continueHistory(p.state, p.confirmed);
    else if (data.operation === 'restore') result = await ${worker.names[0]}.restoreCapsule(p.inspected, p.confirmed);
    else if (data.operation === 'plan') result = await ${worker.names[1]}.prepareImprovement(p.state, p.options);
    else throw Error('OPERATION');
    self.postMessage({result}); } catch (error) { self.postMessage({error:error.message, code:error.code || error.message, failureState:error.failureState || null}); } };`;
  const css = read('site/assets/successor/style.css'), license = read('LICENSE');
  const params = { commit, version, css, script, scriptHash: hash(script, 'base64'), styleHash: hash(css, 'base64'), artifactStyleHash: hash(STYLE, 'base64'), sourceManifest, license, workerSource };
  const pages = Object.fromEntries(['en', 'fr'].map(lang => [lang, renderSuccessor(lang, params)]));
  const layouts = Object.fromEntries(Object.entries(pages).map(([lang, html]) => [lang, html.match(/<div id="interface">([\s\S]*?)<\/div><script id="successor-source"/)[1]]));
  const sources = [...SOURCE_FILES.map(file => ({ path: file, content: read(file) })), { path: 'LICENSE', content: license }, { path: 'SOURCE.json', content: JSON.stringify({ commit, version, sourceManifest }, null, 2) + '\n' }, { path: 'README.txt', content: 'SUCCESSOR Ω editable local engine (MIT).\nRequires Node 22.23.2 or later. No npm install or network is needed.\nTest: node --test scripts/successor/portable.test.mjs\nRebuild: node scripts/successor/build.mjs --out rebuilt\nOpen rebuilt/My-SUCCESSOR-Omega-en.html in a desktop browser.\nImport your separate JSON capsule, confirm restore, and rerun.\nChanges to the engine require a new source identity and fresh checks.\nNo credentials, paid providers or live-worker software are included.\nThe full repository includes adversarial tests, CLI adapters, worker rehearsal and operator documentation.\n' }];
  const inert = value => JSON.stringify(value).replace(/</g, '\\u003c');
  for (const lang of ['en', 'fr']) pages[lang] = pages[lang].replace('<script id="successor-sources" type="application/json">null</script>', () => '<script id="successor-sources" type="application/json">' + inert(sources) + '</script>').replace('<script id="successor-layouts" type="application/json">null</script>', () => '<script id="successor-layouts" type="application/json">' + inert(layouts) + '</script>');
  return { pages, sourceManifest, sources, zip: sourceZip(sources) };
}
export function buildSuccessor(output, options = {}) {
  const artifacts = builderArtifacts(options); fs.mkdirSync(output, { recursive: true });
  for (const lang of ['en', 'fr']) fs.writeFileSync(path.join(output, `My-SUCCESSOR-Omega-${lang}.html`), artifacts.pages[lang]);
  fs.writeFileSync(path.join(output, 'SUCCESSOR-Omega-editable-source.zip'), artifacts.zip);
  fs.writeFileSync(path.join(output, 'SOURCE_MANIFEST.json'), JSON.stringify(artifacts.sourceManifest, null, 2) + '\n');
  return artifacts;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); if (args.length && (args.length !== 2 || args[0] !== '--out')) throw Error('Usage: node scripts/successor/build.mjs [--out directory]');
  const out = path.resolve(args[1] || path.join(root, 'build/successor')); buildSuccessor(out); console.log('Built offline SUCCESSOR Ω and editable source: ' + out);
}
