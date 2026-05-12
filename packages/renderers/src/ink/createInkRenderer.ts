import type { Instance, RenderOptions } from 'ink';
import { randomUUID } from 'node:crypto';
import type { LLMStreamProcessor } from '@agentsy/processor';
import type { JsonObject } from '@agentsy/types';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
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
    text: '',
    thinking: '',
    toolCalls: [] as Array<{ id: string; name: string; arguments: JsonObject; done: boolean }>,
    isStreaming: true,
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

  const resolvedTheme = resolveTheme(options.theme);

  const instance = render(
    h(InkStreamRenderer, {
      stateRef,
      forceUpdateRef,
      setForceUpdate: (fn: () => void) => {
        forceUpdateRef.current = fn;
      },
      options: {
        showThinking: options.showThinking,
        thinkingStyle: options.thinkingStyle,
        showToolCalls: options.showToolCalls,
        markdown: options.markdown,
        theme: resolvedTheme,
        screenReader: options.screenReader,
        syntaxHighlight: options.syntaxHighlight,
        keyboard: options.keyboard,
      },
    }),
    options.inkOptions,
  );

  return {
    instance,
    write(_chunk: string): void {
      // Ink renderer is event-driven via processor; write is a no-op
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
  };
}
