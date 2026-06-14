# Getting Started

Get up and running with the published VS Code package and internal package usage patterns.

Migrating from the old monolith package? See [Migrating from `@selfagency/llm-stream-parser`](/migration/llm-stream-parser).

## Installation

### With npm

```bash
npm install @agentsy/vscode vscode
```

### With pnpm

```bash
pnpm add @agentsy/vscode vscode
```

### With yarn

```bash
yarn add @agentsy/vscode vscode
```

## Requirements

- Node.js 22+
- TypeScript 5.0+ (if using TypeScript)

## Basic Examples

### Extract thinking from streaming response

```typescript
import { ThinkingParser } from '@agentsy/core/thinking';

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
import { parseJson } from '@agentsy/core/structured';

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
import { validateJsonSchema } from '@agentsy/core/structured';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } }
  }
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
import { extractXmlToolCalls } from '@agentsy/core/tool-calls';

const response = await llm.complete('Use tools to search the codebase');

const toolCalls = extractXmlToolCalls(response, new Set(['search_codebase', 'edit_file']));

for (const call of toolCalls) {
  console.log(`Executing: ${call.name}`);
  const result = await executeTool(call.name, call.parameters);
  console.log('Result:', result);
}
```

### Filter context blocks

```typescript
import { createXmlStreamFilter } from '@agentsy/core/xml-filter';

const filter = createXmlStreamFilter({
  enforcePrivacyTags: true
});

for await (const chunk of llmStream) {
  const filtered = filter.write(chunk);
  output.write(filtered);
}

output.write(filter.end());
```

### Process complete stream response

```typescript
import { LLMStreamProcessor } from '@agentsy/core/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit']),
  modelId: 'claude-opus'
});

// Subscribe to events
processor.on('thinking', delta => displayThinking(delta));
processor.on('text', delta => displayText(delta));
processor.on('tool_call', call => executeToolCall(call));

// Process streaming response
for await (const chunk of apiStream) {
  processor.process({
    content: chunk.content,
    thinking: chunk.thinking,
    done: chunk.done
  });
}

// Final accumulated message
const message = processor.accumulatedMessage;
console.log('Thinking:', message.thinking);
console.log('Content:', message.content);
console.log('Tool calls:', message.toolCalls);
```

### Run a multi-step agent loop

```typescript
import { createAgentLoop } from '@agentsy/orchestrator/agent';

const agent = createAgentLoop({
  // Your LLM invocation function
  execute: async function* (messages) {
    const response = await fetch('https://api.example.com/chat', {
      method: 'POST',
      body: JSON.stringify({ messages })
    });

    for await (const chunk of response.body) {
      yield { content: chunk.toString(), done: false };
    }
  },

  // Stop when we have a final answer or after 5 steps
  stopWhen: [
    state => state.lastOutput.toolCalls.length === 0, // No more tool calls
    state => state.steps.length >= 5 // Max steps reached
  ],

  // Convert tool results back to messages
  buildToolResultMessages: async toolCalls => {
    return toolCalls.map(call => ({
      role: 'user',
      content: `Tool "${call.name}" executed successfully`
    }));
  }
});

// Execute the agent
const messages = [{ role: 'user', content: 'Search for the latest AI news' }];

for await (const part of agent.run(messages)) {
  if (part.type === 'text') console.log('Content:', part.text);
  if (part.type === 'thinking') console.log('Thinking:', part.text);
  if (part.type === 'tool_call') console.log('Tool call:', part.call.name);
}
```

### Render to VS Code Chat

```typescript
import { createVSCodeChatRenderer } from '@agentsy/vscode';

// In your VS Code extension command
export async function chatCommand(stream: vscode.ChatResponseStream) {
  const renderer = createVSCodeChatRenderer({
    stream,
    showThinking: true,
    thinkingStyle: 'blockquote', // Thinking appears as blockquote
    onToolCall: async call => {
      console.log(`Tool called: ${call.name}`);
      // Execute tool and return results
    },
    onFinish: (finishReason, usage) => {
      console.log('Chat finished. Reason:', finishReason, 'Usage:', usage);
    }
  });

  // Stream LLM response
  for await (const chunk of llmStream) {
    await renderer.writeChunk(chunk);
  }

  await renderer.end();
}
```

## Notes on package status

- `@agentsy/vscode` is currently published.
- The current `@agentsy/*` package family is published; use the focused packages you need and treat the still-unwritten agentic tooling from `plan/` as future work.
- Planned future packages are tracked in `plan/*.md` and summarized in [Roadmap](./roadmap.md).

