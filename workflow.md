# VeritaScan Project Workflow

This document explains the full workflow of VeritaScan, especially what happens after a user uploads an image or PDF.

## High-Level Workflow

```text
User
  -> React Frontend
  -> Express Backend
  -> MongoDB
  -> Forensics Service
  -> Gemini API
  -> MongoDB
  -> React Report UI
```

## 1. App Start Workflow

1. MongoDB starts locally or through Atlas.
2. Backend starts from `backend/src/server.js`.
3. Backend loads `.env` from `backend/src/config/env.js`.
4. Backend connects to MongoDB using `backend/src/config/db.js`.
5. Backend registers auth routes and scan routes.
6. Frontend starts using Vite.
7. User opens `http://127.0.0.1:5173`.

Backend URL:

```text
http://127.0.0.1:5001
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## 2. Authentication Workflow

### Signup

1. User enters name, email, and password.
2. Frontend calls:

```text
POST /api/auth/signup
```

3. Backend validates fields.
4. Backend checks if email already exists.
5. Backend hashes password using bcrypt.
6. Backend creates user in MongoDB.
7. Backend creates JWT token.
8. Backend returns:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

9. Frontend stores token and user in localStorage.
10. User enters dashboard.

### Login

1. User enters email and password.
2. Frontend calls:

```text
POST /api/auth/login
```

3. Backend finds user by email.
4. Backend compares password with bcrypt hash.
5. Backend returns JWT token and public user data.
6. Frontend opens dashboard.

## 3. Dashboard Workflow

When the dashboard opens:

1. Frontend reads token from AuthContext.
2. Frontend calls:

```text
GET /api/scans
```

3. Backend verifies JWT using `requireAuth`.
4. Backend finds recent scans for that user.
5. Backend returns latest 20 scans.
6. Frontend shows scan history in sidebar.

## 4. Upload Workflow

1. User drags or selects a file.
2. Frontend checks file type.
3. Supported types:

```text
image/jpeg
image/png
image/webp
application/pdf
```

4. User clicks Analyze File.
5. Frontend creates FormData:

```js
const body = new FormData();
body.append('file', file);
```

6. Frontend calls:

```text
POST /api/scans
```

7. JWT token is sent in Authorization header.

```text
Authorization: Bearer <token>
```

## 5. Backend Upload Workflow

The upload route is in:

```text
backend/src/routes/scans.js
```

Steps:

1. `requireAuth` verifies the user.
2. Multer receives file using memory storage.
3. File size limit is 20 MB.
4. Backend rejects unsupported file types.
5. Uploaded file is available as:

```js
req.file.buffer
req.file.mimetype
req.file.originalname
req.file.size
```

6. Backend calls:

```js
analyzeFile({ buffer: req.file.buffer, mimeType: req.file.mimetype })
```

The original uploaded file is not saved to disk.

## 6. Image Analysis Workflow

Image analysis happens in:

```text
backend/src/services/forensics.js
```

If the MIME type starts with `image/`, backend runs `inspectImage()`.

### Image Steps

1. Sharp reads image metadata.
2. Backend checks image width, height, format, color space, EXIF, XMP, and ICC.
3. Backend scans file bytes for known AI generator signatures:

```text
DALL-E
OpenAI
ChatGPT
Google Imagen
SynthID
Midjourney
Stable Diffusion
ComfyUI
Adobe/C2PA
```

4. Backend checks if the image uses common AI canvas sizes.
5. Backend creates a Gemini prompt asking for visual tampering and AI-generation analysis.
6. Backend sends:

```text
prompt + image bytes
```

to Gemini.

7. Gemini returns JSON:

```json
{
  "verdict": "LIKELY_AI_OR_EDITED",
  "confidence": 85,
  "explanation": "Short reason",
  "indicators": []
}
```

8. Backend normalizes the result.
9. Backend combines local indicators and Gemini indicators.
10. Backend returns final image report.

### Image Output

Image report contains:

- fileKind: `image`
- verdict
- confidence
- explanation
- indicators
- metadata
- geminiModel
- geminiRaw

## 7. PDF Analysis Workflow

PDF analysis happens in:

```text
backend/src/services/forensics.js
```

If MIME type is `application/pdf`, backend runs `inspectPdf()`.

### PDF Step 1: Text Extraction

Backend uses `pdf-parse` to extract embedded PDF text.

It creates:

```js
extractedText
```

This is cleaned by removing extra whitespace.

### PDF Step 2: Metadata Reading

Backend reads PDF metadata from `pdf-parse`, including:

- page count
- PDF info object
- creation date
- modification date
- producer
- creator
- whether text is extractable
- extracted text length

### PDF Step 3: Local Heuristic Checks

Before Gemini, backend runs local checks.

Current PDF local checks:

- Metadata date mismatch
- Missing or unknown producer/creator
- Editing-oriented PDF tools
- Low text-to-page ratio
- No extractable text layer
- PDF text extraction failure

Example:

If a PDF has very little extractable text per page, it can mean the document was flattened or image blocks were placed over text.

### PDF Step 4: Gemini Prompt

Backend sends Gemini:

- PDF metadata
- extracted PDF text
- original PDF bytes
- instructions to check for tampering

Gemini is asked to inspect:

- font inconsistencies
- synthetic or unusual embedded fonts
- alignment anomalies
- kerning problems
- baseline shifts
- added layers
- image-over-text tampering
- metadata contradictions
- copy-paste artifacts
- repeated or cloned elements
- object ordering issues
- cross-reference table anomalies
- AI-generated text patterns

### PDF Step 5: Gemini API Call

Gemini request is made in:

```text
backend/src/services/gemini.js
```

The request sends:

```text
prompt + base64 PDF bytes
```

Temperature remains:

```text
0.2
```

### PDF Step 6: Model Fallback

If the first Gemini model hits 429 quota, backend tries fallback models.

Fallback chain:

```text
gemini-2.5-flash
  -> gemini-2.5-flash-lite
  -> gemini-2.0-flash
