const path = require('node:path');
const dotenv = require('dotenv');

function loadDeploymentEnv(directory = path.resolve(__dirname, '..'), environment = process.env) {
  const envPath = path.join(directory, '.env');
  const result = dotenv.config({ path: envPath, processEnv: environment, override: false });
  if (result.error && result.error.code !== 'ENOENT') {
    throw new Error(`Cannot read deployment environment at ${envPath}: ${result.error.code || 'read failed'}`);
  }
  return envPath;
}

module.exports = { loadDeploymentEnv };
