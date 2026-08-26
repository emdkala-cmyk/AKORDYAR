@echo off
cd /d "%~dp0.."
node js\fix-grid.js
echo.
node --check js\app\core.js && echo SYNTAX OK
echo.
pause
