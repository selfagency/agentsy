# CLI Surface — cmux Integration (Optional Add-On)

**Status:** Optional; discovery-gated  
**Effort:** If implemented: ~8 hours  
**Scope:** Terminal multiplexing integration

---

## Overview

Optional integration with cmux for multi-pane terminal workflows. Discovery-gated: only exposed if cmux detected.

---

## TASK-CLI-021: cmux Integration Contracts

```typescript
// packages/cli/src/cmux/transport.ts
export interface CmuxTransport {
  isCmux(): boolean;
  getCapabilities(): CmuxCapabilities;
  postNotification(message: StatusUpdate): void;
  requestPane(spec: PaneRequest): Promise<string>;
}

export interface CmuxCapabilities {
  version: string;
  supportsMultiPane: boolean;
  supportsSidebar: boolean;
  supportsWorkspace: boolean;
}

export async function detectCmux(): Promise<CmuxTransport | null> {
  const socketPath = process.env.CMUX_SOCKET_PATH;
  if (!socketPath) return null;

  try {
    const client = await connectToCmux(socketPath);
    const caps = await client.capabilities();
    return new CmuxTransport(client, caps);
  } catch {
    return null;
  }
}
```

---

## TASK-CLI-022: Native cmux Commands

```bash
/cmux status                  # Current workspace/surface
/cmux workspace              # List workspaces
/cmux surface                # List panes/surfaces
/cmux notify \"message\"       # Send notification to sidebar

# Auto-context when running inside cmux:
# Agent can access: CMUX_WORKSPACE_ID, CMUX_SURFACE_ID, CMUX_SOCKET_PATH
```

---

## TASK-CLI-026/027: Subagent-Pane Orchestration

When agent wants to spawn subagents in separate panes:

```typescript
export async function orchestrateWithPanes(agent: Agent, task: string, layout: 'grid' | 'main-vertical') {
  const panes = [];

  for (const subagent of agent.subagents) {
    const paneId = await cmux.requestPane({
      label: subagent.name,
      layout,
      minWidth: 40,
      minHeight: 10
    });

    panes.push({
      subagent,
      paneId,
      status: 'initializing'
    });
  }

  // Execute in parallel
  const results = await Promise.all(panes.map(p => runInPane(p.paneId, p.subagent, task)));

  return results;
}
```

---

## TASK-CLI-023..025, 028..031: Discovery + Security

**Discovery-gating:**

```typescript
// /cmux commands hidden if cmux not detected
if (!cmux.isCmux()) {
  // Hide cmux-specific commands
  commandRegistry.disable(['/cmux', '/pane', '/workspace']);
}
```

**Default least privilege:**

- `/cmux processes only` (default) — Can only manage own processes
- `/cmux off` — Disable cmux integration entirely
- Never silently force `allowAll`

**Failure modes tested:**

- Socket permission denied
- Stale socket (reconnect)
- Unsupported methods (fallback)
- tmux-compat env interop

---

## Optional Status

Implement only if:

- ✅ Core CLI (Phase 2-12) GA-ready
- ✅ User demand demonstrated
- ✅ cmux v1.0+ stable

Defer to Phase 12.5 or later release.

---
