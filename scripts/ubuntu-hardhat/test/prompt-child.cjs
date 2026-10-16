'use strict';
const { hiddenKey } = require('../prompt.cjs');
hiddenKey().then(key => { if (key.length !== 32) throw Error(); key.fill(0); console.log('DISPOSABLE_KEY_RECEIVED_AND_BUFFER_CLEARED'); }).catch(() => { console.error('DISPOSABLE_ENTRY_REFUSED'); process.exitCode = 1; });
