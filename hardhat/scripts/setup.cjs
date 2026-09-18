const fs = require('node:fs');
const path = require('node:path');

function setup(directory = path.resolve(__dirname, '..')) {
  const results = [];
  for (const [source, target] of [
    ['.env.example', '.env'],
    ['deploy.config.example.cjs', 'deploy.config.cjs'],
    ['readiness-nft-policy.example.json', 'reviewed-nft-policy.json'],
  ]) {
    const destination = path.join(directory, target);
    const contents = fs.readFileSync(path.join(directory, source));
    let descriptor;
    try {
      descriptor = fs.openSync(destination, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      results.push({ file: target, status: 'preserved' });
      continue;
    }
    try {
      fs.writeFileSync(descriptor, contents);
    } finally {
      fs.closeSync(descriptor);
    }
    results.push({ file: target, status: 'created' });
  }
  return results;
}

if (require.main === module) {
  try {
    for (const result of setup()) console.log(`${result.status}: hardhat/${result.file}`);
    console.log('Review the owner, both recipients, RPC and membership settings. NFT admission starts disabled; review the optional/empty policy or configure owner opt-in before readiness.');
    console.log('Next: npm --prefix hardhat run check:config:sepolia (offline), then follow hardhat/README.md. No network requests or transactions were made.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { setup };
