import implementation from './check-readiness.cjs';

try { await implementation.main(); } catch (error) { console.error(error); process.exitCode = 1; }
