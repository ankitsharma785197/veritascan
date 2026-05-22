# VeritaScan

VeritaScan is a full-stack document and image forensics app for detecting signs of AI generation, edits, and suspicious metadata. It supports authenticated users, upload-based scans, Gemini-powered analysis, and MongoDB-backed scan history.

## Features

- JWT-based signup, login, and session restore
- Upload scanner for JPG, PNG, WEBP, and PDF files
- 20 MB upload limit with server-side file validation
- Gemini visual/document analysis with fallback model support
- PDF text extraction and forensic metadata checks
- Per-user scan history with delete and clear-all actions
- React dashboard with scan progress, report view, and responsive history drawer

## Tech Stack

- Frontend: React 19, Vite, lucide-react
- Backend: Node.js, Express, MongoDB, Mongoose
- Authentication: JSON Web Tokens and bcrypt password hashing
- File processing: multer, sharp, pdf-parse
- AI analysis: Google Gemini API

## Project Structure

```text
.
|-- backend/
|   `-- src/
|       |-- config/       # Environment and database configuration
|       |-- middleware/   # Auth middleware
|       |-- models/       # Mongoose models
|       |-- routes/       # API routes
|       |-- services/     # Gemini and forensic analysis services
|       `-- server.js     # Express app entry point
|-- frontend/
|   `-- src/
|       |-- components/   # Report and uploader components
|       |-- context/      # Auth context
|       |-- lib/          # API client
|       |-- pages/        # Auth and dashboard screens
|       `-- main.jsx      # React entry point
|-- package.json          # Root workspace scripts
`-- README.md
```

## Prerequisites

- Node.js 18 or newer
- npm
- MongoDB running locally or a hosted MongoDB connection string
- Google Gemini API key

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then update `.env` in the project root:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/veritascan
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite,gemini-2.0-flash
CLIENT_ORIGIN=http://127.0.0.1:5173
```

Optional frontend variable:

```env
VITE_API_BASE=http://127.0.0.1:5001/api
```

The backend loads environment variables from the root `.env` file and falls back to development defaults for `PORT`, `MONGODB_URI`, `JWT_SECRET`, `GEMINI_MODEL`, and `CLIENT_ORIGIN`.

## Installation

Install all workspace dependencies from the project root:

```bash
npm install
```

## Run Locally

Start the frontend and backend together:

```bash
npm run dev
```

Open the app at:

```text
http://127.0.0.1:5173
```

The API runs at:

```text
http://127.0.0.1:5001
```

## Available Scripts

```bash
npm run dev          # Start backend and frontend in development mode
npm run build        # Build the frontend
npm run start        # Start the backend server
npm run install:all  # Install dependencies for all workspaces
```

Workspace-specific scripts:

```bash
npm run dev --workspace backend
npm run start --workspace backend
npm run dev --workspace frontend
npm run build --workspace frontend
npm run preview --workspace frontend
```

## API Overview

Base URL:

```text
http://127.0.0.1:5001/api
```

### Health

```http
GET /health
```

Returns API status and whether Gemini is configured.

### Authentication

```http
POST /auth/signup
POST /auth/login
GET /auth/me
```

Authenticated routes require:

```http
Authorization: Bearer <token>
```

### Scans

```http
GET /scans
POST /scans
DELETE /scans
DELETE /scans/:id
```

Upload scans use `multipart/form-data` with a `file` field. Supported MIME types are:

- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

## Gemini Model Fallbacks

The backend tries the configured `GEMINI_MODEL` first. If Gemini returns a quota/rate-limit response, it tries models listed in `GEMINI_MODEL_FALLBACKS`. By default, the fallback chain is:

```text
gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-2.0-flash
```

If all configured models are rate limited, scan creation returns a temporary 503 response.

## Production Notes

- Use a strong `JWT_SECRET`.
- Configure `CLIENT_ORIGIN` to match the deployed frontend URL.
- Configure `VITE_API_BASE` to point the frontend at the deployed API.
- Use a managed MongoDB instance for deployed environments.
- Do not commit `.env` files or API keys.

## License

No license has been specified yet.
 
