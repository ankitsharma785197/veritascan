# VeritaScan AI Agent Project Guide

This document is for AI agents or developers who need to understand and modify this project quickly. The active application is a React frontend plus an Express/MongoDB backend. The older Streamlit files are still present for reference, but the primary app flow is in `frontend/` and `backend/`.

## Project Purpose

VeritaScan checks uploaded images and PDFs for signs of AI generation, editing, or document tampering. Users create an account, log in, upload a JPG, PNG, WEBP, or PDF, and receive a scan report with a verdict, confidence score, explanation, metadata, and risk indicators.

Supported verdict values:

- `LIKELY_AI_OR_EDITED`
- `LIKELY_AUTHENTIC`
- `INCONCLUSIVE`

## Main Technology Stack

- Frontend: React 19, Vite, lucide-react icons
- Backend: Node.js, Express, MongoDB, Mongoose
- Auth: JWT bearer tokens, bcrypt password hashing
- Upload handling: multer memory storage
- Image inspection: sharp
- PDF text extraction: pdf-parse
- AI analysis: Gemini REST API

## Important Files

- `package.json`: root workspace scripts for frontend and backend.
- `.env.demo`: sample environment variables.
- `README.md`: short setup guide.
- `backend/src/server.js`: Express app setup, CORS, health route, routers, error handler, DB startup.
- `backend/src/config/env.js`: environment loading and defaults.
- `backend/src/config/db.js`: MongoDB connection.
- `backend/src/models/User.js`: user schema, password hashing, password verification.
- `backend/src/models/Scan.js`: scan result schema.
- `backend/src/middleware/auth.js`: JWT authentication middleware.
- `backend/src/routes/auth.js`: signup, login, and current-user routes.
- `backend/src/routes/scans.js`: scan history, upload, delete, and clear routes.
- `backend/src/services/forensics.js`: image/PDF forensic logic and Gemini prompt calibration.
- `backend/src/services/gemini.js`: Gemini API request and JSON parsing.
- `frontend/src/lib/api.js`: frontend API helper.
- `frontend/src/context/AuthContext.jsx`: frontend token/user state and login/signup/logout logic.
- `frontend/src/App.jsx`: switches between auth page and dashboard based on token.
- `frontend/src/pages/AuthPage.jsx`: login/signup UI.
- `frontend/src/pages/Dashboard.jsx`: authenticated app, upload workflow, history, delete actions.
- `frontend/src/components/ScanUploader.jsx`: drag/drop and file picker UI.
- `frontend/src/components/Report.jsx`: scan result display.
- `main.py` and `server.py`: older Streamlit implementation/reference code, not the main app path.

## Runtime Setup

Install dependencies:

```bash
npm install
```

Run the full app:

```bash
npm run dev
```

Default URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5001`
- Health check: `http://127.0.0.1:5001/api/health`

The backend expects MongoDB to be running. By default it connects to:

```text
mongodb://127.0.0.1:27017/veritascan
```

