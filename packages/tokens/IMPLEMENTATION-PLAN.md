---
goal: @agentsy/tokens production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: tokens-maintainers
status: In progress
tags: [feature, architecture, tokens, budget, compression]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/tokens` as the canonical budget, accounting, and compression authority.

## 1. Requirements & Constraints

- **REQ-TOKENS-001**: Token accounting supports model-aware estimation and usage reconciliation.
- **REQ-TOKENS-002**: Budget policies enforce hard/soft limits for input/output/context/turn/session.
- **REQ-TOKENS-003**: Compression/truncation preserves critical instruction content deterministically.
- **REQ-TOKENS-004**: Runtime/orchestrator integrations fail closed on hard-limit breaches.
- **REQ-TOKENS-005**: Cost telemetry emits stable metrics for observability and UI surfaces.
- **SEC-TOKENS-001**: Budget override pathways require explicit authorization.
- **SEC-TOKENS-002**: Token/cost diagnostics avoid leaking sensitive prompt data.
- **CON-TOKENS-001**: Budget logic is centralized in tokens package, not duplicated in consumers.
- **CON-TOKENS-002**: Provider tokenizer quirks are abstracted behind adapters.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-TOKENS-001: Contract stabilization.

| Task            | Description                                                     | Completed | Date |
| --------------- | --------------------------------------------------------------- | --------- | ---- |
| TASK-TOKENS-001 | Stabilize accounting/budget contract schema and error taxonomy. |           |      |
| TASK-TOKENS-002 | Add typed tests for hard/soft limit policy behavior.            |           |      |
| TASK-TOKENS-003 | Document package boundaries with runtime/orchestrator/core.     |           |      |

### Implementation Phase 2

- GOAL-TOKENS-002: Core accounting and compression implementation.

| Task            | Description                                                        | Completed | Date       |
| --------------- | ------------------------------------------------------------------ | --------- | ---------- |
| TASK-TOKENS-004 | Finalize estimators, reconciler, and budget policy engine modules. | ✅        | 2026-05-17 |
| TASK-TOKENS-005 | Implement compression/truncation strategies and validation hooks.  | ✅        | 2026-05-17 |
| TASK-TOKENS-006 | Implement telemetry payload generation and summary adapters.       | ✅        | 2026-05-17 |

### Implementation Phase 3

- GOAL-TOKENS-003: Integration and enforcement validation.

| Task            | Description                                                                          | Completed | Date |
| --------------- | ------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-TOKENS-007 | Integrate runtime/orchestrator enforcement middleware and fallback behavior.         |           |      |
| TASK-TOKENS-008 | Add integration tests for budget rejection/downscoping and policy override handling. |           |      |
| TASK-TOKENS-009 | Validate observability/CLI/UI metric wiring.                                         |           |      |

### Implementation Phase 4

- GOAL-TOKENS-004: Hardening and release gates.

| Task            | Description                                                             | Completed | Date |
| --------------- | ----------------------------------------------------------------------- | --------- | ---- |
| TASK-TOKENS-010 | Add perf/benchmark regressions for accounting and compression pathways. |           |      |
| TASK-TOKENS-011 | Update docs/examples and operator budget guidance.                      |           |      |
| TASK-TOKENS-012 | Pass package and monorepo release gates.                                |           |      |

## 3. Acceptance Criteria

- **ACC-TOKENS-001**: Budget enforcement and accounting behavior are deterministic and test-validated.
- **ACC-TOKENS-002**: Runtime/orchestrator integrations pass end-to-end tests.
- **ACC-TOKENS-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `plan/feature-memory-token-reduction-phase0-1.md`
- `docs/packages/tokens.md`
- `packages/tokens/README.md`
- `packages/tokens/TOON-INSIGHTS.md`
- `packages/tokens/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## Tokens Package Implementation Plan — REVISED

## Executive Summary

**Objective:** Build comprehensive token optimization package with compression, budget management, caching, and multi-stage liveness coordination.

**Business Rationale:** Immediate 60% cost reduction (75% output + 46% memory) through proven compression strategies, with foundation for lifetime savings via caching and intelligent token management.

**Core Tech Stack:**

- **Compression:** Caveman-style rules with validation (proven 75% output / 46% memory reduction)
- **Encoding:** TOON encoding for multi-byte content (40% JSON savings)
- **Budget:** Real-time tracking with model-specific pricing
- **Caching:** Token-level LRU/TTL caching
- **Coordination:** Multi-stage liveness honker integration
- **Security:** Hard refuse on sensitive paths

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        @agentsy/tokens                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐      ┌──────────────────────┐           │
│  │  Compression Engine  │─────▶│   Budget Manager     │           │
│  ├──────────────────────┤      ├──────────────────────┤           │
│  │ • Output Compressor  │      │ • Token Tracking     │           │
│  │ • Memory Compressor  │      │ • Cost Estimation    │           │
│  │ • JSON Minifier      │      │ • Model Routing      │           │
│  │ • TOON Encoder       │      │ • Budget Alerts      │           │
│  │ • Validation System  │      │ • Usage Analytics    │           │
│  └──────────────────────┘      └──────────────────────┘           │
│               │                         │                            │
│               │                         │                            │
│               ▼                         ▼                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Cache & Encoding Layer                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Token LRU Cache (10k tokens)                           │   │
│  │ • Content Address Cache (BLAKE3)                         │   │
│  │ • TOON Encoder for multi-byte                           │   │
│  │ • JSON/Structured Minifier                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Multi-Stage Liveness Coordination             │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • Compact Memory (concrete to abstract)                         │   │
│  │ • Priority Segments (current > recent > historical)       │   │
│  │ • Smart Truncation (preserve code/URLs/paths)             │   │
│  │ • Honker Coordination (1-5ms pub/sub)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase 1: Core Compression Engine (Days 1-6)

- **Target:** 75% output reduction, 46% memory reduction
- **Proof of concept:** Caveman-style compression with validation

### Day 1-2: Output Compressor

**Scope:** Caveman-style output compression with intensity levels

````typescript
// packages/tokens/src/compression/output-compressor.ts
export interface CompressionOptions {
  level: "lite" | "full" | "ultra"; // 40-50%, 65-75%, 75-87% savings
  preserve: PreservedElements;
  intensity?: number; // 0.0-1.0 for fine-tuning
  autoClarity?: boolean; // Drop for security warnings
}

export interface PreservedElements {
  codeBlocks: boolean; // ``` ... ``` exactly
  inlineCode: boolean; // `...` exactly
  urls: boolean; // https://... exactly
  filePaths: boolean; // /path/to/file exactly
  commands: boolean; // npm install exactly
  technicalTerms: boolean; // Library names, APIs, protocols
  properNouns: boolean; // Project names, people, companies
  constants: boolean; // $HOME, NODE_ENV
  headings: boolean; // Markdown # headings exactly
  structure: boolean; // Lists, tables preserved
}

export function compressOutput(response: string, options: CompressionOptions): CompressedResult {
  // 1. Parse and identify preserved regions
  // 2. Apply compression rules to natural language
  // 3. Preserved regions copied exactly
  // 4. Result validated before finalize
}
````

**Compression Rules (from caveman):**

**Remove:**

