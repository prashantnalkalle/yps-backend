# YPS backend

Independent Express/Multer backend. This folder belongs beside reactiveform1, not inside it.

Local startup: npm ci followed by npm start. The default API address is http://localhost:3000.
Tests: npm test.

Endpoints:
- GET /api/health
- POST /api/admissions (multipart fields: student JSON, optional photo, optional receipt)

The API validates admissions, payment methods, amounts and file signatures. Files are limited to 2 MB each. Admissions, generated receipt data and uploaded attachments are saved in DATA_DIR (defaults to data/ locally).

## Render

Deploy this folder as its own repository. Use Node runtime, npm ci as the build command, npm start as the start command, and /api/health as the health check.

render.yaml is a reviewable Blueprint for a PAID Starter service with a 1 GB persistent disk. Review costs in Render before creating it. It has not been deployed automatically.

Environment settings:
- NODE_ENV=production
- HOST=0.0.0.0
- FRONTEND_URL=https://YOUR-FRONTEND.vercel.app (exact origin without a trailing slash)
- DATA_DIR=/var/data/yps

Mount a persistent disk at /var/data. Render supplies PORT; the server binds to it. Without durable storage, Render discards locally written admissions and uploads on restarts and deploys. Do not set DATA_DIR to an ephemeral folder for production.

FRONTEND_URL can contain a comma-separated list of exact allowed origins. Add explicitly approved preview origins if needed. It controls browser CORS, not authentication.

Local .env.example documents settings; .env files are not loaded automatically. Set variables through the host dashboard or terminal environment.

Keep data/, node_modules/ and .env out of Git. Local saved records are preserved by the folder move but are not uploaded in a code deployment. This API accepts new admissions and does not expose stored records publicly.
