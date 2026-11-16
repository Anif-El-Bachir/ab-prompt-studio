# AB Prompt Studio — guardar a chave do Gemini que está na área de transferência (copiada no AI Studio).
# Não é preciso colar nada: o script lê o que copiaste, verifica e grava em .env.local.
# A chave nunca é mostrada no ecrã. No fim, a área de transferência é limpa.

$envFile = Join-Path $PSScriptRoot ".env.local"

function Set-EnvValue([string]$name, [string]$value) {
    $lines = @()
    if (Test-Path $envFile) { $lines = @(Get-Content $envFile -Encoding UTF8) }
    $found = $false
    $lines = @($lines | ForEach-Object { if ($_ -match "^\s*$name=") { $found = $true; "$name=$value" } else { $_ } })
    if (-not $found) { $lines += "$name=$value" }
    [System.IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host ""
Write-Host "=== Guardar a chave do Gemini ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Confirma que acabaste de clicar em COPIAR ao lado da chave no Google AI Studio."
Write-Host "2. Depois carrega Enter aqui."
Write-Host ""

while ($true) {
    Read-Host "Carrega Enter quando a chave estiver copiada" | Out-Null
    $k = ""
    try { $k = (Get-Clipboard -Raw) } catch {}
    if ($k) { $k = $k.Trim() }

    # Formatos aceites: antigo (AIza...) e novo (AQ....), sem espaços.
    if ($k -match '^(AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_.\-]{30,})$') {
        Set-EnvValue "GEMINI_API_KEY" $k
        Set-EnvValue "GEMINI_MODEL" "gemini-3.5-flash"
        $len = $k.Length
        $k = $null
        try { Set-Clipboard -Value " " } catch {}
        Write-Host ""
        Write-Host "Feito! Chave do Gemini guardada ($len caracteres)." -ForegroundColor Green
        Write-Host "A area de transferencia foi limpa por seguranca."
        Write-Host "Podes fechar esta janela e avisar o Claude."
        Read-Host "Enter para fechar" | Out-Null
        break
    } else {
        $k = $null
        Write-Host ""
        Write-Host "O que esta copiado nao parece uma chave do Gemini (deve comecar por AIza ou AQ.)." -ForegroundColor Red
        Write-Host "Volta ao AI Studio, clica no icone de copiar ao lado da chave e tenta outra vez."
        Write-Host ""
    }
}