- Articles: a, an, the
- Filler: just, really, basically, actually, simply, essentially, generally
- Pleasantries: sure, certainly, of course, happy to, I'd recommend
- Hedging: it might be worth, you could consider, it would be good to
- Redundant phrasing: in order to → to, make sure to → ensure
- Connective fluff: however, furthermore, additionally, in addition

**Chunk-level transformations (caveman pattern):**

- `[thing] [action] [reason]. [next step].`
- Drop "you should", "make sure to", "remember to"
- Short synonyms: big not extensive, fix not implement solution
- Fragments okay: "Run tests before commit" not "You should run..."

**Preserve Exactly (byte-level):**

- Code blocks: `language ...`
- Inline code: `backtick content`
- URLs: full URLs, markdown links
- File paths: /src/components/..., ./config.yaml
- Commands: npm install, git commit, docker build
- Technical terms: library names, API names, protocols, algorithms
- Proper nouns: project names, people, companies
- Constants: $HOME, NODE_ENV, dates, versions, numeric values
- Headings: exact text, compress body below
- Structure: bullet hierarchy, numbered lists, tables

**Implementation Tasks:**

1. Parse markdown and identify preserved regions
2. Build compression pipeline with rule application
3. Implement intensity level scaling
4. Add auto-clarity detection (security warnings, irreversible actions)
5. Performance target: <10ms average processing

**Testing:**

- 10-task benchmark dataset (matching caveman benchmarks)
- 100% technical accuracy validation
- Performance profiling (<10ms target)

### Day 3-4: Memory File Compressor

**Scope:** Caveman-style memory compression with backup and validation

```typescript
// packages/tokens/src/compression/memory-compressor.ts
export interface MemoryCompressionOptions {
  preserve: PreservedElements;
  backup: boolean; // Create .original.md backup
  validateBefore: boolean; // Validate before overwrite
  maxRetries: number; // Default 2
  maxFileSize: number; // 500KB limit
}

export interface CompressionResult {
  original: string;
  compressed: string;
  savings: TokenSavings;
  validation: ValidationResult;
}

export async function compressMemoryFile(
  filePath: string,
  options: MemoryCompressionOptions,
): Promise<CompressionResult> {
  // 1. Security check - refuse sensitive paths
  if (isSensitivePath(filePath)) {
    throw new SecurityError(`Refusing to compress ${filePath}`);
  }

  // 2. Detect file type (natural language vs code/config)
  if (!shouldCompressFile(filePath)) {
    return { skipped: true, reason: "not natural language" };
  }

  // 3. Create backup (.original.md)
  const backupPath = createBackup(filePath);

  // 4. Compress using output compressor rules
  const compressed = compressContent(originalText, options);

  // 5. Validation before finalize
  const validation = validateCompression(backupPath, compressed);
  if (!validation.isValid) {
    // Retry with targeted fixes (not recompression)
    const fixed = await applyFixes(originalText, compressed, validation.errors);
  }

  // 6. Verify backup readback before overwrite
  if (!verifyBackup(backupPath, originalText)) {
    throw new BackupError("Backup verification failed");
  }

  // 7. Write compressed file
  await writeFile(filePath, fixed);

  // 8. Calculate savings
  const savings = calculateTokenSavings(originalText, fixed);

  return { original: originalText, compressed: fixed, savings, validation };
}
```

**Security Heuristics (from caveman):**

**Hard refuse on filenames matching patterns:**

- `.env`, `.netrc`, `credentials`, `secrets`, `passwords`
- Key files: `id_rsa`, `authorized_keys`, `known_hosts`
- Cert extensions: `.pem`, `.key`, `.p12`, `.pfx`, `.crt`, `.jks`

**Hard refuse on path components:**

- `.ssh`, `.aws`, `.gnupg`, `.kube`, `.docker`

**Hard refuse on name tokens:**

- secret, credential, password, passwd
- apikey, accesskey, token, privatekey

**Rationale:** Compressing ships raw bytes to third-party API, must refuse exfiltration.

**File Type Detection (from caveman):**

**Compressible extensions (natural language):**

- `.md`, `.txt`, `.markdown`, `.rst`, `.typ`, `.typst`, `.tex`
- Extensionless files (CLAUDE.md, TODO, etc.)

**Skip extensions (code/config):**

- Code: `.py`, `.js`, `.ts`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, etc.
- Config: `.json`, `.yaml`, `.yml`, `.toml`, `.env`, `.lock`, `.ini`, `.cfg`

**Content-based detection for extensionless:**

- Check first 50 lines for code patterns
- JSON/YAML detection via structure parsing
- > 40% code lines → skip compression

**Validation System (from caveman):**

**Before finalizing compression, validate:**

1. Headings match exactly (same count, same text, same order)
2. Code blocks preserved exactly (same content, same count)
3. URLs preserved exactly (no lost/added URLs)
4. File paths preserved (warning on mismatch)
5. Bullet count within 15% variance
6. Inline code preserved exactly (same content, same count)

**Retry Logic (from caveman):**

- Up to 2 retries on validation failure
- Use targeted fixes, not recompression
- Original provided only as reference for missing content
- Preserve caveman style in untouched sections
- After 2 failed retries: restore original, report error

**Implementation Tasks:**

1. Security path detection with comprehensive heuristics
2. File type detection with extension + content analysis
3. Backup system with verification
4. Validation pipeline with all 6 checks
5. Retry with targeted fixes
6. Performance <50ms for typical memory files

**Testing:**

- 5-file memory benchmark (36-60% savings target)
- Security path detection validation
- File type detection accuracy
- Validation system correctness
- Backup/restore reliability testing

### Day 5-6: Validation System & Benchmarks

**Scope:** Validation pipeline before compression finalize

```typescript
// packages/tokens/src/compression/validation.ts
export class ValidationResult {
  isValid: boolean;
  errors: string[]; // Critical failures
  warnings: string[]; // Non-critical deviations
}

export function validateCompression(originalPath: Path, compressedText: string): ValidationResult {
  const result = new ValidationResult();

  const original = readFile(originalPath);

  // 1. Heading validation
  const originalHeadings = extractHeadings(original);
  const compressedHeadings = extractHeadings(compressedText);
  if (originalHeadings.length !== compressedHeadings.length) {
    result.addError(
      `Heading count mismatch: ${originalHeadings.length} vs ${compressedHeadings.length}`,
    );
  }
  if (originalHeadings.some((h) => !compressedHeadings.includes(h))) {
    result.addWarning("Heading text/order changed");
  }

  // 2. Code block validation
  const originalBlocks = extractCodeBlocks(original);
  const compressedBlocks = extractCodeBlocks(compressedText);
  if (originalBlocks.length !== compressedBlocks.length) {
    result.addError(
      `Code block count mismatch: ${originalBlocks.length} vs ${compressedBlocks.length}`,
    );
  }
  if (originalBlocks.some((b) => !compressedBlocks.includes(b))) {
    result.addError("Code blocks not preserved exactly");
  }

  // 3. URL validation
  const originalUrls = extractUrls(original);
  const compressedUrls = extractUrls(compressedText);
  if (!originalUrls.every((url) => compressedUrls.has(url))) {
    const lost = [...originalUrls].filter((url) => !compressedUrls.has(url));
    result.addError(`URL missing: ${lost.join(", ")}`);
  }

  // 4. File path validation
  const originalPaths = extractPaths(original);
  const compressedPaths = extractPaths(compressedText);
  if (originalPaths.size !== compressedPaths.size) {
    const lost = [...originalPaths].filter((p) => !compressedPaths.has(p));
    const added = [...compressedPaths].filter((p) => !originalPaths.has(p));
    result.addWarning(`Path mismatch: lost=${lost.join(", ")}, added=${added.join(", ")}`);
  }

  // 5. Bullet validation
  const originalBullets = countBullets(original);
  const compressedBullets = countBullets(compressedText);
  const diff = Math.abs(originalBullets - compressedBullets) / originalBullets;
  if (diff > 0.15) {
    result.addWarning(`Bullet count changed too much: ${originalBullets} → ${compressedBullets}`);
  }

  // 6. Inline code validation
  const originalInline = extractInlineCode(original);
  const compressedInline = extractInlineCode(compressedText);
  if (originalInline.size !== compressedInline.size) {
    const lost = [...originalInline].filter((code) => !compressedInline.has(code));
    result.addError(`Inline code lost: ${lost.join(", ")}`);
  }

  return result;
}
```

