# Build from the REPO ROOT (folder that contains frontend/, backend/, database/):
#   docker compose build backend
#   docker build -f backend/Dockerfile -t yoga-backend:latest .

FROM node:20-alpine
WORKDIR /workspace
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
COPY database/schema.sql ./database/schema.sql
WORKDIR /workspace/backend
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000
CMD ["node", "docker-start.js"]
