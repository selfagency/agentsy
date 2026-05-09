# Production Provider Example

This example demonstrates how to use `@agentsy/vscode` package APIs in a production VS Code extension with advanced chat provider integration.

````ts
import { createVSCodeAgentLoop, createVSCodeChatRenderer } from '@agentsy/vscode';

// Setup your MCPTransport and VS Code CancellationToken externally
const transport = createYourMCPTransport();
const cancellationToken = createYourCancellationToken();

// Retry utility for resilient calls
async function runWithRetry(fn: () => Promise<void>) {
await retryWithBackoff(fn, cancellationToken, { maxAttempts: 3, initialDelayMs: 1000 });
}

// Create MCP Chat Bridge for streaming chat interaction
const chatBridge = createMCPChatBridge(transport, cancellationToken);

// Create VS Code chat renderer to render markdown chat content
const chatRenderer = createVSCodeChatRenderer({ stream: chatBridge.createStream(), showThinking: true });

// Agent loop that manages message processing
const agentLoop = createVSCodeAgentLoop({ chatRenderer, ...yourAgentOptions });

async function runChatProvider() {
await runWithRetry(async () => {
await agentLoop.start();
});
}

runChatProvider().catch(console.error);
// Usage of new retryWithBackoff from @agentsy/retry package
// maxAttempts replaces maxRetries, initialDelayMs replaces baseDelayMs
// The new retry API supports AbortSignal for cancellation.

# Production Provider Example

This example demonstrates how to use the `@agentsy/vscode` package APIs in a production VS Code extension with advanced chat provider integration.

```ts
import { createVSCodeAgentLoop, createVSCodeChatRenderer } from '@agentsy/vscode';
import { createMCPChatBridge } from '@agentsy/vscode/stream-bridge';
import { retryWithBackoff } from '@agentsy/retry';

// Setup your MCPTransport and VS Code CancellationToken externally
const transport = createYourMCPTransport();
const cancellationToken: CancellationToken = createYourCancellationToken();

// Retry utility for resilient calls
const retry = (fn: () => Promise<void>) =>
  retryWithBackoff(fn, cancellationToken, {
    maxAttempts: 3,
    initialDelayMs: 1000,
  });

// Create MCP Chat Bridge for streaming chat interaction
const chatBridge = createMCPChatBridge(transport, cancellationToken);

// Create VS Code chat renderer to render markdown chat content
const chatRenderer = createVSCodeChatRenderer({ stream: chatBridge.createStream(), showThinking: true });

// Agent loop that manages message processing
const agentLoop = createVSCodeAgentLoop({ chatRenderer, ...yourAgentOptions });

async function runChatProvider() {
  await retry(async () => {
    await agentLoop.start();
  });
}

runChatProvider().catch(console.error);
````

This example showcases key patterns for resilient streaming, MCP integration, and VS Code chat rendering.

Replace placeholders with actual implementations for your transport, cancellation token, and agent options.

See `@agentsy/vscode` docs for detailed API references.