### Use generic adapter for simpler integration

```typescript
import { processStream } from '@agentsy/providers/adapters';

for await (const output of processStream(apiStream, {
  parseThinkTags: true,
  knownTools: new Set(['search'])
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
  modelId: 'claude-opus', // Auto-detects thinking tags
  parseThinkTags: true
});
```

### Deepseek, Qwen, Llama

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'deepseek', // Uses <think></think>
  parseThinkTags: true
});
```

### Granite

```typescript
const processor = new LLMStreamProcessor({
  modelId: 'granite', // Uses <|thinking|></|thinking|>
  parseThinkTags: true
});
```

### Custom tags

```typescript
const processor = new LLMStreamProcessor({
  thinkingOpenTag: '<reasoning>',
  thinkingCloseTag: '</reasoning>',
  parseThinkTags: true
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
    properties: { key: { type: 'string' } }
  };
  const validated = validateJsonSchema(response, schema);

  if (!validated.success) {
    console.error('Schema validation failed:', validated.errors);
    // Build repair prompt
    const repairPrompt = buildRepairPrompt({
      failedOutput: response,
      error: validated.errors[0],
      schema
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
  }
});
```

## Performance Tips

- **Use subpath imports** to reduce bundle size:

  Prefer focused package imports that match the capability you need:

  ```typescript
  import { ThinkingParser } from '@agentsy/core/thinking';
  import { parseJson } from '@agentsy/core/structured';
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
    maxJsonKeys: 100
  });
  ```

- **Enable privacy scrubbing** by default:

  ```typescript
  const processor = new LLMStreamProcessor({
    scrubContextTags: true,
    enforcePrivacyTags: true
  });
  ```

## Next Steps

- [Configuration & CLI](#configuration--cli) — Config system, MCP CLI, connectors CLI
- [API Reference](/api) - Complete API documentation
- [Developer Guide](/developers/) - Local development and testing
- [Copilot Chat Integration](/developers/integration-copilot) - Integration patterns

## Configuration & CLI

The `@agentsy/cli` package provides a full configuration system and management commands.

### Configuration commands

```bash
# View and manage configuration
agentsy config list                    # List all config values
agentsy config get <key>               # Get a specific config value
agentsy config set <key> <value>       # Set a config value
agentsy config unset <key>             # Remove a config value

# Settings management
agentsy settings                       # Interactive settings editor
agentsy settings list                  # List all settings
agentsy settings set <key> <value>     # Set a setting

# Diagnostics
agentsy doctor                         # Full system diagnostics
agentsy doctor config                  # Validate configuration
agentsy doctor network                 # Check network connectivity
```

### MCP and connectors management

```bash
# MCP server management
agentsy mcp list                       # List registered MCP servers
agentsy mcp add <name> <command>       # Register an MCP server
agentsy mcp remove <name>             # Remove an MCP server
agentsy mcp status                     # Check MCP server health

# Connectors management
agentsy connectors list                # List configured connectors
agentsy connectors add <type>          # Add a connector (discord, slack, telegram)
agentsy connectors remove <name>       # Remove a connector
agentsy connectors status              # Check connector health
```

### Configuration file

Configuration is stored in `~/.config/agentsy/config.json` by default. The config system supports:

- **Profiles**: Switch between named configuration profiles
- **Environment overrides**: `AGENTSY_*` environment variables override file config
- **Validation**: Schema-validated on read with clear error messages
- **Secrets**: Sensitive values stored via `@agentsy/secrets` (1Password integration)

## Troubleshooting

## Q: ThinkingParser not extracting thinking sections

- Verify tag names match the model output:

  ```typescript
  parser = ThinkingParser.forModel('deepseek'); // Auto-detect
  ```

## Q: JSON parsing returns null

- Check for code fences and formatting:

  ```typescript
  const data = parseJson(response, { selectMostComprehensive: true });
  ```

## Q: Tool calls not extracting

- Ensure tool names are in the known tools set:

  ```typescript
  extractXmlToolCalls(response, new Set(['search', 'edit_file']));
  ```

## Q: Performance issues with large responses

- Use streaming chunking instead of buffering:

  ```typescript
  for await (const chunk of stream) {
    processor.process(chunk);
  }
  ```

For more help, see the [API Reference](/api) or open an issue on GitHub.
