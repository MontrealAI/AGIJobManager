const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pathToFileURL } = require("node:url");

const repoRoot = path.resolve(__dirname, "..", "..");
const docsRoot = path.join(repoRoot, "docs");
const artifactPath = path.join(repoRoot, "build", "contracts", "AGIJobManager.json");
const uiPort = Number(process.env.AGIJOBMANAGER_UI_PORT || 4173);
let localProvider;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function startStaticServer(rootDir, port) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (requestUrl.pathname === "/rpc" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          const result = await localProvider.request({ method: request.method, params: request.params || [] });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
        } catch (error) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: "RPC proxy failed" }));
        }
      });
      return;
    }
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = decodedPath === "/" ? "/index.html" : decodedPath;
    const filePath = path.resolve(rootDir, `.${safePath}`);

    if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".css": "text/css",
      }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function deployLocalFixture() {
  if (!fs.existsSync(artifactPath)) throw new Error("Missing build artifacts. Run npm run build first.");
  const { createRuntime } = require('../test-runtime.cjs');
  const { buildInitConfig } = require('../../test/helpers/deploy');
  const runtime = await createRuntime(localProvider);
  const token = await runtime.artifacts.require('MockERC20').new();
  const zeroAddress = '0x' + '00'.repeat(20);
  const zeroRoot = '0x' + '00'.repeat(32);
  const manager = await runtime.artifacts.require('AGIJobManager').new(...buildInitConfig(
    token.address, 'ipfs://', zeroAddress, zeroAddress, zeroRoot, zeroRoot, zeroRoot, zeroRoot, zeroRoot, zeroRoot,
  ));
  await token.mint(runtime.accounts[0], '1000000000');
  await manager.unpause();
  return manager.address;
}

async function run() {
  let connection;
  let server;
  try {
    await runCommand("node", ["--test", path.join("ui-tests", "indexer.test.js")], { cwd: repoRoot });

    const config = path.join(repoRoot, 'hardhat.config.mjs');
    const { createHardhatRuntimeEnvironment } = await import('hardhat/hre');
    const { default: configuration } = await import(pathToFileURL(config));
    // The existing console allows mock USDC only on its loopback-only 1337
    // fixture chain. Keep that boundary while replacing the underlying EVM.
    const fixtureConfiguration = { ...configuration, networks: { ...configuration.networks,
      hardhat: { ...configuration.networks.hardhat, chainId: 1337 } } };
    const hre = await createHardhatRuntimeEnvironment(fixtureConfiguration, { config }, repoRoot);
    connection = await hre.network.connect('hardhat');
    localProvider = connection.provider;

    server = await startStaticServer(docsRoot, uiPort);
    const contractAddress = await deployLocalFixture();
    const baseUrl = `http://127.0.0.1:${uiPort}/ui/agijobmanager.html`;
    const browserRpcUrl = `http://127.0.0.1:${uiPort}/rpc`;

    await runCommand(
      "npx",
      ["playwright", "test", path.join("ui-tests", "ui-smoke.spec.js"), "--reporter=line"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          AGIJOBMANAGER_UI_URL: baseUrl,
          AGIJOBMANAGER_ADDRESS: contractAddress,
          AGIJOBMANAGER_RPC_URL: browserRpcUrl,
        },
      }
    );
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (connection) await connection.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
