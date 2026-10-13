import { fail, safePath } from './safe.mjs';

// Small uncompressed ZIP writer. Imports never decompress archives.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function sourceZip(files) {
  fail(Array.isArray(files) && files.length > 0 && files.length <= 100, 'SOURCE_FILES');
  const parts = [], central = [], seen = new Set(); let offset = 0, total = 0;
  const header = length => { const data = new Uint8Array(length); return { data, view: new DataView(data.buffer) }; };
  for (const file of files) {
    safePath(file.path); fail(!seen.has(file.path.toLowerCase()), 'PATH'); seen.add(file.path.toLowerCase());
    const name = new TextEncoder().encode(file.path), content = new TextEncoder().encode(file.content), checksum = crc32(content);
    total += content.length; fail(total <= 8_000_000, 'SOURCE_SIZE');
    const local = header(30); local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true); local.view.setUint16(6, 0x0800, true); local.view.setUint16(12, 33, true); local.view.setUint32(14, checksum, true); local.view.setUint32(18, content.length, true); local.view.setUint32(22, content.length, true); local.view.setUint16(26, name.length, true);
    parts.push(local.data, name, content);
    const index = header(46); index.view.setUint32(0, 0x02014b50, true); index.view.setUint16(4, 20, true); index.view.setUint16(6, 20, true); index.view.setUint16(8, 0x0800, true); index.view.setUint16(14, 33, true); index.view.setUint32(16, checksum, true); index.view.setUint32(20, content.length, true); index.view.setUint32(24, content.length, true); index.view.setUint16(28, name.length, true); index.view.setUint32(42, offset, true); central.push(index.data, name); offset += 30 + name.length + content.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0), end = header(22); end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true); end.view.setUint32(12, centralSize, true); end.view.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22); let at = 0; for (const p of [...parts, ...central, end.data]) { result.set(p, at); at += p.length; } return result;
}
