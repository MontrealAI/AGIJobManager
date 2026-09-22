import implementation from './deploy-review-escrow.cjs';
try { await implementation.main(); } catch (error) { console.error(error.message); process.exitCode=1; }
