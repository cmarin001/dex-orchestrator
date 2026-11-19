import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "/dashboard/",
  plugins: [react()],
  resolve: { alias: { "@schemas": fileURLToPath(new URL("../schemas", import.meta.url)) } },
  server: { proxy: { "/api/dashboard": {
    target: "http://localhost:8787", rewrite: (path) => path.replace(/^\/api\/dashboard/, ""),
  } } },
});
