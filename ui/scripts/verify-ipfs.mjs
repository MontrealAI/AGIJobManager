import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const distDir = path.join(uiRoot, 'dist-ipfs');
const artifactPath = path.join(distDir, 'agijobmanager.html');

if (!fs.existsSync(distDir)) {
  throw new Error('dist-ipfs directory missing. Run npm run build:ipfs first.');
}

const entries = fs.readdirSync(distDir);
if (entries.length !== 1 || entries[0] !== 'agijobmanager.html') {
  throw new Error(`dist-ipfs must contain exactly one file (agijobmanager.html). Found: ${entries.join(', ')}`);
}

const html = fs.readFileSync(artifactPath, 'utf8');

function parseTagAttributes(tagText) {
  const attrs = new Map();
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tagText.matchAll(attrRegex)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs.set(key, value);
  }
  return attrs;
}

const scriptSrcMatches = [];
const scriptBlocks = [...html.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map((m) => m[0]);
for (const block of scriptBlocks) {
  const openingTagMatch = block.match(/^<script\b[^>]*>/i);
  if (!openingTagMatch) continue;
  const tagText = openingTagMatch[0];
  const attrs = parseTagAttributes(tagText);
  const hasValuedSrc = attrs.has('src');
  const hasValuelessSrc = /\ssrc\b(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]*)?)?(?=\s|>|\/)/i.test(tagText);

  if (hasValuedSrc || hasValuelessSrc) {
    const src = attrs.get('src') ?? '';
    scriptSrcMatches.push(src);
  }
}
if (scriptSrcMatches.length > 0) {
  throw new Error(`External script references found: ${scriptSrcMatches.join(', ')}`);
}

const stylesheetLinks = [];
for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
  const attrs = parseTagAttributes(match[0]);
  const rel = (attrs.get('rel') || '').toLowerCase();
  const href = attrs.get('href');
  if (rel.split(/\s+/).includes('stylesheet') && href) {
    stylesheetLinks.push(href);
  }
}
if (stylesheetLinks.length > 0) {
  throw new Error(`External stylesheet references found: ${stylesheetLinks.join(', ')}`);
}

const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const htmlWithoutScriptsAndStyles = htmlWithoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const urlBearingTags = new Set(['a', 'img', 'link', 'source', 'iframe', 'audio', 'video', 'track', 'embed', 'object']);
const attributeRefs = [];

for (const match of htmlWithoutScriptsAndStyles.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g)) {
  const tag = (match[1] || '').toLowerCase();
  if (!urlBearingTags.has(tag)) continue;
  const attrs = parseTagAttributes(match[0]);
  for (const attr of ['src', 'href', 'srcset']) {
    if (attrs.has(attr)) {
      attributeRefs.push({
        tag,
        attr,
        url: (attrs.get(attr) || '').trim()
      });
    }
  }
}

const isAllowedUrl = ({ tag, attr, url }) => {
  const lower = url.toLowerCase();

  if (tag === 'a' && attr === 'href') {
    return (
      lower.startsWith('#') ||
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('ipfs://') ||
      lower.startsWith('ens://') ||
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:')
    );
  }

  if (attr === 'srcset') {
    const candidates = url
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0] ?? '')
      .filter(Boolean);
    return candidates.every((candidate) => candidate.toLowerCase().startsWith('data:'));
  }

  return lower.startsWith('data:');
};

const disallowedRefs = attributeRefs.filter((entry) => !isAllowedUrl(entry));
if (disallowedRefs.length > 0) {
  const sample = disallowedRefs.slice(0, 5).map((entry) => `${entry.tag}[${entry.attr}]=${entry.url}`);
  throw new Error(`Relative or unsupported asset references found: ${sample.join(', ')}`);
}


