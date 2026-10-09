# CareCopilot AI

**Your health. Your data. Your AI copilot.**

CareCopilot is a responsive health-information dashboard and consent-based emergency-assistance demo. It helps people organize health details and prepare questions for a clinician; it does not diagnose or replace medical care.

## Run locally

### 1. Start the FastAPI backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

The backend creates a local SQLite database and a private local upload folder on first start. Create an account from the sign-up page before entering the app. Uploaded documents are limited to 10 MB and stored in a per-account folder under `backend/uploads/`; do not use real patient documents in this prototype.

### 2. Start the Next.js frontend

In a second PowerShell terminal, from the project root:

```powershell
npm.cmd install
Copy-Item .env.local.example .env.local
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend calls the backend at `http://localhost:8000`; set `NEXT_PUBLIC_API_URL` in `.env.local` to change it.

### Demo on an Android phone over Wi-Fi

1. Connect the phone and PC to the same Wi-Fi network.
2. Find the PC's current Wi-Fi IPv4 address with `ipconfig`.
3. In `.env.local`, set `NEXT_PUBLIC_API_URL=http://<PC-WIFI-IP>:8000`.
4. Start the backend so it listens on the network and allows the phone's frontend origin:

   ```powershell
   cd backend
   $env:CORS_ORIGINS = "http://<PC-WIFI-IP>:3000"
   .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

5. From the project root, start Next.js for network access:

   ```powershell
   npm.cmd run dev -- --hostname 0.0.0.0
   ```

6. On Android Chrome, open `http://<PC-WIFI-IP>:3000`.

If Windows Firewall blocks the connection, open an Administrator PowerShell in the project folder and run `.\windows-demo-firewall.ps1`. It adds a rule only for TCP ports 3000 and 8000 from the local subnet on the Public profile; it does not disable the firewall. Remove it after the demo with `.\windows-demo-firewall.ps1 -Remove`.

**GPS note:** Android browsers generally require a secure (HTTPS) origin for Geolocation. The plain local Wi-Fi URL is fine for the signup and dashboard demo, but may not allow GPS. Use an HTTPS deployment/tunnel to demonstrate consent-based location sharing; do not share medical data with a public tunnel.

## Optional AI provider

Set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` in the backend environment. The API uses an OpenAI-compatible Chat Completions endpoint, and keeps the key on the server. The configured model must support image input to scan JPG/PNG medical reports; the backend sends the image to that provider for text extraction and then requests a plain-language summary. Chat replies show whether they came from the configured AI, demo mode, or the deterministic emergency-safety layer. Without a key, Copilot returns an explicit demo response and image OCR is disabled. Potential emergencies are checked before any model call.

Report text extraction supports PDFs with selectable text when `pypdf` is installed. Scanned/image-only PDFs are not OCR'd; upload a JPG or PNG scan when image text extraction is needed. Medical report text and uploaded report images are sent to the configured AI provider for explanation/scanning, so configure a provider you trust and use synthetic data for demos.

## Deploy an HTTPS demo (Vercel + Render + Supabase)

The repository includes a Render Blueprint in `render.yaml`. For persistent hosted storage:

1. Create a fresh Supabase project. In its SQL Editor, run [`schema.sql`](./supabase/schema.sql). The API owns account signup, password hashing, sessions, and user-data authorization. It connects to Supabase PostgreSQL only from the backend. Row-level security is enabled; the server-side service-role key must never be placed in the browser.
2. Create a Render web service from this repository and select its Blueprint. Set `SUPABASE_DB_URL` to the Supabase PostgreSQL connection URI (use the Supabase pooler URI if required by the host/network), `SUPABASE_URL` to the project URL, `SUPABASE_SERVICE_ROLE_KEY` to its server-only service-role key, and `CORS_ORIGINS` to the exact Vercel origin, e.g. `https://your-project.vercel.app` (no trailing slash). Keep all secrets in Render environment variables.
3. Deploy the frontend on Vercel from this repository and set `NEXT_PUBLIC_API_URL` to the Render service URL, e.g. `https://carecopilot-api.onrender.com` (no trailing slash). Redeploy after setting this variable.
4. Open the Vercel HTTPS URL on Android. HTTPS allows the browser to request location permission after the user activates SOS.

Render's free service may sleep when idle, so the first request can take a short while to wake. The private reports bucket uses the server-side service-role key for uploads and must never be made public. SQLite/local-file mode remains for local development; hosted deployment should have Supabase settings configured before accepting accounts or reports.

Local signup and login create accounts, hash passwords, and scope health data to the signed-in account. Sessions expire after 30 days and are stored in browser local storage; email verification and password reset are not implemented. This hackathon prototype is not a production patient-record system or HIPAA-compliant service.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend readiness |
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Start a signed-in session |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/dashboard` | Dashboard data |
| `GET`, `POST` | `/api/health/profile` | Read or update profile |
| `GET`, `POST` | `/api/health/records` | List or add measurements |
| `GET`, `POST` | `/api/health/symptoms` | List or add symptoms |
| `GET`, `POST` | `/api/health/medications` | List or add medications |
| `POST` | `/api/copilot/chat` | Context-aware chat and emergency screening |
| `POST` | `/api/reports/upload` | Upload and summarize a report |
| `POST` | `/api/emergency/activate` | Save a user-confirmed location event |
| `GET` | `/api/doctor-summary` | Gather data for a doctor summary |

FastAPI interactive API documentation is available at `http://localhost:8000/docs`.
All health-data routes require the bearer token returned by signup or login.

## Safety and demo boundaries

- Potential-emergency language prompts the user to seek urgent help; it is not a diagnosis.
- GPS is requested only after the user selects **Activate Emergency Assistance**.
- Location is never shared automatically; the emergency event is saved only after the user grants location permission and confirms activation.
- The prototype does not send emergency alerts, notify contacts, or dispatch emergency services.
- Call controls require the user to enter their local emergency number before opening the phone handler.
- The browser "Save as PDF" control uses the print dialog; choose **Save as PDF** in that dialog.
- This app is a hackathon demo, not a medical device or a production patient-record system.

## Deployment notes

The Vercel and Render services must be deployed from your own accounts. Do not commit production secrets or real patient data. Set `LLM_API_KEY` only as a Render secret for live AI responses; without it, the copilot uses its explicit demo response.
