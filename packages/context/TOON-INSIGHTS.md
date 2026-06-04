# Tokens Package Implementation Plan — TOON Insights

## TOON Format Analysis (2026)

Based on review of [toon-format/toon](https://github.com/toon-format/toon) repository (version 2.2.0, 24,261 stars).

### What TOON Is

**Token-Oriented Object Notation**—compact, human-readable encoding of JSON data model designed for LLM input. Combines YAML's indentation for nested objects with CSV-style tabular layout for uniform arrays.

**Key characteristics:**

- **76.4% accuracy** (vs JSON's 75.0%) on retrieval benchmarks
- **~40% fewer tokens** overall vs JSON
- **Efficiency ranking:** TOON (27.7 acc%/1K tok) > JSON compact (23.7) > YAML (19.9) > JSON (16.4) > XML (13.8)
- **Drop-in lossless representation** of JSON for LLMs

### When TOON Excels

**Uniform arrays of objects** (primary use case):

- **Tabular-structured data** with identical fields across items
- Example: employee records, GitHub repositories, time-series metrics
- Achieves CSV-like compactness with structure for reliable parsing

**Example conversion:**

```json
// Original JSON (11,274 tokens)
{
  "repositories": [
    {
      "id": 28457823,
      "name": "freeCodeCamp",
      "repo": "freeCodeCamp/freeCodeCamp",
      "stars": 430886,
      "forks": 42146
    },
    {
      "id": 132750724,
      "name": "build-your-own-x",
      "repo": "codecrafters-io/build-your-own-x",
      "stars": 430877,
      "forks": 40453
    }
  ]
}
```

```yaml
// TOON (8,744 tokens, ~22% savings, 76% accuracy)
repositories[2]{id,name,repo,stars,forks}:
  28457823,freeCodeCamp,freeCodeCamp/freeCodeCamp,430886,42146
  132750724,build-your-own-x,codecrafters-io/build-your-own-x,430877,40453
```

### When NOT to Use TOON

**Deeply nested or non-uniform structures:**

- JSON-compact uses fewer tokens (~0-33% tabular eligibility)
- Example: complex configuration with many nested levels

**Semi-uniform arrays (~40-60% tabular eligibility):**

- Token savings diminish
- JSON-compact often equivalent

**Pure tabular data:**

- CSV is smaller than TOON for flat tables
- TOON adds ~5-10% overhead for structure (lengths, headers)

**Latency-critical applications:**

- Some deployments (local/quantized models like Ollama) process JSON faster
- Measure TTFT, tokens/sec, total time for both formats

### TOON Format Basics

**File extension:** `.toon`
**Media type:** `text/toon; charset=utf-8`
**License:** GPL-3.0-or-later

**Structure:**

- Objects: Yaml-like indentation
- Arrays:
  - Empty: `field[]:`
  - Tabular: `field[N]{columns}:`
  - Row values: `val1,val2,val3`
- Primitive values: directly after field name

**Example TOON structure:**

```yaml
# Nested object
context:
  task: Our favorite hikes together
  location: Boulder
  season: spring_2025

# Simple array
friends[3]: ana,luis,sam

# Tabular array (fields declared once)
users[5]{id,name,email,department,salary}: 1,Alice,alice@example.com,Engineering,75000
  2,Bob,bob@example.com,Marketing,62000
  3,Charlie,charlie@example.com,Engineering,81000
  4,Diana,diana@example.com,Sales,72000
  5,Eve,eve@example.com,Engineering,78000
```

### TypeScript SDK (@toon-format/toon v2.2.0)

**Installation:**

```bash
npm install @toon-format/toon
```

**Basic usage:**

```typescript
import { encode, decode } from "@toon-format/toon";

const data = {
  users: [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" },
  ],
};

// Encode to TOON
const toon = encode(data);
// users[2]{id,name,role}:
//   1,Alice,admin
//   2,Bob,user

// Decode TOON back to JSON
const json = decode(toon);
// { users: [ { id: 1, name: 'Alice', role: 'admin' }, { id: 2, name: 'Bob', 'role': 'user' } ] }
```

**Streaming for large datasets:**

```typescript
import { encodeLines } from "@toon-format/toon";

const largeData = await fetchThousandsOfRecords();

// Memory-efficient streaming
for (const line of encodeLines(largeData)) {
  process.stdout.write(`${line}\n`);
}
```

**Stream encoding write to file:**

```typescript
const writableStream = fs.createWriteStream("output.toon");

const lines = encodeLines(largeData);
for (const line of lines) {
  writableStream.write(`${line}\n`);
}
```

**Stream decoding read from file:**

```typescript
import { decodeStream } from "@toon-format/toon";

const toonFile = fs.createReadStream("input.toon");
const jsonFile = fs.createWriteStream("output.json");
const writer = jsonFile.getWriter();

for await (const value of decodeStream(toonFile)) {
  writer.writeValue(value);
}
await writer.close();
```

**Options:**

- `delimiter`: comma (default), tab, pipe
- `replacer`: transform values (e.g., remove sensitive fields)

**With replacer:**

```typescript
const user = { name: "Alice", password: "secret", email: "alice@example.com" };
const safe = encode(user, {
  replacer: (key, value) => (key === "password" ? undefined : value),
});
```

### Benchmark Results (from repository)

**Mixed-Structure Track (tabular-eligible arrays):**

| Dataset                         | TOON tokens | JSON tokens | Savings | Accuracy |
| ------------------------------- | ----------- | ----------- | ------- | -------- |
| E-commerce orders (33% tabular) | 227,830     | 291,711     | -21.9%  | 73.2%    |
| Event logs (50% tabular)        | 227,830     | 291,711     | -15.0%  | 65.0%    |
| Deep config (0% tabular)        | 620         | 911         | -31.9%  | 94.8%    |

**Flat-Only Track (100% tabular):**

| Dataset          | CSV tokens | TOON tokens | TOON vs CSV | JSON savings   |
| ---------------- | ---------- | ----------- | ----------- | -------------- |
| Employee records | 47,102     | 49,919      | +6.0%       | -60.7% vs JSON |
| Time-series      | 8,383      | 9,115       | +8.7%       | -59.0% vs JSON |
| GitHub repos     | 8,512      | 8,744       | +2.7%       | -42.3% vs JSON |

**Overall efficiency:**

- TOON: 27.7 acc%/1K tokens (76.4% accuracy, 2,759 tokens)
- JSON compact: 23.7 acc%/1K tokens (73.7% accuracy, 3,104 tokens)
- YAML: 19.9 acc%/1K tokens (74.5% accuracy, 3,749 tokens)
- JSON: 16.4 acc%/1K tokens (75.0% accuracy, 4,587 tokens)

### Implementation Considerations for Our Use Case

**Recommended integration approach:**

1. **Use @toon-format/toon package directly** (v2.2.0 or later)
   - battle-tested production library
   - 24,261 GitHub stars, active development
   - TypeScript SDK streaming support
   - GPL-3.0-or-later license

2. **Apply TOON selectively based on tabular eligibility:**
   - Detect array uniformity (all objects have identical fields, primitive values)
   - Calculate tabular eligibility percentage (~40-60% threshold)
   - Use TOON for highly uniform arrays (>80% tabular)
   - Use JSON-compact for deeply nested or non-uniform (<40% tabular)

3. **Token counting with TOON:**
   - TOON uses `gpt-tokenizer` with `o200k_base` encoding
   - Counting should use same tokenizer as model for accurate tokenization

4. **TOON for LLM markdown code blocks:**
   - Wrap TOON output in `toon ...` language spec
   - Show format examples instead of describing structure
   - Use tab delimiters for maximum efficiency

5. **Fallback strategies:**
   - If TOON encoding fails, fall back to JSON-compact
   - Cache JSON-compact results as alternative
   - Provide both formats and let LLM choose

**Example integration:**

```typescript
import { encode, decode, encodeLines } from "@toon-format/toon";

// Detect tabular eligibility
function detectTabularEligibility(data: any): number {
  if (!Array.isArray(data) || data.length === 0) return 0;

  const keys = Object.keys(data[0]);
  if (keys.length === 0) return 100;

  let uniformCount = 0;
  for (const item of data) {
    const itemKeys = Object.keys(item);
    if (
      itemKeys.length === keys.length &&
      itemKeys.every((k) => keys.includes(k)) &&
      Object.values(item).every(
        (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
      )
    ) {
      uniformCount++;
    }
  }

  return (uniformCount / data.length) * 100;
}

// Smart encoding based on structure
export function encodeSmart(data: unknown, options?: { preferToON?: boolean }): string {
  if (Array.isArray(data) && data.length > 0) {
    const eligibility = detectTabularEligibility(data);

    if (eligibility > 60 && options?.preferToON !== false) {
      // Use TOON for highly uniform arrays
      return encode(data);
    }
  }

  // Fallback to JSON-compact for nested/non-uniform structures
  return JSON.stringify(data);
}

// Encode large datasets with streaming
export async function encodeLargeDataset(data: unknown[], outputPath: string): Promise<void> {
  const fileStream = fs.createWriteStream(outputPath);
  const lines = encodeLines(data);

  for (const line of lines) {
    fileStream.write(`${line}\n`);
  }

  fileStream.end();
}
```

### Integration Strategy

**For our tokens package:**

1. **Add TOON as encoding option:**

   ```typescript
   export interface EncodingFormat {
     type: "json" | "json-compact" | "toon" | "yaml";
   }

   export function encodeData(
     data: unknown,
     format: EncodingFormat,
     options?: EncodingOptions,
   ): string {
     switch (format.type) {
       case "toon":
         return encode(data, options);
       case "json-compact":
         return JSON.stringify(data);
       default:
         return JSON.stringify(data, null, 2);
     }
   }
   ```

2. **Auto-detect optimal format:**

   ```typescript
   function selectOptimalFormat(data: unknown, context: EncodingContext): EncodingFormat {
     const eligibility = detectTabularEligibility(data);

     if (eligibility > 60 && context.tokenBudget < 50000) {
       // Use TOON for uniform arrays when token budget tight
       return { type: "toon" };
     }

     if (context.tokenBudget < 20000) {
       // Use JSON-compact for tight budgets on nested data
       return { type: "json-compact" };
     }

     // Default to pretty JSON for readability
     return { type: "json" };
   }
   ```

3. **Part of the compression pipeline:**
   - Step 1: Apply caveman compression to natural language
   - Step 2: Encode structured data with optimal format (TOON or JSON)
   - Step 3: Token count
   - Step 4: Validate and return result

This approach gives us the best of both worlds: proven 76.4% accuracy with ~40% token savings on structured data, while maintaining fallback strategies for edge cases.

### Key Takeaways for Implementation Plan

1. **Use @toon-format/toon package** - don't reimplement from scratch
2. **TOON excels on uniform arrays** - use selectively based on eligibility detection
3. **Fallback to JSON-compact** for nested/non-uniform structures
4. **Streaming support** - critical for large datasets
5. **Measurement** - use o200k_base tokenizer for accurate counting
6. **LLM integration** - wrap in `toon` code blocks, show examples not descriptions
