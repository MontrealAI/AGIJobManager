import implementation from './deploy-ens-job-pages.cjs';

try { await implementation.main(); } catch (error) { console.error(error); process.exitCode = 1; }
