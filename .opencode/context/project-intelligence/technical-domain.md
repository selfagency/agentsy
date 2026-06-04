<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.1 | Updated: 2026-06-02 -->

# Technical Domain

Agentsy is a layered TypeScript monorepo for LLM stream parsing, provider normalization, rendering, and runtime orchestration. Treat model output as untrusted input, keep lower layers reusable, and push product-specific logic to outer layers.

The `plan/` folder is the roadmap authority: it defines phase sequencing, package ownership, gates, and future domains like workflows, DCP/context pruning, council mode, and tokenomics.

## Primary Stack

| Layer       | Technology                | Notes                                           |
| ----------- | ------------------------- | ----------------------------------------------- |
| Framework   | pnpm + Turborepo monorepo | Workspace-driven package layout                 |
| Language    | TypeScript (strict)       | ESM-first, `.js` extensions in relative imports |
| Runtime     | Node.js 22+               | Repo baseline and CI target                     |
| Lint/format | Ultracite / Biome         | Strict code quality and formatting              |
| Testing     | Vitest                    | Colocated tests beside source                   |

## API Pattern

- Prefer small factory functions for public entry points.
- Validate inputs early; throw `Error` with descriptive messages for invalid configuration.
- Normalize provider-specific payloads before core processing.
- Use `async/await`, `try/catch`, and recoverable warnings for malformed streams.

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = schema.parse(body);
    return Response.json({ ok: true, input });
  } catch (error) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

## Component Pattern

- Use function components over class components.
- Keep components focused; do not define nested components inside render functions.
- Prefer semantic HTML, accessible labels, and explicit props interfaces.
- Keep UI/rendering code at the edges; core parsing stays framework-agnostic.

```tsx
interface StatusProps {
  label: string;
  tone: "ok" | "warn";
}

export function StatusBadge({ label, tone }: StatusProps) {
  return (
    <span data-tone={tone} className="rounded px-2 py-1">
      {label}
    </span>
  );
}
```

## Naming Conventions

| Type               | Convention               | Example                    |
| ------------------ | ------------------------ | -------------------------- |
| Files              | kebab-case               | `llm-stream-processor.ts`  |
| Components         | PascalCase               | `AgentPicker`              |
| Functions          | camelCase                | `createStreamEventAdapter` |
| Types / interfaces | PascalCase               | `ProcessorOptions`         |
| Packages           | scoped / subpath exports | `@agentsy/core/processor`  |

## Code Standards

- Type-safe by default; prefer `unknown` over `any`.
- Use `const` by default, destructuring, optional chaining, and nullish coalescing.
- Keep parsing bounded and defensive; partial or malformed output should degrade gracefully.
- Colocate tests with source and cover chunk boundaries, incomplete input, and recovery paths.
- Prefer focused modules over broad barrel exports.

## Security Requirements

- Treat all model/provider input as untrusted.
- Validate and sanitize user input before use or rendering.
- Avoid `dangerouslySetInnerHTML`, `eval()`, and unsafe cookie writes.
- Use parameterized / schema-validated inputs for data operations.
- Preserve privacy scrubbing and bounded parsing limits.

## Plan / Roadmap Signals

- **Authority docs**: `plan/INDEX.md`, `plan/00-EXECUTIVE-SUMMARY.md`, `plan/00-AUTHORITY-ARCHITECTURE.md`
- **Current gates**: Phase 2 = first dogfoodable TUI slice; Phase 4 = gate before tools; Phase 9 = gate before GA
- **Verified reality**: Phase 0 and R1 are complete; Phase 1 is ready; many later phases are planned only
- **Future domains**: workflows, DCP/context pruning, aImock, ECC, external adoptions, council mode, small-model parity, context rename, tokenomics
- **Package direction**: current packages are stable; future docs may rename `@agentsy/context` to `@agentsy/context`

## 📂 Codebase References

- `packages/core/src/processor/llm-stream-processor.ts` — stream processor, warnings, recovery, tool-call handling
- `packages/core/src/structured/parse-json.ts` — bounded JSON parsing and repair
- `packages/core/src/xml-filter/xml-stream-filter.ts` — XML scrubbing and nesting limits
- `packages/providers/src/normalizers/*.ts` — provider-specific normalization layer
- `packages/providers/src/request-path.ts` — request-path orchestration and provider selection
- `packages/renderers/src/ink/**/*.tsx` — Ink component patterns and UI boundaries
- `packages/renderers/src/shared.ts` — shared renderer/event plumbing
- `packages/core/src/recovery/index.ts` — continuation and stream-state recovery

## Related Docs

- `plan/INDEX.md`
- `plan/00-EXECUTIVE-SUMMARY.md`
- `plan/00-AUTHORITY-ARCHITECTURE.md`
- `plan/17-GOVERNANCE-QUALITY-GATES.md`
- `plan/21-DCP-PATTERNS-TOKENS.md`
- `plan/23-PHASE-14-EXTERNAL-ADOPTIONS.md`
- `plan/24-PHASE-15-COUNCIL-MODE.md`
- `plan/25-PHASE-16-SMALL-MODEL-PARITY.md`
- `plan/28-PHASE-19-CONTEXT-RENAME.md`
- `plan/29-PHASE-20-TOKENOMICS.md`
- `docs/index.md`
- `docs/architecture/index.md`
- `docs/architecture/stream-processing.md`
- `docs/packages.md`
- `docs/developer-guide.md`
- `docs/testing-msw-patterns.md`
- `docs/migration/index.md`
