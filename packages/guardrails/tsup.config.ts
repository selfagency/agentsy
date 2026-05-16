import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
  },
  external: ["@agentsy/types"],
  format: ["esm"],
  treeshake: true,
});
