import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const contentSecurityPolicy: Plugin = {
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:" />`,
    ),
};

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), contentSecurityPolicy],
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
