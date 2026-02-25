import fs from 'node:fs';
import path from 'node:path';

const checkMode = process.argv.includes('--check');
const repoRoot = path.resolve(process.cwd(), '..');
const deploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/deployment.1.24522684.json');
const solcInputPath = path.join(repoRoot, 'hardhat/deployments/mainnet/solc-input.json');
const outputPath = path.join(process.cwd(), 'src/generated/deployment.ts');

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const solcInput = JSON.parse(fs.readFileSync(solcInputPath, 'utf8'));

const payload = {
  releaseTag: 'v0.1.0-mainnet-beta',
  releaseUrl: 'https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.1.0-mainnet-beta',
  chainId: deployment.chainId,
  deployer: deployment.deployer,
  finalOwner: deployment.finalOwner,
  deploymentBlock: deployment.contracts.AGIJobManager.blockNumber,
  addresses: Object.fromEntries(Object.entries(deployment.contracts).map(([name, value]) => [name, value.address])),
  constructorArgs: deployment.constructorArgs,
  compiler: {
    version: '0.8.23',
    optimizerRuns: solcInput.settings.optimizer.runs,
    evmVersion: solcInput.settings.evmVersion,
    viaIR: solcInput.settings.viaIR,
    metadataBytecodeHash: solcInput.settings.metadata.bytecodeHash,
    revertStrings: solcInput.settings.debug.revertStrings
  }
};

const content = `export const OFFICIAL_DEPLOYMENT = ${JSON.stringify(payload, null, 2)} as const;\n`;

if (checkMode) {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Missing generated file: ${path.relative(repoRoot, outputPath)}. Run npm run sync:deployment.`);
  }

  const current = fs.readFileSync(outputPath, 'utf8');
  if (current !== content) {
    throw new Error(
      `${path.relative(repoRoot, outputPath)} is stale versus hardhat/deployments/mainnet artifacts. Run npm run sync:deployment and commit the result.`
    );
  }

  console.log(`Verified ${path.relative(repoRoot, outputPath)} is up to date.`);
} else {
  fs.writeFileSync(outputPath, content);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
