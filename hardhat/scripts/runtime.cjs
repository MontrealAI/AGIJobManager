const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveInputSource } = require('./deployment-safety.cjs');
let runtimePromise;

async function getRuntime() {
  if (!runtimePromise) runtimePromise = initialize();
  return runtimePromise;
}

async function initialize() {
  const { default: hre } = await import(pathToFileURL(require.resolve('hardhat', { paths: [path.resolve(__dirname, '../..')] })).href);
  const connection = await hre.network.create(hre.globalOptions.network || 'hardhat');
  const artifacts = {
    readArtifact: name => hre.artifacts.readArtifact(name),
    async getBuildInfo(name) {
      const id = await hre.artifacts.getBuildInfoId(name);
      if (!id) return undefined;
      const inputPath = await hre.artifacts.getBuildInfoPath(id);
      const outputPath = await hre.artifacts.getBuildInfoOutputPath(id);
      if (!inputPath || !outputPath) return undefined;
      const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      return { ...input, output: output.output };
    },
  };
  const ethers = { ...connection.ethers,
    async getContractFactory(name, options) {
      if (options?.libraries) {
        const info = await artifacts.getBuildInfo(name);
        if (!info) throw new Error('Linked deployment requires intact release build information.');
        const libraries = Object.fromEntries(Object.entries(options.libraries).map(([key, value]) => {
          const separator = key.lastIndexOf(':');
          if (separator < 0) return [key, value];
          const source = key.slice(0, separator);
          return [`${resolveInputSource(info, source)}:${key.slice(separator + 1)}`, value];
        }));
        const artifact = await artifacts.readArtifact(name);
        const required = new Set(Object.entries(artifact.linkReferences || {}).flatMap(([source, entries]) =>
          Object.keys(entries).map(entry => `${source}:${entry}`)));
        const selected = Object.fromEntries(Object.entries(libraries).filter(([key]) =>
          required.has(key) || [...required].some(fqn => key === fqn.slice(fqn.lastIndexOf(':') + 1))));
        return connection.ethers.getContractFactory(name, { ...options, libraries: selected });
      }
      return connection.ethers.getContractFactory(name, options);
    },
  };
  return {
    ethers, artifacts, config: { ...hre.config, verify: { etherscan: { enabled: true, apiKey: process.env.ETHERSCAN_API_KEY || '' } } },
    network: { name: connection.networkName, config: connection.networkConfig, provider: connection.provider },
    async run(task, parameters) {
      if (task !== 'verify:verify') throw new Error(`Unsupported deployment runtime task ${task}`);
      const artifact = await artifacts.readArtifact(parameters.contract || 'ENSJobPages');
      const buildInfo = await artifacts.getBuildInfo(parameters.contract || 'ENSJobPages');
      if (!buildInfo) throw new Error('Verification requires intact release build information.');
      const { requireArtifactMatch } = require('./deployment-safety.cjs');
      requireArtifactMatch({ artifact, buildInfo, address: parameters.address, libraries: parameters.libraries,
        tokenAddress: artifact.contractName === 'AGIJobManager' ? parameters.constructorArguments?.[0] : undefined,
        code: await connection.ethers.provider.getCode(parameters.address) });
      const { verifyEtherscan } = require('./verify-etherscan.cjs');
      return verifyEtherscan({ chainId: Number((await connection.ethers.provider.getNetwork()).chainId),
        address: parameters.address, artifact, buildInfo, constructorArguments: parameters.constructorArguments || [],
        libraries: parameters.libraries, apiKey: process.env.ETHERSCAN_API_KEY || '' });
    },
  };
}

module.exports = { getRuntime };