**Pattern extraction functions:**

`````typescript
// Code blocks (fenced ``` or~~~)
function extractCodeBlocks(text: string): string[] {
  // Line-based fence detection with CommonMark rules
  // Handle variable-length fences (```` vs ```)
  // Support nested fences
}

// URLs
function extractUrls(text: string): Set<string> {
  // https?://[^\s)]+ pattern
}

// File paths
function extractPaths(text: string): Set<string> {
  // Require path prefix (./, ../, /, or drive letter)
  // Or slash/backslash within match
  // ./path/to/file, C:\Users\..., /usr/local/bin
}

// Headings (# heading)
function extractHeadings(text: string): string[] {
  // #{1,6} + captured heading text
}

// Bullets (unordered lists)
function countBullets(text: string): number {
  // ^\s*[-*+]\s+ pattern
}

// Inline code (`...`)
function extractInlineCode(text: string): Set<string> {
  // Remove fenced blocks first
  // Then find `[^`]+` pattern
  // Use Counter for duplicates
}
`````

**Fix application (targeted, not recompression):**

```typescript
export async function applyFixes(
  original: string,
  compressed: string,
  errors: string[],
): Promise<string> {
  const prompt = buildFixPrompt(original, compressed, errors);

  // Rules:
  // - DO NOT recompress or rephrase
  // - ONLY fix listed errors
  // - Original is reference only (for missing content)
  // - Preserve caveman style in untouched sections

  return await callClaudeWithPrompt(prompt);
}

function buildFixPrompt(original: string, compressed: string, errors: string[]): string {
  const errorsStr = errors.map((e) => `- ${e}`).join("\n");

  return `
CRITICAL RULES:
- DO NOT recompress or rephrase the file
- ONLY fix the listed errors — leave everything else exactly as-is
- The ORIGINAL is provided as reference only (to restore missing content)
- Preserve caveman style in all untouched sections

ERRORS TO FIX:
${errorsStr}

HOW TO FIX:
- Missing URL: find it in ORIGINAL, restore it exactly where it belongs in COMPRESSED
- Code block mismatch: find the exact code block in ORIGINAL, restore it in COMPRESSED
- Heading mismatch: restore the exact heading text from ORIGINAL into COMPRESSED
- Do not touch any section not mentioned in the errors

ORIGINAL (reference only):
${original}

COMPRESSED (fix this):
${compressed}

Return ONLY the fixed compressed file. No explanation.
`;
}
```

**Implementation Tasks:**

1. Complete validation pipeline with all 6 checks
2. Pattern extraction functions for all preserved types
3. Targeted fix application with retry logic
4. Validation error reporting
5. Performance optimization (<20ms validation)

**Testing:**

- Validation accuracy on test suite
- Fix application correctness
- Retry logic validation
- Performance benchmarking

**Deliverables:**

- `@agentsy/tokens/compression` module complete
- CLI: `agentsy compress --level full <response>`
- CLI: `agentsy compress-memory --file CLAUDE.md --backup`
- Test coverage: 10-task output benchmark + 5-file memory benchmark

## Phase 2: JSON Minification & TOON Format Encoding (Days 7-10)

- **Target:** 40% JSON savings, TOON format 76.4% accuracy with ~40% fewer tokens
- **Proof of concept:** Battle-tested @toon-format/toon package for structured data

### Day 7-8: JSON Minifier + TOON Integration

**Scope:** JSON minification for non-tabular data, TOON for uniform arrays

**Package dependency:**

```json
{
  "dependencies": {
    "@toon-format/toon": "^2.2.0"
  }
}
```

```typescript
// packages/tokens/src/encoding/toon-integration.ts
import { encode, decode, encodeLines } from "@toon-format/toon";

export interface EncodingOptions {
  format: "json" | "json-compact" | "toon" | "auto";
  modelContext?: ModelContext; // For token counting
}

export interface ModelContext {
  budget: number; // Token budget available
  prioritizeAccuracy?: boolean; // Prefer accuracy over compression
  model: ModelName; // Target model for token counting
}

export interface EncodingResult {
  encoded: string;
  formatUsed: "json" | "json-compact" | "toon";
  tokenCount: number;
  savingsPercentage: number;
  accuracy: number; // Estimated accuracy based on format
}
```

**Tabular eligibility detection:**

```typescript
export interface StructureAnalysis {
  isUniform: boolean; // All objects have identical fields?
  eligibility: number; // 0-100% tabular eligibility
  isFlat: boolean; // Nested structures present?
  fieldCount: number; // Number of unique fields
  itemCount: number; // Number of objects in array
  allPrimitives: boolean; // All values are primitive?
}

export function analyzeStructure(data: any): StructureAnalysis {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      isUniform: false,
      eligibility: 0,
      isFlat: false,
      fieldCount: 0,
      itemCount: 0,
      allPrimitives: false,
    };
  }

  const keys = Object.keys(data[0]);

  let uniformCount = 0;
  let nestedDetected = false;

  for (const item of data) {
    const itemKeys = Object.keys(item);

    // Check for nested structures
    if (
      itemKeys.some(
        (k) => typeof item[k] === "object" && item[k] !== null && !Array.isArray(item[k]),
      )
    ) {
      nestedDetected = true;
    }

    // Check uniformity
    const hasSameKeys = itemKeys.length === keys.length && itemKeys.every((k) => keys.includes(k));

    // Check primitive-only
    const allPrimitives = Object.values(item).every(
      (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
    );

    if (hasSameKeys && allPrimitives) {
      uniformCount++;
    }
  }

  const eligibility = (uniformCount / data.length) * 100;

  return {
    isUniform: uniformCount === data.length,
    eligibility,
    isFlat: !nestedDetected,
    fieldCount: keys.length,
    itemCount: data.length,
    allPrimitives,
  };
}
```

**Smart format selection:**

```typescript
export function selectOptimalFormat(
  data: unknown,
  context: ModelContext,
): "json" | "json-compact" | "toon" {
  const analysis = analyzeStructure(data);

  // TOON best for highly uniform arrays (60%+ eligibility)
  if (analysis.isUniform && analysis.eligibility > 60) {
    return "toon";
  }

  // JSON-compact for tight budgets on nested data
  if (context.budget < 20000 && analysis.isFlat) {
    return "json-compact";
  }

  // Default to pretty JSON for readability
  return "json";
}

