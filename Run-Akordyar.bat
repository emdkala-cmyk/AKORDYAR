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

REM Mark this launch as desktop mode so server.js does not open a browser.
set "AKORDYAR_DESKTOP=1"

REM Firewall: allow phone to connect to port 3000 (sync)
echo [Firewall] Opening port 3000 for phone connection...
netsh advfirewall firewall delete rule name="Akordyar Sync 3000" >nul 2>nul
netsh advfirewall firewall add rule name="Akordyar Sync 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>nul
echo [Firewall] Port 3000 is open.
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

REM Start the LAN server exactly like start.bat.
REM Electron will detect this server on port 3000 and use it only
REM for the desktop UI, while the Node process handles phone access.
echo [Server] Starting Node LAN server...
start "Akordyar LAN Server" /min cmd /c "cd /d ""%~dp0"" && node server.js"

REM Wait briefly for Node to bind to 0.0.0.0:3000.
timeout /t 2 /nobreak >nul

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
