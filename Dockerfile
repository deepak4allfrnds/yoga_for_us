# syntax=docker/dockerfile:1
# Build from the project ROOT (the folder that contains client/ and server/), not from client/:
#   docker build -t yoga-website:latest .
#   or double-click docker-build.bat

FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS app
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=frontend  /app/client/dist ./client/dist
WORKDIR /app/server
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000
CMD ["node", "docker-start.js"]
