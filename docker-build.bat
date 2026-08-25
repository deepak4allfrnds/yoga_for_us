@echo off
cd /d "%~dp0"
echo Building from %cd%
set DOCKER_BUILDKIT=1
docker build -t yoga-website:latest .
if errorlevel 1 exit /b 1
echo.
echo Image ready: yoga-website:latest
echo Tag and push:
echo   docker tag yoga-website:latest YOUR_DOCKERHUB_USER/yoga-website:latest
echo   docker push YOUR_DOCKERHUB_USER/yoga-website:latest