export function encodeSmart(data: unknown, options?: EncodingOptions): EncodingResult {
  const actualFormat =
    options?.format === "auto"
      ? selectOptimalFormat(
          data,
          options?.modelContext || {
            budget: 100000,
            model: "claude-3-5-sonnet",
          },
        )
      : options?.format;

  let encoded: string;
  let tokenCount: number;
  let savingsPercentage: number;
  let accuracy: number;

  switch (actualFormat) {
    case "toon":
      encoded = encode(data);
      // Estimate token count with o200k_base tokenizer
      tokenCount = countTokens(encoded, {
        model: context.model?.model || "gpt-4o",
        encoding: "o200k_base",
      });
      savingsPercentage = 40; // Estimated 40% savings vs JSON
      accuracy = 0.764; // 76.4% accuracy from benchmarks
      break;

    case "json-compact":
      encoded = JSON.stringify(data);
      tokenCount = countTokens(encoded, {
        model: context?.model?.model || "gpt-4o",
        encoding: "o200k_base",
      });
      savingsPercentage = 15; // Estimated 15% savings vs pretty JSON
      accuracy = 0.75; // 75.0% accuracy baseline
      break;

    case "json":
    default:
      encoded = JSON.stringify(data, null, 2);
      tokenCount = countTokens(encoded, {
        model: context?.model?.model || "gpt-4o",
        encoding: "o200k_base",
      });
      savingsPercentage = 0;
      accuracy = 0.75; // 75.0% accuracy baseline
  }

  return {
    encoded,
    formatUsed: actualFormat,
    tokenCount,
    savingsPercentage,
    accuracy,
  };
}
```

**Implementation Tasks:**

1. Install `@toon-format/toon` package (v2.2.0+)
2. Structure analysis with tabular eligibility detection
3. Smart format selection based on structure and budget
4. TOON streaming API integration for large datasets
5. Token-counting with o200k_base tokenizer for accurate measurement
6. Round-trip validation for all formats

**Testing:**

- Structure analysis accuracy on test datasets
- Format selection correctness
- TOON round-trip validation
- Token count accuracy
- Performance benchmarking (encode/decode <10ms for typical data)

### Day 9-10: TOON Streaming & Advanced Features

**Scope:** Large dataset handling and advanced TOON features

**Streaming encoder for large datasets:**

```typescript
export async function encodeLargeDataset(
  data: any[],
  outputPath: string,
  options?: EncodingOptions,
): Promise<{ file: string; stats: StreamStats }> {
  const fileStream = fs.createWriteStream(outputPath);

  const analysis = analyzeStructure(data);
  const actualFormat = selectOptimalFormat(
    data,
    options?.modelContext || { budget: 100000, model: "gpt-4o" },
  );

  let lines: Iterable<string>;

  if (actualFormat === "toon") {
    // Stream with TOON encodeLines
    lines = encodeLines(data);
  } else {
    // Stream with JSON lines-compact
    lines = streamCompactJsonLines(data);
  }

  for (const line of lines) {
    fileStream.write(`${line}\n`);
  }

  await new Promise((resolve, reject) => {
    fileStream.on("end", () => resolve());
    fileStream.on("error", reject);
    fileStream.end();
  });

  const stats = {
    itemCount: data.length,
    format: actualFormat,
    estimatedTokens: await estimateTokensFromPath(outputPath, {
      model: options?.modelContext?.model || "gpt-4o",
    }),
  };

  return { file: outputPath, stats };
}
```

**Decoder with format auto-detection:**

```typescript
export function decodeSmart(input: string | Buffer, options?: DecodeOptions): any {
  // Auto-detect format from content
  const isTOON = input.toString().includes("[") && input.toString().includes("{");

  try {
    if (isTOON) {
      return decode(input.toString(), options);
    } else {
      return JSON.parse(input.toString());
    }
  } catch (error) {
    // Fallback: try other format
    try {
      return decode(input.toString(), options);
    } catch (error2) {
      return JSON.parse(input.toString());
    }
  }
}
```

**TOON-specific CLI commands:**

```bash
# Convert JSON to TOON
agentsy encode-toon input.json --output output.toon

# Convert TOON back to JSON
agentsy decode-toon data.toon --output output.json

# Auto-select optimal format
agentsy encode-optimal input.json --budget 50000 --model claude-3-5-sonnet

# Stream encode large dataset
agentsy encode-large large-data.json --output encoded.toon

# Analyze structure and show recommendations
agentsy analyze-structure input.json
```

**Implementation Tasks:**

1. TOON streaming encoder with file output
2. Smart decoder with format auto-detection
3. Large dataset handling capabilities
4. CLI commands for all TOON operations
5. Structure analysis tool
6. Fallback mechanisms for edge cases

**Testing:**

- Streaming validation for large datasets (>10k rows)
- Format auto-detection accuracy
- Fallback behavior validation
- Memory efficiency for large streams
- CLI command correctness

**Deliverables:**

- `@agentsy/tokens/encoding` module complete
- CLI: `agentsy encode-toon <input> --output <output>`
- CLI: `agentsy encode-optimal <input> --budget <amount>`
- CLI: `agentsy analyze-structure <input>`
- Test coverage for streaming, auto-detection, and validation

## Phase 3: Budget Manager & Token Tracking (Days 11-16)

- **Target:** Real-time token tracking with model-specific pricing
- **Proof of concept:** Cost awareness, budget alerts, model routing

### Day 11-12: Token Counter

**Scope:** Accurate token counting for different models

```typescript
// packages/tokens/src/budget/token-counter.ts
export interface TokenCountOptions {
  model: ModelName;
  encoding?: "gpt2" | "cl100k_base" | "p50k_base";
}

