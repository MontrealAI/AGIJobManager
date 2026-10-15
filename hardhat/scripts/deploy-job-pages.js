import implementation from './deploy-job-pages.cjs';
try { await implementation.main(); }
catch { console.error('Router operation failed; preserve existing journals. No successful deployment/verification is established.'); process.exitCode = 1; }