Required environment values should be placed in `.env`, using `.env.demo` as the template:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest
PORT=5001
CLIENT_ORIGIN=http://127.0.0.1:5173
MONGODB_URI=mongodb://127.0.0.1:27017/veritascan
JWT_SECRET=...
```

Do not commit real API keys or production JWT secrets.

## High-Level App Flow

1. User opens the Vite frontend.
2. `frontend/src/App.jsx` reads auth state from `AuthProvider`.
3. If no token exists, the app shows `AuthPage`.
4. Login or signup calls `POST /api/auth/login` or `POST /api/auth/signup`.
5. Backend returns `{ token, user }`.
6. Frontend stores token and user in `localStorage`.
7. With a token present, the app shows `Dashboard`.
8. Dashboard loads recent scans from `GET /api/scans`.
9. User selects or drops a file in `ScanUploader`.
10. Dashboard sends the file as `FormData` to `POST /api/scans`.
11. Backend analyzes the file and stores the result in MongoDB.
12. Frontend adds the new result to scan history and renders `Report`.

## Authentication Flow

Frontend state lives in `frontend/src/context/AuthContext.jsx`.

- Token storage key: `veritascan_token`
- User storage key: `veritascan_user`
- `authenticate(mode, form)` calls `/auth/login` or `/auth/signup`.
- `logout()` clears local storage and resets React state.

Backend auth lives in `backend/src/routes/auth.js` and `backend/src/middleware/auth.js`.

Signup:

- Route: `POST /api/auth/signup`
- Required body: `name`, `email`, `password`
- Password must be at least 6 characters.
- Email is checked for duplicates.
- Password is hashed with bcrypt using 12 rounds.
- JWT is signed with payload `{ sub: user._id }`.
- Token expires in 7 days.

Login:

- Route: `POST /api/auth/login`
- Required body: `email`, `password`
- Email is normalized to lowercase for lookup.
- Password is checked with `user.verifyPassword()`.
- Returns `{ token, user }` on success.

Protected routes:

- Clients must send `Authorization: Bearer <token>`.
- `requireAuth` verifies the token with `JWT_SECRET`.
- It loads the user with `_id`, `name`, and `email`.
- It attaches the user to `req.user`.
- Invalid, missing, or expired sessions return `401`.

## Data Model

### User

Defined in `backend/src/models/User.js`.

Fields:

- `name`: required string, trimmed, max 80 chars
- `email`: required unique lowercase string
- `passwordHash`: required string
- `createdAt` and `updatedAt`: automatic timestamps

Methods:

- `User.createWithPassword({ name, email, password })`
- `user.verifyPassword(password)`

### Scan

Defined in `backend/src/models/Scan.js`.

Fields:

- `user`: required ObjectId reference to `User`
- `fileName`: original uploaded filename
- `mimeType`: uploaded MIME type
- `fileSize`: byte size
- `fileKind`: `image` or `pdf`
- `verdict`: `LIKELY_AI_OR_EDITED`, `LIKELY_AUTHENTIC`, or `INCONCLUSIVE`
- `confidence`: number from 0 to 100
- `explanation`: human-readable summary
- `indicators`: array of `{ label, severity, detail }`
- `metadata`: mixed object for image/PDF metadata
- `pdfText`: extracted PDF text, if available
- `geminiRaw`: raw Gemini text response
- `createdAt` and `updatedAt`: automatic timestamps

Scan ownership is enforced by querying with both scan id and `req.user._id`.

## API Endpoints

### Health

`GET /api/health`

Returns:

```json
{
  "ok": true,
  "geminiConfigured": true
}
```

### Auth

`POST /api/auth/signup`

Body:

```json
{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "password123"
}
```

`POST /api/auth/login`

Body:

```json
{
  "email": "demo@example.com",
  "password": "password123"
}
```

Both return:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "mongo-user-id",
    "name": "Demo User",
    "email": "demo@example.com"
  }
}
```

`GET /api/auth/me`

Requires bearer token. Returns the current public user.

### Scans

All scan routes require bearer token.

`GET /api/scans`

Returns the latest 20 scans for the current user, newest first. It selects public report fields and excludes internal raw fields like `pdfText` and `geminiRaw`.

`POST /api/scans`

Uploads and analyzes a file.

- Content type: `multipart/form-data`
- Field name: `file`
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Max file size: 20 MB

Returns:

```json
{
  "scan": {
    "_id": "scan-id",
    "fileName": "example.pdf",
    "mimeType": "application/pdf",
    "fileSize": 12345,
    "fileKind": "pdf",
    "verdict": "INCONCLUSIVE",
    "confidence": 50,
    "explanation": "Summary...",
    "indicators": [],
    "metadata": {}
  }
}
```

`DELETE /api/scans/:id`

Deletes one scan owned by the current user.

`DELETE /api/scans`

Deletes all scans owned by the current user.

## File Analysis Flow

The upload route in `backend/src/routes/scans.js` uses multer memory storage. Uploaded file bytes are never written to disk by the backend. The file buffer is passed directly to `analyzeFile()` in `backend/src/services/forensics.js`.

### Image Analysis

`inspectImage(buffer, mimeType)` performs:

- `sharp().metadata()` extraction.
- Byte-level search for AI generator signatures such as DALL-E, OpenAI, Imagen, SynthID, Midjourney, Stable Diffusion, ComfyUI, and Adobe/C2PA markers.
- Metadata sparsity check for missing EXIF, ICC, and XMP.
- Common AI canvas resolution check.
- Gemini visual analysis using the original file bytes as inline data.
- Calibration to avoid overclaiming from missing metadata, compression, screenshots, or old dates.

If a high-severity embedded AI signature is found, the final verdict is forced to `LIKELY_AI_OR_EDITED` with confidence at least 90.

Image metadata stored in MongoDB includes:

- `width`
- `height`
- `format`
- `space`
- `hasExif`
- `hasXmp`
- `hasIcc`

### PDF Analysis

`inspectPdf(buffer)` performs:

