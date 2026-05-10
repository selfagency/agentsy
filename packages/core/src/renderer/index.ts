/**
 * Re-export renderer functionality from @agentsy/renderers.
 *
 * This allows consumers to import renderer types and functionality
 * from @agentsy/core/renderers instead of @agentsy/renderers directly.
 */

// Export renderer types
export type {
  BaseRendererOptions,
  CancellationToken,
  OnToolCall,
  RendererHandle,
  TextOutput,
  ThinkingStyle,
  PlainTextRendererOptions,
} from '@agentsy/renderers';

// Export shared utilities
export { createSharedRendererHandle, createStepChangeEmitter, createPlainTextRenderer } from '@agentsy/renderers';
