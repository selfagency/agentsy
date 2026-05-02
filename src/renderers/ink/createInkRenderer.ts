import { randomUUID } from 'node:crypto';
import type { RenderOptions, Instance } from 'ink';
import type { LLMStreamProcessor } from '../../processor/index.js';

export interface InkRendererOptions {
  showThinking?: boolean;
  thinkingStyle?: 'blockquote' | 'inline' | 'suppress';
  showToolCalls?: boolean;
  markdown?: boolean;
  processor: LLMStreamProcessor;
  onWarning: (message: string) => void;
  onToolCall?: (tool: { name: string; arguments: Record<string, unknown> }) => void;
  onToolCallDelta?: (delta: string) => void;
  onFinish?: () => void;
  inkOptions?: Partial<RenderOptions>;
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
    toolCalls: [] as Array<{ id: string; name: string; arguments: Record<string, unknown>; done: boolean }>,
    isStreaming: true,
  };

  let forceUpdate: () => void = () => {};

  const { processor } = options;
  processor.on('text', delta => {
    stateRef.text += delta;
    forceUpdate();
  });

  processor.on('thinking', delta => {
    stateRef.thinking += delta;
    forceUpdate();
  });

  processor.on('tool_call', part => {
    stateRef.toolCalls.push({ id: part.id || randomUUID(), name: part.name, arguments: part.parameters, done: true });
    forceUpdate();
  });

  processor.on('done', () => {
    stateRef.isStreaming = false;
    forceUpdate();
    options.onFinish?.();
  });

  processor.on('warning', error => {
    options.onWarning?.(error);
  });

  const InkStreamRenderer = (await import('./InkStreamRenderer.js')).default;

  const instance = render(
    h(InkStreamRenderer, {
      stateRef,
      forceUpdateRef: { current: () => forceUpdate() },
      setForceUpdate: (fn: () => void) => {
        forceUpdate = fn;
      },
      options,
    }),
  );

  return {
    instance,
    write(chunk: string): void {
      // Ink renderer is event-driven via processor; write is a no-op
    },
    end(): void {
      stateRef.isStreaming = false;
      forceUpdate();
    },
    unmount(): void {
      instance.unmount();
    },
  };
}
