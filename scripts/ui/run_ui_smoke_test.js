const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const ganache = require("ganache");

const RPC_PORT = 8545;
const UI_PORT = 4173;
const MNEMONIC = "test test test test test test test test test test test junk";

const projectRoot = path.resolve(__dirname, "..", "..");
const docsRoot = path.join(projectRoot, "docs");
const ethersBundlePath = path.join(projectRoot, "node_modules", "ethers", "dist", "ethers.umd.min.js");

const contentTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

const rpcRequest = async (method, params = []) => {
  const response = await fetch(`http://127.0.0.1:${RPC_PORT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || "RPC error");
  }
  return payload.result;
};

const startUiServer = () =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

      if (urlPath === "/rpc") {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const rpcResponse = await fetch(`http://127.0.0.1:${RPC_PORT}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });
            const payload = await rpcResponse.text();
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(payload);
          } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(error.message);
          }
        });
        return;
      }

      if (urlPath === "/ui/ethers.umd.min.js") {
        fs.readFile(ethersBundlePath, (err, data) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Failed to load ethers bundle");
            return;
          }
          res.writeHead(200, { "Content-Type": "application/javascript" });
          res.end(data);
        });
        return;
      }

      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(docsRoot, safePath);
      const resolvedPath = fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()
        ? path.join(filePath, "index.html")
        : filePath;

      fs.readFile(resolvedPath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }
        const ext = path.extname(resolvedPath);
        res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.listen(UI_PORT, "127.0.0.1", () => resolve(server));
  });

const main = async () => {
  const ganacheServer = ganache.server({
    wallet: { mnemonic: MNEMONIC, totalAccounts: 10, defaultBalance: 1000 },
    logging: { quiet: true },
    chain: { chainId: 1337, networkId: 1337, hardfork: "london" },
    miner: { blockGasLimit: 100_000_000 },
  });

  await ganacheServer.listen(RPC_PORT);

  let uiServer;
  try {
    await runCommand("node", ["--test", path.join("ui-tests", "indexer.unit.test.js")], { cwd: projectRoot });
    await runCommand("npx", ["truffle", "migrate", "--network", "development", "--reset"], { cwd: projectRoot });

    const networkId = await rpcRequest("net_version");
    const artifactPath = path.join(projectRoot, "build", "contracts", "AGIJobManager.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const deployed = artifact.networks[networkId];
    if (!deployed || !deployed.address) {
      throw new Error(`No AGIJobManager deployment found for network ${networkId}.`);
    }

    uiServer = await startUiServer();

    await runCommand("npx", ["playwright", "test", "--config=playwright.config.js"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        UI_BASE_URL: `http://127.0.0.1:${UI_PORT}`,
        UI_RPC_URL: `http://127.0.0.1:${UI_PORT}/rpc`,
        UI_CONTRACT_ADDRESS: deployed.address,
      },
    });
  } finally {
    if (uiServer) {
      await new Promise((resolve) => uiServer.close(resolve));
    }
    await ganacheServer.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
