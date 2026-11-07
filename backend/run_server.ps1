Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting AI Trading Chart Assistant Backend (FastAPI)..." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir "..\venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    & $VenvPython -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
} else {
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
}

