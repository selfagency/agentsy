# Node DNS blocklist workflow (showcase)

This example shows a workflow you could build with Agentsy:

1. Read multiple log files.
2. Stream model output.
3. Normalize provider chunks.
4. Process incrementally.
5. Validate JSON before any automated action.
6. Update a remote DNS blocklist when an IP should be blocked.

## Packages used

```bash
npm install @agentsy/core @agentsy/providers
```

## Illustrative implementation

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { applyDecisionAction, runStructuredDecisionFromRawStream } from '@agentsy/providers/adapters';
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { parseSSEStream } from '@agentsy/core/sse';

type DnsBlockDecision = {
  shouldBlock: boolean;
  targetIp: string;
  reason: string;
  ttlSeconds: number;
  evidence: string[];
};

const dnsBlockSchema = {
  type: 'object',
  required: ['shouldBlock', 'targetIp', 'reason', 'ttlSeconds', 'evidence'],
  properties: {
    shouldBlock: { type: 'boolean' },
    targetIp: { type: 'string', minLength: 7 },
    reason: { type: 'string', minLength: 1 },
    ttlSeconds: { type: 'number', minimum: 60, maximum: 86400 },
    evidence: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
  },
} as const;

async function loadLogFile(fileName: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'sample-logs', fileName);
  return readFile(filePath, 'utf8');
}

async function* streamModelDecision(prompt: string): AsyncGenerator<unknown> {
  // Replace this with your provider SDK stream call.
  const response = await fetch('https://api.example.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a production SRE assistant. Return only JSON matching the requested schema. Do not include markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const textStream = response.body?.pipeThrough(new TextDecoderStream());
  if (!textStream) {
    return;
  }

  for await (const event of parseSSEStream(textStream)) {
    if (event.data === '[DONE]') {
      return;
    }

    try {
      yield JSON.parse(event.data) as unknown;
    } catch {
      // Ignore malformed SSE payloads in this showcase example.
    }
  }
}

async function maybeBlockIpInDns(decision: DnsBlockDecision): Promise<void> {
  // Replace with your DNS provider API endpoint.
  await fetch('https://dns-control.example.com/v1/blocklist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ip: decision.targetIp,
      ttlSeconds: decision.ttlSeconds,
      reason: decision.reason,
      evidence: decision.evidence,
      source: 'agentsy-log-triage',
    }),
  });
}

export async function runLogTriage(): Promise<void> {
  const files = ['api-gateway.log', 'payments.log', 'queue-worker.log'];
  const logs = await Promise.all(files.map(loadLogFile));

  const prompt = `
Analyze these production logs and decide if any source IP should be blocked via remote DNS.
Return JSON only with: shouldBlock, targetIp, reason, ttlSeconds, evidence.

--- LOG FILES ---
${files.map((name, i) => `### ${name}\n${logs[i]}`).join('\n\n')}
`;

  const decision = await runStructuredDecisionFromRawStream<unknown, DnsBlockDecision>({
    source: streamModelDecision(prompt),
    normalize: normalizeOpenAIChatChunk,
    schema: dnsBlockSchema,
    processorOptions: {
      parseThinkTags: true,
      onWarning: (message, context) => console.warn('[processor-warning]', message, context),
    },
  });

  if (!decision.success) {
    throw new Error(`Model output did not pass DNS block schema validation: ${decision.errors.join('; ')}`);
  }

  await applyDecisionAction(decision.decision, {
    shouldAct: value => value.shouldBlock,
    onSkip: value => {
      console.log('No DNS block required:', value.reason);
    },
    action: maybeBlockIpInDns,
  });
}

void runLogTriage();
```

## Why this pattern is useful

- `@agentsy/providers/normalizers` gives downstream code one common event shape.
- `@agentsy/providers/adapters` now orchestrates normalization + processing + schema validation in one helper.
- `applyDecisionAction` gives you a reusable side-effect gate for any validated decision payload.

For additional package context, see the [package catalog](../packages.md).
