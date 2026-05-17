import { randomUUID } from 'node:crypto';

import type { XmlToolCall } from '@agentsy/core/tool-calls';
import type { JsonObject } from '@agentsy/types';
import type { Instance, RenderOptions } from 'ink';
// @ts-ignore ink has no default export, but we need it for type references
import type typeInk from 'ink';
// @ts-ignore react has no default export, but we need it for type references
import type typeReact from 'react';

import type { InkRendererHandle, InkRendererOptions } from './create-ink-renderer.js';
import { resolveTheme } from './themes/index.js';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string | undefined;
  toolCalls: {
    id: string;
    name: string;
    arguments: JsonObject;
    done: boolean;
  }[];
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

// fallow-ignore-next-line unused-export
export async function createInkConversationRenderer(
  options: InkConversationRendererOptions
): Promise<InkConversationRendererHandle> {
  let ink: typeof typeInk;
  let react: typeof typeReact;
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
    isStreaming: true,
    text: '',
    thinking: '',
    toolCalls: [] as {
      id: string;
      name: string;
      arguments: JsonObject;
      done: boolean;
    }[]
  };

  const historyRef: { current: ConversationTurn[] } = {
    current: options.initialHistory ? [...options.initialHistory] : []
  };

  const forceUpdateRef = { current: () => {} };

  const { processor } = options;

  // Store listener functions for cleanup on unmount
  const listeners = {
    done: () => {
      stateRef.isStreaming = false;
      forceUpdateRef.current();
      options.onFinish?.();
    },
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
        arguments: part.parameters,
        done: true,
        id: part.id ?? randomUUID(),
        name: part.name
      });
      forceUpdateRef.current();
    },
    warning: (error: string) => {
      options.onWarning?.(error);
    }
  };

  processor.on('text', listeners.text);
  processor.on('thinking', listeners.thinking);
  processor.on('tool_call', listeners.tool_call);
  processor.on('done', listeners.done);
  processor.on('warning', listeners.warning);

  const InkStreamRenderer = (await import('./ink-stream-renderer.tsx')).default;
  const { ConversationHistory } = await import('./components/conversation-history.tsx');

  const rendererOptions = {
    keyboard: options.keyboard,
    markdown: options.markdown,
    screenReader: options.screenReader,
    showThinking: options.showThinking,
    showToolCalls: options.showToolCalls,
    syntaxHighlight: options.syntaxHighlight,
    theme: resolvedTheme,
    thinkingStyle: options.thinkingStyle
  };

  const instance: Instance = render(
    h(
      Fragment,
      null,
      h(ConversationHistory, {
        options: rendererOptions,
        screenReader: options.screenReader,
        theme: resolvedTheme,
        turns: historyRef.current
      }),
      h(InkStreamRenderer, {
        forceUpdateRef,
        options: rendererOptions,
        setForceUpdate: (fn: () => void) => {
          forceUpdateRef.current = fn;
        },
        stateRef
      })
    ),
    options.inkOptions ?? {}
  );

  return {
    addUserTurn(text: string): void {
      historyRef.current.push({
        id: randomUUID(),
        role: 'user',
        text,
        timestamp: Date.now(),
        toolCalls: []
      });
      forceUpdateRef.current();
    },
    end(): void {
      stateRef.isStreaming = false;
      forceUpdateRef.current();
    },
    getHistory(): readonly ConversationTurn[] {
      return historyRef.current;
    },
    instance,
    newTurn(role: 'assistant' | 'user' = 'assistant'): void {
      historyRef.current.push({
        id: randomUUID(),
        role,
        text: stateRef.text,
        thinking: stateRef.thinking || undefined,
        timestamp: Date.now(),
        toolCalls: [...stateRef.toolCalls]
      });
      stateRef.text = '';
      stateRef.thinking = '';
      stateRef.toolCalls = [];
      stateRef.isStreaming = true;
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
    write(_chunk: string): void {
      // No-op; driven by processor events
    }
  };
}
