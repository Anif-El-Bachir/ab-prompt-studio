# AB Prompt Studio — configurar um fornecedor de IA (.env.local)
# A chave é lida da área de transferência (sem colar) e escrita apenas em .env.local (que está no .gitignore).
# Nada é mostrado no ecrã nem enviado para outro lado.

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot ".env.local"

function Set-EnvValue([string]$name, [string]$value) {
    $lines = @()
    if (Test-Path $envFile) { $lines = @(Get-Content $envFile -Encoding UTF8) }
    $found = $false
    # @() garante um array: sem ele, uma só linha vira texto e "+=" junta as variáveis na mesma linha.
    $lines = @($lines | ForEach-Object {
        if ($_ -match "^\s*$name=") { $found = $true; "$name=$value" } else { $_ }
    })
    if (-not $found) { $lines += "$name=$value" }
    [System.IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}

# Lê a chave da área de transferência (o utilizador clica em "copiar" no site e carrega Enter aqui).
# Não é preciso colar. Valida o formato e repete até estar certo. Limpa a área de transferência no fim.
function Read-KeyFromClipboard([string]$nome, [string]$pattern, [string]$exemplo) {
    while ($true) {
        Write-Host ""
        Write-Host "Copia a chave do $nome no site (botao de copiar) e depois carrega Enter aqui." -ForegroundColor Cyan
        Read-Host "Enter quando a chave estiver copiada" | Out-Null
        $k = ""
        try { $k = (Get-Clipboard -Raw) } catch {}
        if ($k) { $k = $k.Trim() }
        if ($k -and $k -match $pattern) {
            try { Set-Clipboard -Value " " } catch {}
            return $k
        }
        $k = $null
        Write-Host "O que esta copiado nao parece uma chave do $nome (normalmente comeca por $exemplo). Tenta outra vez." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== AB Prompt Studio — configurar IA ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1) Google Gemini   (tem plano gratuito — chave em https://aistudio.google.com/apikey)"
Write-Host "  2) OmniRoute local (usa a chave que já tens em .omniroute\chave-cliente.json)"
Write-Host "  3) Anthropic (Claude) — pago"
Write-Host "  4) OpenAI (ChatGPT) — pago, chave em https://platform.openai.com/api-keys"
Write-Host "  5) OpenRouter — tem modelos gratuitos, chave em https://openrouter.ai/keys"
Write-Host ""
$choice = Read-Host "Escolhe 1-5 e carrega Enter"

switch ($choice) {
    "1" {
        $k = Read-KeyFromClipboard "Gemini" '^(AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_.\-]{30,})$' "AIza ou AQ."
        Set-EnvValue "GEMINI_API_KEY" $k
        Set-EnvValue "GEMINI_MODEL" "gemini-3.5-flash"
        $label = "Gemini"
    }
    "2" {
        $p = Join-Path $env:USERPROFILE ".omniroute\chave-cliente.json"
        if (-not (Test-Path $p)) { throw "Não encontrei $p" }
        $raw = [System.IO.File]::ReadAllText($p).Trim([char]0xFEFF, ' ', "`r", "`n")
        $m = [regex]::Match($raw, '"(?:key|apiKey|api_key|token|value)"\s*:\s*"([^"]+)"')
        $k = if ($m.Success) { $m.Groups[1].Value } else { $null }
        if (-not $k) { $k = Read-KeyFromClipboard "OmniRoute" '^\S{16,}$' "sk-" }
        $base = "http://127.0.0.1:20128/v1"
        Write-Host "A verificar o OmniRoute em $base ..."
        $model = $null
        try {
            $r = Invoke-RestMethod -Uri "$base/models" -Headers @{ Authorization = "Bearer $k" } -TimeoutSec 8
            $ids = @($r.data | ForEach-Object { $_.id })
            if ($ids.Count -gt 0) {
                for ($i = 0; $i -lt [Math]::Min($ids.Count, 20); $i++) { Write-Host ("  {0}) {1}" -f ($i + 1), $ids[$i]) }
                $n = Read-Host "Número do modelo a usar (Enter = 1)"
                if (-not $n) { $n = 1 }
                $model = $ids[[int]$n - 1]
            }
        } catch {
            Write-Host "O OmniRoute não respondeu. Arranca-o com:  omniroute serve" -ForegroundColor Red
        }
        if (-not $model) { $model = Read-Host "Nome do modelo (ex.: auto)" ; if (-not $model) { $model = "auto" } }
        Set-EnvValue "CUSTOM_AI_BASE_URL" $base
        Set-EnvValue "CUSTOM_AI_API_KEY" $k
        Set-EnvValue "CUSTOM_AI_MODEL" $model
        $label = "OmniRoute ($model)"
    }
    "3" { $k = Read-KeyFromClipboard "Anthropic" '^sk-ant-[0-9A-Za-z_\-]{20,}$' "sk-ant-"; Set-EnvValue "ANTHROPIC_API_KEY" $k; $label = "Anthropic" }
    "4" { $k = Read-KeyFromClipboard "OpenAI" '^sk-[0-9A-Za-z_\-]{20,}$' "sk-"; Set-EnvValue "OPENAI_API_KEY" $k; $label = "OpenAI" }
    "5" { $k = Read-KeyFromClipboard "OpenRouter" '^sk-or-[0-9A-Za-z_\-]{20,}$' "sk-or-"; Set-EnvValue "OPENROUTER_API_KEY" $k; Set-EnvValue "OPENROUTER_MODEL" "openrouter/free"; $label = "OpenRouter (modelos gratuitos)" }
    default { throw "Opção inválida." }
}

$k = $null
Write-Host ""
Write-Host "Feito: $label configurado em .env.local" -ForegroundColor Green
Write-Host "Podes fechar esta janela e avisar o Claude."
Read-Host "Enter para fechar" | Out-Null
