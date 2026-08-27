@echo off
cd /d "%~dp0"
echo Building backend from %cd%
copy /Y ..\database\schema.sql schema.sql >nul
set DOCKER_BUILDKIT=1
docker build -t yoga-backend:latest .
if errorlevel 1 exit /b 1
echo Image ready: yoga-backend:latest