const cssUrlRefs = [...htmlWithoutScripts.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .flatMap((m) => [...m[1].matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((x) => (x[2] || '').trim()))
  .filter(Boolean);

const disallowedCssUrls = cssUrlRefs.filter((url) => !url.toLowerCase().startsWith('data:'));
if (disallowedCssUrls.length > 0) {
  throw new Error(`Unsupported CSS url() references found: ${disallowedCssUrls.slice(0, 5).join(', ')}`);
}

const styleAttributeUrls = [...htmlWithoutScripts.matchAll(/<[^>]+\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
  .flatMap((m) => {
    const styleValue = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    return [...styleValue.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((x) => (x[2] || '').trim());
  })
  .filter(Boolean);

const disallowedStyleAttrUrls = styleAttributeUrls.filter((url) => !url.toLowerCase().startsWith('data:'));
if (disallowedStyleAttrUrls.length > 0) {
  throw new Error(`Unsupported inline style url() references found: ${disallowedStyleAttrUrls.slice(0, 5).join(', ')}`);
}

const metaTags = [...htmlWithoutScripts.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseTagAttributes(m[0]));
const cspMeta = metaTags.find((attrs) => (attrs.get('http-equiv') || '').toLowerCase() === 'content-security-policy');
if (!cspMeta) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

const cspContent = (cspMeta.get('content') || '').toLowerCase();
if (!cspContent.includes("frame-ancestors 'none'")) {
  throw new Error("CSP meta content must include frame-ancestors 'none'.");
}

if (cspContent.includes("'unsafe-eval'")) {
  throw new Error("CSP meta content must not include 'unsafe-eval'.");
}

if (!cspContent.includes("object-src 'none'")) {
  throw new Error("CSP meta content must include object-src 'none'.");
}

const referrerMeta = metaTags.find((attrs) => (attrs.get('name') || '').toLowerCase() === 'referrer');
if (!referrerMeta) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

const referrerContent = (referrerMeta.get('content') || '').toLowerCase();
if (referrerContent !== 'no-referrer') {
  throw new Error('Referrer policy meta content must be no-referrer.');
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');
if (/<[^>]+\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(htmlWithoutScriptBlocks)) {
  throw new Error('Inline event handlers detected in built HTML.');
}


const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const scriptPatterns = [
  /\bfetch\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\bimportScripts\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\bimport\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1\s*\)/gi
];

const scriptInjectionPatterns = [
  /\.src\s*=\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\.setAttribute\(\s*(["'])src\1\s*,\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\2\s*\)/gi
];

const localPathVariablePattern = /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\2/g;
const localPathMemberPattern = /\b([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+)\s*=\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\2/g;
const objectMemberLocalPathPattern = /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\{[\s\S]*?\b([a-zA-Z_$][\w$]*)\s*:\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\3[\s\S]*?\}/g;
const variableAssignmentPattern = /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*([^;\n]+)/g;

const localScriptFetches = [];
for (const body of scriptBodies) {
  for (const pattern of scriptPatterns) {
    for (const match of body.matchAll(pattern)) {
      localScriptFetches.push(match[0]);
    }
  }

  if (/\b(?:document\.)?createElement\(\s*(["'])script\1\s*\)/i.test(body)) {
    for (const pattern of scriptInjectionPatterns) {
      for (const match of body.matchAll(pattern)) {
        localScriptFetches.push(match[0]);
      }
    }

    const objectMemberSymbols = [...body.matchAll(objectMemberLocalPathPattern)].map((m) => `${m[1]}.${m[2]}`);
    const localPathSymbols = new Set([
      ...[...body.matchAll(localPathVariablePattern)].map((m) => m[1]),
      ...[...body.matchAll(localPathMemberPattern)].map((m) => m[1]),
      ...objectMemberSymbols
    ]);

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const match of body.matchAll(variableAssignmentPattern)) {
        const variableName = match[1];
        const expr = match[2] || '';
        if (localPathSymbols.has(variableName)) continue;

        for (const symbol of localPathSymbols) {
          const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const symbolRefPattern = new RegExp(`\\b${escapedSymbol}\\b`);
          if (symbolRefPattern.test(expr)) {
            localPathSymbols.add(variableName);
            expanded = true;
            break;
          }
        }
      }
    }

    for (const symbol of localPathSymbols) {
      const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const srcDirectPattern = new RegExp(`\\.src\\s*=\\s*${escapedSymbol}\\b`, 'g');
      const srcConcatPattern = new RegExp(`\\.src\\s*=\\s*[^;\\n]*(?:\\b${escapedSymbol}\\b[^;\\n]*\\+|\\+[^;\\n]*\\b${escapedSymbol}\\b)[^;\\n]*`, 'g');
      const setAttributeDirectPattern = new RegExp(`\\.setAttribute\\(\\s*(["'])src\\1\\s*,\\s*${escapedSymbol}\\b`, 'g');
      const setAttributeConcatPattern = new RegExp(`\\.setAttribute\\(\\s*(["'])src\\1\\s*,\\s*[^)]*(?:\\b${escapedSymbol}\\b[^)]*\\+|\\+[^)]*\\b${escapedSymbol}\\b)[^)]*\\)`, 'g');

      for (const pattern of [srcDirectPattern, srcConcatPattern, setAttributeDirectPattern, setAttributeConcatPattern]) {
        for (const match of body.matchAll(pattern)) {
          localScriptFetches.push(match[0]);
        }
      }
    }
  }
}
if (localScriptFetches.length > 0) {
  throw new Error(`Local sidecar fetches detected in script bodies: ${localScriptFetches.slice(0, 5).join(', ')}`);
}

const stripCommentsAndStrings = (code) => {
  let result = '';
  let i = 0;
  let state = 'normal';

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1] ?? '';

    if (state === 'normal') {
      if (ch === '/' && next === '/') {
        state = 'line-comment';
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block-comment';
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'single-quote';
        result += ' ';
        i += 1;
        continue;
      }
      if (ch === '"') {
        state = 'double-quote';
        result += ' ';
        i += 1;
        continue;
      }
      if (ch === '`') {
        state = 'template';
        result += ' ';
        i += 1;
        continue;
      }
      result += ch;
      i += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (ch === '\n') {
        state = 'normal';
        result += '\n';
      } else {
        result += ' ';
      }
      i += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        result += '  ';
        i += 2;
      } else {
        result += ch === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    if (state === 'single-quote') {
      if (ch === '\\') {
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'normal';
        result += ' ';
        i += 1;
        continue;
      }
      result += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    if (state === 'double-quote') {
      if (ch === '\\') {
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '"') {
        state = 'normal';
        result += ' ';
        i += 1;
        continue;
      }
      result += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    if (state === 'template') {
      if (ch === '\\') {
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '`') {
        state = 'normal';
        result += ' ';
        i += 1;
        continue;
      }
      result += ch === '\n' ? '\n' : ' ';
      i += 1;
    }
  }

  return result;
};

const normalizedScriptBodies = scriptBodies.map(stripCommentsAndStrings);
const uncommentedScriptBodies = scriptBodies.map((body) => body
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 '));
const hasHashAccess = normalizedScriptBodies.some((body) => /\bwindow\.location\.hash\b/.test(body));
const hasPushStateLogic = normalizedScriptBodies.some((body) => /\bhistory\.pushState\b/.test(body));
const hasRoutingHook = uncommentedScriptBodies.some((body) => /\baddEventListener\s*\(\s*(["'`])hashchange\1/.test(body))
  || normalizedScriptBodies.some((body) => /\b__IPFS_BOOTSTRAP_ROUTE__\b/.test(body));

const hasBootstrapScriptIntegrity = normalizedScriptBodies.some((body) => {
  if (!/\b__IPFS_BOOTSTRAP_ROUTE__\b/.test(body)) return false;
  return /\bwindow\.location\.hash\b/.test(body)
    && /\.startsWith\s*\(/.test(body)
    && /\bhistory\.replaceState\b/.test(body)
    && /\bbootstrapUrl\b/.test(body);
});
const stripKnownNextScriptInterleave = (source) => {
  if (!source.includes('</script>')) return source;
  const hasNextMarkers = /__next_f|_next\/static|buildId/.test(source);
  if (!hasNextMarkers) return null;

  const withoutScriptTags = source.replace(/<\/?script[^>]*>/gi, '');
  return withoutScriptTags.replace(/self\.__next_f[^\n]*(?:\n|$)/g, '');
};

const extractArrowFunctionBody = (source, constName) => {
  const declarationPatterns = [
    new RegExp(`\\b(?:const|let|var)\\s+${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`),
    new RegExp(`\\bfunction\\s+${constName}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`\\b${constName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`\\b${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`)
  ];
  const matchedDeclaration = declarationPatterns
    .map((pattern) => pattern.exec(source))
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)[0];
  if (!matchedDeclaration) return null;

  const openingBraceIndex = matchedDeclaration.index + matchedDeclaration[0].lastIndexOf('{');
  if (openingBraceIndex < 0) return null;

  let depth = 0;
  for (let i = openingBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBraceIndex + 1, i);
      }
    }
  }

  return null;
};

const validateNavigateHashRouteBody = (navigateHashRouteBody) => {
  if (navigateHashRouteBody.includes('</script>')) {
    throw new Error('navigateHashRoute body appears split by a closing script tag, indicating malformed bootstrap code.');
  }

  if (/\brawHash\b/.test(navigateHashRouteBody)) {
    throw new Error('Hash routing guard references rawHash inside navigateHashRoute, which can break history rewrites.');
  }

  const hasModeBranch = /\bmode\b/.test(navigateHashRouteBody);
  const hasReplaceRewrite = /\b(?:rawReplaceState|history\.replaceState)\b/.test(navigateHashRouteBody);
  const hasPushRewrite = /\b(?:rawPushState|history\.pushState)\b/.test(navigateHashRouteBody);

  if (!hasModeBranch || !hasReplaceRewrite || !hasPushRewrite) {
    throw new Error('navigateHashRoute is missing required push/replace history rewrite logic.');
  }
};

const extractNavigateHashRouteFromHtml = (htmlSource) => {
  const declarationPattern = /(?:const|let|var)\s+navigateHashRoute\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+navigateHashRoute\s*\([^)]*\)\s*\{/g;
  const hashchangePattern = /(?:window\.)?addEventListener\(\s*['"`]hashchange['"`]/g;

  for (const declarationMatch of htmlSource.matchAll(declarationPattern)) {
    const declarationIndex = declarationMatch.index ?? -1;
    if (declarationIndex < 0) continue;

    hashchangePattern.lastIndex = declarationIndex;
    const hashMatch = hashchangePattern.exec(htmlSource);
    if (!hashMatch) continue;

    const helperWindow = htmlSource.slice(declarationIndex, hashMatch.index);
    const normalizedWindow = stripKnownNextScriptInterleave(helperWindow);
    if (!normalizedWindow) continue;

    const candidateBody = extractArrowFunctionBody(normalizedWindow, 'navigateHashRoute');
    if (!candidateBody) continue;

    if (/\brawHash\b/.test(candidateBody)) continue;
    if (!/\bmode\b/.test(candidateBody) || !/\brawReplaceState\b/.test(candidateBody) || !/\brawPushState\b/.test(candidateBody)) {
      continue;
    }

    return candidateBody;
  }

  return null;
};

let sawNavigateDeclaration = false;
let parsedNavigateBody = false;
for (const body of normalizedScriptBodies) {
  const hasNavigateHashRoute = /\b(?:const|let|var|function)\s+navigateHashRoute\b|\bnavigateHashRoute\s*=\s*(?:function|\()/.test(body);
  const navigateHashRouteBody = extractArrowFunctionBody(body, 'navigateHashRoute');

  if (!hasNavigateHashRoute && !navigateHashRouteBody) continue;

  sawNavigateDeclaration ||= hasNavigateHashRoute;

  if (!navigateHashRouteBody) {
    continue;
  }

  parsedNavigateBody = true;
  validateNavigateHashRouteBody(navigateHashRouteBody);
}

if (sawNavigateDeclaration && !parsedNavigateBody) {
  const fallbackNavigateBody = extractNavigateHashRouteFromHtml(html);
  if (!fallbackNavigateBody) {
    throw new Error('Unable to parse navigateHashRoute body in single-file artifact.');
  }
  validateNavigateHashRouteBody(fallbackNavigateBody);
}

if (!hasHashAccess || !hasPushStateLogic || !hasRoutingHook) {
  throw new Error('Hash routing guard is missing from single-file artifact.');
}

const hasBootstrapCandidate = normalizedScriptBodies.some((body) => /\bconst\s+detectGatewayBase\b/.test(body) && /\bwindow\.location\.hash\b/.test(body));

if (hasBootstrapCandidate && !hasBootstrapScriptIntegrity) {
  throw new Error('IPFS bootstrap script is incomplete or malformed.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
