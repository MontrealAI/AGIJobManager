import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
createServer(async (req, res) => {
  const entry = files.get(req.url);
  if (req.method !== 'GET' || !entry || (req.headers.host !== '127.0.0.1:4173' && req.headers.host !== 'localhost:4173')) { res.writeHead(404); res.end(); return; }
  try {
    const content = await readFile(new URL(`../dist/${entry[0]}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'Permissions-Policy': 'hid=(self), bluetooth=(), usb=()' });
    res.end(content);
  } catch { res.writeHead(503); res.end('Run npm run build before starting.'); }
}).listen(4173, '127.0.0.1', () => process.stdout.write('Local signer: http://127.0.0.1:4173\n'));
