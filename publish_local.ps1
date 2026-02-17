# publish_local.ps1
# Automates the release process:
# 1. Bumps version (package.json + git tag)
# 2. Builds & Publishes Windows version locally (with blockmaps)
# 3. Builds & Publishes Linux version locally
# 4. Pushes tags to GitHub to trigger macOS build (GitHub Actions)

param (
    [string]$VersionType = "patch", # patch, minor, major, or specific version like 1.2.3
    [string]$Token # Optional: Pass GH_TOKEN as argument
)

# 0. Check for GH_TOKEN
if (-not $Token) {
    if (-not $env:GH_TOKEN) {
        Write-Error "GH_TOKEN is not set. Please set `$env:GH_TOKEN` or pass it as an argument."
        Write-Host "Usage: `$env:GH_TOKEN='your_token'; .\publish_local.ps1"
        exit 1
    }
}
else {
    $env:GH_TOKEN = $Token
}

Write-Host "=== Starting Local Release Process ===" -ForegroundColor Cyan

# 1. Bump Version
Write-Host "`n[1/4] Bumping version ($VersionType)..." -ForegroundColor Yellow
try {
    npm version $VersionType
    if ($LASTEXITCODE -ne 0) { throw "npm version failed" }
}
catch {
    Write-Error "Failed to bump version. Ensure git working directory is clean."
    exit 1
}

# 2. Build Windows
Write-Host "`n[2/4] Building & Publishing Windows..." -ForegroundColor Yellow
# -p always ensures publish even if draft release doesn't exist yet (it will create one)
cmd /c "npm run dist -- -p always"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Windows build failed."
    exit 1
}

# 3. Build Linux
Write-Host "`n[3/4] Building & Publishing Linux..." -ForegroundColor Yellow
# Note: This might fail on Windows if target includes formats requiring Linux tools (rpm/deb without tools)
cmd /c "npm run dist:linux -- -p always"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Linux build had issues. Check logs. Continuing to push tags..."
}

# 4. Push to GitHub
Write-Host "`n[4/4] Pushing changes and tags to GitHub..." -ForegroundColor Yellow
git push --follow-tags
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push to GitHub."
    exit 1
}

Write-Host "`n=== SUCCESS! ===" -ForegroundColor Green
Write-Host "1. Windows/Linux artifacts uploaded."
Write-Host "2. Tag pushed."
Write-Host "3. GitHub Action should now start building macOS version."
Write-Host "Check status here: https://github.com/KaucBartosz/BBTP-Launcher/actions" 
