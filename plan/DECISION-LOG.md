# Architecture Decision Log

## Overview
This document captures key architectural decisions made during the architecture lock phase (2025-05-07) to reconcile the existing 40-package state with the corrected 7-layer architecture.

## Core Architectural Decisions

### 1. Layer Structure Decision
**Date:** 2025-05-07  
**Decision:** Adopt 7 distinct layers instead of monolithic "agent" abstraction  
**Rationale:** Clear separation of concerns, better maintainability, aligned with existing codebase  
**Layers:** Core → Runtime → Provider → Knowledge → Tooling → Interop/Plugin → Presentation

### 2. Package Consolidation Strategy
**Date:** 2025-05-07  
**Decision:** Focus on boundary clarity over drastic count reduction  
**Rationale:** Avoid high migration cost while achieving architectural improvements  
**Approach:** Aggressive consolidation of provider/tool/presentation layers only

### 3. Core Package Cluster Decision
**Date:** 2025-05-07  
**Decision:** Keep 10 core packages separate for now, plan future `core` umbrella with subpaths  
**Rationale:** Lower migration risk while preserving future consolidation option  
**Packages:** types, xml-filter, context, formatting, sse, thinking, structured, tool-calls, processor, recovery

## Package-Specific Decisions

### Merges Approved

| Old Package | New Package | Date | Rationale |
|-------------|-------------|------|-----------|
| extension-vscode | vscode | 2025-05-07 | Clean composition, no reason for separation |
| renderer-gui | renderers | 2025-05-07 | Good fit for subpaths and display targets |
| context-manager | context | 2025-05-07 | Overlaps with context window events |
| runtime | agentic-loop | 2025-05-07 | Runtime concerns belong in loop engine |
| ag-ui | ui | 2025-05-07 | UI components should be unified |
| pacing | tokens | 2025-05-07 | Token budgeting is natural fit |

### Renames Approved

| Old Name | New Name | Date | Migration Strategy |
|----------|----------|------|-------------------|
| agent | agentic-loop | 2025-05-07 | Clearer boundary for loop engine |
| token-economy | tokens | 2025-05-07 | Migration alias during transition |

### Splits/Reorganizations Approved

| Package | Split Direction | Date | Details |
|---------|----------------|------|---------|
| providers | Absorb normalizers + adapters | 2025-05-07 | Provider-specific subfolders |
| tool-calls | Split to tools + providers | 2025-05-07 | Tool schemas to tools, provider calls to providers |

### Preservation Decisions

| Package | Decision | Date | Rationale |
|---------|----------|------|-----------|
| secrets | Keep standalone | 2025-05-07 | Cross-cutting infrastructure, not provider-specific |
| subagents | Keep separate from a2a | 2025-05-07 | Local orchestration vs remote protocol layers |
| agents | Keep as plugin surface | 2025-05-07 | Plugins are one layer, orchestration is different |
| memory | Keep separate from retrieval | 2025-05-07 | Storage vs retrieval are distinct concerns |

## New Package Creations Approved

| Package | Layer | Purpose | Date |
|---------|-------|---------|------|
| acp-client | Interop | Editor/client control protocol | 2025-05-07 |
| slash-commands | Interop | Command registry + SKILL.md parsing | 2025-05-07 |
| skills | Interop | SkillsManager + progressive loading | 2025-05-07 |

## MCP Strategy Decision

**Date:** 2025-05-07  
**Decision:** MCP servers become internal tools first, standalone MCP only as thin optional bridge  
**Rationale:** Keep implementation simple while preserving external compatibility  
**Implementation:** Internal MCP tools in `tools/mcp-internal`, optional bridge package later

## Rejected Proposals

| Proposal | Rejection Date | Reason |
|----------|----------------|--------|
| Merge secrets into providers | 2025-05-07 | Secrets are cross-cutting infrastructure |
| Combine subagents + a2a | 2025-05-07 | Blurs local vs remote protocol boundaries |
| Drop agents entirely | 2025-05-07 | Plugins and orchestration are different layers |
| Make MCP central abstraction | 2025-05-07 | Tools are primary, MCP is implementation detail |

## Compatibility Strategies

### Migration Aliases
- `token-economy` → `tokens` (temporary alias during transition)
- `agent` → `agentic-loop` (temporary alias during transition)

### Wrapper Packages
- Minimal compatibility wrappers for renamed packages during transition
- Clear deprecation path with migration guides

## Dependencies Between Decisions

1. **Prerequisite:** Core layer decisions (types, context, etc.) must stabilize before runtime layer
2. **Blocked until:** Provider reorganization depends on tools split completion
3. **并行可执行:** Presentation layer merges can happen independently
4. **Co-development:** Runtime group (agentic-loop, runtime, session, tokens) must develop together

## Verification Criteria

Each decision will be verified by:

1. **Build Success:** `pnpm build` succeeds after changes
2. **Type Safety:** `pnpm check-types` passes
3. **Tests Pass:** `pnpm test` passes
4. **No Circular Dependencies:** Dependendency graph is acyclic
5. **Import Paths Updated:** All imports match new package names

## Superseded Documents

The following documents are superseded by this decision log:

- Original scaffold plan (44-package target)
- Previous architecture drafts with agent-centric design
- Any plan documents suggesting desktop app development
- Documents suggesting secrets merge into providers

## Next Steps

1. Update `plan/MASTER-IMPLEMENTATION-PLAN.md` with these decisions
2. Create package naming map reflecting these decisions
3. Mark superseded documents appropriately
4. Begin Phase 1 package census and scaffold pass