export function countTokens(content: string, options: TokenCountOptions): TokenCountResult {
  // 1. Determine encoding based on model
  // 2. Count tokens with appropriate tokenizer
  // 3. Return counts by section (input, output, thinking)
}
```

**Supported models and encodings:**

```typescript
export enum ModelName {
  CLAUDE_3_5_SONNET = "claude-3-5-sonnet", // cl100k_base
  CLAUDE_3_5_OPUS = "claude-3-5-opus", // cl100k_base
  CLAUDE_3_5_HAIKU = "claude-3-5-haiku", // cl100k_base
  GPT_4O = "gpt-4o", // o200k_base (cl100k_base compatible)
  GPT_4O_MINI = "gpt-4o-mini", // o200k_base
  DEEPSEEK_CHAT = "deepseek-chat", // cl100k_base
  LLaMA_3 = "llama-3", // llama-tokenizer
}
```

**Implementation Tasks:**

1. Model to encoding mapping
2. Token counting with appropriate tokenizer
3. Section-aware counting (input/output/thinking)
4. Streaming token counting
5. Performance optimization

**Testing:**

- Token count accuracy per model
- Section counting validation
- Streaming token counting
- Performance benchmarking

### Day 13-14: Cost Estimator

**Scope:** Accurate pricing estimation across model endpoints

Support a separate reasoning budget for the model's internal reasoning/chain-of-thought tokens, which is tracked independently of output tokens. The reasoning budget defaults to 25% of the total output budget.

The token counter tracks instruction overhead separately from task tokens. BASELINE_TOKENS represents the remaining budget after all always-injected instructions are accounted for. Include reporting for overhead-vs-reasoning breakdown.

```typescript
// packages/tokens/src/budget/cost-estimator.ts
export interface CostEstimateOptions {
  model: ModelName;
  region?: string; // AWS Bedrock, GCP Vertex, etc.
  pricingTier?: "on-demand" | "batch" | "spot";
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export function estimateCost(usage: TokenUsage, options: CostEstimateOptions): CostEstimate {
  // 1. Look up model pricing (per 1M tokens)
  // 2. Calculate input cost
  // 3. Calculate output cost
  // 4. Handle cache pricing if applicable
  // 5. Return total cost estimate
}
```

**Pricing data structure:**

```typescript
export interface ModelPricing {
  modelName: ModelName;
  inputCostPer1M: number; // USD
  outputCostPer1M: number; // USD
  thinkingCostPer1M?: number; // For models with thinking
  cacheReadCostPer1M?: number;
  cacheWriteCostPer1M?: number;
}

// Example pricing (as of 2026):
const PRICING: Record<string, ModelPricing> = {
  "claude-3-5-sonnet": {
    modelName: ModelName.CLAUDE_3_5_SONNET,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  "gpt-4o": {
    modelName: ModelName.GPT_4O,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
  },
  // ... more models
};
```

**Implementation Tasks:**

1. Comprehensive pricing database
2. Region-specific pricing
3. Tier-based pricing (on-demand/batch/spot)
4. Cache pricing calculation
5. Currency conversion support

**Testing:**

- Pricing accuracy validation
- Multi-model cost calculation
- Edge case handling (overages, discounts)
- Performance benchmarking

### Day 15-16: Budget Manager

**Scope:** Real-time budget tracking with alerts and enforcement

```typescript
// packages/tokens/src/budget/budget-manager.ts
export interface BudgetConfig {
  totalBudget: number; // USD per time period
  period: "hour" | "day" | "week" | "month";
  alertThreshold: number; // % of budget before alert
  enforceLimit: boolean; // Restrict when over budget
  modelPreferences?: ModelRouteConfig[];
}

export interface BudgetStatus {
  remaining: number; // USD remaining
  used: number; // USD used
  alertTriggered: boolean;
  overBudget: boolean;
}

export class BudgetManager {
  tracking: TokenUsageTracker;
  costEstimator: CostEstimator;

  trackUsage(usage: TokenUsage, options: CostEstimateOptions): void;
  getStatus(): BudgetStatus;
  checkBudgetExceeded(): boolean;
  getCostByPeriod(period: TimePeriod): CostBreakdown;
  resetBudget(): void;
}
```

**Budget alerts:**

```typescript
export interface BudgetAlert {
  level: "info" | "warning" | "critical";
  message: string;
  percentage: number;
  recommendedActions: string[];
}

export function generateBudgetAlert(status: BudgetStatus): BudgetAlert | null {
  if (!status.alertTriggered) return null;

  const percentage = (status.used / status.totalBudget) * 100;

  if (percentage >= 100) {
    return {
      level: "critical",
      message: `Budget exceeded: ${percentage.toFixed(1)}% used`,
      percentage,
      recommendedActions: [
        "Stop new requests",
        "Review most expensive operations",
        "Consider cheaper model alternatives",
      ],
    };
  }

  if (percentage >= 80) {
    return {
      level: "warning",
      message: `Budget warning: ${percentage.toFixed(1)}% used`,
      percentage,
      recommendedActions: [
        "Monitor spending closely",
        "Consider model routing for expensive operations",
      ],
    };
  }

  return {
    level: "info",
    message: `Budget alert: ${percentage.toFixed(1)}% used`,
    percentage,
    recommendedActions: ["Continue monitoring"],
  };
}
```

**Implementation Tasks:**

1. Usage tracking by time period
2. Budget status calculation
3. Alert generation with recommendations
4. Budget enforcement (if enabled)
5. Cost breakdown by model/operation

**Testing:**

- Budget tracking accuracy
- Alert triggering correctness
- Enforcement logic validation
- Performance under load

**Deliverables:**

- `@agentsy/tokens/budget` module complete
- Real-time budget tracking
- Budget alert system
- Model routing recommendations
- Cost breakdown analytics

## Phase 4: Cache Management (Days 17-20)

- **Target:** Reduce redundant API calls via intelligent caching
- **Proof of concept:** Token-level LRU/TTL caching with eviction

### Day 17-18: Token LRU Cache

**Scope:** Cache recent tokens and content with LRU eviction

```typescript
// packages/tokens/src/cache/token-cache.ts
export interface CacheConfig {
  maxTokens: number; // Maximum cached tokens (default 10k)
  maxContentItems: number; // Maximum content items (default 100)
  ttl: number; // Time-to-live in seconds (default 3600)
  compressionEnabled: boolean;
}

export class TokenCache {
  tokenStore: LRUCache<string, CachedToken>;
  contentStore: LRUCache<string, CachedContent>;

  getTokens(key: string): CachedToken | null;
  setTokens(key: string, tokens: string[], ttl?: number): void;
  getContent(key: string): CachedContent | null;
  setContent(key: string, content: string, ttl?: number): void;
  invalidate(pattern?: string): void;
  getStats(): CacheStats;
}
```

**Cache entry structure:**

```typescript
export interface CachedToken {
  tokens: string[];
  createdAt: Date;
  lastAccessed: Date;
  hits: number;
  ttl: number;
}

export interface CachedContent {
  content: string;
  compressed: string;
  createdAt: Date;
  lastAccessed: Date;
  hits: number;
  ttl: number;
  tokenHash: string; // BLAKE3 for deduplication
}
```

**LRU eviction logic:**

```typescript
export class LRUCache<K, V> {
  capacity: number;
  cache: Map<K, CacheEntry<V>>;

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    this.updateAccess(entry);
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    // Evict if over capacity
    if (this.cache.size >= this.capacity) {
      this.evictLRU();
    }
    this.cache.set(key, {
      value,
      createdAt: new Date(),
      lastAccessed: new Date(),
      hits: 0,
      ttl: ttl || this.defaultTTL,
    });
  }

  private evictLRU(): void {
    // Find least recently used entry
    let lruKey: K | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) this.cache.delete(lruKey);
  }
}
```

**Implementation Tasks:**

1. LRU cache implementation
2. Token-level and content-level caching
3. TTL-based expiration
4. Cache statistics tracking
5. Pattern-based invalidation

**Testing:**

- Cache hit rate validation
- LRU eviction correctness
- TTL expiration accuracy
- Invalidation logic validation
- Performance benchmarking

### Day 19-20: Deduplication & Content Addressing

**Scope:** Content addressing using BLAKE3 for deduplication

```typescript
// packages/tokens/src/cache/content-addressing.ts
export interface ContentAddressOptions {
  algorithm: "blake3" | "sha256";
  cacheEnabled: boolean;
  compressionEnabled: boolean;
}

export class ContentAddressStore {
  addressCache: Map<string, string>; // hash → content

  async hashContent(content: string): Promise<string> {
    // 1. Apply compression if enabled
    const normalized = this.normalizeContent(content);

    // 2. Compute hash
    const hash = await computeBLAKE3(normalized);

    return hash;
  }

