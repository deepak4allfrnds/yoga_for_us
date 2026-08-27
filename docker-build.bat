@echo off
cd /d "%~dp0"
echo Building 3-tier images from %cd%
set DOCKER_BUILDKIT=1
docker compose build
if errorlevel 1 exit /b 1
echo.
echo Images ready: yoga-frontend, yoga-backend, yoga-database
echo Tag and push (replace YOUR_DOCKERHUB_USER):
echo   docker tag yourdockerhubuser/yoga-frontend:latest YOUR_DOCKERHUB_USER/yoga-frontend:latest
echo   docker push YOUR_DOCKERHUB_USER/yoga-frontend:latest
echo   docker tag yourdockerhubuser/yoga-backend:latest YOUR_DOCKERHUB_USER/yoga-backend:latest
echo   docker push YOUR_DOCKERHUB_USER/yoga-backend:latest
echo   docker tag yourdockerhubuser/yoga-database:latest YOUR_DOCKERHUB_USER/yoga-database:latest
echo   docker push YOUR_DOCKERHUB_USER/yoga-database:latest
