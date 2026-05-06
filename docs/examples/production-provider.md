# Production Provider Example

This example demonstrates how to use the `@agentsy/vscode` package APIs in a production VS Code extension with advanced chat provider integration.

```ts
import { createVSCodeAgentLoop, createVSCodeChatRenderer } from '@agentsy/vscode';
import { createMCPChatBridge } from '@agentsy/vscode/stream-bridge';
import { createRetryUtility } from '@agentsy/vscode/retry';

// Setup your MCPTransport and VS Code CancellationToken externally
const transport = createYourMCPTransport();
const cancellationToken = createYourCancellationToken();

// Retry utility for resilient calls
const retry = createRetryUtility(3, 1000, cancellationToken);

// Create MCP Chat Bridge for streaming chat interaction
const chatBridge = createMCPChatBridge(transport, cancellationToken);

// Create VS Code chat renderer to render markdown chat content
const chatRenderer = createVSCodeChatRenderer({ stream: chatBridge.createStream(), showThinking: true });

// Agent loop that manages message processing
const agentLoop = createVSCodeAgentLoop({ chatRenderer, ...yourAgentOptions });

async function runChatProvider() {
  await retry.executeWithRetry(async () => {
    await agentLoop.start();
  });
}

runChatProvider().catch(console.error);
```

This example showcases key patterns for resilient streaming, MCP integration, and VS Code chat rendering.

Replace placeholders with actual implementations for your transport, cancellation token, and agent options.

See the `@agentsy/vscode` docs for detailed API references.
