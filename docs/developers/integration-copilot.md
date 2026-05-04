# GitHub Copilot Chat Integration

This guide describes how `@agentsy/*` stream-processing packages can be integrated with GitHub Copilot Chat extensions and chat hosts.

## Goals

- Provide composable parsing primitives for streaming LLM responses in Copilot Chat
- Enable structured output extraction (thinking, tool calls, JSON schemas)
- Support extensible stream processing for chat-based workflows
- Maintain compatibility with multiple model providers (Claude, GPT, local models via Ollama)

## Integration Patterns

### Usage with LLMStreamProcessor

```typescript
const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  scrubContextTags: true,
  knownTools: new Set(['search', 'edit_file']),
});

processor.on('thinking', delta => {
  // Stream thinking to UI in real-time
  updateThinkingPanel(delta);
});

processor.on('text', delta => {
  // Stream content to UI
  updateContentPanel(delta);
});

processor.on('tool_call', call => {
  // Execute tool calls
  executeToolInCopilot(call.name, call.parameters);
});

for await (const chunk of chatStream) {
  const output = processor.process({
    content: chunk.content,
    thinking: chunk.thinking,
    done: chunk.done,
  });
}

// Get final accumulated state
const final = processor.accumulatedMessage;
```

### Streaming in Chat UI

Process chunks immediately without buffering:

```typescript
import { ThinkingParser } from '@agentsy/thinking';
import { createXmlStreamFilter } from '@agentsy/xml-filter';

const thinking = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });
const filter = createXmlStreamFilter({ enforcePrivacyTags: true });

for await (const chunk of chatStream) {
  // Extract thinking and regular content
  const [thinkingDelta, contentDelta] = thinking.addContent(chunk);

  if (thinkingDelta) {
    updateThinkingPanel(thinkingDelta);
  }

  // Filter context blocks before display
  const filtered = filter.write(contentDelta);

  if (filtered) {
    updateChatDisplay(filtered);
  }
}

// Finalize streams
const [finalThinking, finalContent] = thinking.flush();
updateThinkingPanel(finalThinking);

const finalFiltered = filter.end();
updateChatDisplay(finalFiltered);
```

### Tool Call Routing

Extract and execute structured tool calls:

```typescript
import { extractXmlToolCalls } from '@agentsy/tool-calls';

const response = await chatCompletion(messages);

const toolCalls = extractXmlToolCalls(
  response,
  new Set(['search_codebase', 'edit_file', 'run_tests', 'execute_command']),
);

for (const call of toolCalls) {
  const result = await executeToolInHost(call.name, call.parameters);

  // Feed result back to chat context
  messages.push({ role: 'user', content: `Tool ${call.name} returned: ${result}` });
}
```

### Schema Validation with Retry

Validate structured outputs and prompt for repairs:

```typescript
import { buildRepairPrompt, parseJson, validateJsonSchema } from '@agentsy/structured';

const schema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

let response = await chatCompletion(messages);
let parsed = parseJson(response);

if (parsed === null) {
  console.error('Failed to parse JSON');
  return;
}

let validation = validateJsonSchema(JSON.stringify(parsed), schema);

if (!validation.success) {
  // Build repair prompt
  const repairPrompt = buildRepairPrompt({
    failedOutput: response,
    error: validation.errors[0],
    schema,
    originalPrompt: messages[messages.length - 1].content,
  });

  // Ask model to fix
  messages.push({ role: 'user', content: repairPrompt });
  response = await chatCompletion(messages);
  parsed = parseJson(response);

  if (parsed === null) {
    console.error('Failed to parse JSON on retry');
    return;
  }

  validation = validateJsonSchema(JSON.stringify(parsed), schema);
}

if (validation.success) {
  return validation.data;
}
```

## Model-Specific Considerations

### Claude (Anthropic)

- Supports `<think>...</think>` natively
- Tool use via XML format
- Use `ThinkingParser` with default settings

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'claude-opus', // Auto-detects thinking tags
  parseThinkTags: true,
  knownTools: new Set(toolNames),
});
```

### GPT Models (OpenAI)

- Supports `<think>...</think>` format via system prompts
- Tool calls via function calling (separate from response)
- May need to parse tool calls from response text

```typescript
const processor = new LLMStreamProcessor({
  thinkingOpenTag: '<think>',
  thinkingCloseTag: '</think>',
  parseThinkTags: true,
  knownTools: new Set(toolNames),
});
```

### Local Models (Ollama)

- Varies by model; check model-specific documentation
- Common patterns: `<think>...</think>`, `<reasoning>...</reasoning>`
- Configure tag mapping in processor options

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'deepseek', // Auto-detects for known models
  parseThinkTags: true,
  knownTools: new Set(toolNames),
});

// Custom configuration for unknown models
const processor2 = new LLMStreamProcessor({
  thinkingOpenTag: '<reasoning>',
  thinkingCloseTag: '</reasoning>',
  parseThinkTags: true,
  knownTools: new Set(toolNames),
});
```

## Safety Invariants

1. **Only process trusted context** - Context blocks extracted as elevated context should only come from known sources
2. **Enable privacy scrubbing** - Keep privacy-related XML tags scrubbed by default to avoid leaking sensitive data
3. **Enforce limits** - Use `maxJsonDepth` and `maxJsonKeys` to prevent DoS via deeply nested structures
4. **Validate at boundaries** - Always validate structured output at the chat→tool interface

## Feature Flags and Rollout

For safe integration into existing Copilot Chat hosts:

```typescript
// Feature flag for gradual rollout
const useLLMStreamParser = features.isEnabled('@agentsy/processor');

const processor = useLLMStreamParser ? new LLMStreamProcessor(config) : legacyParsingPath(config);

// Run both paths in tests for parity verification
if (process.env.VERIFY_PARITY) {
  const legacyResult = legacyParsingPath(response);
  const newResult = processor.flush();

  if (JSON.stringify(legacyResult) !== JSON.stringify(newResult)) {
    logParityMismatch('streams_not_equal', { legacyResult, newResult });
  }
}
```

## Performance Tips

- **Stream processing** - Process chunks immediately instead of buffering entire responses
- **Package-scoped imports** - Only import what you need: `import { ThinkingParser } from '@agentsy/thinking'`
- **Limit tuning** - Adjust `maxJsonDepth` and `maxJsonKeys` based on expected response types
- **Caching** - Cache parsed schemas and processors across multiple chat turns

## Debugging

Enable diagnostics for stream processing using the `onWarning` hook:

```typescript
const processor = new LLMStreamProcessor({
  onWarning: (message, context) => {
    console.log(`[@agentsy/processor] ${message}`, context);
  },
  ...config,
});
```
