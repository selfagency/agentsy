import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { MessageBubble } from './message-bubble.tsx';

describe('MessageBubble', () => {
  it('renders user message right-aligned', () => {
    const { lastFrame } = render(<MessageBubble text="hello" role="user" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('hello');
    expect(lastFrame()).toContain('you');
  });

  it('renders assistant message left-aligned', () => {
    const { lastFrame } = render(<MessageBubble text="response" role="assistant" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('response');
    expect(lastFrame()).toContain('assistant');
  });

  it('renders system message with warning style', () => {
    const { lastFrame } = render(<MessageBubble text="system message" role="system" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('system message');
    expect(lastFrame()).toContain('system');
  });

  it('renders timestamp when provided', () => {
    const { lastFrame } = render(
      <MessageBubble text="hi" role="user" palette={defaultAcidPalette} timestamp="12:34:56" />
    );
    expect(lastFrame()).toContain('12:34:56');
  });

  it('renders dim text when dim prop is true', () => {
    const { lastFrame } = render(<MessageBubble text="dim text" role="assistant" palette={defaultAcidPalette} dim />);
    expect(lastFrame()).toContain('dim text');
  });
});
