const assert = require('assert/strict');
const { BSON } = require('mongodb');
const { createStorage, createMongoStore } = require('./storage.cjs');
async function run() {
  assert.throws(() => createStorage({ NODE_ENV: 'production' }), /MONGODB_URI/);
  assert.throws(() => createStorage({ RENDER: 'true', DATA_DIR: '/tmp' }), /MONGODB_URI/);
  assert.throws(() => createStorage({ VERCEL: '1' }), /MONGODB_URI/);
  assert.throws(() => createStorage({ VERCEL: '1' }), /MONGODB_URI/);
  const record = { id: 'test-id', attachments: { receipt: 'receipt.pdf' }, total: 2400, pending: 1900 };
  const receipt = { number: record.id, paid: 500 };
  const files = [{ fieldname: 'receipt', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fixture') }];
  let saved;
  const db = {
    collection(name) {
      assert.equal(name, 'admissions');
      return { async insertOne(document) { saved = BSON.deserialize(BSON.serialize(document)); } };
    },
    async command(command) { assert.deepEqual(command, { ping: 1 }); }
  };
  const store = createMongoStore(db);
  await store.health();
  await store.save(record, receipt, files);
  assert.equal(saved._id, record.id);
  assert.deepEqual(saved.receipt, receipt);
  assert.equal(saved.uploads[0].filename, 'receipt.pdf');
  assert.equal(saved.uploads[0].contentType, 'application/pdf');
  assert.deepEqual(Buffer.from(saved.uploads[0].data.value()), files[0].buffer);
  const failing = createMongoStore({
    collection() { return { async insertOne() { throw new Error('database unavailable'); } }; },
    async command() { throw new Error('database unavailable'); }
  });
  await assert.rejects(failing.save(record, receipt, files), /database unavailable/);
  await assert.rejects(failing.health(), /database unavailable/);
  console.log('Storage checks passed: production configuration, BSON binary round trip, receipt and database failures.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
