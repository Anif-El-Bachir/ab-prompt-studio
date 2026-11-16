# AB Prompt Studio — publicar na internet (Vercel), protegido por palavra-passe.
# Corre SÓ depois de definires a palavra-passe (definir-palavra-passe.ps1).
#
# O que faz:
#  1. Confirma que há palavra-passe no .env.local (sem ela não publica).
#  2. Abre o login do Vercel (fazes tu no browser) e liga a pasta a um projeto Vercel.
#  3. Copia para o Vercel, como variáveis de ambiente SECRETAS do servidor, apenas:
#     APP_PASSWORD, GEMINI_API_KEY, GEMINI_MODEL, OPENROUTER_API_KEY, OPENROUTER_MODEL.
#     (O ficheiro .env.local em si nunca é enviado — ver .vercelignore.)
#  4. Publica e mostra o endereço.

# Não usar "Stop": no Windows PowerShell 5.1, as mensagens de progresso que o Vercel escreve
# no canal de erros seriam tratadas como erro fatal. O sucesso é verificado com $LASTEXITCODE.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$envFile = Join-Path $PSScriptRoot ".env.local"

function Get-EnvValue([string]$name) {
    if (-not (Test-Path $envFile)) { return $null }
    $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match "^\s*$name=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $v = ($line -split '=', 2)[1].Trim()
    if ($v.Length -ge 2 -and (($v.StartsWith("'") -and $v.EndsWith("'")) -or ($v.StartsWith('"') -and $v.EndsWith('"')))) { $v = $v.Substring(1, $v.Length - 2) }
    return $v
}

Write-Host ""
Write-Host "=== Publicar o AB Prompt Studio no Vercel ===" -ForegroundColor Yellow
Write-Host ""

if (-not (Get-EnvValue "APP_PASSWORD")) {
    Write-Host "Ainda nao definiste a palavra-passe. Corre primeiro definir-palavra-passe.ps1." -ForegroundColor Red
    Read-Host "Enter para fechar" | Out-Null
    exit 1
}

# Localiza a Vercel CLI: instalacao global (node vc.js) ou, em alternativa, npx.
$vcJs = $null
try { $g = (& npm.cmd root -g 2>$null | Select-Object -First 1); if ($g) { $c = Join-Path $g "vercel\dist\vc.js"; if (Test-Path $c) { $vcJs = $c } } } catch {}
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source

# Corre a Vercel CLI; o valor secreto (se houver) vai pela entrada do programa, sem BOM nem quebra de linha,
# para nunca passar pela linha de comandos.
function Invoke-Vercel([string[]]$VcArgs, [string]$Stdin = $null) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $q = $VcArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
    if ($vcJs -and $nodeExe) { $psi.FileName = $nodeExe; $psi.Arguments = ('"' + $vcJs + '" ' + ($q -join ' ')) }
    else { $psi.FileName = "cmd.exe"; $psi.Arguments = "/c npx.cmd --yes vercel " + ($q -join ' ') }
    $psi.WorkingDirectory = $PSScriptRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    # A Vercel CLI escreve em UTF-8 (simbolos como o visto); sem isto aparecem caracteres estranhos.
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $p = [System.Diagnostics.Process]::Start($psi)
    if ($Stdin) { $b = (New-Object System.Text.UTF8Encoding($false)).GetBytes($Stdin); $p.StandardInput.BaseStream.Write($b, 0, $b.Length); $p.StandardInput.BaseStream.Flush() }
    $p.StandardInput.Close()
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $err = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    return @{ code = $p.ExitCode; text = (($outTask.Result + "`n" + $err) -replace "\x1b\[[0-9;?]*[A-Za-z]", "") }
}

