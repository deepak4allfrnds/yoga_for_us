# syntax=docker/dockerfile:1
# 3-tier images are built with Compose from the repo root:
#   docker compose -f docker-compose.prod.yml build
#   docker compose -f docker-compose.dev.yml up --build
# Images: yoga-frontend (nginx), yoga-backend (api), yoga-database (postgres)

FROM node:20-alpine
WORKDIR /app
CMD ["echo", "Use docker compose build from the repo root for frontend, backend, and database images."]
