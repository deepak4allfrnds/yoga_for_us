@echo off
cd /d "%~dp0"
echo Building production images
set DOCKER_BUILDKIT=1
docker compose -f docker-compose.prod.yml build
if errorlevel 1 exit /b 1
echo Production images ready.
