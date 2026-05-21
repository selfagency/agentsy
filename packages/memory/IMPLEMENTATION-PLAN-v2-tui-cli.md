# Implementation Plan: Interactive Memory Management (TUI + CLI)

## Context

After reviewing two reference implementations — [`agentmemory`](https://github.com/rohitg00/agentmemory) (15.1k⭐, web viewer + rich CLI) and [`memelord`](https://github.com/glommer/memelord) (172⭐, weight-based CLI) — we need to add interactive memory management capabilities to `@agentsy/memory`. The existing v2 implementation has a full 7-phase cognitive architecture but **no way for a human to browse, read, add, edit, or delete memories** outside of programmatic API calls or MCP tool invocations.

## Goals

1. **CLI commands** for non-interactive memory CRUD operations (list, get, add, edit, delete, search, stats, lint)
2. **TUI** (using `ink` components from `@agentsy/renderers`) for interactive memory browsing, editing, and management
3. **Leverage existing architecture** — build on top of `MemoryEngine`, `MemoryTierLike`, and the oclif CLI framework already in place

---

## Phase 1: Core Engine Enhancements

The current `MemoryTierLike` and `MemoryEngine` APIs support `ingest`, `recall`, `awaken`, `snapshot`, `stats`, and `reset`. They do **not** support per-item mutation or deletion.

### New `MemoryTierLike` methods

```typescript
// In packages/memory/src/cognitive/memory-tier.ts
export interface MemoryTierLike {
  // ... existing methods ...
  get(id: string): MemoryItem | undefined;
  update(
    id: string,
    updates: Partial<Pick<MemoryItem, 'content' | 'importance' | 'metadata' | 'kind'>>
  ): MemoryItem | null;
  remove(id: string): MemoryItem | null;
}
```

### New `MemoryEngine` methods

```typescript
// In packages/memory/src/cognitive/memory-engine.ts
export interface MemoryEngine {
  // ... existing methods ...
  get(id: string): MemoryItem | undefined;
  search(query: string, options?: { tiers?: TierName[]; limit?: number }): MemoryItem[];
  update(id: string, updates: Partial<Pick<MemoryItem, 'content' | 'importance' | 'metadata' | 'kind'>>): boolean;
  delete(id: string): boolean;
}
```

### Implementation details

- `tier.get(id)` — O(1) lookup via the internal `Map<string, MemoryItem>`
- `tier.remove(id)` — Deletes from map, updates `usedTokens`, returns the removed item or `null`
- `tier.update(id, updates)` — Validates updates (e.g., `importance` clamped to `[0, 1]`), re-computes token count if `content` changed, re-fingerprints content, returns updated item or `null`
- `engine.get(id)` — Searches all tiers for the item
- `engine.search(query)` — Content substring match across all tiers, sorted by importance. No vector/BM25 for now — we can add semantic search later.
- `engine.update(id, updates)` — Finds item in any tier, applies updates, handles token budget changes (reclaims or allocates as needed)
- `engine.delete(id)` — Finds item in any tier, removes it, releases budget tokens

### Tests

- `memory-tier.test.ts` — Add tests for `get`, `remove`, `update`
- `memory-engine.test.ts` — Add tests for `get`, `search`, `update`, `delete`

---

## Phase 2: MCP Tool Updates

The existing MCP tools (`memory_ingest`, `memory_recall`, `memory_awaken`, `memory_stats`, `memory_lint`, `memory_list`, `memory_search`, `memory_capture`) are read-only or create-only. Update them to support mutation.

### Tool changes

| Tool            | Current                   | New                                        |
| --------------- | ------------------------- | ------------------------------------------ |
| `memory_list`   | Lists with filters        | Add `--id` flag to get single item         |
| `memory_search` | Alias for `memory_recall` | Proper content substring search            |
| `memory_delete` | Does not exist            | New tool: delete by ID                     |
| `memory_edit`   | Does not exist            | New tool: edit content/importance/metadata |

### Implementation

- `src/mcp/tools.ts` — Add `memory_delete` and `memory_edit` handlers
- `src/mcp/tools.test.ts` — Add tests for new tools

---

## Phase 3: CLI Commands (non-interactive)

Add new oclif commands as top-level commands (no topic namespace). These are the non-interactive, scriptable interface.

### Command list

| Command                         | Description                 | Key flags                                                                               |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- | ------ |
| `agentsy-memory list`           | List all memories           | `--tier`, `--kind`, `--min-importance`, `--limit`, `--format=json                       | table` |
| `agentsy-memory get <id>`       | Get a single memory by ID   | `--format=json                                                                          | table` |
| `agentsy-memory add`            | Add a memory                | `--content`, `--importance`, `--kind`, `--tier`, `--metadata` (interactive if no flags) |
| `agentsy-memory delete <id>`    | Delete a memory             | `--force` (skip confirm)                                                                |
| `agentsy-memory edit <id>`      | Edit a memory               | `--content`, `--importance`, `--kind`, `--metadata` (interactive if no flags)           |
| `agentsy-memory search <query>` | Search by content substring | `--tier`, `--limit`, `--format=json                                                     | table` |
| `agentsy-memory stats`          | Show engine stats           | `--format=json                                                                          | table` |
| `agentsy-memory lint`           | Run health checks           | `--format=json                                                                          | table` |
| `agentsy-memory browse`         | Launch the TUI browser      | —                                                                                       |

### Implementation

- `src/commands/list.ts` — oclif command
- `src/commands/get.ts` — oclif command
- `src/commands/add.ts` — oclif command
- `src/commands/delete.ts` — oclif command
- `src/commands/edit.ts` — oclif command
- `src/commands/search.ts` — oclif command
- `src/commands/stats.ts` — oclif command
- `src/commands/lint.ts` — oclif command
- `src/commands/browse.ts` — oclif command (thin wrapper that launches the TUI)

### Table output format

Use a simple terminal table format (or a lightweight library if we want to add one). For now, plain text with columns:

```text
ID          TIER                KIND      IMPORTANCE  TOKENS  CONTENT
mem-1       working_memory      episodic  0.85        12      User prefers dark mode
mem-2       long_term_memory    semantic  0.72        45      Auth middleware uses jose library
```

---

## Phase 4: TUI (using `@agentsy/renderers` ink components)

The TUI is the star feature. It provides an interactive, keyboard-driven interface for managing memories without leaving the terminal.

### Architecture

```text
src/tui/
├── app.tsx                 # Main Ink app component (manages screen state)
├── index.ts                # Entry point — launches the Ink renderer
├── screens/
│   ├── dashboard.tsx       # Overview: tier stats, recent memories, health
│   ├── list.tsx            # Scrollable memory list with keyboard nav
│   ├── detail.tsx          # Full memory view with metadata
│   ├── search.tsx          # Live search input + results
│   ├── editor.tsx          # Inline memory editor (content + importance)
│   └── confirm.tsx         # Confirmation dialogs (delete, etc.)
├── components/
│   ├── memory-row.tsx      # Single memory row (ID, tier, importance, preview)
│   ├── tier-badge.tsx      # Colored tier name badge
│   ├── importance-bar.tsx  # Visual importance indicator
│   ├── status-bar.tsx      # Bottom status bar (key hints, current tier)
│   ├── scrollable-list.tsx # Reusable scrollable list with selection
│   └── search-input.tsx    # Search box with live filtering
├── hooks/
│   ├── use-memory-engine.ts    # Hook that provides engine instance
│   ├── use-memory-list.ts      # Hook that fetches/searches memories
│   ├── use-keyboard-navigation.ts # Arrow keys, enter, delete, etc.
│   └── use-screen.ts           # Screen routing state
└── theme.ts                # Colors, borders, spacing (reuse @agentsy/renderers themes)
```

### Screen details

#### Dashboard (`dashboard.tsx`)

```text
┌─────────────────────────────────────────┐
│  @agentsy/memory — Dashboard            │
├─────────────────────────────────────────┤
│  Tiers                                  │
│  ┌─────────────┐ ┌─────────────┐       │
│  │ Sensory     │ │ Working     │       │
│  │ 12/50 items │ │ 5/7 items   │       │
│  │ 45% full    │ │ 71% full    │       │
│  └─────────────┘ └─────────────┘       │
│                                         │
│  Recent Memories                        │
│  ┌─────────────────────────────────────┐│
│  │ mem-42  working  0.92  "Auth..."   ││
│  │ mem-41  short    0.67  "Rate..."   ││
│  │ mem-40  sensory  0.55  "Bug..."    ││
│  └─────────────────────────────────────┘│
│                                         │
│  Health: ✓ All tiers operational        │
│  Budget: 34% utilized                   │
│                                         │
│  [L] List  [S] Search  [A] Add  [?] Help│
└─────────────────────────────────────────┘
```

#### List (`list.tsx`)

- Scrollable list of all memories
- Keyboard: `↑/↓` to navigate, `Enter` to view detail, `e` to edit, `d` to delete (with confirm), `s` to search, `q` to quit
- Filter bar at top: `[All tiers] [All kinds] [min importance: 0]` — cycle with `Tab`
- Sort: `i` importance, `t` time, `k` kind

#### Detail (`detail.tsx`)

```text
┌─────────────────────────────────────────┐
│  Memory: mem-42                         │
├─────────────────────────────────────────┤
│  Tier:     working_memory               │
│  Kind:     episodic                     │
│  Importance: ████████░░ 0.82            │
│  Tokens:   23                           │
│  Created:   2026-05-20T14:32:01Z        │
│  Accessed:  2026-05-20T14:35:12Z (3x)   │
│  Fingerprint: a3f7...                   │
│                                         │
│  Content:                               │
│  ┌─────────────────────────────────────┐│
│  │ User prefers dark mode with high    ││
│  │ contrast settings. Mentioned this   ││
│  │ in session 3.                       ││
│  └─────────────────────────────────────┘│
│                                         │
│  Metadata:                              │
│  ┌─────────────────────────────────────┐│
│  │ sessionId: "sess-7"                  ││
│  │ source: "on-response"               ││
│  └─────────────────────────────────────┘│
│                                         │
│  [E] Edit  [D] Delete  [B] Back  [?] Help│
└─────────────────────────────────────────┘
```

#### Search (`search.tsx`)

- Live search input at top (content substring)
- Results update as you type
- Same list navigation as `list.tsx`
- `Ctrl+C` or `Esc` to clear/close

#### Editor (`editor.tsx`)

- Text area for content editing (multiline)
- Slider or numeric input for importance `[0.00 - 1.00]`
- Dropdown/select for kind (`episodic`, `semantic`, `procedural`, `factual`)
- Key-value editor for metadata (JSON)
- `Ctrl+S` to save, `Ctrl+C` or `Esc` to cancel

### Component reuse from `@agentsy/renderers`

| New component         | Reuses from renderers                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `scrollable-list.tsx` | `keyboard-handler.tsx` logic, `conversation-history.tsx` scroll patterns |
| `search-input.tsx`    | `streaming-text.tsx` live update patterns                                |
| `status-bar.tsx`      | `ink-runtime-state.ts` theme system                                      |
| `memory-row.tsx`      | `thinking-block.tsx` compact info display patterns                       |
| `dashboard.tsx`       | `tool-call-block.tsx` structured data display                            |

### Theme

Reuse `@agentsy/renderers/src/ink/themes/` for colors. Define memory-specific semantic colors:

```typescript
const memoryTheme = {
  tierColors: {
    sensory_buffer: '#ff6b6b',
    sensory_register: '#feca57',
    working_memory: '#48dbfb',
    short_term_memory: '#1dd1a1',
    long_term_memory: '#5f27cd'
  },
  importanceGradient: ['#ff4757', '#ffa502', '#2ed573'] // low → medium → high
  // ... plus base renderer theme colors
};
```

---

## Phase 5: Package Wiring

### New entry points

Add to `tsup.config.ts`:

```typescript
entry: {
  // ... existing entries ...
  'tui': 'src/tui/index.ts',
  'commands/memory/list': 'src/commands/memory/list.ts',
  'commands/memory/get': 'src/commands/memory/get.ts',
  'commands/memory/add': 'src/commands/memory/add.ts',
  'commands/memory/delete': 'src/commands/memory/delete.ts',
  'commands/memory/edit': 'src/commands/memory/edit.ts',
  'commands/memory/search': 'src/commands/memory/search.ts',
  'commands/memory/stats': 'src/commands/memory/stats.ts',
  'commands/memory/lint': 'src/commands/memory/lint.ts',
  'commands/memory/browse': 'src/commands/memory/browse.ts',
}
```

Add to `package.json` exports:

```json
{
  "./tui": {
    "types": "./dist/tui.d.ts",
    "import": "./dist/tui.js",
    "require": "./dist/tui.cjs"
  }
}
```

### Dependencies

The TUI depends on `ink` and `@agentsy/renderers`. Check if `ink` is already in the workspace.

```json
{
  "dependencies": {
    "@agentsy/renderers": "workspace:*",
    "ink": "^5.0.0",
    "react": "^18.3.0"
  }
}
```

> Note: `@agentsy/renderers` already depends on `ink` and `react`. We can either re-export from renderers or add direct deps. Prefer workspace re-exports to avoid version drift.

---

## Phase 6: Testing

### Unit tests

| File                     | What to test                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `memory-tier.test.ts`    | `get`, `remove`, `update` edge cases (missing ID, expired items, budget changes) |
| `memory-engine.test.ts`  | `get`, `search`, `update`, `delete` cross-tier behavior                          |
| `mcp/tools.test.ts`      | `memory_delete`, `memory_edit` tool handlers                                     |
| `commands/*.test.ts`     | oclif command argument parsing, output formatting, error handling                |
| `tui/screens/*.test.tsx` | Ink component rendering with `ink-testing-library`                               |
| `tui/hooks/*.test.ts`    | Hook behavior (keyboard navigation, search debouncing, screen routing)           |

### Integration tests

- `tui/app.test.tsx` — Full TUI flow: open → list → search → detail → edit → save → delete → confirm
- CLI command integration — Run command, assert stdout format

---

## Phase 7: Documentation

Update `SKILL.md` to document the new CLI and TUI features:

````markdown
## CLI Memory Management

### Non-interactive commands

```bash
agentsy-memory list --tier working_memory --limit 10
agentsy-memory get mem-42
agentsy-memory add --content "User prefers Vim" --importance 0.9 --kind semantic
agentsy-memory delete mem-42 --force
agentsy-memory search "dark mode"
agentsy-memory stats
```
````

### Interactive TUI

```bash
agentsy-memory browse
```

Keyboard shortcuts:

- `↑/↓` — Navigate list
- `Enter` — View memory detail
- `e` — Edit selected memory
- `d` — Delete selected memory (with confirmation)
- `s` — Search
- `a` — Add new memory
- `q` / `Esc` — Quit/back
- `?` — Help

```text

---

## File Structure

```

packages/memory/src/
├── cognitive/
│ ├── memory-tier.ts # + get, remove, update
│ ├── memory-engine.ts # + get, search, update, delete
│ └── ... # (existing files)
├── mcp/
│ ├── tools.ts # + memory_delete, memory_edit
│ └── ... # (existing files)
├── commands/
│ ├── list.ts
│ ├── get.ts
│ ├── add.ts
│ ├── delete.ts
│ ├── edit.ts
│ ├── search.ts
│ ├── stats.ts
│ ├── lint.ts
│ ├── browse.ts # launches TUI
│ └── ... # (existing files)
├── tui/
│ ├── app.tsx
│ ├── index.ts
│ ├── theme.ts
│ ├── screens/
│ │ ├── dashboard.tsx
│ │ ├── list.tsx
│ │ ├── detail.tsx
│ │ ├── search.tsx
│ │ ├── editor.tsx
│ │ └── confirm.tsx
│ ├── components/
│ │ ├── memory-row.tsx
│ │ ├── tier-badge.tsx
│ │ ├── importance-bar.tsx
│ │ ├── status-bar.tsx
│ │ ├── scrollable-list.tsx
│ │ └── search-input.tsx
│ └── hooks/
│ ├── use-memory-engine.ts
│ ├── use-memory-list.ts
│ ├── use-keyboard-navigation.ts
│ └── use-screen.ts
└── ... # (existing files)

```text

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `ink` + `react` add bundle size | TUI is a separate entry point (`./tui`); CLI commands that don't need it don't pull it in |
| Terminal compatibility | Test on macOS Terminal, iTerm2, VS Code integrated terminal, Windows Terminal. Use `ink`'s built-in graceful fallbacks |
| oclif command discovery latency | 9 new top-level commands; oclif lazy-loads command modules, so startup cost is minimal |
| Memory tier `Map` mutation races | `update` and `delete` are synchronous; no async races in current architecture |
| Exact optional property types | Follow existing pattern: build options objects conditionally, never pass `undefined` explicitly |

---

## Success Criteria

- [ ] `agentsy-memory list` lists memories in a readable table
- [ ] `agentsy-memory browse` opens an interactive TUI
- [ ] In the TUI, a user can navigate, search, view, edit, add, and delete memories without using the mouse
- [ ] All new engine methods have unit tests
- [ ] All new MCP tools have unit tests
- [ ] All new oclif commands have unit tests
- [ ] TUI components have rendering tests with `ink-testing-library`
- [ ] `pnpm check-types` and `pnpm test` pass
- [ ] `SKILL.md` is updated with new CLI/TUI documentation
```
