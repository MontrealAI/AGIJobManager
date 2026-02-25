import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const agiDeploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/deployment.1.24522684.json');
const ensDeploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/ens-job-pages/deployment.1.24531331.json');
const verifyTargetsPath = path.join(repoRoot, 'hardhat/deployments/mainnet/verify-targets.json');
const solcInputPath = path.join(repoRoot, 'hardhat/deployments/mainnet/solc-input.json');
const outputPath = path.join(repoRoot, 'docs/ui/DEPLOYMENT_MAINNET.md');

const agiDeployment = JSON.parse(fs.readFileSync(agiDeploymentPath, 'utf8'));
const ensDeployment = JSON.parse(fs.readFileSync(ensDeploymentPath, 'utf8'));
const verifyTargets = JSON.parse(fs.readFileSync(verifyTargetsPath, 'utf8'));
const solcInput = JSON.parse(fs.readFileSync(solcInputPath, 'utf8'));

const generatedAt = ensDeployment.timestamp || agiDeployment.timestamp || 'deterministic-from-artifacts';

const lines = [
  '# Mainnet Deployment Registry',
  '',
  `- Generated at: ${generatedAt}`,
  '- Source artifacts:',
  '  - hardhat/deployments/mainnet/deployment.1.24522684.json',
  '  - hardhat/deployments/mainnet/ens-job-pages/deployment.1.24531331.json',
  '  - hardhat/deployments/mainnet/verify-targets.json',
  '  - hardhat/deployments/mainnet/solc-input.json',
  '',
  '## Official release',
  '',
  '- AGIJobManager: v0.1.0-mainnet-beta',
  '- ENSJobPages: v0.2.0-mainnet-identity-layer',
  `- Chain ID: ${agiDeployment.chainId}`,
  `- Explorer: ${agiDeployment.explorerBaseUrl}`,
  `- AGIJobManager deployer: ${agiDeployment.deployer}`,
  `- AGIJobManager final owner: ${agiDeployment.finalOwner}`,
  `- AGIJobManager: ${agiDeployment.contracts.AGIJobManager.address}`,
  `- AGIJobManager deployment block: ${agiDeployment.contracts.AGIJobManager.blockNumber}`,
  `- ENSJobPages: ${ensDeployment.contracts.ENSJobPages.address}`,
  `- ENSJobPages deployment block: ${ensDeployment.contracts.ENSJobPages.blockNumber}`,
  '',
  '## Linked libraries (AGIJobManager)',
  '',
  '| Library | Address |',
  '| --- | --- |'
];

for (const [name, data] of Object.entries(agiDeployment.contracts)) {
  if (name === 'AGIJobManager') continue;
  lines.push(`| ${name} | ${data.address} |`);
}

lines.push(
  '',
  '## Constructor arguments (AGIJobManager)',
  '',
  '```json',
  JSON.stringify(agiDeployment.constructorArgs, null, 2),
  '```',
  '',
  '## Constructor arguments (ENSJobPages)',
  '',
  '```json',
  JSON.stringify(ensDeployment.constructorArgs, null, 2),
  '```',
  '',
  '## Identity wiring calls (ENS deployment artifact calls[])',
  '',
  '```json',
  JSON.stringify(ensDeployment.calls, null, 2),
  '```',
  '',
  '## Verification',
  '',
  `- solc: ${solcInput.language === 'Solidity' ? '0.8.23' : 'unknown'}`,
  `- optimizer: enabled=${solcInput.settings.optimizer.enabled}, runs=${solcInput.settings.optimizer.runs}`,
  `- evmVersion: ${solcInput.settings.evmVersion}`,
  `- viaIR: ${solcInput.settings.viaIR}`,
  `- metadata.bytecodeHash: ${solcInput.settings.metadata.bytecodeHash}`,
  `- debug.revertStrings: ${solcInput.settings.debug.revertStrings}`,
  '',
  '## Verify targets',
  '',
  '| Name | FQN | Address |',
  '| --- | --- | --- |'
);

for (const target of verifyTargets.targets) {
  lines.push(`| ${target.name} | ${target.fqn} | ${target.address} |`);
}

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
