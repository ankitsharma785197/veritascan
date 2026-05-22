# VeritaScan Start Guide

This guide explains how to start the complete VeritaScan project: MongoDB database, Express backend, and React frontend.

## Project Parts

VeritaScan has three main runtime parts:

- Database: MongoDB stores users and scan reports.
- Backend: Node.js + Express API handles auth, uploads, Gemini analysis, and scan history.
- Frontend: React + Vite app provides login, dashboard, upload, history, and report UI.

## Folder Structure

```text
Document-Farud/
  package.json              Root workspace scripts
  .env                      Local environment variables
  .env.demo                 Example environment file
  backend/
    package.json
    src/server.js           Express app entry point
    src/config/db.js        MongoDB connection
    src/config/env.js       Environment config
    src/routes/auth.js      Login/signup APIs
    src/routes/scans.js     Upload/history/delete APIs
    src/services/forensics.js
    src/services/gemini.js
  frontend/
    package.json
    src/main.jsx
    src/App.jsx
    src/pages/
    src/components/
```

## Requirements

Install these before starting:

- Node.js
- npm
- MongoDB running locally, or a MongoDB Atlas connection string
- Gemini API key

## Environment Setup

Create `.env` in the project root. You can copy from `.env.demo`.

```bash
cp .env.demo .env
```

Required values:

```text
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite,gemini-2.0-flash

PORT=5001
CLIENT_ORIGIN=http://127.0.0.1:5173
MONGODB_URI=mongodb://127.0.0.1:27017/veritascan
JWT_SECRET=replace-with-a-long-random-secret
```

Do not share the real `.env` file because it contains secrets.

## Database Start

If using local MongoDB, make sure it is running.

Common macOS Homebrew command:

```bash
brew services start mongodb-community
```

If MongoDB is already running, no extra database command is needed. The backend automatically connects to:

```text
mongodb://127.0.0.1:27017/veritascan
```

MongoDB creates the `veritascan` database automatically when the first user or scan is saved.

## Install Dependencies

From the project root:

```bash
npm install
```

This installs dependencies for the root workspace, backend, and frontend.

## Start Full Project

From the project root:

```bash
npm run dev
```

This starts both:

- Backend API: `http://127.0.0.1:5001`
- Frontend app: `http://127.0.0.1:5173`

Open the frontend URL in the browser.

## Start Backend Only

```bash
npm run dev --workspace backend
```

Backend runs at:

```text
http://127.0.0.1:5001
```

Health check:

```bash
curl http://127.0.0.1:5001/api/health
```

Expected response:

```json
{
  "ok": true,
  "geminiConfigured": true
}
```

## Start Frontend Only

```bash
npm run dev --workspace frontend
```

Frontend runs at:

```text
http://127.0.0.1:5173
```

The frontend calls the backend at `http://127.0.0.1:5001/api` by default.

## Build Frontend

```bash
npm run build --workspace frontend
```

This creates the production frontend build in:

```text
frontend/dist/
```

## Login And Signup Flow

1. Open frontend.
2. Create account with name, email, and password.
3. Backend hashes the password with bcrypt.
4. Backend stores user in MongoDB.
5. Backend returns JWT token and public user data.
6. Frontend stores token and user in localStorage.
7. Dashboard loads scan history using the token.

## Common Problems

### Frontend says connection refused

Backend is not running. Start it:

```bash
npm run dev --workspace backend
```

### Backend fails to start

Check MongoDB and `.env`.

```bash
curl http://127.0.0.1:5001/api/health
```

### Scan fails with Gemini error

Check:

- `GEMINI_API_KEY` exists in `.env`
- model names are valid
- Gemini quota is available

The backend uses fallback models:

```text
gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-2.0-flash
```

If all are rate-limited, the user sees a clean retry-later message.

## Stop Project

If running with `npm run dev`, press:

```text
Ctrl + C
```

If ports are still busy, find processes:

```bash
lsof -iTCP:5001 -sTCP:LISTEN -n -P
lsof -iTCP:5173 -sTCP:LISTEN -n -P
```

Then stop the listed process IDs:

```bash
kill <PID>
```
