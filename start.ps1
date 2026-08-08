# ============================================================
# Universal AI Memory Vault — one-click startup (Windows)
# ============================================================
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Universal AI Memory Vault — Launcher"      -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Node.js check ---------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- 2. Install dependencies --------------------------------
if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    Write-Host "[1/4] node_modules not found, running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "[1/4] Dependencies present." -ForegroundColor Green
}

# --- 3. Create .env.local from example ----------------------
if (-not (Test-Path -LiteralPath (Join-Path $Root ".env.local"))) {
    Write-Host "[2/4] .env.local missing, copying from .env.example..." -ForegroundColor Yellow
    Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination (Join-Path $Root ".env.local")
} else {
    Write-Host "[2/4] .env.local present." -ForegroundColor Green
}

# --- 4. Validate placeholder values -------------------------
Write-Host "[3/4] Checking environment..." -ForegroundColor Cyan
$envLocal = Get-Content -LiteralPath (Join-Path $Root ".env.local") -Raw
$hasRealConfig = $true
if ($envLocal -match "placeholder|dev-only-secret-change-me|change-me") {
    $hasRealConfig = $false
    Write-Host "  WARNING: .env.local still contains placeholder values:" -ForegroundColor Yellow
    Write-Host "  -> Sign-up/login and memory storage will NOT work until you"  -ForegroundColor Yellow
    Write-Host "     fill in real Supabase credentials in .env.local"          -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Required (get these from https://supabase.com project settings):" -ForegroundColor Yellow
    Write-Host "    NEXT_PUBLIC_SUPABASE_URL          https://xxxx.supabase.co"  -ForegroundColor Yellow
    Write-Host "    NEXT_PUBLIC_SUPABASE_ANON_KEY     your anon key"             -ForegroundColor Yellow
    Write-Host "    SUPABASE_SERVICE_ROLE_KEY         your service-role key"     -ForegroundColor Yellow
    Write-Host "    MCP_OAUTH_SECRET                  random 32+ char string"     -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "  .env.local looks configured." -ForegroundColor Green
}

# --- 5. Start dev server ------------------------------------
Write-Host "[4/4] Starting dev server at http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""
npm run dev
