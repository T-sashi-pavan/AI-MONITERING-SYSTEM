# Algonox Secretary - AI Monitoring System

Algonox Secretary is a real-time monitoring dashboard and management application for various AI and cloud API services (including OpenAI, Groq, Twilio, Convex, Render, ElevenLabs, Gemini, and Anthropic).

## Key Features
- **API Key Telemetry**: Automatically syncs key status, remaining quota limits, and usage logs.
- **OAuth Interactive Scraper**: Pop-up browser session management using Playwright to bypass multi-factor authentication (MFA) step-by-step.
- **Keep-Warm Cron**: Diagnostic service pinging to prevent cloud deployments on Render from entering sleeping states.

---

## Getting Started

### 1. Database Configuration
Ensure a MongoDB database is active on your system or via MongoDB Atlas. Place connection details in `backend/.env` (which is excluded from Git version control via `.gitignore`).

### 2. How to Run (Automatic Launch)
On Windows, you can double-click **`run_all.bat`** in the root directory to automatically launch both the backend server and frontend client.

### 3. How to Run (Manual Start)

#### Backend Service
```bash
cd backend
python -m venv venv
venv\Scripts\activate

# Install dependencies and chromium binary
pip install -r requirements.txt
playwright install chromium

# Launch backend API server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend Client
```bash
cd frontend
# Install packages
npm install

# Run Vite dev server
npm run dev
```
Open your browser to `http://localhost:5173` to interact with the web dashboard.

---

## Interface Dashboard Showcase
![Secretary Showcase Dashboard](frontend/src/assets/hero.png)
