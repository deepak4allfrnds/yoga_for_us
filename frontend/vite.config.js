import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/uploads": "http://localhost:8080",
      
    },
  },
  preview: {
    proxy: {
      '/api': {
        // `backend` is the compose service name; 8080 is its container port and
        // must match BACKEND_PORT in .env (the port the Go app listens on).
        target: 'http://backend:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
