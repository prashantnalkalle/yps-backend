# YPS backend

Independent Express/Multer backend. This folder belongs beside reactiveform1, not inside it.

Local startup: npm ci followed by npm start. The default API address is http://localhost:3000.
Tests: npm test.

Endpoints:
- GET /api/health
- POST /api/admissions (multipart fields: student JSON, optional photo, optional receipt)

The API validates admissions, payment methods, amounts and file signatures. Requires Node.js 20 or later. Each upload is limited to 2 MB. When MONGODB_URI is set, admissions, generated receipts and binary uploads are saved atomically in one MongoDB document. Without it, local development uses DATA_DIR (defaults to data/). Production requires MongoDB.

## MongoDB Atlas

1. In your existing Atlas cluster, choose Connect > Drivers and copy the connection string. Use a database user with read/write access to the yps database. URL-encode special characters in credentials.
2. For local use, copy .env.example to .env and set MONGODB_URI to the private connection string and MONGODB_DB=yps. Keep .env out of Git.
3. In Atlas Network Access, allow your local public IP and your Render service's outbound IP ranges (listed in Render's Connect menu).
4. Run npm start. The server connects and pings MongoDB before listening. /api/health returns 503 when storage is unavailable.

Each document in the admissions collection has the UUID as _id and id, generated receipt data under receipt, and binary file content under uploads. API responses remain unchanged. Existing data/ records are preserved and are not imported automatically; new submissions use MongoDB.

npm test checks local API behavior and MongoDB BSON serialization and failures without Atlas. Live connectivity remains unverified until your private MONGODB_URI is configured.

## Render

Deploy this folder as its own repository. Use Node runtime, npm ci as the build command, npm start as the start command, and /api/health as the health check.

render.yaml is a reviewable Blueprint for a PAID Starter service using your MongoDB Atlas cluster. It does not provision Atlas or require a persistent disk for new submissions. It has not been deployed automatically.

Environment settings:
- NODE_ENV=production
- HOST=0.0.0.0
- FRONTEND_URL=https://YOUR-FRONTEND.vercel.app (exact origin without a trailing slash)
- MONGODB_URI=your private Atlas connection string
- MONGODB_DB=yps

Render supplies PORT; the server binds to it. Set MONGODB_URI privately in Render's environment settings. If an existing service has a disk, back up its records before removing it; this change does not migrate files.

The backend allows https://reactiveform1-seven.vercel.app and http://localhost:4200 by default. FRONTEND_URL can contain a comma-separated list of additional exact allowed origins; trailing slashes are normalized. Paths, queries and credentials are rejected. Add explicitly approved preview origins if needed. It controls browser CORS, not authentication.

Local .env.example documents settings; .env is loaded automatically. Host environment variables take precedence.

Keep data/, node_modules/ and .env out of Git. Local saved records are preserved by the folder move but are not uploaded in a code deployment. This API accepts new admissions and does not expose stored records publicly.
