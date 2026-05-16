import { defineConfig } from "tsup";

export default defineConfig({
  dts: {
    resolve: true,
    tsconfig: {
      compilerOptions: {
        declaration: true,
        moduleResolution: "bundler",
      },
    },
  },
  entry: ["src/index.ts"],
  external: ["node-fetch"],
  format: ["esm", "cjs"],
  target: "node20",
});
