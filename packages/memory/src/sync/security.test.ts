import { describe, expect, it } from "vitest";

import {
  createSecureSyncErrorEnvelope,
  redactSyncSecrets,
  validateCredentialSource,
} from "./security.js";

describe("sync security helpers", () => {
  it("redacts secret-like values", () => {
    const text =
      "Bearer sk_live_secret-token and api_key=super-secret and TURSO_AUTH_TOKEN=abc123xyz";

    expect(redactSyncSecrets(text)).not.toContain("sk_live_secret-token");
    expect(redactSyncSecrets(text)).not.toContain("abc123xyz");
    expect(redactSyncSecrets(text)).toContain("[REDACTED]");
  });

  it("rejects unsafe credential sources", () => {
    expect(() => validateCredentialSource("environment")).not.toThrow();
    expect(() => validateCredentialSource("injected")).not.toThrow();
    expect(() => validateCredentialSource("source-code")).toThrow(
      /credential source/u
    );
  });

  it("creates redacted secure error envelopes", () => {
    const envelope = createSecureSyncErrorEnvelope(
      new Error("Bearer sk_live_secret-token exploded"),
      {
        diagnosticContext: "api_key=super-secret",
        retryable: true,
      }
    );

    expect(envelope.retryable).toBeTruthy();
    expect(envelope.message).toContain("[REDACTED]");
    expect(envelope.message).not.toContain("sk_live_secret-token");
    expect(envelope.diagnosticContext).toContain("[REDACTED]");
  });
});
