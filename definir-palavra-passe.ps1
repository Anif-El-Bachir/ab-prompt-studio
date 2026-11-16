# AB Prompt Studio — definir a palavra-passe de entrada (guardada só em .env.local).
# Escreve-a duas vezes; aparecem asteriscos em vez das letras.

$envFile = Join-Path $PSScriptRoot ".env.local"

function Set-EnvValue([string]$name, [string]$value) {
    $lines = @()
    if (Test-Path $envFile) { $lines = @(Get-Content $envFile -Encoding UTF8) }
    $found = $false
    $lines = @($lines | ForEach-Object { if ($_ -match "^\s*$name=") { $found = $true; "$name=$value" } else { $_ } })
    if (-not $found) { $lines += "$name=$value" }
    [System.IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-Plain([string]$prompt) {
    $sec = Read-Host -Prompt $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "=== Palavra-passe do AB Prompt Studio ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Regras: pelo menos 10 caracteres, sem aspas simples ( ' )."
Write-Host "Dica: usa uma frase facil de lembrar, por exemplo 4 palavras juntas."
Write-Host ""

while ($true) {
    $a = Read-Plain "Escreve a palavra-passe"
    if ($a.Length -lt 10) { Write-Host "Demasiado curta (minimo 10 caracteres)." -ForegroundColor Red; continue }
    if ($a.Contains("'")) { Write-Host "Nao uses aspas simples." -ForegroundColor Red; continue }
    $b = Read-Plain "Escreve outra vez para confirmar"
    if ($a -ne $b) { Write-Host "Nao coincidem. Tenta outra vez." -ForegroundColor Red; continue }
    Set-EnvValue "APP_PASSWORD" "'$a'"
    $a = $null; $b = $null
    break
}

Write-Host ""
Write-Host "Feito! Palavra-passe guardada." -ForegroundColor Green
Write-Host "Guarda-a num sitio seguro (ex.: gestor de palavras-passe). Podes fechar a janela e avisar o Claude."
Read-Host "Enter para fechar" | Out-Null
