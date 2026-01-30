const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DOCS_ROOT = path.join(ROOT, "docs");
const BUILD_ARTIFACT = path.join(ROOT, "build", "contracts", "AGIJobManager.json");
const RPC_URL = "http://127.0.0.1:8545";
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 4173;

function waitForPort(port, host, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = http
        .request({ host, port, method: "GET", path: "/" }, () => {
          socket.destroy();
          resolve();
        })
        .on("error", () => {
          socket.destroy();
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for ${host}:${port}`));
            return;
          }
          setTimeout(attempt, 250);
        });
      socket.end();
    };
    attempt();
  });
}

async function waitForRpc(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "net_version", params: [] }),
      });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Ganache RPC.");
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, { stdio: "inherit", shell: false, ...options });
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(DOCS_ROOT, safePath);

    if (reqPath === "/") {
      filePath = path.join(DOCS_ROOT, "index.html");
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".ico": "image/x-icon",
      }[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(SERVER_PORT, SERVER_HOST, () => {
      resolve(server);
    });
  });
}

async function readContractAddress() {
  if (!fs.existsSync(BUILD_ARTIFACT)) {
    throw new Error("AGIJobManager artifact not found. Did migration run?");
  }
  const artifact = JSON.parse(fs.readFileSync(BUILD_ARTIFACT, "utf8"));
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "net_version", params: [] }),
  });
  const payload = await response.json();
  const networkId = payload.result;
  const networkEntry = artifact.networks?.[networkId];
  if (!networkEntry || !networkEntry.address) {
    throw new Error(`No deployment found for network id ${networkId}.`);
  }
  return networkEntry.address;
}

async function run() {
  const ganache = spawnProcess("npx", [
    "ganache",
    "--wallet.mnemonic",
    "test test test test test test test test test test test junk",
    "--chain.chainId",
    "1337",
    "--chain.networkId",
    "1337",
    "--logging.quiet",
    "--port",
    "8545",
  ]);

  let server;
  try {
    await waitForRpc();

    const migrate = spawnProcess("npx", ["truffle", "migrate", "--network", "development", "--reset"], {
      cwd: ROOT,
    });
    const migrateCode = await new Promise((resolve) => migrate.on("close", resolve));
    if (migrateCode !== 0) {
      throw new Error(`Truffle migrate failed with exit code ${migrateCode}`);
    }

    const contractAddress = await readContractAddress();
    server = await startStaticServer();
    await waitForPort(SERVER_PORT, SERVER_HOST);

    const env = {
      ...process.env,
      UI_BASE_URL: `http://${SERVER_HOST}:${SERVER_PORT}`,
      UI_CONTRACT: contractAddress,
      UI_RPC_URL: RPC_URL,
    };
    const testProcess = spawnProcess("npx", ["playwright", "test", "ui-tests/ui-smoke.spec.js"], {
      cwd: ROOT,
      env,
    });
    const testCode = await new Promise((resolve) => testProcess.on("close", resolve));
    if (testCode !== 0) {
      throw new Error(`Playwright tests failed with exit code ${testCode}`);
    }
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (ganache) {
      ganache.kill("SIGTERM");
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
