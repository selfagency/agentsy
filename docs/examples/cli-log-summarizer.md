# CLI log summarizer (easy)

This example shows a minimal, practical workflow for local operations:

1. Stream provider output.
2. Normalize chunks.
3. Process incremental text.
4. Render clean output to a terminal.

## Packages used

```bash
npm install @agentsy/adapters @agentsy/normalizers @agentsy/renderers
```

## Illustrative implementation

```ts
import { processRawStream } from '@agentsy/adapters';
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { createPlainTextRenderer } from '@agentsy/renderers';

async function* streamProviderLogs(prompt: string): AsyncGenerator<unknown> {
  const response = await fetch('https://api.example.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  for await (const chunk of response.body as AsyncIterable<unknown>) {
    yield chunk;
  }
}

async function runCliSummary(): Promise<void> {
  const renderer = createPlainTextRenderer({ showThinking: false });

  const prompt = 'Summarize the latest application logs into key issues and probable causes.';
  for await (const output of processRawStream(streamProviderLogs(prompt), normalizeOpenAIChatChunk)) {
    renderer.write(output);
  }
}

void runCliSummary();
```

## Why this pattern is useful

- Good first step for validating your provider integration.
- Minimal boilerplate while still preserving stream correctness.
- Easy to embed into scripts and cron-like operational tooling.
