import { defineConfig } from "tsup";

export default defineConfig({
  dts: {
    resolve: true,
  },
  entry: ["src/index.ts"],
  external: ["node-fetch"],
  format: ["esm", "cjs"],
  target: "node20",
});
