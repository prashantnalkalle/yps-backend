const assert = require('assert');
const http = require('http');
const app = require('./index.cjs');
const server = app.listen(0, '127.0.0.1', async () => {
  function request(origin, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({host: '127.0.0.1', port: server.address().port, path: '/api/health', method, headers: origin ? {Origin: origin} : {}}, res => {
        res.resume(); res.on('end', () => resolve({status: res.statusCode, headers: res.headers}));
      });
      req.on('error', reject); req.end();
    });
  }
  try {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:4200').split(',')[0].trim();
    assert.equal((await request()).status, 200);
    const result = await request(allowed);
    assert.equal(result.status, 200);
    assert.equal(result.headers['access-control-allow-origin'], allowed);
    assert.equal((await request(allowed, 'OPTIONS')).status, 204);
    assert.equal((await request('https://unapproved.example')).status, 403);
    console.log('Deployment checks passed: health endpoint, allowed origins, preflight and denied origins.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
