# The-ENGINE local dev bootstrap
# Run from repo root: .\scripts\dev-setup.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> The-ENGINE dev setup" -ForegroundColor Cyan

# Node check
$nodeVer = node -v
Write-Host "Node: $nodeVer"

# Install dependencies
Write-Host "`n==> npm install --legacy-peer-deps" -ForegroundColor Yellow
npm install --legacy-peer-deps

# .env bootstrap
$envFile = Join-Path $Root ".env"
$example = Join-Path $Root ".env.example"
$canonical = Join-Path $env:USERPROFILE "OneDrive\Documents\env.txt"

if (-not (Test-Path $envFile)) {
    if (Test-Path $example) {
        Copy-Item $example $envFile
        Write-Host "Created .env from .env.example" -ForegroundColor Green
    } else {
        New-Item -ItemType File -Path $envFile | Out-Null
    }
}

function Set-EnvLine($key, $value) {
    $content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { $content = "" }
    if ($content -match "(?m)^$key=.*") {
        $content = $content -replace "(?m)^$key=.*", "$key=$value"
    } else {
        if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $content += "`n" }
        $content += "$key=$value`n"
    }
    Set-Content -Path $envFile -Value $content.TrimEnd() -NoNewline
    Add-Content -Path $envFile -Value ""
}

# Dev defaults (safe to overwrite for local)
Set-EnvLine "NODE_ENV" "development"
Set-EnvLine "PORT" "5000"

$localDb = "postgresql://grudge:grudge@localhost:5432/the_engine"
if (Test-Path $canonical) {
    $dbLine = Select-String -Path $canonical -Pattern "^DATABASE_URL=" | Select-Object -First 1
    if ($dbLine) {
        $val = $dbLine.Line -replace "^DATABASE_URL=", ""
        Set-EnvLine "DATABASE_URL" $val
        Write-Host "DATABASE_URL synced from canonical env.txt (Railway public proxy)" -ForegroundColor Green
    }
}

# Session secrets from existing .env or canonical
foreach ($key in @("SESSION_SECRET", "JWT_SECRET", "ADMIN_PASSCODE", "VITE_ADMIN_PASSCODE")) {
    $has = (Get-Content $envFile -ErrorAction SilentlyContinue) -match "^$key="
    if (-not $has -and (Test-Path $canonical)) {
        $line = Select-String -Path $canonical -Pattern "^$key=" | Select-Object -First 1
        if ($line) {
            $val = $line.Line -replace "^$key=", ""
            Set-EnvLine $key $val
        }
    }
}

# Local CORS
$cors = "http://localhost:5000,http://localhost:5173,http://127.0.0.1:5000,https://grudge-studio.com"
Set-EnvLine "CORS_ORIGINS" $cors
Set-EnvLine "AUTH_ALLOWED_ORIGINS" $cors
Set-EnvLine "VITE_PORTAL_ORIGIN" "http://localhost:5000"
Set-EnvLine "VITE_WS_URL" "http://localhost:5000"

Write-Host "`n==> Optional: local Postgres via Docker" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.dev.yml up -d"
Write-Host "  Then set DATABASE_URL=$localDb and run npm run db:push"

Write-Host "`n==> Start dev server" -ForegroundColor Yellow
Write-Host "  npm run dev"
Write-Host "  Open http://localhost:5000"
Write-Host "`nDev setup complete." -ForegroundColor Green