# Aura Fahsai Local Stack Bootstrapper
# This script opens 2 separate terminal windows for the Python Engine and the React UI.

Write-Host "Initializing Aura: Fahsai Stack..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

# 1. Start Python Local Node (Fahsai Engine)
Write-Host "Starting Aura Fahsai Backend Engine..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pip install fastapi uvicorn; python fahsai_engine.py"

# 2. Settle period for the engine
Write-Host "Waiting for engine to start (3s)..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 3. Start UI Dashboard
Write-Host "Starting Web UI Dashboard..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd aura-wallet-ledger\web; npm run dev"

Write-Host "All systems initiated." -ForegroundColor Green
Write-Host "Check the new terminal windows for live logs." -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

