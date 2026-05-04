import type { UsageInfo } from '../normalizers/types.js';
import type { FinishReason } from '@agentsy/types';
import type { ConversationEvent } from '../ui/types.js';
import type { LLMStreamProcessor, OutputPart, StreamEventMap } from './LLMStreamProcessor.js';

export interface ProcessorCallbackAdapterOptions {
  onText?: (delta: string) => void;
  onThinking?: (delta: string) => void;
  onToolCall?: StreamEventMap['tool_call'];
  onToolCallDelta?: (delta: Extract<OutputPart, { type: 'tool_call_delta' }>) => void;
  onStep?: (stepIndex: number, usage?: UsageInfo) => void;
  onFinish?: (finishReason?: FinishReason, usage?: UsageInfo) => void;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  onConversationEvent?: (event: ConversationEvent) => void;
}

/**
 * Attaches stable callback-style handlers to an `LLMStreamProcessor` event emitter.
 */
export function createProcessorEventAdapter(
  processor: LLMStreamProcessor,
  options: ProcessorCallbackAdapterOptions,
): { dispose(): void } {
  function textListener(delta: string): void {
    options.onText?.(delta);
  }

  function thinkingListener(delta: string): void {
    options.onThinking?.(delta);
  }

  function toolCallListener(call: Parameters<StreamEventMap['tool_call']>[0]): void {
    options.onToolCall?.(call);
  }

  function toolCallDeltaListener(delta: Extract<OutputPart, { type: 'tool_call_delta' }>): void {
    options.onToolCallDelta?.(delta);
  }

  function warningListener(message: string, context?: Record<string, unknown>): void {
    options.onWarning?.(message, context);
  }

  function conversationListener(event: ConversationEvent): void {
    options.onConversationEvent?.(event);

    if (event.type === 'step_started') {
      options.onStep?.(event.stepIndex, event.usage);
      return;
    }

    if (event.type === 'message_finished') {
      options.onFinish?.(event.finishReason, event.usage);
    }
  }

  processor.on('text', textListener);
  processor.on('thinking', thinkingListener);
  processor.on('tool_call', toolCallListener);
  processor.on('tool_call_delta', toolCallDeltaListener);
  processor.on('warning', warningListener);
  processor.on('conversation_event', conversationListener);

  return {
    dispose(): void {
      processor.off('text', textListener);
      processor.off('thinking', thinkingListener);
      processor.off('tool_call', toolCallListener);
      processor.off('tool_call_delta', toolCallDeltaListener);
      processor.off('warning', warningListener);
      processor.off('conversation_event', conversationListener);
    },
  };
}
