import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
await require('./finalize-authority.cjs').main();
