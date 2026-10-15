const assert = require('assert');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const app = require('./index.cjs');
const server = app.listen(0, '127.0.0.1', async () => {
  function send(student, file) {
    const boundary = 'admission-test-boundary';
    let body = '--' + boundary + '\r\nContent-Disposition: form-data; name="student"\r\n\r\n' + JSON.stringify(student) + '\r\n';
    if (file) body += '--' + boundary + '\r\nContent-Disposition: form-data; name="receipt"; filename="receipt.pdf"\r\nContent-Type: application/pdf\r\n\r\n' + file + '\r\n';
    body += '--' + boundary + '--\r\n';
    return new Promise((resolve, reject) => {
      const req = http.request({host: '127.0.0.1', port: server.address().port, path: '/api/admissions', method: 'POST', headers: {'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': Buffer.byteLength(body)}}, res => {
        let result = ''; res.on('data', chunk => result += chunk); res.on('end', () => resolve({status: res.statusCode, body: JSON.parse(result)}));
      });
      req.on('error', reject); req.end(body);
    });
  }
  const student = {firstName: 'Test', lastName: 'Student', email: 'test@example.com', contact: '9876543210', gender: 'Female', year: '2026-27', class: 'Class 10', subjects: ['Mathematics'], selfStudy: false, discount: 100, amount: 500, paymentMode: 'cash', paymentMethod: '', paymentDate: '2026-10-15', remarks: ''};
  let savedDirectory;
  try {
    assert.equal((await send({...student, paymentMode: 'online'})).status, 400);
    assert.equal((await send({...student, amount: 3000})).status, 400);
    assert.equal((await send(student, 'not a PDF')).status, 400);
    const result = await send({...student, paymentMode: 'online', paymentMethod: 'PhonePe'}, '%PDF-1.4\n test fixture');
    assert.equal(result.status, 201);
    assert.match(result.body.id, /^[0-9a-f-]{36}$/);
    savedDirectory = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), result.body.id);
    const record = JSON.parse(await fs.readFile(path.join(savedDirectory, 'admission.json')));
    assert.equal(record.total, 2400);
    assert.equal(record.pending, 1900);
    const receipt = JSON.parse(await fs.readFile(path.join(savedDirectory, 'receipt.json')));
    assert.deepEqual(result.body.receipt, receipt);
    assert.equal(receipt.number, result.body.id);
    assert.equal(receipt.studentName, 'Test Student');
    assert.equal(receipt.total, 2400);
    assert.equal(receipt.paid, 500);
    assert.equal(receipt.pending, 1900);
    assert.equal(receipt.paymentMethod, 'PhonePe');
    assert.equal(await fs.readFile(path.join(savedDirectory, 'receipt.pdf'), 'utf8'), '%PDF-1.4\n test fixture');
    console.log('Backend checks passed: payment validation, overpayment, file signatures, upload and persistence.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (savedDirectory) await fs.rm(savedDirectory, {recursive: true, force: true}); server.close(); }
});