# Sessao do Vercel: verifica neste computador/janela (a sessao e guardada por utilizador do Windows).
$who = Invoke-Vercel @("whoami")
if ($who.code -ne 0) {
    Write-Host ""
    Write-Host "Passo 1/3 - Iniciar sessao no Vercel nesta janela." -ForegroundColor Cyan
    Write-Host "  Vai aparecer um endereco 'https://vercel.com/oauth/device?user_code=...'." -ForegroundColor Cyan
    Write-Host "  Faz Ctrl + clique nele (ou copia-o para o browser), entra na tua conta Vercel" -ForegroundColor Cyan
    Write-Host "  e carrega em 'Allow Access'. Depois volta a esta janela." -ForegroundColor Cyan
    Write-Host ""
    npx.cmd --yes vercel login
    $who = Invoke-Vercel @("whoami")
    if ($who.code -ne 0) {
        Write-Host "Nao foi possivel iniciar sessao no Vercel. Fecha esta janela e tenta outra vez." -ForegroundColor Red
        Read-Host "Enter para fechar" | Out-Null
        exit 1
    }
}
$conta = ($who.text -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch 'Vercel CLI' } | Select-Object -Last 1).Trim()
Write-Host "Sessao Vercel ativa: $conta" -ForegroundColor Green

# Ligacao da pasta ao projeto (o ficheiro .vercel\project.json ja existe; isto so corre se faltar).
if (-not (Test-Path (Join-Path $PSScriptRoot ".vercel\project.json"))) {
    Write-Host "Passo 2/3 - Ligar esta pasta ao projeto Vercel..." -ForegroundColor Cyan
    npx.cmd --yes vercel link --yes --project ab-prompt-studio
}
if ($vcJs) { Write-Host "Vercel CLI: $vcJs" } else { Write-Host "Vercel CLI global nao encontrada; a usar npx." -ForegroundColor Yellow }

Write-Host ""
Write-Host "A enviar as variaveis secretas para o Vercel (producao)..." -ForegroundColor Cyan
$log = Join-Path $PSScriptRoot "publicar-vercel.log"
"=== $(Get-Date -Format s) ===" | Out-File $log -Encoding utf8
$falhou = $false
foreach ($name in "APP_PASSWORD", "GEMINI_API_KEY", "GEMINI_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL") {
    $v = Get-EnvValue $name
    if (-not $v) { Write-Host "  $name : nao definido, ignorado"; continue }
    $r = Invoke-Vercel @("env", "add", $name, "--environment", "production", "--sensitive", "--force", "--yes") $v
    $msg = $r.text.Replace($v, "***")   # nunca mostrar nem guardar o valor
    $v = $null
    if ($r.code -eq 0) { Write-Host "  $name : enviado como segredo" -ForegroundColor Green }
    else {
        Write-Host "  $name : ERRO ao enviar (codigo $($r.code))" -ForegroundColor Red
        $linhas = ($msg -split "`n" | Where-Object { $_.Trim() }) | Select-Object -Last 6
        $linhas | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        "[$name] codigo $($r.code)`n$msg" | Out-File $log -Append -Encoding utf8
        $falhou = $true
    }
}
if ($falhou) {
    Write-Host ""
    Write-Host "Houve erros a enviar variaveis. Nao vou publicar." -ForegroundColor Red
    Write-Host "Os detalhes (sem valores secretos) ficaram em publicar-vercel.log. Avisa o Claude." -ForegroundColor Red
    Read-Host "Enter para fechar" | Out-Null
    exit 1
}

Write-Host ""
Write-Host "Passo 3/3 - Publicar (1 a 3 minutos)..." -ForegroundColor Cyan
$d = Invoke-Vercel @("deploy", "--prod", "--yes")
$d.text -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 8 | ForEach-Object { Write-Host "  $_" }
"[deploy] codigo $($d.code)`n$($d.text)" | Out-File $log -Append -Encoding utf8
if ($d.code -ne 0) {
    Write-Host "A publicacao falhou. Os detalhes ficaram em publicar-vercel.log. Avisa o Claude." -ForegroundColor Red
    Read-Host "Enter para fechar" | Out-Null
    exit 1
}

Write-Host ""
Write-Host "Feito! O AB Prompt Studio esta em:" -ForegroundColor Green
Write-Host ""
Write-Host "      https://ab-prompt-studio.vercel.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "Abre-o no iPhone ou no computador e entra com a tua palavra-passe." -ForegroundColor Green
Read-Host "Enter para fechar" | Out-Null
