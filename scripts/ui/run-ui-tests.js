const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

const repoRoot = path.resolve(__dirname, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');

const rpcPort = 8545;
const rpcHost = '127.0.0.1';
const mnemonic = 'test test test test test test test test test test test junk';

function waitForPort(port, host, timeoutMs = 15_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection(port, host);
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function startGanache() {
  const args = [
    'ganache',
    '--server.host', rpcHost,
    '--server.port', String(rpcPort),
    '--chain.chainId', '1337',
    '--chain.networkId', '1337',
    '--wallet.mnemonic', mnemonic,
    '--logging.quiet',
  ];
  const child = spawn('npx', args, { stdio: 'inherit' });
  return child;
}

function startStaticServer(rootDir) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    const baseUrl = `http://${req.headers.host}`;
    const parsed = new URL(req.url, baseUrl);
    const pathname = decodeURIComponent(parsed.pathname);
    let filePath = path.join(rootDir, pathname);
    if (!filePath.startsWith(rootDir)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    if (pathname.endsWith('/')) {
      filePath = path.join(rootDir, pathname, 'index.html');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.setHeader('content-type', mimeTypes[ext] || 'application/octet-stream');
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function readDeployedAddress() {
  const artifactPath = path.join(repoRoot, 'build', 'contracts', 'AGIJobManager.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const networks = artifact.networks || {};
  const networkId = networks['1337'] ? '1337' : Object.keys(networks)[0];
  if (!networkId || !networks[networkId] || !networks[networkId].address) {
    throw new Error('Unable to find deployed AGIJobManager address in build/contracts/AGIJobManager.json');
  }
  return networks[networkId].address;
}

async function main() {
  let ganache;
  let server;
  try {
    ganache = startGanache();
    await waitForPort(rpcPort, rpcHost);

    await runCommand('npx', ['truffle', 'migrate', '--network', 'development', '--reset'], { cwd: repoRoot });

    const contractAddress = readDeployedAddress();

    const serverInfo = await startStaticServer(docsRoot);
    server = serverInfo.server;
    const baseUrl = `http://127.0.0.1:${serverInfo.port}/ui/agijobmanager.html`;

    await runCommand('npx', ['playwright', 'install', '--with-deps', 'chromium'], { cwd: repoRoot });

    await runCommand('npx', ['playwright', 'test', 'tests/ui/agijobmanager.spec.js'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        UI_BASE_URL: baseUrl,
        CONTRACT_ADDRESS: contractAddress,
        CHAIN_RPC_URL: `http://${rpcHost}:${rpcPort}`,
      },
    });
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (ganache) {
      ganache.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
