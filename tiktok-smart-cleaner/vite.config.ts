/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CSP estricta solo en producción: sin conexiones salientes (connect-src 'none').
const csp = {
  name: "inject-csp",
  apply: "build" as const,
  transformIndexHtml: () => [{
    tag: "meta",
    attrs: {
      "http-equiv": "Content-Security-Policy",
      content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'",
    },
    injectTo: "head-prepend" as const,
  }],
};

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), csp],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
