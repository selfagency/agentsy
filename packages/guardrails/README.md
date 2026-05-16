# @agentsy/guardrails

Standalone, pluggable safety and security guardrails for the `@agentsy` platform. Provides input/output moderation pipelines, PII redaction, intent classification, retrieval domain firewalling, token quota enforcement, streaming filters, and regulatory compliance audit trails.

## Installation

```bash
pnpm add @agentsy/guardrails
```

## Policy and governance

Before enabling this package in an agent, review the policy documents that define its operating rules:

- [Ethics](../../ETHICS.md)
- [Safety](../../SAFETY.md)
- [Governance](../../GOVERNANCE.md)
- [Agentsy Constitution](../../docs/constitution.md)

These documents establish the human-rights, safety, privacy, accountability, and review requirements that the guardrails layer is expected to enforce.

## Usage

```typescript
import {
  GuardrailsConfig,
  GuardrailProvider,
  PiiRedactionProvider,
  RetryBlockedError,
} from "@agentsy/guardrails";

async function enforceGuardrails(
  userMessage: string,
  config: GuardrailsConfig
) {
  // PII redaction
  const piiProvider = new PiiRedactionProvider();
  const redactedMessage = await piiProvider.redact(userMessage, [
    "email",
    "phone",
  ]);

  // Token quota enforcement
  if (config.tokenQuota) {
    const currentUsage = await getSessionTokenUsage();
    if (currentUsage > config.tokenQuota.maxSessionTokens) {
      throw new QuotaExceededError("Token quota exceeded for current session");
    }
  }

  // ... additional guardrail enforcement
}
```

## Interfaces

### `GuardrailsConfig`

```typescript
interface GuardrailsConfig {
  providers: string[];
  allowedTopics?: string[];
  blockedTopics?: string[];
  piiRedaction?: boolean;
  tokenQuota?: {
    maxSessionTokens: number;
  };
  retrievalDomains?: string[];
  trustHierarchy?: "system" | "user" | "retrieved";
  egressAllowList?: string[];
  crossUserDataAccess?: boolean;
  stripUntrustedContext?: string;
}
```

### `GuardrailProvider`

Base interface for all guardrail providers. Implementations include:

- `PiiRedactionProvider` - Detects and redacts personal information
- `RegexProvider` - Custom regex-based content filtering
- `OpenAIModerationProvider` - OpenAI Moderation API integration
- `LlamaGuardProvider` - Llama Guard content moderation

### `StreamingGuardrailFilter`

Streaming interface for real-time guardrail enforcement:

```typescript
interface StreamingGuardrailFilter {
  filter(chunk: string): string | null;
}
```

## Error Types

- **QuotaExceededError** - Thrown when session token quota is exceeded
- **RetrievalBlockedError** - Thrown when retrieval domain is not in allowlist

## Requirements

- Optional peer dependency: `openai@^4` (for OpenAI Moderation provider)

## License

[MIT](LICENSE)
