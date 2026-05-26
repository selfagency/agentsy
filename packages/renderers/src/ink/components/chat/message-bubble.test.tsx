import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { MessageBubble } from './message-bubble.tsx';

describe('MessageBubble', () => {
  it('renders user message right-aligned', () => {
    const { lastFrame } = render(<MessageBubble palette={defaultAcidPalette} text="hello" />);
    expect(lastFrame()).toContain('hello');
    expect(lastFrame()).toContain('you');
  });

  it('renders assistant message left-aligned', () => {
    const { lastFrame } = render(<MessageBubble palette={defaultAcidPalette} text="response" />);
    expect(lastFrame()).toContain('response');
    expect(lastFrame()).toContain('assistant');
  });

  it('renders system message with warning style', () => {
    const { lastFrame } = render(<MessageBubble palette={defaultAcidPalette} text="system message" />);
    expect(lastFrame()).toContain('system message');
    expect(lastFrame()).toContain('system');
  });

  it('renders timestamp when provided', () => {
    const { lastFrame } = render(<MessageBubble palette={defaultAcidPalette} text="hi" timestamp="12:34:56" />);
    expect(lastFrame()).toContain('12:34:56');
  });

  it('renders dim text when dim prop is true', () => {
    const { lastFrame } = render(<MessageBubble dim palette={defaultAcidPalette} text="dim text" />);
    expect(lastFrame()).toContain('dim text');
  });
});
