import fs from 'node:fs';
import path from 'node:path';

const targetArg = process.argv[2] || 'dist-ipfs/agijobmanager.html';
const targetPath = path.isAbsolute(targetArg) ? targetArg : path.join(process.cwd(), targetArg);

if (!fs.existsSync(targetPath)) {
  throw new Error(`Cannot inject CSP: file not found at ${targetPath}`);
}

const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
let html = fs.readFileSync(targetPath, 'utf8');

const cspMeta = `  <meta http-equiv=\"Content-Security-Policy\" content=\"${csp}\">`;
if (/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.test(html)) {
  html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, cspMeta);
} else {
  html = html.replace('</head>', `${cspMeta}\n</head>`);
}

if (!/name=["']referrer["']/i.test(html)) {
  html = html.replace('</head>', '  <meta name="referrer" content="no-referrer">\n</head>');
}

fs.writeFileSync(targetPath, html, 'utf8');
console.log(`Injected CSP/referrer policy into ${targetPath}`);
