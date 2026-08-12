# Create-Audit-Zip.ps1

$files = @(
    "Akordyar.html",
    "package.json",
    "preload.js",
    "electron-main.js",
    "js\app.js"
)

$folders = @(
    "js\app",
    "js\core",
    "js\editor",
    "js\archive",
    "js\tests",
    ".gapcode"
)

$staging = Join-Path $PSScriptRoot "_audit_upload"

Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($file in $files) {
    $source = Join-Path $PSScriptRoot $file

    if (Test-Path $source) {
        $destination = Join-Path $staging $file
        $destinationDirectory = Split-Path $destination -Parent

        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item $source $destination -Force
    }
}

foreach ($folder in $folders) {
    $source = Join-Path $PSScriptRoot $folder

    if (Test-Path $source) {
        $destination = Join-Path $staging $folder
        $destinationDirectory = Split-Path $destination -Parent

        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item $source $destination -Recurse -Force
    }
}

$output = Join-Path $PSScriptRoot "Akordyar-audit.zip"

Remove-Item $output -Force -ErrorAction SilentlyContinue

Compress-Archive `
    -Path (Join-Path $staging "*") `
    -DestinationPath $output `
    -Force

Remove-Item $staging -Recurse -Force

Write-Host "Created: $output"
