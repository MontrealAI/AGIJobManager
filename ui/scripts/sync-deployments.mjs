import fs from 'node:fs';
import path from 'node:path';

const checkMode = process.argv.includes('--check');
const repoRoot = path.resolve(process.cwd(), '..');

const agiDeploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/deployment.1.24522684.json');
const agiSolcInputPath = path.join(repoRoot, 'hardhat/deployments/mainnet/solc-input.json');
const ensDeploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/ens-job-pages/deployment.1.24531331.json');
const outputPath = path.join(process.cwd(), 'src/generated/deployments.ts');

const agiDeployment = JSON.parse(fs.readFileSync(agiDeploymentPath, 'utf8'));
const agiSolcInput = JSON.parse(fs.readFileSync(agiSolcInputPath, 'utf8'));
const ensDeployment = JSON.parse(fs.readFileSync(ensDeploymentPath, 'utf8'));

const payload = {
  release: {
    agiJobManager: {
      tag: 'v0.1.0-mainnet-beta',
      releaseUrl: 'https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.1.0-mainnet-beta'
    },
    ensJobPages: {
      tag: 'v0.2.0-mainnet-identity-layer',
      releaseUrl: 'https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.2.0-mainnet-identity-layer'
    }
  },
  chain: {
    chainId: agiDeployment.chainId,
    explorerBaseUrl: agiDeployment.explorerBaseUrl
  },
  agiJobManager: {
    deployer: agiDeployment.deployer,
    finalOwner: agiDeployment.finalOwner,
    deploymentBlock: agiDeployment.contracts.AGIJobManager.blockNumber,
    addresses: Object.fromEntries(Object.entries(agiDeployment.contracts).map(([name, value]) => [name, value.address])),
    constructorArgs: agiDeployment.constructorArgs,
    libraries: agiDeployment.libraries,
    compiler: {
      version: '0.8.23',
      optimizerRuns: agiSolcInput.settings.optimizer.runs,
      evmVersion: agiSolcInput.settings.evmVersion,
      viaIR: agiSolcInput.settings.viaIR,
      metadataBytecodeHash: agiSolcInput.settings.metadata.bytecodeHash,
      revertStrings: agiSolcInput.settings.debug.revertStrings
    }
  },
  ensJobPages: {
    deployer: ensDeployment.deployer,
    finalOwner: ensDeployment.finalOwner,
    deploymentBlock: ensDeployment.contracts.ENSJobPages.blockNumber,
    addresses: Object.fromEntries(Object.entries(ensDeployment.contracts).map(([name, value]) => [name, value.address])),
    constructorArgs: ensDeployment.constructorArgs,
    calls: ensDeployment.calls
  }
};

const content = `export const OFFICIAL_DEPLOYMENTS = ${JSON.stringify(payload, null, 2)} as const;\n`;

if (checkMode) {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Missing generated file: ${path.relative(repoRoot, outputPath)}. Run npm run sync:deployments.`);
  }

  const current = fs.readFileSync(outputPath, 'utf8');
  if (current !== content) {
    throw new Error(
      `${path.relative(repoRoot, outputPath)} is stale versus hardhat/deployments/mainnet artifacts. Run npm run sync:deployments and commit the result.`
    );
  }

  console.log(`Verified ${path.relative(repoRoot, outputPath)} is up to date.`);
} else {
  fs.writeFileSync(outputPath, content);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
