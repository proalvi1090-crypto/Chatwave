import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Development proxy target - can be overridden with VITE_DEV_PROXY_TARGET env var
// NOSONAR: S5332 - Development environment only, not for production use
const proxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300
    },
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/socket.io": {
        target: proxyTarget,
        ws: true,
        changeOrigin: true
      }
    },
    headers: {
      "Cache-Control": "no-store"
    }
  }
});
