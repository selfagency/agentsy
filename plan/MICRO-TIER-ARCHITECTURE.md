# Micro-Tier Multi-Platform Architecture

## Phase 17 — Micro-Tier Local Offload (NPU & Accelerator-First)

---

## Platform-Tier Mapping

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Capability Tier Model                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Tier: micro      small        mid           frontier                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  Scope: Cheap,    Capable,     Powerful,     Frontier                   │
│         local,    local or     cloud or      cloud                      │
│         fast,     small-cloud  large-cloud   (GPT-5, Claude)            │
│         good-     (7B-14B)     (30B-70B)                                │
│         enough                                                          │
│                                                                          │
│  Tasks: classify  reason       multi-hop     original                   │
│         extract   code         reasoning     research                   │
│         summ.     complex       math                                     │
│         tag       tasks        world-know                               │
│         revise                                                          │
│         title                                                           │
│         repair                                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Platform-Specific Micro-Tier Backends

### macOS + Apple Silicon

```text
┌──────────────────────────────────────────────────────────┐
│  macOS + Apple Silicon (arm64)                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Preferred Backend: Apfel                               │
│  ├─ Model: Apple Foundation Model (~3B)                 │
│  ├─ Accelerator: Apple Neural Engine (NE)               │
│  ├─ API: OpenAI-compatible HTTP                         │
│  ├─ Port: 11434 (configurable via APFEL_BASE_URL)       │
│  ├─ Context: ~4,096 tokens (3,000 safe budget)          │
│  ├─ Cost: $0 (on-device)                                │
│  └─ Latency: <500ms first token                         │
│                                                          │
│  Fallback 1: Ollama (if running)                        │
│  ├─ Model: llama3.2:3b or similar                       │
│  ├─ Accelerator: Metal GPU (if available)               │
│  ├─ API: OpenAI-compatible HTTP                         │
│  └─ Port: 11434 (configurable)                          │
│                                                          │
│  Fallback 2: Cloud small-tier                           │
│  └─ (if no local backends available)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Windows + NPU / GPU

```text
┌──────────────────────────────────────────────────────────┐
│  Windows 11 (with AI PC / NPU)                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Preferred Backend: Ollama (NPU-accelerated)            │
│  ├─ Model: llama3.2:3b or qwen2.5:3b (Q4/Q5 GGUF)       │
│  ├─ Accelerator: NPU (Snapdragon X, Intel AI Boost,     │
│  │              AMD XDNA)                               │
│  ├─ API: OpenAI-compatible HTTP                         │
│  ├─ Port: 11434 (configurable via OLLAMA_BASE_URL)      │
│  ├─ Context: 8K–16K tokens (3,000 safe budget)          │
│  ├─ Cost: $0 (on-device)                                │
│  └─ Latency: <1s first token (NPU-accelerated)          │
│                                                          │
│  Fallback 1: LM Studio (if running)                     │
│  ├─ Model: any GGUF (3–7B)                              │
│  ├─ Accelerator: GPU or CPU                             │
│  ├─ API: OpenAI-compatible HTTP                         │
│  └─ Port: 1234 (configurable)                           │
│                                                          │
│  Fallback 2: LocalAI (if running)                       │
│  ├─ Model: any GGUF                                     │
│  ├─ API: OpenAI-compatible HTTP                         │
│  └─ Port: 8080 (configurable)                           │
│                                                          │
│  Fallback 3: Cloud small-tier                           │
│  └─ (if no local backends available)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Windows + GPU (no NPU)

```text
┌──────────────────────────────────────────────────────────┐
│  Windows 11 (with NVIDIA/AMD GPU, no NPU)                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Preferred Backend: Ollama (GPU-accelerated)            │
│  ├─ Model: llama3.2:3b or qwen2.5:3b (Q4/Q5 GGUF)       │
│  ├─ Accelerator: GPU (NVIDIA CUDA or AMD ROCm)          │
│  ├─ API: OpenAI-compatible HTTP                         │
│  ├─ Port: 11434 (configurable)                          │
│  ├─ Context: 8K–16K tokens (3,000 safe budget)          │
│  ├─ Cost: $0 (on-device)                                │
│  └─ Latency: <1s first token (GPU-accelerated)          │
│                                                          │
│  Fallback 1: LM Studio (if running)                     │
│  Fallback 2: LocalAI (if running)                       │
│  Fallback 3: Cloud small-tier                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Linux + GPU / CPU

```text
┌──────────────────────────────────────────────────────────┐
│  Linux (with GPU or CPU)                                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Preferred Backend: Ollama (GPU-accelerated)            │
│  ├─ Model: llama3.2:3b or qwen2.5:3b (Q4/Q5 GGUF)       │
│  ├─ Accelerator: GPU (NVIDIA CUDA, AMD ROCm, Intel Arc) │
│  ├─ API: OpenAI-compatible HTTP                         │
│  ├─ Port: 11434 (configurable)                          │
│  ├─ Context: 8K–16K tokens (3,000 safe budget)          │
│  ├─ Cost: $0 (on-device)                                │
│  └─ Latency: <1s first token (GPU-accelerated)          │
│                                                          │
│  Fallback 1: vLLM (if running)                          │
│  ├─ Model: any vLLM-compatible                          │
│  ├─ API: OpenAI-compatible HTTP                         │
│  └─ Port: 8000 (configurable)                           │
│                                                          │
│  Fallback 2: Ollama (CPU mode)                          │
│  ├─ Model: llama3.2:3b or qwen2.5:3b (Q4)               │
│  ├─ Accelerator: CPU (slower but viable)                │
│  └─ Latency: 2–5s first token (CPU)                     │
│                                                          │
│  Fallback 3: Cloud small-tier                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Any Platform (No Accelerators)

