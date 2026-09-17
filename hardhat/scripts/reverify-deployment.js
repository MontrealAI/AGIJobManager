import implementation from './reverify-deployment.cjs';

try { await implementation.main(); } catch (error) { console.error(error); process.exitCode = 1; }
