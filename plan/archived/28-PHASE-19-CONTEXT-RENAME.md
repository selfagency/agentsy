# Phase 19 — Rename @agentsy/context → @agentsy/context

**Effort:** ~1h  
**Milestone:** Package name reflects actual responsibility; all consumers updated  
**Packages:** `@agentsy/context` (renamed), `@agentsy/memory`, `@agentsy/cli`, `@agentsy/prompts`, all plan documents  
**Gate:** `pnpm check-types` passes monorepo-wide; no remaining `@agentsy/context` references  
**Next:** Phase 20 (Tokenomics)

---

## Rationale

`@agentsy/context` is a misleading name. The package does not count tokens in isolation — it manages the **context window**: output compression, conversation truncation, budget allocation, pacing, and rate limiting. The name `@agentsy/context` is precise, aligns with Anthropic's "context engineering" framing, and eliminates the confusion between "token counting" (which is spread across multiple packages) and "context management" (which is the exclusive responsibility of this package).

The rename is purely mechanical. No API changes, no behavioral changes.

---

## Scope of Change

### 1. Package directory

```bash
mv packages/context packages/context
```

### 2. package.json

```diff
- "name": "@agentsy/context"
+ "name": "@agentsy/context"
  "description": "Context window management: output compression, conversation truncation, budget allocation, and pacing"
  "directory": "packages/context"
```

### 3. Consumer updates (3 files)

| File                                                    | Change                               |
| ------------------------------------------------------- | ------------------------------------ |
| `packages/memory/src/retrieval/rag/context-packer.ts:1` | `import ... from '@agentsy/context'` |
| `packages/cli/tsup.config.ts:7`                         | Add `'@agentsy/context'` to external |
| `packages/cli/src/index.ts:4-5`                         | `import ... from '@agentsy/context'` |

### 4. Dependency declarations (2 package.json files)

| File                           | Change                              |
| ------------------------------ | ----------------------------------- |
| `packages/memory/package.json` | `"@agentsy/context": "workspace:*"` |
| `packages/cli/package.json`    | `"@agentsy/context": "workspace:*"` |

### 5. DCP plan document

`plan/21-DCP-PATTERNS-TOKENS.md` — update title and all `@agentsy/context` references to `@agentsy/context`. The DCP work (compress tool, dedup, nudge, turn protection) moves to `@agentsy/context` — this is correct since all DCP patterns are context management, not tokenomics.

### 6. Authority architecture document

`plan/00-AUTHORITY-ARCHITECTURE.md`:

- Layer model table: `@agentsy/context` → `@agentsy/context`
- Data flow diagram: update package reference
- Phase matrix: update `@agentsy/context` entry

### 7. All other plan documents

```bash
# Mechanical find-and-replace across all plan/ files:
grep -rl "@agentsy/context" plan/ | xargs sed -i 's/@agentsy\/tokens/@agentsy\/context/g'
```

### 8. `pnpm-workspace.yaml` / `pnpm-lock.yaml`

No explicit entry needed — workspace references use `workspace:*` which resolves by directory name. After renaming the directory, `pnpm install` regenerates the lockfile correctly.

---

## TASK-CTX-001: Execute rename

**Effort:** 1h  
**Sequence:**

```bash
# 1. Rename directory
mv packages/context packages/context

# 2. Update package.json
sed -i 's/"@agentsy\/tokens"/"@agentsy\/context"/' packages/context/package.json
sed -i 's/packages\/tokens/packages\/context/' packages/context/package.json

# 3. Update IMPLEMENTATION-PLAN.md header
sed -i 's/@agentsy\/tokens/@agentsy\/context/g' packages/context/IMPLEMENTATION-PLAN.md

# 4. Update consumers
sed -i 's/@agentsy\/tokens/@agentsy\/context/g' \
  packages/memory/src/retrieval/rag/context-packer.ts \
  packages/memory/package.json \
  packages/cli/src/index.ts \
  packages/cli/tsup.config.ts \
  packages/cli/package.json

# 5. Update plan documents
grep -rl "@agentsy/context" plan/ | xargs sed -i 's/@agentsy\/tokens/@agentsy\/context/g'

# 6. Regenerate lockfile
pnpm install

# 7. Verify
pnpm check-types
pnpm test
```

---

## Quality Gates

- ✅ `pnpm check-types` passes monorepo-wide
- ✅ `pnpm test` all packages green
- ✅ `grep -r "@agentsy/context" packages/ plan/` returns zero results
- ✅ `packages/context/` directory exists, `packages/context/` does not
- ✅ IMPLEMENTATION-PLAN.md in `packages/context/` updated

---

**Next phase:** `29-PHASE-20-TOKENOMICS.md`
