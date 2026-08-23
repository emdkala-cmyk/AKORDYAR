@echo off
chcp 65001 > nul
title Akordyar - Build Windows Installer
cd /d "%~dp0"

echo ============================================
echo   Akordyar - Build Windows Installer
echo ============================================
echo.

echo [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js found:
node --version
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APP_VERSION=%%v"
echo Akordyar version: %APP_VERSION%
echo.

echo [2/4] Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.

echo [3/4] Building Windows NSIS installer...
call npm run dist
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.

echo [4/4] Build completed successfully!
echo.
echo Installer location:
echo   release\Akordyar Setup %APP_VERSION%.exe
echo.
pause
