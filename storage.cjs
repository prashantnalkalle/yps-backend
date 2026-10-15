const fs = require('fs/promises');
const path = require('path');
const { MongoClient, Binary } = require('mongodb');

function createMongoStore(db) {
  const admissions = db.collection('admissions');
  return {
    async health() { await db.command({ ping: 1 }); },
    async save(record, receipt, files) {
      // The two 2 MB uploads fit comfortably within MongoDB's 16 MB document limit.
      // A single insert keeps the admission, receipt and attachments atomic.
      await admissions.insertOne({
        _id: record.id, ...record, receipt,
        uploads: files.map(file => ({
          field: file.fieldname, filename: record.attachments[file.fieldname],
          contentType: file.mimetype, data: new Binary(file.buffer)
        }))
      });
    }
  };
}

function createStorage(env = process.env) {
  if (env.MONGODB_URI) {
    const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const store = createMongoStore(client.db(env.MONGODB_DB || 'yps'));
    return { ...store, async init() { await client.connect(); await store.health(); }, close: () => client.close() };
  }
  if (env.VERCEL || env.RENDER || env.NODE_ENV === 'production') {
    throw new Error('Set MONGODB_URI before starting the production backend.');
  }
  const root = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(__dirname, 'data');
  return {
    async init() { await fs.mkdir(root, { recursive: true }); },
    async health() { await fs.access(root); },
    async close() {},
    async save(record, receipt, files) {
      const directory = path.join(root, record.id);
      await fs.mkdir(directory, { recursive: true });
      try {
        for (const file of files) {
          await fs.writeFile(path.join(directory, record.attachments[file.fieldname]), file.buffer);
        }
        await fs.writeFile(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
        await fs.writeFile(path.join(directory, 'admission.json'), JSON.stringify(record, null, 2));
      } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
      }
    }
  };
}

module.exports = { createStorage, createMongoStore };
