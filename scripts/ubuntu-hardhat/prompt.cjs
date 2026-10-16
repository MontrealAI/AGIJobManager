'use strict';
const tty = require('node:tty');

// No readline history, shell read, environment variable, IPC or key string.
// The caller gets 32 mutable bytes and must clear them in a finally block.
function hiddenKey({ input = process.stdin, output = process.stdout, signals = process } = {}) {
  if (!input.isTTY || !output.isTTY || !tty.isatty(input.fd))
    return Promise.reject(Error('LOCAL_TERMINAL_REQUIRED'));
  return new Promise((resolve, reject) => {
    const ascii = Buffer.alloc(66); let length = 0, done = false, invalid = false;
    const wasRaw = Boolean(input.isRaw);
    const finish = (error, key) => {
      if (done) return; done = true;
      input.removeListener('data', data); input.removeListener('end', abort);
      input.removeListener('error', abort);
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.removeListener(signal, abort);
      input.setRawMode(wasRaw); input.pause();
      ascii.fill(0); output.write('\n');
      if (error) reject(Error('KEY_ENTRY_CANCELLED_OR_INVALID')); else resolve(key);
    };
    const abort = () => finish(true);
    const digit = c => c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;
    const data = chunk => {
      try {
        for (let i = 0; i < chunk.length; i++) {
          const c = chunk[i];
          if (c === 3 || c === 4 || c === 26) return abort();
          if (invalid) { if (c === 13 || c === 10) return abort(); continue; }
          if (c === 127 || c === 8) { if (length) ascii[--length] = 0; continue; }
          if (c === 13 || c === 10) {
            const offset = length === 66 && ascii[0] === 48 && ascii[1] === 120 ? 2 : 0;
            if (length - offset !== 64 || (i + 1 < chunk.length && !(i + 2 === chunk.length && chunk[i + 1] === 10))) return abort();
            const key = Buffer.alloc(32);
            for (let j = 0; j < 32; j++) {
              const high = digit(ascii[offset + j * 2]), low = digit(ascii[offset + j * 2 + 1]);
              if (high < 0 || low < 0) { key.fill(0); return abort(); }
              key[j] = high * 16 + low;
            }
            return finish(false, key);
          }
          if (length >= 66) {
            // Even an oversized line stays hidden until Enter. Validate other
            // characters only at Enter, allowing corrections with Backspace.
            invalid = true; ascii.fill(0); length = 0; continue;
          }
          ascii[length++] = c;
        }
      } finally { if (Buffer.isBuffer(chunk)) chunk.fill(0); }
    };
    input.setRawMode(true); input.resume();
    input.on('data', data); input.once('end', abort); input.once('error', abort);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.once(signal, abort);
    output.write('Deployer private key (hidden; local memory only): ');
  });
}
module.exports = { hiddenKey };
