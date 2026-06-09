import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In local dev, proxy /api to your serverless function via vercel dev
      "/api": "http://localhost:3000",
    },
  },
});
