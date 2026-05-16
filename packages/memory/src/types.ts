import { createHash } from "node:crypto";

export interface ContextFingerprint {
  value: string;
  modelFamily: string;
  templateVersion: string;
  schemaVersion: number;
}

export interface CreateContextFingerprintInput {
  content: string;
  modelFamily: string;
  templateVersion: string;
  schemaVersion: number;
}

export interface MemoryReuseHint {
  reuseClass: "hot" | "warm" | "cold";
  stablePrefix: boolean;
  toolSchema: boolean;
  invalidationKeys: string[];
}

export interface CreateMemoryReuseHintInput {
  reuseClass: "hot" | "warm" | "cold";
  stablePrefix: boolean;
  toolSchema: boolean;
  invalidationKeys: string[];
}

export function createContextFingerprint(
  input: CreateContextFingerprintInput
): ContextFingerprint {
  const source = [
    input.modelFamily,
    input.templateVersion,
    String(input.schemaVersion),
    input.content,
  ].join("|");
  const value = `sha256:${createHash("sha256").update(source).digest("hex")}`;

  return {
    modelFamily: input.modelFamily,
    schemaVersion: input.schemaVersion,
    templateVersion: input.templateVersion,
    value,
  };
}

export function createMemoryReuseHint(
  input: CreateMemoryReuseHintInput
): MemoryReuseHint {
  return {
    invalidationKeys: [...input.invalidationKeys],
    reuseClass: input.reuseClass,
    stablePrefix: input.stablePrefix,
    toolSchema: input.toolSchema,
  };
}
