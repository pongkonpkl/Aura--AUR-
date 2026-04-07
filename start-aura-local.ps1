# Aura Local Stack Bootstrapper
# This script opens 3 separate terminal windows for Chain, Bot, and UI.

Write-Host "Initializing Aura Local Stack..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

# 1. Start Hardhat Local Chain
Write-Host "Starting Local Chain..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd aura-l3-contracts; npx hardhat node"

# 2. Settle period for the chain
Write-Host "Waiting for chain to settle (5s)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 3. Start Guardian Distributor
Write-Host "Starting Guardian Distributor..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd aura-guardian-node; npm run distribute"

# 4. Start UI Dashboard
Write-Host "Starting UI Dashboard..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd aura-wallet-ledger/web; npm run dev"

Write-Host "All systems initiated." -ForegroundColor Green
Write-Host "Check the new terminal windows for live logs." -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
