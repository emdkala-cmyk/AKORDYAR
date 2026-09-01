@echo off
setlocal
cd /d "%~dp0"

REM Read the version straight from package.json so the installer name always
REM matches the shipped app version (release-version-contract).
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APP_VERSION=%%v"

echo.
echo ======================================
echo   Building Akordyar %APP_VERSION%
echo ======================================
echo.

call npx electron-builder --win nsis

echo.
echo Output: release\Akordyar Setup %APP_VERSION%.exe
echo.
endlocal
