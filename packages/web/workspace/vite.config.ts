import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { macaronVitePlugin } from "@macaron-css/vite";
import inspect from "vite-plugin-inspect";
import path from "path";

export default defineConfig({
  plugins: [inspect(), macaronVitePlugin(), solidPlugin() as any],
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  optimizeDeps: {
    exclude: ["@modular-forms/solid"],
    esbuildOptions: {
      target: "es2020",
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "@console/functions": path.resolve(__dirname, "../../functions/src"),
      "@console/core": path.resolve(__dirname, "../../core/src"),
      $: path.resolve(__dirname, "./src"),
    },
  },
});
