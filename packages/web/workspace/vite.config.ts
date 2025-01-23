import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { macaronVitePlugin } from "@macaron-css/vite";
import inspect from "vite-plugin-inspect";
import path from "path";

export default defineConfig({
  plugins: [inspect(), macaronVitePlugin(), solidPlugin()],
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  optimizeDeps: {
    // exclude: ["@modular-forms/solid"],
    esbuildOptions: {
      target: "es2020",
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "@console/web": path.resolve(__dirname, "./src"),
    },
  },
});
