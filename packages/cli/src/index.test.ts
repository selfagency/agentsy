import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { name, runCli } from "./index.js";

describe("cli package scaffold", () => {
  it("exports the package name", () => {
    expect(name).toBe("cli");
  });

  it("runs compress command with inline --text input", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(
      [
        "compress",
        "--level",
        "full",
        "--text",
        "very very verbose verbose text",
      ],
      {
        stderr: () => {
          // no-op
        },
        stdout: (value) => {
          stdout.push(value);
        },
      }
    );

    expect(exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("Savings:");
  });

  it("runs compress command for file input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentsy-cli-compress-"));
    const filePath = join(dir, "response.md");
    await writeFile(
      filePath,
      "This is basically a simple response with fluff.",
      "utf-8"
    );

    const stdout: string[] = [];
    const stderr: string[] = [];

    const code = await runCli(
      ["compress", "--file", filePath, "--level", "full"],
      {
        stderr: (message: string) => {
          stderr.push(message);
        },
        stdout: (message: string) => {
          stdout.push(message);
        },
      }
    );

    expect(code).toBe(0);
    expect(stderr).toStrictEqual([]);
    expect(stdout.join("\n")).toContain("Savings:");
  });

  it("runs memory file compression command and preserves original as backup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentsy-cli-compress-"));

    try {
      const filePath = join(dir, "CLAUDE.md");
      await writeFile(filePath, "line\n\nline\n", "utf-8");

      const exitCode = await runCli(["compress-memory", "--file", filePath], {
        stderr: () => {
          // no-op
        },
        stdout: () => {
          // no-op
        },
      });
      const backup = await readFile(`${filePath}.original.md`, "utf-8");

      expect(exitCode).toBe(0);
      expect(backup).toBe("line\n\nline\n");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("runs compress-memory command and writes compressed file with backup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentsy-cli-memory-"));
    const filePath = join(dir, "CLAUDE.md");
    await writeFile(
      filePath,
      "This is basically a memory file that is actually verbose.",
      "utf-8"
    );

    const stdout: string[] = [];

    const code = await runCli(["compress-memory", "--file", filePath], {
      stderr: () => {
        // no-op for test
      },
      stdout: (message: string) => {
        stdout.push(message);
      },
    });

    expect(code).toBe(0);

    const updated = await readFile(filePath, "utf-8");
    const backup = await readFile(`${filePath}.original.md`, "utf-8");

    expect(updated.length).toBeLessThanOrEqual(backup.length);
    expect(stdout.join("\n")).toContain("Savings:");
  });

  it("prints local memory sync dev wiring", async () => {
    const stdout: string[] = [];

    const code = await runCli(["memory-sync-dev"], {
      stderr: () => {
        // no-op
      },
      stdout: (message) => {
        stdout.push(message);
      },
    });

    expect(code).toBe(0);
    expect(stdout.join("\n")).toContain(
      "tursodb ./.agentsy/local-sync-server.db --sync-server 0.0.0.0:8080"
    );
    expect(stdout.join("\n")).toContain(
      "TURSO_DATABASE_URL=http://localhost:8080"
    );
    expect(stdout.join("\n")).toContain(
      "import { createTursoManager } from '@agentsy/memory';"
    );
  });

  it("prints local memory sync dev wiring as JSON", async () => {
    const stdout: string[] = [];

    const code = await runCli(
      [
        "memory-sync-dev",
        "--json",
        "--server-db",
        "./tmp/server.db",
        "--replica-db",
        "./tmp/replica.db",
        "--server-url",
        "http://localhost:9090",
        "--bind",
        "127.0.0.1:9090",
        "--sync-interval-ms",
        "1500",
      ],
      {
        stderr: () => {
          // no-op
        },
        stdout: (message) => {
          stdout.push(message);
        },
      }
    );

    expect(code).toBe(0);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      bindAddress: "127.0.0.1:9090",
      replicaDbPath: "./tmp/replica.db",
      serverDbPath: "./tmp/server.db",
      serverUrl: "http://localhost:9090",
      startCommand: "tursodb ./tmp/server.db --sync-server 127.0.0.1:9090",
      syncIntervalMs: 1500,
    });
  });

  it("returns non-zero for invalid memory sync interval values", async () => {
    const stderr: string[] = [];

    const code = await runCli(
      ["memory-sync-dev", "--sync-interval-ms", "nope"],
      {
        stderr: (message) => {
          stderr.push(message);
        },
        stdout: () => {
          // no-op
        },
      }
    );

    expect(code).toBe(1);
    expect(stderr.join(" ")).toContain("Invalid --sync-interval-ms value");
  });

  it("returns non-zero for unknown command", async () => {
    const stderr: string[] = [];
    const code = await runCli(["unknown-command"], {
      stderr: (message: string) => {
        stderr.push(message);
      },
      stdout: () => {
        // no-op
      },
    });

    expect(code).toBe(1);
    expect(stderr.join(" ")).toContain("Unknown command");
  });
});
