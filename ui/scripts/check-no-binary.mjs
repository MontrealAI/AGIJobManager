import fs from 'node:fs';
import path from 'node:path';
const forbidden = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.tgz','.woff','.woff2','.ttf','.otf']);
const roots = [path.resolve('.'), path.resolve('../docs/ui')];
const bad = [];
for (const root of roots) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git', 'playwright-report', 'test-results'].includes(entry.name)) continue;
        walk(p);
      } else if (forbidden.has(path.extname(entry.name).toLowerCase())) bad.push(p);
    }
  };
  walk(root);
}
if (bad.length) throw new Error(`Forbidden binary files:\n${bad.join('\n')}`);
console.log('No forbidden binaries found.');
