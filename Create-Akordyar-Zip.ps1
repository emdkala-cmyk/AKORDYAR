# ==============================
# تنظیم مسیرها
# ==============================

# پوشه‌ای که باید ZIP شود
$SourcePath = "C:\Users\MEHDI\Desktop\Akordyar\Akordyar"

# پوشه‌ای که ZIP در آن ذخیره می‌شود
$DestinationPath = "C:\Users\MEHDI\Desktop\Update Akordyar"

# نام پایه فایل ZIP
$BaseName = "Akordyar"


# ==============================
# بررسی مسیرها
# ==============================

if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) {
    Write-Host "پوشه مبدأ پیدا نشد:" -ForegroundColor Red
    Write-Host $SourcePath
    Read-Host "برای خروج Enter را بزنید"
    exit
}

if (-not (Test-Path -LiteralPath $DestinationPath -PathType Container)) {
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
}


# ==============================
# انتخاب نام فایل خروجی
# ==============================

$FirstZip = Join-Path $DestinationPath "$BaseName.zip"

if (-not (Test-Path -LiteralPath $FirstZip)) {
    $ZipPath = $FirstZip
}
else {
    $Number = 1

    while ($true) {
        $NumberText = $Number.ToString("00")
        $Candidate = Join-Path $DestinationPath "$BaseName-$NumberText.zip"

        if (-not (Test-Path -LiteralPath $Candidate)) {
            $ZipPath = $Candidate
            break
        }

        $Number++
    }
}


# ==============================
# ساخت لیست فایل‌های غیر Hidden
# ==============================

$FilesToZip = Get-ChildItem `
    -LiteralPath $SourcePath `
    -Recurse `
    -File `
    -Force `
    -ErrorAction Stop |
    Where-Object {
        # حذف فایل‌های Hidden
        ($_.Attributes -band [System.IO.FileAttributes]::Hidden) -eq 0 -and

        # حذف فایل‌های System
        ($_.Attributes -band [System.IO.FileAttributes]::System) -eq 0
    }


# ==============================
# ساخت ZIP
# ==============================

if ($FilesToZip.Count -eq 0) {
    Write-Host "هیچ فایل قابل مشاهده‌ای برای ZIP کردن پیدا نشد." -ForegroundColor Yellow
    Read-Host "برای خروج Enter را بزنید"
    exit
}

$TempFolder = Join-Path $env:TEMP "Akordyar-Zip-Temp-$([Guid]::NewGuid())"

New-Item -ItemType Directory -Path $TempFolder -Force | Out-Null

try {
    foreach ($File in $FilesToZip) {
        $RelativePath = $File.FullName.Substring($SourcePath.Length).TrimStart("\")
        $TargetFile = Join-Path $TempFolder $RelativePath
        $TargetDirectory = Split-Path -Parent $TargetFile

        if (-not (Test-Path -LiteralPath $TargetDirectory)) {
            New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
        }

        Copy-Item `
            -LiteralPath $File.FullName `
            -Destination $TargetFile `
            -Force
    }

    Compress-Archive `
        -Path (Join-Path $TempFolder "*") `
        -DestinationPath $ZipPath `
        -CompressionLevel Optimal `
        -Force

    Write-Host ""
    Write-Host "ZIP با موفقیت ساخته شد:" -ForegroundColor Green
    Write-Host $ZipPath -ForegroundColor Cyan
}
finally {
    if (Test-Path -LiteralPath $TempFolder) {
        Remove-Item -LiteralPath $TempFolder -Recurse -Force
    }
}

Write-Host ""
Read-Host "برای بستن پنجره Enter را بزنید"
