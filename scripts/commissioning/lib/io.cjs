'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
class Stop extends Error { constructor(code) { super(code); this.code = code; } }
const ensure = (ok, code) => { if (!ok) throw new Stop(code); };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
function parse(text, limit = 262144) {
  ensure(typeof text === 'string' && Buffer.byteLength(text) <= limit, 'INPUT_SIZE_LIMIT');
  let value; try { value = JSON.parse(text); } catch { throw new Stop('INPUT_JSON_INVALID'); }
  const stack = [];
  for (const match of text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:"]+/g)) {
    const token = match[0], parent = stack.at(-1);
    if (token === '{' || token === '[') {
      ensure(stack.length < 48, 'INPUT_DEPTH_LIMIT');
      stack.push(token === '{' ? {keys:new Set(), key:true} : {});
    } else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && parent?.keys) parent.key = true;
    else if (token[0] === '"' && parent?.keys && parent.key) {
      const key = JSON.parse(token);
      ensure(!parent.keys.has(key), 'INPUT_DUPLICATE_KEY'); parent.keys.add(key); parent.key = false;
    }
  }
  return value;
}
function safePath(file) {
  ensure(typeof file === 'string' && !file.split(/[\\/]/).includes('..'), 'INPUT_PATH_TRAVERSAL');
  const full = path.resolve(file); let part = path.parse(full).root;
  for (const segment of full.slice(part.length).split(path.sep)) {
    part = path.join(part, segment);
    ensure(!fs.lstatSync(part).isSymbolicLink(), 'INPUT_SYMLINK_REFUSED');
  }
  return full;
}
function read(file, limit = 262144) {
  const fd = fs.openSync(safePath(file), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    ensure(stat.isFile() && stat.size <= limit, 'INPUT_FILE_OR_SIZE_INVALID');
    const data = Buffer.alloc(stat.size + 1); let offset = 0, n;
    while ((n = fs.readSync(fd, data, offset, data.length - offset, null)) > 0) offset += n;
    ensure(offset === stat.size && fs.fstatSync(fd).size === stat.size, 'INPUT_CHANGED_DURING_READ');
    const bytes = data.subarray(0, offset);
    return {value:parse(bytes.toString('utf8'), limit), sha256:sha256(bytes), bytes:offset};
  } finally { fs.closeSync(fd); }
}
function write(file, value) {
  const full = path.resolve(file), parent = safePath(path.dirname(full));
  const stat = fs.statSync(parent);
  ensure(stat.isDirectory() && (stat.mode & 0o077) === 0 &&
    (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'OUTPUT_PRIVATE_OWNED_DIRECTORY_REQUIRED');
  fs.writeFileSync(full, stringify(value), {flag:'wx', mode:0o600});
}
function source(root) {
  const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim();
  try { return {commit:git(['rev-parse','HEAD']), tree:git(['rev-parse','HEAD^{tree}']),
    worktreeChanged:git(['status','--porcelain','--untracked-files=normal']).length > 0}; }
  catch { return {commit:null, tree:null, worktreeChanged:null, status:'NOT_ASSESSED'}; }
}
function failure(error) { return error instanceof Stop ? error.code : 'LOCAL_MODULE_INPUT_OR_IO_FAILURE'; }
function sameSource(before, after) {
  return ['commit', 'tree', 'worktreeChanged'].every(key => before[key] === after[key]);
}
module.exports = {Stop, ensure, sha256, stringify, parse, safePath, read, write, source, sameSource, failure};