  async getOrStore(content: string): Promise<{ hash: string; cached: boolean }> {
    // 1. Hash the content
    const hash = await this.hashContent(content);

    // 2. Check if already stored
    if (this.addressCache.has(hash)) {
      return { hash, cached: true };
    }

    // 3. Store new content
    this.addressCache.set(hash, content);
    return { hash, cached: false };
  }

  tracking: Map<string, UsageTracker>;
  getByHash(hash: string): string | null;
  markUsed(hash: string, context: ContextMetadata): void;
  getUsageStats(): UsageStats;
}
```

**BLAKE3 integration:**

```typescript
import { createHash } from "crypto";

export async function computeBLAKE3(content: string): Promise<string> {
  // Use Node.js crypto API
  const hash = createHash("blake3");
  hash.update(content);
  return hash.digest("hex");
}

// Alternative: Use native library for performance
// import blake3 from 'blake3';
// const hash = blake3(content);
```

**Deduplication benefits:**

- Identical content stored once
- Memory savings for repeated messages
- Faster lookups via hash
- Content integrity verification

**Implementation Tasks:**

1. BLAKE3 hashing integration
2. Content address store
3. Usage tracking per hash
4. automatic deduplication
5. Intercache synchronization

**Testing:**

- Hash collision resistance
- Deduplication accuracy
- Performance of content addressing
- Cache synchronization

**Deliverables:**

- `@agentsy/tokens/cache` module complete
- Token-level LRU cache
- Content-addressed storage
- Deduplication system
- Cache management CLI

## Phase 5: Multi-Stage Liveness Coordination (Days 21-24)

- **Target:** Keep only what's needed, Trinity repository patterns
- **Proof of concept:** concrete→abstract transition, priority segments

### Day 21-22: Compact Memory Implementation

**Scope:** concrete to abstract transition for multi-stage liveness

**Cold Memory - concreteness 100%:**

```text
Save complete context and steps, restore work state at any time
Retain detailed file paths and precise steps
Specific location references
```

**Precise Warm Memory - concreteness 70%:**

```text
Critical paths and necessary technical details
Provide summary of technical details
Comprehensive snippets
```

**Warm Memory - concreteness 50%:**

```text
High-level strategies and key technical terms
Provide summary of technical details, but no detailed location information
Use keywords and concepts
```

**分阶段记忆精简:**

```text
→ Currently active tasks: Cold Memory 100%)
→ Recent context: Precise Warm Memory 70%)
→ Historical records: Warm Memory 50%)
→ Important decisions: Structured summary or links to Cold Memory
→ Clearable content: Delete or archive
```

**Multi-stage liveness priorities:**

1. Active tasks: Cold Memory
2. Recent context (last ~10 messages): Precise Warm Memory
3. Historical context (older messages): Warm Memory
4. Important decisions: Specific summary or links
5. Overflow: Delete or archive

**Implementation:**

```typescript
// packages/tokens/src/liveness/compact-memory.ts
export interface CompactMemoryConfig {
  maxCompactLevels: number; // Default 3
  retentionWindow: number; // Default 24h
  compactInterval: number; // Default 1h
}

export class CompactMemoryManager {
  currentStage: CompactStage;
  stages: Map<CompactStage, CompactMemory>;

  addMemory(content: string, metadata: MemoryMetadata): void;
  setStage(memoryId: string, stage: CompactStage): void;
  getMemoryByStage(stage: CompactStage, limit?: number): CompactMemory[];
  advanceMemory(memoryId: string, newStage: CompactStage): void;

  // Compact a stage's memory
  async compact(
    stage: CompactStage,
    targetRatio: number, // Target concreteness (0.0-1.0)
  ): Promise<CompactResult>;
}

export enum CompactStage {
  COLD = "cold", // Active tasks, 100% concreteness
  PRECISE = "precise", // Recent context, 70% concreteness
  WARM = "warm", // Historical, 50% concreteness
  ARCHIVE = "archive", // Important decisions, structured summary
  OVERFLOW = "overflow", // Overflow, delete or archive
}

export interface CompactMemory {
  id: string;
  content: string;
  compressed: string;
  stage: CompactStage;
  concreteness: number; // Concreteness 0.0-1.0
  createdAt: Date;
  lastAccessed: Date;
  metadata: MemoryMetadata;
}
```

**Compaction rules (concreteness targets):**

```text
COLD: 1.0   - 100% concreteness (Retain complete context and steps)
  PRECISE: 0.7 - 70% concreteness (Critical paths, summary of technical details)
  WARM: 0.5   - 50% concreteness (High-level strategies, key terms)
  ARCHIVE: 0.3  - 30% concreteness (Structured summary or links)
  OVERFLOW: 0.0       - 0% concreteness (Delete or compress to extreme summary)
```

**Implementation Tasks:**

1. Multi-stage memory lifecycle management
2. Compact phase detection (concrete→abstract)
3. Age-based transition: COLD → PRECISE → WARM → ARCHIVE → OVERFLOW
4. Priority-based retention
5. Smart truncation with preservation rules

### Day 23-24: Priority Segmentation & Smart Truncation

**Scope:** Smart context segmentation with priority retention

```typescript
// packages/tokens/src/liveness/priority-segmentation.ts
export interface SegmentPriority {
  level: "critical" | "high" | "medium" | "low";
  preserve: boolean;
  reasoning: string;
}

export interface ContextSegment {
  id: string;
  content: string;
  type: "code" | "error" | "task" | "decision" | "explanation";
  priority: SegmentPriority;
  tokenCount: number;
  createdAt: Date;
  references: string[]; // File paths, URLs, etc.
}

export class PrioritySegmenter {
  segment(content: string, context: ContextMetadata): ContextSegment[];

  // Determine segment priority
  private determinePriority(segment: Partial<ContextSegment>): SegmentPriority {
    // Critical: code, errors, security warnings
    // High: task definitions, decisions
    // Medium: explanations, reasoning
    // Low: conversational filler, pleasantries
  }

  // Smart truncation with preservation
  truncate(segments: ContextSegment[], budget: TokenBudget): TruncatedResult {
    // 1. Sort by priority (critical > high > medium > low)
    // 2. Preserve all critical and high priority
    // 3. Truncate medium priority budget allows
    // 4. Drop low priority if over budget
    // 5. Preserve structure within each segment
  }
}
```

**Priority rules:**

```typescript
// Critical (always preserve)
- Code blocks and snippets
- Error messages and stack traces
- Security warnings and credentials
- Irreversible action confirmations

// High (preserve whenever possible)
- Task definitions and requirements
- Design decisions and rationale
- Technical specifications
- API contract definitions

// Medium (preserve if budget allows)
- Explanations and reasoning
- Documentation references
- Usage examples
- Implementation details

