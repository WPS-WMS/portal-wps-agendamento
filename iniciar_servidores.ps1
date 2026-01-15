# Script para iniciar ambos os servidores
Write-Host "=== Iniciando Servidores Portal WPS ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se Python está instalado
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python encontrado: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Python nao encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Node.js nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Iniciando Backend na porta 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\portal_wps_backend'; python src/main.py"

Start-Sleep -Seconds 2

Write-Host "Iniciando Frontend na porta 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\portal_wps_frontend'; npm run dev"

Write-Host ""
Write-Host "=== Servidores iniciados ===" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione qualquer tecla para sair (os servidores continuarao rodando)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
