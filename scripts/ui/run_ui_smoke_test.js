const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { setTimeout: delay } = require("timers/promises");

const repoRoot = path.resolve(__dirname, "..", "..");
const docsRoot = path.join(repoRoot, "docs");
const artifactPath = path.join(repoRoot, "build", "contracts", "AGIJobManager.json");
const rpcUrl = process.env.AGIJOBMANAGER_RPC_URL || "http://127.0.0.1:8545";
const uiPort = Number(process.env.AGIJOBMANAGER_UI_PORT || 4173);
const ganacheMnemonic = process.env.GANACHE_MNEMONIC || "test test test test test test test test test test test junk";

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

async function rpcRequest(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || "RPC error");
  }
  return payload.result;
}

async function waitForRpc({ retries = 40, intervalMs = 250 } = {}) {
  for (let i = 0; i < retries; i += 1) {
    try {
      await rpcRequest("net_version");
      return;
    } catch (error) {
      await delay(intervalMs);
    }
  }
  throw new Error("Ganache RPC not responding.");
}

function startGanache() {
  const args = [
    "ganache",
    "--server.host",
    "127.0.0.1",
    "--server.port",
    "8545",
    "--wallet.mnemonic",
    ganacheMnemonic,
    "--chain.chainId",
    "1337",
    "--chain.networkId",
    "1337",
    "--logging.quiet",
    "--miner.blockGasLimit",
    "100000000",
  ];
  const child = spawn("npx", args, { stdio: "inherit" });
  return child;
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
          const upstream = await fetch(rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
          const payload = await upstream.text();
          res.writeHead(upstream.status, { "Content-Type": "application/json" });
          res.end(payload);
        } catch (error) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: "RPC proxy failed" }));
        }
      });
      return;
    }
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = decodedPath === "/" ? "/index.html" : decodedPath;
    const filePath = path.normalize(path.resolve(rootDir, `.${safePath}`));

    if (!filePath.startsWith(rootDir)) {
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

async function getDeployedAddress() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Missing build artifact. Run `npm run build` before UI tests.");
  }
  const networkId = await rpcRequest("net_version");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const deployment = artifact.networks?.[networkId];
  if (!deployment?.address) {
    throw new Error(`No deployment found for network ${networkId}. Run truffle migrate.`);
  }
  return deployment.address;
}

async function run() {
  let ganacheProcess;
  let server;
  try {
    await runCommand("node", ["--test", path.join("ui-tests", "indexer.test.js")], { cwd: repoRoot });
    await runCommand("npx", ["playwright", "install", "--with-deps", "chromium"], { cwd: repoRoot });

    ganacheProcess = startGanache();
    await waitForRpc();

    await runCommand("npx", ["truffle", "migrate", "--network", "development", "--reset"], { cwd: repoRoot });

    server = await startStaticServer(docsRoot, uiPort);
    const contractAddress = await getDeployedAddress();
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
    if (ganacheProcess) {
      ganacheProcess.kill("SIGTERM");
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
