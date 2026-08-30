import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    // Routes /api to the backend proxy in development. The browser therefore
    // never learns the provider host and never holds a credential.
    proxy: {
      "/api": {
        target: process.env.SOCGENIE_API_URL ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
