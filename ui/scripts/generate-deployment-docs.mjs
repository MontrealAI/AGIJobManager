import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');

const deploymentPath = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'deployment.1.24522684.json');
const verifyPath = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'verify-targets.json');
const solcInputPath = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'solc-input.json');
const outputPath = path.join(repoRoot, 'docs', 'ui', 'DEPLOYMENT_MAINNET.md');

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const verifyTargets = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
const solcInput = JSON.parse(fs.readFileSync(solcInputPath, 'utf8'));

const releaseTag = 'v0.1.0-mainnet-beta';
const releaseUrl = 'https://github.com/MontrealAI/AGIJobManager/releases/tag/v0.1.0-mainnet-beta';

const contractRows = Object.entries(deployment.contracts)
  .map(([name, data]) => `| ${name} | ${data.address} | ${data.blockNumber} | [tx](https://etherscan.io/tx/${data.txHash}) |`)
  .join('\n');

const libraryRows = Object.entries(deployment.libraries)
  .map(([name, address]) => `| \`${name}\` | ${address} |`)
  .join('\n');

const verifyRows = verifyTargets.targets
  .map((target) => `| ${target.name} | ${target.address} | \`${target.fqn}\` |`)
  .join('\n');

const constructor = deployment.constructorArgs;
const settings = solcInput.settings;

const content = `# Mainnet Deployment Registry (Official)\n\n- Generated at: ${new Date().toISOString()}\n- Source files:\n  - \`hardhat/deployments/mainnet/deployment.1.24522684.json\`\n  - \`hardhat/deployments/mainnet/verify-targets.json\`\n  - \`hardhat/deployments/mainnet/solc-input.json\`\n\n## Release\n\n- Tag: **${releaseTag}**\n- Release: ${releaseUrl}\n- Chain: Ethereum Mainnet (chainId = ${deployment.chainId})\n\n## Principals\n\n- Deployer: \`${deployment.deployer}\`\n- Final owner: \`${deployment.finalOwner}\`\n\n## Deployed contracts\n\n| Contract | Address | Block | Transaction |\n|---|---|---:|---|\n${contractRows}\n\n## Linked libraries\n\n| Library | Address |\n|---|---|\n${libraryRows}\n\n## Constructor arguments (AGIJobManager)\n\n- agiTokenAddress: \`${constructor.agiTokenAddress}\`\n- baseIpfsUrl: \`${constructor.baseIpfsUrl}\`\n- ensConfig (address[2]):\n  - \`${constructor.ensConfig[0]}\`\n  - \`${constructor.ensConfig[1]}\`\n- rootNodes (bytes32[4]):\n  - \`${constructor.rootNodes[0]}\`\n  - \`${constructor.rootNodes[1]}\`\n  - \`${constructor.rootNodes[2]}\`\n  - \`${constructor.rootNodes[3]}\`\n- merkleRoots (bytes32[2]):\n  - \`${constructor.merkleRoots[0]}\`\n  - \`${constructor.merkleRoots[1]}\`\n\n## Verification settings\n\n- solc: \`${solcInput.settings?.compilationTarget ? '0.8.23' : '0.8.23'}\`\n- optimizer: enabled=\`${settings.optimizer.enabled}\`, runs=\`${settings.optimizer.runs}\`\n- evmVersion: \`${settings.evmVersion}\`\n- viaIR: \`${settings.viaIR}\`\n- settings.metadata.bytecodeHash: \`${settings.metadata.bytecodeHash}\`\n- settings.debug.revertStrings: \`${settings.debug.revertStrings}\`\n\n## Verify targets\n\n| Name | Address | Fully qualified name |\n|---|---|---|\n${verifyRows}\n`;

fs.writeFileSync(outputPath, content);
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
