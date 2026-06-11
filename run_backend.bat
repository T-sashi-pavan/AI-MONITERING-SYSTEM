@echo off
echo Starting Algonox Secretary Backend...
cd /d "%~dp0backend"
if not exist venv (
    echo Virtual environment 'venv' not found! Installing dependencies first...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    playwright install --with-deps chromium
) else (
    echo Virtual environment found. Starting backend directly...
    call venv\Scripts\activate
)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
