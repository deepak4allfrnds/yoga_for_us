# Build from the backend folder:
#   cd backend
#   docker build -t yoga-backend:latest .
# Or from repo root:
#   docker compose build backend

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "docker-start.js", "--", "host", "0.0.0.0", "--", "port", "8080"]