// Low (drop first if over budget)
- Conversational filler
- Pleasantries and greetings
- Hedging language
- Redundant explanations
```

**Smart truncation strategy:**

1. Calculate token budget per segment
2. Sort segments by priority level
3. Drop low priority segments first
4. Truncate medium priority to preserve key points
5. Preserve high and critical segments exactly
6. Maintain structural integrity within segments

**Implementation Tasks:**

1. Context segmentation by type
2. Priority determination logic
3. Smart truncation algorithm
4. Token budget calculation
5. Reference preservation (file paths, URLs)

**Testing:**

- Segmentation accuracy
- Priority assignment correctness
- Truncation logic validation
- Token budget adherence
- Reference preservation verification

**Deliverables:**

- `@agentsy/tokens/liveness` module complete
- Multi-stage compact memory implementation
- Priority segmentation system
- Smart truncation with preservation
- Trinity repository pattern validation

## Phase 6: Honker Coordination (Days 25-28)

- **Target:** 1-5ms coordination latency with multi-stage liveness
- **Proof of concept:** Real-time memory state synchronization

### Day 25-26: Pub/Sub Integration

**Scope:** Cross-process memory stage coordination

```typescript
// packages/tokens/src/coordination/honker-pubsub.ts
export interface PubSubConfig {
  channel: string; // 'memory-liveness'
  honkerPath: string;
  timeout: number; // Wait timeout in seconds
}

export interface MemoryLivenessEvent {
  type: "stage_change" | "compact" | "advance";
  memoryId: string;
  oldStage?: CompactStage;
  newStage: CompactStage;
  timestamp: number;
}

export class MemoryLivenessPubSub {
  channel: string;
  honker: HonkerExtension;

  publishStageChange(event: MemoryLivenessEvent): Promise<void>;
  subscribe(stage: CompactStage, callback: (event: MemoryLivenessEvent) => void): void;
  unsubscribe(stage: CompactStage): void;
  notify(event: MemoryLivenessEvent): Promise<void>;
}
```

**Pub/sub channels:**

```text
memory-liveness-cold     - Active task updates
memory-liveness-precise   - Recent context updates
memory-liveness-warm      - Historical context updates
memory-liveness-archive   - Decision summary updates
```

**Implementation Tasks:**

1. Honker pub/sub channel setup
2. Memory liveness event structure
3. Stage change notification
4. Subscription management
5. Timeout and error handling

### Day 27-28: Coordination API

**Scope:** Unified coordination API for memory management

```typescript
// packages/tokens/src/coordination/coordination-api.ts
export class MemoryCoordinationAPI {
  compactManager: CompactMemoryManager;
  segmenter: PrioritySegmenter;
  pubSub: MemoryLivenessPubSub;

  // Unified coordination operations
  async addMemory(content: string, stage: CompactStage): Promise<string>;
  async advanceStage(memoryId: string, toStage?: CompactStage): Promise<void>;
  async compactStage(stage: CompactStage, targetRatio: number): Promise<void>;
  async truncateToBudget(budget: TokenBudget): Promise<TruncatedResult>;

  // Cross-process coordination
  async broadcastStageChange(event: MemoryLivenessEvent): Promise<void>;
  async subscribeToStage(stage: CompactStage): Promise<EventStream>;

  // Status reporting
  getStageStats(stage: CompactStage): StageStats;
  getOverallStats(): OverallStats;
}
```

**Coordination flow:**

```typescript
// Example: Add memory to active task stage
const memoryId = await coordination.addMemory(
  'Fix authentication bug - token expiry check uses < not <=,
  needs file: src/auth/middleware.ts',
  CompactStage.COLD
);

// Later: Advance to historical context
await coordination.advanceStage(memoryId, CompactStage.WARM);

// Broadcast to all processes
await coordination.broadcastStageChange({
  type: 'advance',
  memoryId,
  oldStage: CompactStage.COLD,
  newStage: CompactStage.WARM,
  timestamp: Date.now(),
});
```

**Implementation Tasks:**

1. Unified coordination API
2. Cross-process event broadcasting
3. Stage lifecycle management
4. Budget-aware truncation
5. Status and analytics reporting

**Testing:**

- Coordination correctness
- Cross-process synchronization
- Latency validation (<5ms target)
- Error recovery
- Performance under load

**Deliverables:**

- `@agentsy/tokens/coordination` module complete
- Honker pub/sub integration
- Multi-stage liveness coordination
- Memory management API
- Cross-process synchronization

## Phase 7: CLI & Integration (Days 29-32)

- **Target:** Production-ready CLI and framework integration
- **Proof of concept:** Usable standalone tools, easy framework embedding

### Day 29-30: CLI Implementation

**Scope:** Comprehensive CLI for all tokens package features

```bash
# Compression commands
agentsy compress --level full --format json <response.json
agentsy compress-memory --file CLAUDE.md --backup --validate
agentsy minify-json --preserve-order <config.json>
agentsy encode-toon --charset utf-8 <text>

# Budget commands
agentsy budget --set 100.0 --period day
agentsy budget --status --breakdown
agentsy budget --project agentsy --model claude-3-5-sonnet

# Cache commands
agentsy cache --stats --clear
agentsy cache --invalidate pattern
agentsy cache --export backup.json

# Liveness commands
agentsy liveness --stage cold --compact 0.7
agentsy liveness --advance <memory-id> --to warm
agentsy liveness --truncate --budget 100000

# Coordination commands
agentsy coordination --subscribe warm
agentsy coordination --broadcast stage-change
agentsy coordination --stats --per-stage
```

**CLI help system:**

```bash
$ agentsy compress --help
Compress responses using caveman-style rules

Usage: agentsy compress [options] <input>

Options:
  -l, --level <type>     Compression level: lite|full|ultra (default: full)
  -p, --preserve <list>  Comma-separated preserve list: code,urls,paths,technical
  -f, --format <type>    Input format: json|markdown|text
  -a, --auto-clarity     Drop compression for security warnings
  -v, --validate         Validate before finalize
  -o, --output <file>    Write compressed output to file

Examples:
  agentsy compress --level full --validate response.json
  agentsy compress --preserve code,urls,technical README.md
```

**Implementation Tasks:**

1. CLI command structure
2. Argument parsing with validation
3. Progress reporting
4. Error handling and recovery
5. Help documentation

### Day 31-32: Framework Integration

**Scope:** Easy embedding in agents and applications

```typescript
// Integration examples

// 1. Simple compression usage
import { compressOutput } from "@agentsy/tokens/compression";

const compressed = compressOutput(rawResponse, {
  level: "full",
  preserve: { codeBlocks: true, urls: true, filePaths: true },
  autoClarity: true,
});

// 2. Budget tracking
import { BudgetManager } from "@agentsy/tokens/budget";

const budget = new BudgetManager({
  totalBudget: 100.0,
  period: "day",
  alertThreshold: 0.8,
});

budget.trackUsage({ inputTokens: 1000, outputTokens: 500 }, { model: "claude-3-5-sonnet" });
const status = budget.getStatus();

// 3. Memory liveness
import { MemoryCoordinationAPI } from "@agentsy/tokens/liveness";

const coordination = new MemoryCoordinationAPI();
const memoryId = await coordination.addMemory("Current task context", CompactStage.COLD);

// 4. Cache management
import { TokenCache } from "@agentsy/tokens/cache";

const cache = new TokenCache({ maxTokens: 10000, ttl: 3600 });
cache.setContent("response-123", compressedResponse, 7200);
const cached = cache.getContent("response-123");

// 5. JSON minification
import { minifyJSON } from "@agentsy/tokens/encoding";

