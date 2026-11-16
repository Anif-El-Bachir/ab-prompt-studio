# AB Prompt Studio — arrancar a aplicação para usar no computador e no iPhone (mesmo Wi-Fi).
# Deixa esta janela aberta enquanto usares a aplicação. Para parar: fecha a janela.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$port = 3100

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware' } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== AB Prompt Studio ===" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path ".next\BUILD_ID")) {
    Write-Host "A preparar a aplicacao (so na primeira vez, cerca de 1 minuto)..."
    npm run build | Out-Null
}

Write-Host "No computador abre:   http://localhost:$port" -ForegroundColor Green
if ($ip) {
    Write-Host ""
    Write-Host "No iPhone (ligado ao MESMO Wi-Fi), abre no Safari:" -ForegroundColor Green
    Write-Host ""
    Write-Host "      http://${ip}:$port" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Nao encontrei o endereco da rede Wi-Fi. Confirma que o computador esta ligado ao Wi-Fi." -ForegroundColor Red
}
Write-Host "Deixa esta janela aberta. Para desligar a aplicacao, fecha-a."
Write-Host ""

Start-Process "http://localhost:$port"
npx next start -p $port
