const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const app = express();
app.disable('x-powered-by');
const defaultOrigins = [
  'https://reactiveform1-seven.vercel.app',
  'http://localhost:4200'
];
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  [...defaultOrigins, ...configuredOrigins].map(origin => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('FRONTEND_URL must contain comma-separated HTTP or HTTPS origins without paths.');
    }
    return url.origin;
  })
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.vary('Origin');
    if (!allowedOrigins.has(origin)) return res.status(403).json({ error: 'This frontend origin is not allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'yps-backend' }));
const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (process.env.RENDER && !process.env.DATA_DIR) {
  throw new Error('Set DATA_DIR to a persistent disk mount path before deploying.');
}
const rates = { Mathematics: 2500, Science: 2500, English: 1800, 'Social Science': 1800, Physics: 3000, Chemistry: 3000, Biology: 3000 };
const methods = ['PhonePe', 'Google Pay', 'Paytm', 'BHIM', 'Amazon Pay', 'WhatsApp Pay', 'Other UPI app', 'Debit card', 'Credit card', 'Net banking', 'NEFT', 'RTGS', 'IMPS'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 2, fields: 1, fieldSize: 16384 },
  fileFilter(req, file, callback) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.fieldname === 'receipt') allowed.push('application/pdf');
    callback(allowed.includes(file.mimetype) ? null : new Error('Unsupported file type'), allowed.includes(file.mimetype));
  }
}).fields([{ name: 'photo', maxCount: 1 }, { name: 'receipt', maxCount: 1 }]);

function validSignature(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/jpeg') return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (file.mimetype === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return file.mimetype === 'application/pdf' && b.toString('ascii', 0, 5) === '%PDF-';
}
app.post('/api/admissions', (req, res) => {
  upload(req, res, async error => {
    if (error) return res.status(400).json({ error: error.message });
    let directory;
    try {
      const student = JSON.parse(req.body.student);
      const upper = ['Class 11', 'Class 12'].includes(student.class);
      const subjects = upper ? ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'] : ['Mathematics', 'Science', 'English', 'Social Science'];
      const nameValid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 60;
      if (!nameValid(student.firstName) || !nameValid(student.lastName) ||
          typeof student.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email) ||
          !/^[6-9][0-9]{9}$/.test(student.contact) ||
          !['Female', 'Male', 'Other', 'Prefer not to say'].includes(student.gender) ||
          !['2026-27', '2027-28', '2028-29'].includes(student.year) ||
          !['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].includes(student.class) ||
          !Array.isArray(student.subjects) || !student.subjects.length ||
          new Set(student.subjects).size !== student.subjects.length ||
          student.subjects.some(subject => !subjects.includes(subject)) ||
          typeof student.selfStudy !== 'boolean' || typeof student.remarks !== 'string' || student.remarks.length > 1000) {
        return res.status(400).json({ error: 'Invalid student details' });
      }
      const subtotal = student.subjects.reduce((sum, subject) => sum + rates[subject], 0);
      if (typeof student.discount !== 'number' || !Number.isFinite(student.discount) || student.discount < 0 || student.discount > subtotal ||
          typeof student.amount !== 'number' || !Number.isFinite(student.amount) || student.amount < 0 || student.amount > subtotal - student.discount ||
          !['cash', 'online', 'cheque'].includes(student.paymentMode) ||
          (student.paymentMode === 'cash' && student.paymentMethod !== '') ||
          (student.paymentMode === 'online' && !methods.includes(student.paymentMethod)) ||
          (student.paymentMode === 'cheque' && student.paymentMethod !== 'Cheque') ||
          (student.amount > 0 && (!/^\d{4}-\d{2}-\d{2}$/.test(student.paymentDate) || !Number.isFinite(Date.parse(student.paymentDate))))) {
        return res.status(400).json({ error: 'Invalid payment details' });
      }
      const files = Object.values(req.files || {}).flat();
      if (files.some(file => !validSignature(file))) return res.status(400).json({ error: 'File content does not match its type' });
      const id = randomUUID();
      directory = path.join(dataDirectory, id);
      await fs.mkdir(directory, { recursive: true });
      const attachments = {};
      const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
      for (const file of files) {
        const filename = file.fieldname + extensions[file.mimetype];
        await fs.writeFile(path.join(directory, filename), file.buffer);
        attachments[file.fieldname] = filename;
      }
      const createdAt = new Date().toISOString();
      const receipt = {
        number: id, issuedAt: createdAt,
        studentName: student.firstName.trim() + ' ' + student.lastName.trim(),
        email: student.email, contact: student.contact, class: student.class, year: student.year,
        items: student.subjects.map(subject => ({ subject, amount: rates[subject] })),
        subtotal, discount: student.discount, total: subtotal - student.discount,
        paid: student.amount, pending: subtotal - student.discount - student.amount,
        paymentDate: student.amount > 0 ? student.paymentDate : null,
        paymentMode: student.amount > 0 ? student.paymentMode : null,
        paymentMethod: student.amount > 0 ? student.paymentMethod : null,
        remarks: student.remarks
      };
      await fs.writeFile(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
      await fs.writeFile(path.join(directory, 'admission.json'), JSON.stringify({ id, student, total: receipt.total, pending: receipt.pending, attachments, createdAt }, null, 2));
      res.status(201).json({ id, receipt });
    } catch (error) {
      if (directory) await fs.rm(directory, { recursive: true, force: true });
      res.status(error instanceof SyntaxError ? 400 : 500).json({ error: 'Unable to save admission' });
    }
  });
});
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || (process.env.RENDER || process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  app.listen(port, host, () => console.log('YPS admission API listening on ' + host + ':' + port));
}
module.exports = app;
