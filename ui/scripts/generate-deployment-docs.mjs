import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const deploymentPath = path.join(repoRoot, 'hardhat/deployments/mainnet/deployment.1.24522684.json');
const verifyTargetsPath = path.join(repoRoot, 'hardhat/deployments/mainnet/verify-targets.json');
const solcInputPath = path.join(repoRoot, 'hardhat/deployments/mainnet/solc-input.json');
const outputPath = path.join(repoRoot, 'docs/ui/DEPLOYMENT_MAINNET.md');

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const verifyTargets = JSON.parse(fs.readFileSync(verifyTargetsPath, 'utf8'));
const solcInput = JSON.parse(fs.readFileSync(solcInputPath, 'utf8'));

const generatedAt = deployment.timestamp || 'unknown';

const lines = [
  '# Mainnet Deployment Registry',
  '',
  `- Generated at: ${generatedAt}`,
  '- Source artifacts:',
  '  - hardhat/deployments/mainnet/deployment.1.24522684.json',
  '  - hardhat/deployments/mainnet/verify-targets.json',
  '  - hardhat/deployments/mainnet/solc-input.json',
  '',
  '## Official release',
  '',
  '- Release tag: v0.1.0-mainnet-beta',
  `- Chain ID: ${deployment.chainId}`,
  `- Deployer: ${deployment.deployer}`,
  `- Final owner: ${deployment.finalOwner}`,
  `- AGIJobManager: ${deployment.contracts.AGIJobManager.address}`,
  `- Deployment block: ${deployment.contracts.AGIJobManager.blockNumber}`,
  '',
  '## Linked libraries',
  '',
  '| Library | Address |',
  '| --- | --- |'
];

for (const [name, data] of Object.entries(deployment.contracts)) {
  if (name === 'AGIJobManager') continue;
  lines.push(`| ${name} | ${data.address} |`);
}

lines.push('', '## Constructor arguments', '', '```json', JSON.stringify(deployment.constructorArgs, null, 2), '```', '', '## Verification', '', `- solc: ${solcInput.language === 'Solidity' ? '0.8.23' : 'unknown'}`, `- optimizer: enabled=${solcInput.settings.optimizer.enabled}, runs=${solcInput.settings.optimizer.runs}`, `- evmVersion: ${solcInput.settings.evmVersion}`, `- viaIR: ${solcInput.settings.viaIR}`, `- metadata.bytecodeHash: ${solcInput.settings.metadata.bytecodeHash}`, `- debug.revertStrings: ${solcInput.settings.debug.revertStrings}`, '', '## Verify targets', '', '| Name | FQN | Address |', '| --- | --- | --- |');

for (const target of verifyTargets.targets) {
  lines.push(`| ${target.name} | ${target.fqn} | ${target.address} |`);
}

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
