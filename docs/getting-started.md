# Getting Started

Get up and running with `llm-stream-parser` in a few minutes.

## Installation

### With npm

```bash
npm install llm-stream-parser
```

### With pnpm

```bash
pnpm add llm-stream-parser
```

### With yarn

```bash
yarn add llm-stream-parser
```

## Requirements

- Node.js 18+
- TypeScript 5.0+ (if using TypeScript)

## Basic Examples

### Extract thinking from streaming response

```typescript
import { ThinkingParser } from 'llm-stream-parser';

const parser = new ThinkingParser();

for await (const chunk of llmStream) {
  const [thinking, content] = parser.addContent(chunk);

  if (thinking) console.log('[thinking]', thinking);
  if (content) console.log('[output]', content);
}

// Finalize to get any remaining buffered content
const [finalThinking, finalContent] = parser.flush();
```

### Parse JSON from response

```typescript
import { parseJson } from 'llm-stream-parser';

const response = await llm.complete('Return JSON: {key: "value"}');
const data = parseJson(response);

if (data !== null) {
  console.log(data); // { key: "value" }
} else {
  console.error('Failed to parse JSON');
}
```

### Validate JSON against schema

```typescript
import { validateJsonSchema } from 'llm-stream-parser';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
  },
};

const result = validateJsonSchema(response, schema);

if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Invalid:', result.errors);
}
```

### Extract tool calls

```typescript
import { extractXmlToolCalls } from 'llm-stream-parser';

const response = await llm.complete(
  'Use tools to search the codebase'
);

const toolCalls = extractXmlToolCalls(
  response,
  new Set(['search_codebase', 'edit_file'])
);

for (const call of toolCalls) {
  console.log(`Executing: ${call.name}`);
  const result = await executeTool(call.name, call.parameters);
  console.log('Result:', result);
}
```

### Filter context blocks

```typescript
import { createXmlStreamFilter } from 'llm-stream-parser';

const filter = createXmlStreamFilter({
  scrubContextTags: true,
  enforcePrivacyTags: true,
});

for await (const chunk of llmStream) {
  const filtered = filter.write(chunk);
  output.write(filtered);
}

output.write(filter.end());
```

### Process complete stream response

```typescript
import { LLMStreamProcessor } from 'llm-stream-parser';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit']),
  modelId: 'claude-opus',
});

// Subscribe to events
processor.on('thinking', (delta) => displayThinking(delta));
processor.on('text', (delta) => displayText(delta));
processor.on('tool_call', (call) => executeToolCall(call));

// Process streaming response
for await (const chunk of apiStream) {
  processor.process({
    content: chunk.content,
    thinking: chunk.thinking,
    done: chunk.done,
  });
}

// Final accumulated message
const message = processor.accumulatedMessage;
console.log('Thinking:', message.thinking);
console.log('Content:', message.content);
console.log('Tool calls:', message.toolCalls);
```

### Use generic adapter for simpler integration

```typescript
import { processStream } from 'llm-stream-parser/adapters';

for await (const output of processStream(apiStream, {
  parseThinkTags: true,
  knownTools: new Set(['search']),
})) {
  console.log('Thinking:', output.thinking);
  console.log('Content:', output.content);
  console.log('Tool calls:', output.toolCalls);
  console.log('Done:', output.done);
}
```

## Model-Specific Configuration

### Claude (Anthropic)

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'claude-opus',  // Auto-detects thinking tags
  parseThinkTags: true,
});
```

### Deepseek, Qwen, Llama

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'deepseek',  // Uses <think></think>
  parseThinkTags: true,
});
```

### Granite

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'granite',  // Uses <|thinking|></|thinking|>
  parseThinkTags: true,
});
```

### Custom tags

```typescript
const processor = new LLMStreamProcessor({
  thinkingOpenTag: '<reasoning>',
  thinkingCloseTag: '</reasoning>',
  parseThinkTags: true,
});
```

## Error Handling

### Graceful JSON parsing

```typescript
const data = parseJson(response);
if (data === null) {
  // Retry or use default
  const schema = {
    type: 'object',
    properties: { key: { type: 'string' } },
  };
  const validated = validateJsonSchema(response, schema);

  if (!validated.success) {
    console.error('Schema validation failed:', validated.errors);
    // Build repair prompt
    const repairPrompt = buildRepairPrompt({
      failedOutput: response,
      error: validated.errors[0],
      schema,
    });
    // Ask model to fix...
  }
}
```

### Handle tool call failures

```typescript
const toolCalls = extractXmlToolCalls(response, knownTools);

for (const call of toolCalls) {
  try {
    const result = await executeTool(call.name, call.parameters);
    console.log(`${call.name} succeeded:`, result);
  } catch (error) {
    console.error(`${call.name} failed:`, error);
    // Continue processing other tool calls
  }
}
```

### Listen for warnings

```typescript
const processor = new LLMStreamProcessor({
  onWarning: (message, context) => {
    console.warn('[warning]', message, context);
  },
});
```

## Performance Tips

- **Use subpath imports** to reduce bundle size:
  ```typescript
  import { ThinkingParser } from 'llm-stream-parser/thinking';
  import { parseJson } from 'llm-stream-parser/structured';
  ```

- **Stream processing** instead of buffering:
  ```typescript
  // Good - process chunks as they arrive
  for await (const chunk of stream) {
    processor.process(chunk);
  }

  // Avoid - buffering entire response
  const fullResponse = await stream.text();
  processor.processComplete({ content: fullResponse, done: true });
  ```

- **Set appropriate limits** to prevent DoS:
  ```typescript
  parseJson(response, {
    maxJsonDepth: 10,
    maxJsonKeys: 100,
  });
  ```

- **Enable privacy scrubbing** by default:
  ```typescript
  const processor = new LLMStreamProcessor({
    scrubContextTags: true,
    enforcePrivacyTags: true,
  });
  ```

## Next Steps

- [API Reference](/api) - Complete API documentation
- [Developer Guide](/developers/) - Local development and testing
- [Copilot Chat Integration](/developers/integration-opilot) - Integration patterns

## Troubleshooting

**Q: ThinkingParser not extracting thinking sections**
- Verify tag names match the model output:
  ```typescript
  parser = ThinkingParser.forModel('deepseek');  // Auto-detect
  ```

**Q: JSON parsing returns null**
- Check for code fences and formatting:
  ```typescript
  const data = parseJson(response, { selectMostComprehensive: true });
  ```

**Q: Tool calls not extracting**
- Ensure tool names are in the known tools set:
  ```typescript
  extractXmlToolCalls(response, new Set(['search', 'edit_file']));
  ```

**Q: Performance issues with large responses**
- Use streaming chunking instead of buffering:
  ```typescript
  for await (const chunk of stream) {
    processor.process(chunk);
  }
  ```

For more help, see the [API Reference](/api) or open an issue on GitHub.
