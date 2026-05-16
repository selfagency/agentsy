import { randomUUID } from 'node:crypto';

import type { LLMStreamProcessor } from '@agentsy/core/processor';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
import type { JsonObject } from '@agentsy/types';
import type { Instance, RenderOptions } from 'ink';

import type { KeyboardOptions } from './components/KeyboardHandler.js';
import { resolveTheme } from './themes/index.js';
import type { Theme, ThemeName } from './themes/types.js';

export interface InkRendererOptions {
  showThinking?: boolean;
  thinkingStyle?: 'blockquote' | 'inline' | 'suppress';
  showToolCalls?: boolean;
  markdown?: boolean;
  processor: LLMStreamProcessor;
  onWarning: (message: string) => void;
  onFinish?: () => void;
  inkOptions?: Partial<RenderOptions>;
  theme?: Theme | ThemeName;
  screenReader?: boolean;
  syntaxHighlight?: boolean;
  keyboard?: KeyboardOptions;
}

export interface InkRendererHandle {
  instance: Instance;
  write(chunk: string): void;
  end(): void;
  unmount(): void;
}

export async function createInkRenderer(options: InkRendererOptions): Promise<InkRendererHandle> {
  let ink: typeof import('ink');
  let react: typeof import('react');
  try {
    ink = await import('ink');
    react = await import('react');
  } catch {
    throw new Error('ink and react are required peer dependencies. Install them with: pnpm add ink react');
  }

  const { createElement: h } = react;
  const { render } = ink;

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
        id: part.id || randomUUID(),
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

  const InkStreamRenderer = (await import('./InkStreamRenderer.js')).default;

  const resolvedTheme = resolveTheme(options.theme);

  const instance = render(
    h(InkStreamRenderer, {
      forceUpdateRef,
      options: {
        keyboard: options.keyboard,
        markdown: options.markdown,
        screenReader: options.screenReader,
        showThinking: options.showThinking,
        showToolCalls: options.showToolCalls,
        syntaxHighlight: options.syntaxHighlight,
        theme: resolvedTheme,
        thinkingStyle: options.thinkingStyle
      },
      setForceUpdate: (fn: () => void) => {
        forceUpdateRef.current = fn;
      },
      stateRef
    }),
    options.inkOptions
  );

  return {
    end(): void {
      stateRef.isStreaming = false;
      forceUpdateRef.current();
    },
    instance,
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
      // Ink renderer is event-driven via processor; write is a no-op
    }
  };
}
