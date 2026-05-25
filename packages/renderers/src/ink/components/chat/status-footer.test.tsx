import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { StatusFooter } from './status-footer.tsx';

describe('StatusFooter', () => {
  it('displays status text', () => {
    const { lastFrame } = render(<StatusFooter status="idle" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('idle');
  });

  it('displays model name when provided', () => {
    const { lastFrame } = render(
      <StatusFooter status="connected" modelName="claude-sonnet-4" palette={defaultAcidPalette} />
    );
    expect(lastFrame()).toContain('claude-sonnet-4');
  });

  it('displays elapsed time', () => {
    const { lastFrame } = render(<StatusFooter status="streaming" elapsedSec={42} palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('42s');
  });

  it('displays provider info', () => {
    const { lastFrame } = render(
      <StatusFooter status="connecting" provider="anthropic" palette={defaultAcidPalette} />
    );
    expect(lastFrame()).toContain('anthropic');
  });
});
