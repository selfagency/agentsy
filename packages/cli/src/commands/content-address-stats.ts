import { createDedupStore, migrateContentToDedupStore } from "@agentsy/memory";

import type { CliIO } from "../index.js";

const defaultIo = {
  stderr: (msg: string) => console.error(msg),
  stdout: (msg: string) => console.log(msg),
};

export function runContentAddressStatsCommand(
  argv: readonly string[],
  io: CliIO = defaultIo
): number {
  const sampleArg = argv.find((a) => a.startsWith("--sample="));
  const sampleContents =
    sampleArg === undefined
      ? [
          "Hello, world!",
          "Hello, world!",
          "Unique content A",
          "Unique content B",
          "Unique content A",
        ]
      : sampleArg.replace("--sample=", "").split(",").filter(Boolean);

  const asJson = argv.includes("--json");
  const stdout = io.stdout ?? defaultIo.stdout;

  const store = createDedupStore();
  const stats = migrateContentToDedupStore(sampleContents, store);

  if (asJson) {
    stdout(
      JSON.stringify(
        {
          deduped: stats.deduped,
          deduplicationRatio:
            stats.total > 0
              ? (stats.deduped / stats.total).toFixed(3)
              : "0.000",
          entries: store
            .entries()
            .map(
              (e: {
                fingerprint: { value: string; size: number };
                refCount: number;
              }) => ({
                refCount: e.refCount,
                size: e.fingerprint.size,
                value: e.fingerprint.value,
              })
            ),
          total: stats.total,
          unique: stats.unique,
        },
        null,
        2
      )
    );
    return 0;
  }

  stdout("Content-Addressing Statistics");
  stdout("-----------------------------");
  stdout(`Total items ingested:  ${stats.total}`);
  stdout(`Deduplicated:          ${stats.deduped}`);
  stdout(`Unique content blobs:  ${stats.unique}`);
  const ratio =
    stats.total > 0 ? ((stats.deduped / stats.total) * 100).toFixed(1) : "0.0";
  stdout(`Dedup ratio:           ${ratio}%`);
  stdout("");
  stdout("Fingerprints:");
  for (const entry of store.entries()) {
    stdout(
      `  ${entry.fingerprint.value} (${entry.fingerprint.size} bytes, refs=${entry.refCount})`
    );
  }
  return 0;
}
