import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['app', 'campaign-app', 'campaign-signer']) await build({ entryPoints: [`src/${name}.mjs`], outfile: `dist/${name}.js`, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, sourcemap: false, legalComments: 'external', metafile: true }).then(async result => {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(`dist/${name === 'app' ? 'build' : name}-metafile.json`, JSON.stringify(result.metafile, null, 2));
});
await copyFile('index.html', 'dist/index.html');
await copyFile('style.css', 'dist/style.css');
for (const name of ['campaign.html', 'campaign-signer.html', 'campaign.css']) await copyFile(name, `dist/${name}`);
