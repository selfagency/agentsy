import type { Instance, RenderOptions } from 'ink';
import { randomUUID } from 'node:crypto';
import type { JsonObject } from '@agentsy/types';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
import type { InkRendererHandle, InkRendererOptions } from './createInkRenderer.js';
import { resolveTheme } from './themes/index.js';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string | undefined;
  toolCalls: Array<{ id: string; name: string; arguments: JsonObject; done: boolean }>;
  timestamp: number;
}

export interface InkConversationRendererOptions extends InkRendererOptions {
  initialHistory?: ConversationTurn[];
}

export interface InkConversationRendererHandle extends InkRendererHandle {
  newTurn(role?: 'assistant'): void;
  addUserTurn(text: string): void;
  getHistory(): readonly ConversationTurn[];
}

export async function createInkConversationRenderer(
  options: InkConversationRendererOptions,
): Promise<InkConversationRendererHandle> {
  let ink: typeof import('ink');
  let react: typeof import('react');
  try {
    ink = await import('ink');
    react = await import('react');
  } catch {
    throw new Error('ink and react are required peer dependencies. Install them with: pnpm add ink react');
  }

  const { createElement: h, Fragment } = react;
  const { render } = ink;

  const resolvedTheme = resolveTheme(options.theme);

  const stateRef = {
    text: '',
    thinking: '',
    toolCalls: [] as Array<{ id: string; name: string; arguments: JsonObject; done: boolean }>,
    isStreaming: true,
  };

  const historyRef: { current: ConversationTurn[] } = {
    current: options.initialHistory ? [...options.initialHistory] : [],
  };

  const forceUpdateRef = { current: () => {} };

  const { processor } = options;

  // Store listener functions for cleanup on unmount
  const listeners = {
    text: (delta: string) => {
      stateRef.text += delta;
      forceUpdateRef.current();
    },
    thinking: (delta: string) => {
      stateRef.thinking += delta;
      forceUpdateRef.current();
    },
    tool_call: (part: XmlToolCall) => {
      stateRef.toolCalls.push({
        id: part.id || randomUUID(),
        name: part.name,
        arguments: part.parameters,
        done: true,
      });
      forceUpdateRef.current();
    },
    done: () => {
      stateRef.isStreaming = false;
      forceUpdateRef.current();
      options.onFinish?.();
    },
    warning: (error: string) => {
      options.onWarning?.(error);
    },
  };

  processor.on('text', listeners.text);
  processor.on('thinking', listeners.thinking);
  processor.on('tool_call', listeners.tool_call);
  processor.on('done', listeners.done);
  processor.on('warning', listeners.warning);

  const InkStreamRenderer = (await import('./InkStreamRenderer.js')).default;
  const { ConversationHistory } = await import('./components/ConversationHistory.js');

  const rendererOptions = {
    showThinking: options.showThinking,
    thinkingStyle: options.thinkingStyle,
    showToolCalls: options.showToolCalls,
    markdown: options.markdown,
    theme: resolvedTheme,
    screenReader: options.screenReader,
    syntaxHighlight: options.syntaxHighlight,
    keyboard: options.keyboard,
  };

  const instance: Instance = render(
    h(
      Fragment,
      null,
      h(ConversationHistory, {
        turns: historyRef.current,
        theme: resolvedTheme,
        screenReader: options.screenReader,
        options: rendererOptions,
      }),
      h(InkStreamRenderer, {
        stateRef,
        forceUpdateRef,
        setForceUpdate: (fn: () => void) => {
          forceUpdateRef.current = fn;
        },
        options: rendererOptions,
      }),
    ),
    options.inkOptions as Partial<RenderOptions>,
  );

  return {
    instance,
    write(_chunk: string): void {
      // No-op; driven by processor events
    },
    end(): void {
      stateRef.isStreaming = false;
      forceUpdateRef.current();
    },
    unmount(): void {
      // Clean up processor listeners to prevent memory leaks
      processor.off('text', listeners.text);
      processor.off('thinking', listeners.thinking);
      processor.off('tool_call', listeners.tool_call);
      processor.off('done', listeners.done);
      processor.off('warning', listeners.warning);
      instance.unmount();
    },
    newTurn(role: 'assistant' | 'user' = 'assistant'): void {
      historyRef.current.push({
        id: randomUUID(),
        role,
        text: stateRef.text,
        thinking: stateRef.thinking || undefined,
        toolCalls: [...stateRef.toolCalls],
        timestamp: Date.now(),
      });
      stateRef.text = '';
      stateRef.thinking = '';
      stateRef.toolCalls = [];
      stateRef.isStreaming = true;
      forceUpdateRef.current();
    },
    addUserTurn(text: string): void {
      historyRef.current.push({
        id: randomUUID(),
        role: 'user',
        text,
        toolCalls: [],
        timestamp: Date.now(),
      });
      forceUpdateRef.current();
    },
    getHistory(): readonly ConversationTurn[] {
      return historyRef.current;
    },
  };
}
