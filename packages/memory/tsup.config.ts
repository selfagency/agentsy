import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
    cognitive: "src/cognitive/index.ts",
    mcp: "src/mcp/index.ts",
    hooks: "src/hooks/index.ts",
    config: "src/config.ts",
    init: "src/init.ts",
    cli: "src/cli/index.ts",
    "commands/init": "src/commands/init.ts",
    "commands/mcp": "src/commands/mcp.ts",
    "commands/daemon/start": "src/commands/daemon/start.ts",
    "commands/daemon/stop": "src/commands/daemon/stop.ts",
    "commands/daemon/status": "src/commands/daemon/status.ts",
  },
  format: ["esm", "cjs"],
  sourcemap: true,
  splitting: false,
  target: "es2022",
});
