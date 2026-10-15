const assert = require('assert/strict');

async function run() {
  process.env.NODE_ENV = 'test';
  process.env.VERCEL = '1';
  const origin = 'https://reactiveform1-seven.vercel.app';
  for (const uri of ['', 'invalid-mongodb-uri']) {
    process.env.MONGODB_URI = uri;
    delete require.cache[require.resolve('./index.cjs')];
    // Importing the Vercel handler must succeed even with broken storage settings.
    const app = require('./index.cjs');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    try {
      const preflight = await fetch(base + '/admissions', { method: 'OPTIONS', headers: { Origin: origin } });
      assert.equal(preflight.status, 204);
      for (let attempt = 0; attempt < 2; attempt++) {
        const health = await fetch(base + '/health', { headers: { Origin: origin } });
        assert.equal(health.status, 503);
        assert.equal(health.headers.get('access-control-allow-origin'), origin);
        assert.equal((await health.json()).status, 'unavailable');
      }
      const body = new FormData();
      body.append('student', JSON.stringify({ firstName: 'Test', lastName: 'Student', email: 'test@example.com',
        contact: '9876543210', gender: 'Female', year: '2026-27', class: 'Class 10', subjects: ['Mathematics'],
        selfStudy: false, discount: 0, amount: 0, paymentMode: 'cash', paymentMethod: '', remarks: '' }));
      const saved = await fetch(base + '/admissions', { method: 'POST', headers: { Origin: origin }, body });
      assert.equal(saved.status, 503);
      assert.equal(saved.headers.get('access-control-allow-origin'), origin);
      assert.match((await saved.json()).error, /storage is unavailable/);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
  console.log('Serverless checks passed: handler loads, CORS works, failed storage retries and submissions return 503.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