- Text extraction with `pdf-parse`.
- Metadata collection such as page count, PDF info, text availability, extracted text length, and extraction errors.
- Gemini document analysis using the PDF bytes as inline data.
- Prompt includes the extracted text layer so Gemini can compare visible content against embedded text.
- Calibration treats font differences, metadata quirks, object ordering, and text-layer ordering as weak evidence unless there is stronger contradiction or mismatch.

PDF-specific fields:

- `metadata.pages`
- `metadata.info`
- `metadata.hasExtractableText`
- `metadata.extractedTextLength`
- `metadata.extractionError`
- `pdfText`: stored excerpt of extracted text, up to 20,000 chars

## Gemini Integration

`backend/src/services/gemini.js` calls:

```text
https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent
```

The request contains:

- A text prompt.
- Inline base64 file data.
- `generationConfig.temperature = 0.2`
- `generationConfig.responseMimeType = application/json`

The code expects Gemini to return JSON with:

```json
{
  "verdict": "LIKELY_AI_OR_EDITED",
  "confidence": 85,
  "explanation": "1-3 concise sentences",
  "indicators": [
    {
      "label": "short label",
      "severity": "low",
      "detail": "specific reason"
    }
  ]
}
```

`parseJsonFromText()` can handle direct JSON or fenced ```json blocks. The normalized result clamps confidence to 0-100, validates verdict values, normalizes severity, truncates long strings, and falls back to `INCONCLUSIVE` if parsing fails.

## Frontend Data Handling

`frontend/src/lib/api.js` is the single API helper.

- Uses `VITE_API_BASE` if defined.
- Defaults to `http://127.0.0.1:5001/api`.
- Automatically JSON-serializes normal request bodies.
- Leaves `FormData` untouched for file upload.
- Adds `Authorization: Bearer <token>` when a token is supplied.
- Parses JSON response and throws `Error(message)` for non-2xx responses.

Dashboard state in `frontend/src/pages/Dashboard.jsx`:

- `file`: selected upload file
- `scans`: current user's recent scan history
- `activeScan`: currently displayed report
- `scanning`: loading state during upload/analyze
- `error`: current UI error message

History behavior:

- On dashboard mount, `loadHistory()` calls `GET /api/scans`.
- After a new scan, the result is prepended to local history.
- Deleting a scan calls `DELETE /api/scans/:id` and removes it locally.
- Clearing history calls `DELETE /api/scans` and clears local state.

## Security And Privacy Notes

- Passwords are never stored directly; only bcrypt hashes are stored.
- JWTs are currently stored in `localStorage`, which is simple but vulnerable to XSS token theft. If hardening auth, consider httpOnly secure cookies and CSRF protection.
- Uploads are held in memory and passed to Gemini. The backend does not persist original files, but it does persist derived scan metadata, extracted PDF text, indicators, explanation, and Gemini raw output.
- `GET /api/scans` intentionally does not select `pdfText` or `geminiRaw`.
- Real `.env` secrets should not be committed or copied into documentation.
- `JWT_SECRET` should be long and random outside local development.

## Development Notes For Future Agents

- Prefer modifying the React/Express app unless the user explicitly asks about the Streamlit version.
- Keep route behavior consistent with the existing API helper and AuthContext.
- When adding protected backend routes, use `requireAuth`.
- When adding scan fields, update both `Scan.js` and frontend display/selection logic if the field should appear in the UI.
- When changing upload behavior, update both client-side allowed types in `ScanUploader.jsx` and server-side multer validation in `scans.js`.
- When changing API base URLs, prefer `VITE_API_BASE` for frontend and `CLIENT_ORIGIN` for backend CORS.
- Be careful with AI verdict language. The app already has calibration logic to avoid false positives from metadata-only, compression-only, or weak PDF construction signals.
- The backend depends on network access to Gemini. Without `GEMINI_API_KEY`, scan uploads fail with `GEMINI_API_KEY is missing in .env`.

## Common Commands

Install all workspace dependencies:

```bash
npm install
```

Run frontend and backend together:

```bash
npm run dev
```

Run backend only:

```bash
npm run dev --workspace backend
```

Run frontend only:

```bash
npm run dev --workspace frontend
```

Build frontend:

```bash
npm run build
```

Start production backend:

```bash
npm run start --workspace backend
```

## Current Limitations

- There is no automated test suite in the project.
- The original uploaded files are not retained, so reports cannot re-render the source file from stored data.
- Auth state is trusted from localStorage until an API request fails; the frontend does not call `/auth/me` on startup.
- MongoDB must be available before the backend starts.
- Gemini failures fail the scan request instead of producing a partial heuristic-only report.
- The repository contains generated folders such as `node_modules/` and frontend `dist/`; avoid editing generated dependencies.
