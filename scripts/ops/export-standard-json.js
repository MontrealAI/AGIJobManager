const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const entrypoint = path.join(rootDir, "contracts", "AGIJobManager.sol");
const truffleConfig = require(path.join(rootDir, "truffle-config"));

const sources = {};
const visited = new Set();

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function resolveImport(importPath, fromDir) {
  if (importPath.startsWith(".")) {
    return path.resolve(fromDir, importPath);
  }
  return path.resolve(rootDir, "node_modules", importPath);
}

function addSource(filePath) {
  const resolved = path.resolve(filePath);
  if (visited.has(resolved)) {
    return;
  }
  visited.add(resolved);

  const content = fs.readFileSync(resolved, "utf8");
  sources[normalizePath(resolved)] = { content };

  const importRegex = /import\s+(?:[^"']*\s+from\s+)?["']([^"']+)["'];/g;
  let match;
  const dir = path.dirname(resolved);
  while ((match = importRegex.exec(content))) {
    const importPath = match[1];
    addSource(resolveImport(importPath, dir));
  }
}

addSource(entrypoint);

const compilerSettings = truffleConfig.compilers?.solc?.settings || {};
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: compilerSettings.optimizer,
    evmVersion: compilerSettings.evmVersion,
    viaIR: compilerSettings.viaIR,
    metadata: compilerSettings.metadata,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
      },
    },
  },
};

const outputDir = path.join(rootDir, "build", "standard-json");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "AGIJobManager.standard.json");
fs.writeFileSync(outputPath, JSON.stringify(input, null, 2));
console.log(`Wrote ${outputPath}`);
