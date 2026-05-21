import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY || ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;

            if (id.includes("react-dom") || id.includes("react")) {
              return "vendor-react";
            }

            if (
              id.includes("react-syntax-highlighter") ||
              id.includes("refractor") ||
              id.includes("lowlight")
            ) {
              return "vendor-code";
            }

            if (
              id.includes("lucide-react") ||
              id.includes("motion") ||
              id.includes("framer-motion")
            ) {
              return "vendor-ui";
            }

            if (id.includes("jszip") || id.includes("file-saver")) {
              return "vendor-export";
            }

            return "vendor-misc";
          },
        },
      },
    },
  };
});
