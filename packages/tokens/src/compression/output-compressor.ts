import type { CompressionLevel } from "@agentsy/core/context";
import {
  compressProse,
  protectPattern,
  restoreProtectedSegments,
} from "@agentsy/core/context";

export interface OutputPreserveOptions {
  codeFences: boolean;
  inlineCode: boolean;
  urls: boolean;
}

export interface OutputCompressionOptions {
  level?: CompressionLevel;
  preserve?: Partial<OutputPreserveOptions>;
}

const DEFAULT_PRESERVE: OutputPreserveOptions = {
  codeFences: true,
  inlineCode: true,
  urls: true,
};

const PLACEHOLDER_PREFIX = "__AGENTSY_PRESERVE_";

function mergePreserveOptions(
  options?: Partial<OutputPreserveOptions>
): OutputPreserveOptions {
  return {
    ...DEFAULT_PRESERVE,
    ...options,
  };
}

export function compressOutput(
  input: string,
  options: OutputCompressionOptions = {}
): string {
  const level = options.level ?? "full";
  const preserve = mergePreserveOptions(options.preserve);

  let working = input;

  if (!preserve.inlineCode) {
    working = working.replaceAll(/`([^`\n]+)`/g, "$1");
  }

  if (!preserve.urls) {
    working = working.replaceAll(/https?:\/\/\S+/gi, "link");
  }

  const placeholderMap = new Map<string, string>();
  const nextId = { value: 0 };

  if (preserve.codeFences) {
    working = protectPattern(
      working,
      /```[\s\S]*?```/g,
      placeholderMap,
      nextId,
      PLACEHOLDER_PREFIX
    );
  }

  if (preserve.inlineCode) {
    working = protectPattern(
      working,
      /`[^`\n]+`/g,
      placeholderMap,
      nextId,
      PLACEHOLDER_PREFIX
    );
  }

  if (preserve.urls) {
    working = protectPattern(
      working,
      /https?:\/\/\S+/gi,
      placeholderMap,
      nextId,
      PLACEHOLDER_PREFIX
    );
  }

  const compressed = compressProse(working, level);
  return restoreProtectedSegments(compressed, placeholderMap);
}
