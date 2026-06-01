# Production Provider Example

This example demonstrates how to use `@agentsy/vscode` package APIs in a production VS Code extension with advanced chat provider integration.

```ts
import { createVSCodeAgentLoop, createVSCodeChatRenderer } from '@agentsy/vscode';

// Setup your MCPTransport and VS Code CancellationToken externally
const transport = createYourMCPTransport();
const cancellationToken = createYourCancellationToken();

// Retry utility for resilient calls
async function runWithRetry(fn: () => Promise<void>) {
  // Implement your retry logic here
  const maxAttempts = 3;
  const initialDelayMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fn();
      break;
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, initialDelayMs * (attempt + 1)));
    }
  }
}

// Create VS Code chat renderer to render markdown chat content
const chatRenderer = createVSCodeChatRenderer({ stream: transport.createStream(), showThinking: true });

// Agent loop that manages message processing
const agentLoop = createVSCodeAgentLoop({ chatRenderer, ...yourAgentOptions });

async function runChatProvider() {
  await runWithRetry(async () => {
    await agentLoop.start();
  });
}

runChatProvider().catch(console.error);
```

This example showcases key patterns for resilient streaming, MCP integration, and VS Code chat rendering.

Replace placeholders with actual implementations for your transport, cancellation token, and agent options.

See `@agentsy/vscode` docs for detailed API references.
