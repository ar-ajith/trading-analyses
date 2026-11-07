@echo off
echo ========================================================
echo Starting AI Trading Chart Assistant Backend (FastAPI)...
echo ========================================================
cd /d "%~dp0"
if exist "..\venv\Scripts\python.exe" (
    "..\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
)
pause