```

If all models are rate-limited, backend returns:

```json
{
  "error": "AI analysis is temporarily unavailable due to rate limits. Please try again in a few minutes."
}
```

### PDF Step 7: Result Calibration

Backend checks Gemini response and prevents bad results.

Examples:

- Weak signals are not removed.
- False future-date claims are corrected.
- A date is only future if it is actually after the current date.
- Weak but meaningful evidence becomes `INCONCLUSIVE`, not clean authentic.
- Strong evidence can become `LIKELY_AI_OR_EDITED`.

### PDF Output

PDF report contains:

- fileKind: `pdf`
- verdict
- confidence
- explanation
- indicators
- metadata
- pdfText
- geminiModel
- geminiRaw

## 8. Saving Scan Result

After analysis, backend creates a Scan document in MongoDB.

Stored fields:

- user
- fileName
- mimeType
- fileSize
- fileKind
- verdict
- confidence
- explanation
- indicators
- metadata
- pdfText
- geminiModel
- geminiRaw
- createdAt
- updatedAt

The scan belongs to the logged-in user.

## 9. Returning Result To Frontend

Backend returns:

```json
{
  "scan": {
    "_id": "scan-id",
    "fileName": "document.pdf",
    "fileKind": "pdf",
    "verdict": "INCONCLUSIVE",
    "confidence": 62,
    "explanation": "Analysis summary",
    "indicators": [],
    "metadata": {}
  }
}
```

Frontend then:

1. Adds scan to top of history.
2. Sets it as active scan.
3. Shows Report component.
4. Displays verdict, confidence, explanation, indicators, and metadata.

## 10. Report UI Workflow

Report component receives:

```js
<Report scan={activeScan} />
```

It displays:

- Verdict card
- Confidence bar
- File name and size
- Analysis summary
- Risk indicators
- Technical metadata
- Scan Another File button
- Delete This Report button

If indicators exist, they are rendered as rows. The message `No specific risk signals detected` only appears when the indicators array is truly empty.

## 11. Scan History Workflow

Recent history uses:

```text
GET /api/scans
```

Backend returns latest 20 scans for the current user.

Frontend shows:

- file name
- verdict badge
- file size
- time
- confidence
- delete button

The sidebar scrolls independently when history becomes large.

## 12. Delete Workflow

Delete one scan:

```text
DELETE /api/scans/:id
```

Clear all scans:

```text
DELETE /api/scans
```

Backend only deletes scans owned by the logged-in user.

## 13. Complete PDF Example

For a PDF upload:

```text
User uploads PDF
  -> frontend sends FormData
  -> backend receives buffer with multer
  -> pdf-parse extracts embedded text
  -> backend reads PDF metadata
  -> backend runs local heuristic checks
  -> backend builds Gemini prompt with metadata + extracted text
  -> backend sends original PDF bytes to Gemini
  -> Gemini returns JSON result
  -> backend calibrates result
  -> backend stores scan in MongoDB
  -> frontend displays report
```

## 14. Complete Image Example

For an image upload:

```text
User uploads image
  -> frontend sends FormData
  -> backend receives buffer with multer
  -> sharp reads metadata
  -> backend checks AI signatures in bytes
  -> backend checks common AI image dimensions
  -> backend builds Gemini image prompt
  -> backend sends image bytes to Gemini
  -> Gemini returns JSON result
  -> backend combines local + Gemini indicators
  -> backend stores scan in MongoDB
  -> frontend displays report
```

## 15. Key Security Points

- Passwords are hashed with bcrypt.
- JWT protects scan routes.
- Users can only access their own scans.
- Uploaded files are processed in memory.
- Original uploaded files are not permanently stored.
- API keys stay in backend `.env`, not frontend.
