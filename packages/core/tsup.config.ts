import { defineConfig } from "tsup";

const isWatch = process.argv.includes("--watch");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  // Skip DTS in watch mode to avoid race condition with workspace dependencies
  dts: !isWatch,
  clean: true,
  outDir: "dist",
  external: ["@heydata/shared"],
});
