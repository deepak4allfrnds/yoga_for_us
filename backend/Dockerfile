# Production backend: Express API on port 4000
#   cd backend
#   docker build -t yoga-backend:latest .
#   docker compose -f docker-compose.prod.yml build backend

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
ENV SCHEMA_PATH=/app/schema.sql
EXPOSE 4000
CMD ["node", "docker-start.js"]
