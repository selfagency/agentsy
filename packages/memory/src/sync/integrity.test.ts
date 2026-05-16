import { describe, expect, it } from "vitest";

import {
  cloneSyncSnapshot,
  computeSyncChecksum,
  validateRemoteSnapshot,
  verifySyncChecksum,
} from "./integrity.js";

describe("sync integrity helpers", () => {
  it("validates a well-formed remote snapshot", () => {
    const snapshot = {
      cursor: "cursor-1",
      records: [
        {
          content: "value-1",
          id: "record-1",
          tier: "wiki",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    };

    expect(validateRemoteSnapshot(snapshot)).toStrictEqual({
      errors: [],
      valid: true,
    });
  });

  it("rejects malformed remote snapshots", () => {
    expect(
      validateRemoteSnapshot({
        cursor: 42,
        records: [{ content: 12, id: "", tier: "broken", updatedAt: "nope" }],
      })
    ).toStrictEqual({
      errors: expect.arrayContaining([
        expect.stringMatching(/cursor/u),
        expect.stringMatching(/id/u),
        expect.stringMatching(/tier/u),
        expect.stringMatching(/updatedAt/u),
        expect.stringMatching(/content/u),
      ]),
      valid: false,
    });
  });

  it("computes and verifies checksums", () => {
    const payload = {
      cursor: "cursor-1",
      records: [
        {
          content: "value-1",
          id: "record-1",
          tier: "wiki",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    };
    const checksum = computeSyncChecksum(payload);

    expect(verifySyncChecksum(payload, checksum)).toBeTruthy();
    expect(verifySyncChecksum(payload, "sha256:tampered")).toBeFalsy();
  });

  it("deep-clones nested metadata in snapshots", () => {
    const snapshot = {
      cursor: "cursor-1",
      records: [
        {
          content: "value-1",
          id: "record-1",
          metadata: { nested: { value: "original" } },
          tier: "wiki" as const,
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    };

    const clone = cloneSyncSnapshot(snapshot);
    const record = snapshot.records[0] as {
      metadata: { nested: { value: string } };
    };
    record.metadata.nested.value = "mutated";

    expect(clone.records[0]?.metadata).toMatchObject({
      nested: { value: "original" },
    });
  });
});
