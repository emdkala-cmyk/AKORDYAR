@echo off
setlocal
title Akordyar Web + Phone Sync
cd /d "%~dp0"

REM Keep this launcher in the same mode as Run-Akordyar.bat.
set "AKORDYAR_DESKTOP=1"

echo.
echo ======================================
echo     Starting Akordyar Web + Sync
echo ======================================
echo.

REM Allow phone connections to the LAN sync server.
netsh advfirewall firewall delete rule name="Akordyar Sync 3000" >nul 2>nul
netsh advfirewall firewall add rule name="Akordyar Sync 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>nul

echo [Server] Starting LAN server...
start "Akordyar LAN Server" /min cmd /c "cd /d ""%~dp0"" && set ""AKORDYAR_DESKTOP=1"" && node server.js"

REM Give HTTP and WebSocket time to bind before opening the single desktop page.
timeout /t 2 /nobreak >nul
start "" http://localhost:3000/Akordyar.html

echo.
echo Akordyar is running. Close the LAN Server window to stop it.
pause
endlocal
