@echo off
echo Starting Algonox Secretary Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo 'node_modules' not found! Installing npm dependencies first...
    npm install
) else (
    echo 'node_modules' found. Starting frontend directly...
)
npm run dev
pause
