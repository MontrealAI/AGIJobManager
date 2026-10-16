import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
for (const file of (await readdir('dist')).filter(value => value.endsWith('.js') || value.endsWith('.json'))) {
  const content = await readFile(`dist/${file}`,'utf8');
  assert.equal(/__COMPANION_BROWSER_TEST__|TEST_ONLY_SYNTHETIC_DEVICE|test\/fixtures\/browser|browser-test-only-device/.test(content),false,'PRODUCTION_MUST_NOT_REFERENCE_SYNTHETIC_DEVICE');
}
process.stdout.write('Production browser test-alias exclusion PASS.\n');
