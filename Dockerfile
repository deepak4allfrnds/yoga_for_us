# syntax=docker/dockerfile:1
# 3-tier images are built with Compose from the repo root:
#   docker compose build
#   docker compose up -d
# Images: yoga-frontend (nginx), yoga-backend (api), yoga-database (postgres)

FROM node:20-alpine
WORKDIR /app
CMD ["echo", "Use docker compose build from the repo root for frontend, backend, and database images."]
