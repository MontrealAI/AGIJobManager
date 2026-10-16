import { build } from 'esbuild';
import { mkdir, copyFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const fixture = resolve('test/fixtures/browser/device.mjs');
export async function buildBrowserFixture(directory) {
  await mkdir(directory, { recursive: true });
  const entries = [['src/app.mjs','app.js'],['src/campaign-app.mjs','campaign-app.js'],['src/campaign-signer.mjs','campaign-signer.js']];
  const built = [];
  for (const [input, output] of entries) {
    try { await access(input); } catch { continue; }
    const result = await build({ entryPoints: [input], outfile: resolve(directory,output), bundle: true, platform: 'browser', format: 'esm', target: 'es2022', legalComments: 'none', metafile: true, plugins: [{ name: 'browser-test-only-device', setup(context) { context.onResolve({ filter: /^\.\/device\.mjs$/ }, () => ({ path: fixture })); } }] });
    if (output !== 'campaign-app.js' && !Object.keys(result.metafile.inputs).some(path => path.endsWith('/fixtures/browser/device.mjs'))) throw new Error('TEST_DEVICE_ALIAS_MISSING');
    built.push(output);
  }
  for (const file of ['index.html','style.css','campaign.html','campaign-signer.html','campaign.css']) { try { await copyFile(file,resolve(directory,file)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  return built;
}
