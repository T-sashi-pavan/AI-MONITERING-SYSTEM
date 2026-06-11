@echo off
echo Launching Algonox Secretary Backend and Frontend...
start "Algonox Backend" cmd /k "%~dp0run_backend.bat"
start "Algonox Frontend" cmd /k "%~dp0run_frontend.bat"
echo Both servers initiated.
