# VeritaScan Team Roles

This file describes five project roles. Each person should understand their own responsibilities and be ready to explain their part to a professor.

## 1. Frontend Developer

### Main Responsibility

The frontend developer built the React user interface that users interact with.

### Files Owned

- `frontend/src/App.jsx`
- `frontend/src/pages/AuthPage.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/ScanUploader.jsx`
- `frontend/src/components/Report.jsx`
- `frontend/src/styles.css`

### Work Done

- Created the dark forensic dashboard UI.
- Built login and signup screens.
- Built file upload drag-and-drop UI.
- Built scan history sidebar.
- Built report screen showing verdict, confidence, explanation, indicators, and metadata.
- Added responsive design for desktop and mobile.
- Displayed backend errors in a readable way.

### What To Say If Professor Asks

I worked on the React frontend. My responsibility was to make the system easy to use. I built the login page, dashboard, upload area, scan history, and final report page. The frontend sends files to the backend using FormData and displays the backend response. I did not perform AI detection in the frontend; I only show the result returned by the backend.

### Important Explanation

When a user uploads an image or PDF, the frontend sends it to:

```text
POST /api/scans
```

After the backend returns the scan result, the frontend adds it to recent history and shows the report.

## 2. Backend API Developer

### Main Responsibility

The backend developer built the Express API that handles authentication, protected routes, file uploads, and scan history.

### Files Owned

- `backend/src/server.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/scans.js`
- `backend/src/middleware/auth.js`
- `backend/src/config/env.js`
- `backend/src/config/db.js`

### Work Done

- Created Express server.
- Connected backend to MongoDB.
- Added CORS so frontend can call backend.
- Built signup, login, and current-user APIs.
- Added JWT authentication middleware.
- Built protected scan APIs.
- Used multer memory storage to receive uploaded files.
- Added clean error handling for Gemini rate limit failures.

### What To Say If Professor Asks

I worked on the backend API. I created the routes for login, signup, scan upload, scan history, delete scan, and clear all scans. I also added JWT authentication so every scan belongs to the logged-in user. Files are uploaded through multer and passed as a memory buffer to the forensic analysis service.

### Important Explanation

The backend does not save uploaded files to disk. It only saves the scan result in MongoDB.

Protected scan routes require:

```text
Authorization: Bearer <jwt-token>
```

## 3. Database And Authentication Developer

### Main Responsibility

This role handled user accounts, password security, MongoDB models, and scan data storage.

### Files Owned

- `backend/src/models/User.js`
- `backend/src/models/Scan.js`
- `backend/src/routes/auth.js`
- `backend/src/middleware/auth.js`

### Work Done

- Created User model.
- Created Scan model.
- Stored password hashes instead of plain passwords.
- Used bcrypt for password hashing.
- Used JWT for session authentication.
- Stored scan results with user ownership.
- Ensured users only see their own scans.

### What To Say If Professor Asks

I handled database structure and authentication. The User model stores name, email, and passwordHash. Passwords are never stored directly. The Scan model stores the result of each analysis, including verdict, confidence, explanation, indicators, metadata, extracted PDF text, raw Gemini response, and the Gemini model used. Each scan has a user reference, so scan history is user-specific.

### Important Explanation

User fields:

- name
- email
- passwordHash

Scan fields:

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

## 4. AI And Forensics Developer

### Main Responsibility

This role built the detection logic for images and PDFs.

### Files Owned

- `backend/src/services/forensics.js`
- `backend/src/services/gemini.js`

### Work Done

- Added image metadata inspection using Sharp.
- Added PDF text extraction using pdf-parse.
- Added local PDF heuristic checks.
- Created Gemini prompts for image and PDF analysis.
- Added Gemini model fallback chain.
- Added calibration logic so weak signals are not hidden.
- Added safeguards against false future-date claims.

### What To Say If Professor Asks

I worked on the forensic analysis engine. For images, we check metadata, dimensions, embedded AI signatures, and Gemini visual analysis. For PDFs, we extract text, inspect metadata, check text density, and send both PDF bytes and extracted text to Gemini. The system returns a verdict, confidence score, explanation, and indicators.

### Important Explanation

For PDF scanning:

1. Extract PDF text.
2. Read PDF metadata.
3. Run local checks like metadata mismatch and low text-to-page ratio.
4. Send PDF bytes, metadata, and extracted text to Gemini.
5. Normalize Gemini JSON response.
6. Merge local and Gemini indicators.
7. Store final report.

Gemini fallback chain:

```text
gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-2.0-flash
```

## 5. Testing, Integration, And Presentation Lead

### Main Responsibility

This role connects all parts together, verifies flows, prepares demo steps, and explains the complete system.

### Files Used

- `README.md`
- `start.md`
- `workflow.md`
- `AI_AGENT_PROJECT_GUIDE.md`
- Browser frontend
- Backend health endpoint

### Work Done

- Verified frontend and backend run together.
- Checked MongoDB connection.
- Tested signup and login.
- Tested image and PDF upload.
- Verified scan history loads correctly.
- Checked rate-limit fallback behavior.
- Prepared project explanation for presentation.

### What To Say If Professor Asks

I handled integration and testing. I made sure the frontend, backend, database, and Gemini API work together. I tested the main user journey: signup, login, upload file, wait for analysis, view report, check history, and delete reports. I also documented how to start and explain the project.

### Demo Flow To Explain

1. Start MongoDB.
2. Start backend.
3. Start frontend.
4. Create or log into account.
5. Upload image or PDF.
6. Backend analyzes file.
7. Frontend shows final report.
8. Scan result appears in history.

## How Team Members Should Answer Together

If the professor asks about the whole project:

VeritaScan is a forensic AI detection tool. The frontend is built with React, the backend is built with Express, and data is stored in MongoDB. Users log in, upload images or PDFs, and the backend analyzes the file using local forensic checks and Gemini AI. The final report includes verdict, confidence, explanation, indicators, and metadata.

If the professor asks who did what:

- Frontend Developer: UI, dashboard, uploader, report.
- Backend API Developer: Express routes, upload handling, protected APIs.
- Database/Auth Developer: MongoDB schemas, bcrypt, JWT, user-specific history.
- AI/Forensics Developer: image/PDF analysis, Gemini prompts, fallback models.
- Testing/Presentation Lead: integration testing, demo flow, documentation.
