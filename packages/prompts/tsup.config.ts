import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: ["@agentsy/types"],
  format: ["esm"],
  sourcemap: true,
});
