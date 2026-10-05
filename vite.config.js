import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local development: /api/ai is served by the Express backend
    // (npm run dev:backend). In production a Netlify Function serves it.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:5050",
        changeOrigin: true,
      },
    },
  },
  build: {
    // xlsx and pptxgenjs are large but only load on the pages that use them.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("node_modules/@supabase/")) return "supabase";
          return undefined;
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.mjs", "supabase/**/*.test.mjs"],
    environment: "node",
  },
});
