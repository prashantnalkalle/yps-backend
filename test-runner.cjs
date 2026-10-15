const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yps-tests-'));
try {
  for (const test of ['smoke-test.cjs', 'deployment-test.cjs', 'storage-test.cjs', 'serverless-test.cjs']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: '', VERCEL: '', RENDER: '', DATA_DIR: directory }
    });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