```text
┌──────────────────────────────────────────────────────────┐
│  Any platform without accelerators                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Micro-tier backends unavailable                        │
│  ↓                                                       │
│  Escalate to small-tier (7B-14B cloud model)            │
│  ↓                                                       │
│  Escalate to frontier (GPT-5, Claude, etc.)             │
│                                                          │
│  Zero user-visible errors; graceful fallback            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Routing Decision Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Call Site declares: tier: 'micro'                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Orchestrator.routeMicroTask()                                            │
│ ├─ Detect platform (OS, arch, accelerators)                             │
│ ├─ Build fallback chain (Apfel > Ollama > LM Studio > LocalAI > Cloud)  │
│ └─ Try backends in order until healthy                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
        ┌──────────────────────┐      ┌──────────────────────┐
        │ Micro backend found  │      │ No micro backend     │
        │ & healthy            │      │ available            │
        └──────────────────────┘      └──────────────────────┘
                    ↓                               ↓
        ┌──────────────────────┐      ┌──────────────────────┐
        │ Invoke on micro      │      │ Escalate to          │
        │ (Apfel/Ollama/etc.)  │      │ small-tier           │
        └──────────────────────┘      └──────────────────────┘
                    ↓
        ┌──────────────────────┐
        │ Validate output      │
        │ (schema, confidence) │
        └──────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
    ┌────────┐         ┌──────────────┐
    │ Pass   │         │ Fail         │
    └────────┘         └──────────────┘
        ↓                       ↓
    ┌────────┐         ┌──────────────────┐
    │ Return │         │ Repair attempt   │
    │ result │         │ (up to 2x)       │
    └────────┘         └──────────────────┘
                                ↓
                    ┌───────────┴───────────┐
                    ↓                       ↓
                ┌────────┐         ┌──────────────┐
                │ Pass   │         │ Still fail   │
                └────────┘         └──────────────┘
                    ↓                       ↓
                ┌────────┐         ┌──────────────────┐
                │ Return │         │ Escalate to      │
                │ result │         │ next tier        │
                └────────┘         └──────────────────┘
```

---

## Offload Targets (All Routed Through Micro-Tier)

| Target | Package | Use Case | Savings |
|--------|---------|----------|---------|
| Compression | `@agentsy/tokens` | Stale-turn summarization | 50–70% (per summary) |
| Fact Extraction | `@agentsy/memory` | Event log → facts | 30–50% (per chunk) |
| Wiki Synthesis | `@agentsy/memory` | Facts → wiki entries | 20–40% (per synthesis) |
| Guardrail Classification | `@agentsy/guardrails` | Intent/safety gating | 10–20% (per input) |
| Query Rewriting | `@agentsy/retrieval` | HyDE expansion | 5–10% (per query) |
| Chunk Summarization | `@agentsy/retrieval` | Index-time summaries | 20–30% (per chunk) |
| Session Titling | `@agentsy/session` | Auto-title generation | 5–10% (per session) |
| JSON Repair | `@agentsy/core` | Malformed output fix | 10–20% (per repair) |
| CLI Assist | `@agentsy/cli` | Autocomplete, suggestions | 5–10% (per assist) |

**Estimated total savings:** 30–50% reduction in cloud token spend (depends on workload composition).

---

## Config Layering (XDG-Compliant)

```text
Priority (highest → lowest):
1. Session slash override (e.g., /micro prefer ollama)
2. Workspace .agentsy/agentsy.yml
3. User ~/.agentsy/agentsy.yml
4. User ~/.config/agentsy/agentsy.yml
5. Environment variables (APFEL_BASE_URL, OLLAMA_BASE_URL, etc.)
6. Built-in defaults
```

---

## Metrics & Observability

Every offload call emits:

```typescript
{
  target: 'compression' | 'fact-extraction' | ... ,
  backend: 'apfel' | 'ollama' | 'lm-studio' | ... ,
  routedToMicro: number,
  escalated: number,
  tokensOnDevice: number,
  estimatedTokensAvoided: number,
  estimatedUsdAvoided: number
}
```

Aggregated per session → visible in `agentsy micro status` and observability dashboards.

---

## Testing Strategy

- **Unit tests:** Platform detection, backend selection, routing logic
- **Integration tests:** Multi-backend failover, escalation on validation failure
- **aImock fixtures:** All backends (Apfel, Ollama, LM Studio, LocalAI, vLLM)
- **CI:** Fixture-only (no real hardware probing on Linux CI)
- **Scorecard:** Per-target quality metrics (format pass-rate, escalation rate, savings)

---

**Authority:** Phase 17 — Micro-Tier Local Offload (NPU & Accelerator-First)