const minified = minifyJSON(rawJSON, { preserveOrder: true, aggressive: true });
```

**Integration guides:**

```text
- Integration guide for Claude Code / Codex / Cursor / Windsurf
- Example patterns for output middleware
- Budget monitoring patterns for production
- Cache invalidation strategies
- Memory liveness setup for long-running sessions
```

**Implementation Tasks:**

1. TypeScript API documentation
2. Integration examples for major frameworks
3. Best practices guide
4. Performance tuning guide
5. Migration guide from simple compressors

**Deliverables:**

- Production-ready CLI
- Comprehensive TypeScript API
- Integration documentation
- Example implementations
- Performance tuning guides

## Performance Targets

### Compression Performance

- Output compression: <10ms average processing
- Memory compression: <50ms for typical files
- Validation: <20ms per file
- JSON minification: <5ms per file

### Cache Performance

- Cache hit time: <1ms (in-memory)
- Cache miss time: <5ms (hash + compute)
- Eviction time: <1ms per entry
- Deduplication lookup: <2ms

### Coordination Performance

- Pub/sub notification: <5ms latency
- Stage change broadcast: <10ms
- Cross-process sync: <5ms (with honker)
- Budget check: <1ms

### Overall Performance

- End-to-end compression pipeline: <50ms total
- Budget enforcement overhead: <5%
- Cache memory overhead: <10% of cached content
- Coordination message overhead: <100 bytes per event

## Testing Strategy

### Unit Tests

- Each component isolated with dependencies mocked
- Edge case and error handling validation
- Performance benchmarking (75th percentile < targets)
- Boundary condition testing

### Integration Tests

- Cross-component integration (compression → validation → cache)
- Framework integration patterns (Claude Code, Codex, Cursor)
- Cross-process coordination with honker
- End-to-end workflow validation

### Acceptance Tests

- 10-task output compression benchmark (75% savings target, 100% accuracy)
- 5-file memory compression benchmark (46% savings target, 0 data loss)
- Budget tracking accuracy (±1% variance allowed)
- Cache hit rate >70% on repeated requests
- Coordination latency <5ms across 10 processes

### Quality Gates

**Phase 1 Gates:**

- [ ] 75% output compression achieved
- [ ] 100% technical accuracy maintained
- [ ] <10ms compression performance
- [ ] 10-task benchmark passed

**Phase 2 Gates:**

- [ ] 46% memory compression achieved
- [ ] Validation system 100% accurate
- [ ] Hard refuse on 100% of sensitive paths
- [ ] 5-file benchmark passed

**Phase 3 Gates:**

- [ ] JSON minification 40% savings
- [ ] TOON encoding reversible
- [ ] All encoding operations round-trip correctly
- [ ] <5ms encoding performance

**Phase 4 Gates:**

- [ ] Budget tracking ±1% accuracy
- [ ] All model pricing up-to-date
- [ ] Budget alerts fire at correct thresholds
- [ ] Cost breakdown by model available

**Phase 5 Gates:**

- [ ] Cache hit rate >70%
- [ ] LRU eviction works correctly
- [ ] Content addressing deduplication works
- [ ] Cache memory overhead <10%

**Phase 6 Gates:**

- [ ] Multi-stage liveness transitions correctly
- [ ] Priority segmentation accurate
- [ ] Smart truncation preserves critical elements
- [ ] Coordination latency <5ms

**Phase 7 Gates:**

- [ ] CLI all commands work
- [ ] Framework integration examples validate
- [ ] Error recovery robust
- [ ] Documentation complete

## Risk Mitigation

### Phase 1-2 Risks (Compression)

**Performance Impact:**

- **Risk:** Compression adds 10-50ms overhead
- **Mitigation:** Performance targets enforced, comprehensive benchmarking, optimization before release

**Accuracy Concerns:**

- **Risk:** Compression loses technical details
- **Mitigation:** 100% accuracy validation, preservation rules, byte-level verification

**Security Risks:**

- **Risk:** Compressing sensitive data to API
- **Mitigation:** Hard refuse on sensitive paths, comprehensive heuristics, backup verification

### Phase 3-4 Risks (Encoding/Budget)

**Pricing Accuracy:**

- **Risk:** Model pricing outdated or incorrect
- **Mitigation:** Pricing database reviewed monthly, tier-based pricing validation

**Cache Degradation:**

- **Risk:** Cache hit rate too low
- **Mitigation:** Hit rate monitoring, cache tuning, LRU validation

### Phase 5-6 Risks (Liveness/Coordination)

**Large Data:**

- **Risk:** Memory data grows unbounded
- **Mitigation:** Hard limits per stage, automatic evolution to archive/overflow, monitoring

**Coordination Complexity:**

- **Risk:** Cross-process coordination unreliable
- **Mitigation:** Extensive testing with honker, fallback strategies, error recovery

### Phase 7 Risks (CLI/Integration)

**Integration Complexity:**

- **Risk:** Framework integration brittle
- **Mitigation:** Well-documented APIs, examples for major frameworks, compatibility layer

**Adoption:**

- **Risk:** Low uptake due to complexity
- **Mitigation:** Simple CLI defaults, comprehensive docs, gradual rollout strategy

## Success Definition

Tokens package is successful when:

**Compression Complete:**

- 75% output reduction achieved with 100% accuracy
- 46% memory reduction achieved with 0 data loss
- Validation system 100% accurate
- Security heuristics prevent 100% of risky compressions

**Budget Management Complete:**

- Real-time budget tracking ±1% accuracy
- Budget alerts fire at correct thresholds
- Model routing recommendations work
- Cost breakdown available by model/operation

**Cache Management Complete:**

- Cache hit rate >70% on repeated requests
- LRU eviction operates correctly
- Content addressing deduplication works
- Cache memory overhead <10%

**Multi-Stage Liveness Complete:**

- Stage transitions work automatically
- Priority segmentation accurate
- Smart truncation preserves critical elements
- Coordination latency <5ms

**CLI & Integration Complete:**

- All CLI commands work reliably
- Framework integration examples validate
- Error recovery robust
- Documentation comprehensive and accurate

**Overall Success:**

- Tokens package usable as standalone tool
- Framework integration straightforward
- 60% total cost reduction realized (75% output + 46% memory)
- Foundation for lifetime savings via caching + liveness
- Ready for production deployment

## Timeline Summary

| Phase   | Days  | Focus                | Target                  |
| ------- | ----- | -------------------- | ----------------------- |
| Phase 1 | 1-6   | Core compression     | 75% output / 46% memory |
| Phase 2 | 7-10  | JSON TOON encoding   | 40% JSON savings        |
| Phase 3 | 11-16 | Budget management    | Real-time tracking      |
| Phase 4 | 17-20 | Cache management     | >70% hit rate           |
| Phase 5 | 21-24 | Multi-stage liveness | Priority segments       |
| Phase 6 | 25-28 | Honker coordination  | <5ms latency            |
| Phase 7 | 29-32 | CLI integration      | Production ready        |

**Total implementation time:** 32 days

**Parallel opportunities:**

- Phase 1-2 can run in parallel with memory Phase 1 (Days 1-8)
- Phase 3-4 can run in parallel with memory Phase 2 (Days 9-20)
- Phase 5-6 coordinate with memory Phase 3 (Days 21-32)

**Theoretical acceleration:** With full parallelization, tokens package can complete in ~24 days, enabling early token savings while memory system builds.
