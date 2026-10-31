import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // tsconfig has `jsx: "preserve"` for Next; Vitest 4 transforms with Vite's
  // oxc, which needs the runtime spelled out to compile JSX in imported .tsx.
  oxc: { jsx: { runtime: "automatic" } },
});
