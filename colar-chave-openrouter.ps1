# AB Prompt Studio — guardar a chave do OpenRouter que está na área de transferência.
# Não é preciso colar: basta ter copiado a chave (sk-or-...) e carregar Enter.

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
Write-Host "=== Guardar a chave do OpenRouter ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "A chave ja esta copiada. Nao precisas de colar nada."

while ($true) {
    Read-Host "Carrega Enter" | Out-Null
    $k = ""
    try { $k = (Get-Clipboard -Raw) } catch {}
    if ($k) { $k = $k.Trim() }
    if ($k -match '^sk-or-[0-9A-Za-z_\-]{20,}$') {
        Set-EnvValue "OPENROUTER_API_KEY" $k
        Set-EnvValue "OPENROUTER_MODEL" "openrouter/free"
        $k = $null
        try { Set-Clipboard -Value " " } catch {}
        Write-Host ""
        Write-Host "Feito! Chave do OpenRouter guardada." -ForegroundColor Green
        Write-Host "Podes fechar esta janela e avisar o Claude."
        Read-Host "Enter para fechar" | Out-Null
        break
    }
    $k = $null
    Write-Host "O que esta copiado nao e uma chave do OpenRouter (comeca por sk-or-). Copia-a outra vez e carrega Enter." -ForegroundColor Red
}
