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
    const allowed = new URL((process.env.FRONTEND_URL || 'http://localhost:4200').split(',')[0].trim()).origin;
    assert.equal((await request()).status, 200);
    const result = await request(allowed);
    assert.equal(result.status, 200);
    assert.equal(result.headers['access-control-allow-origin'], allowed);
    assert.equal((await request(allowed, 'OPTIONS')).status, 204);
    const productionOrigin = 'https://reactiveform1-seven.vercel.app';
    const production = await request(productionOrigin);
    assert.equal(production.status, 200);
    assert.equal(production.headers['access-control-allow-origin'], productionOrigin);
    const preflight = await request(productionOrigin, 'OPTIONS');
    assert.equal(preflight.status, 204);
    assert.ok(preflight.headers['access-control-allow-methods'].includes('POST'));
    assert.equal((await request(productionOrigin + '.unapproved.example')).status, 403);
    assert.equal((await request('https://unapproved.example')).status, 403);
    console.log('Deployment checks passed: health endpoint, allowed origins, preflight and denied origins.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
