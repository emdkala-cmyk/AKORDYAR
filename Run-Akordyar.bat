@echo off
setlocal
title Akordyar Desktop

REM Go to the folder where this BAT file is located
cd /d "%~dp0"

echo.
echo ======================================
echo        Starting Akordyar Desktop
echo ======================================
echo.

REM Close a server already listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Closing previous process on port 3000...
    taskkill /F /PID %%a >nul 2>nul
)

REM Verify npm is available
where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: npm was not found.
    echo Please install Node.js or reopen the terminal after installation.
    pause
    exit /b 1
)

REM Run Electron application
call npm run electron

REM Keep window open only if application failed
if errorlevel 1 (
    echo.
    echo ======================================
    echo Application failed to start.
    echo ======================================
    pause
)

endlocal
