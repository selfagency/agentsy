import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { ApprovalState } from './approval-state.tsx';

describe('ApprovalState', () => {
  it('renders pending state', () => {
    const { lastFrame } = render(
      <ApprovalState status="pending" action="execute tool: read_file" palette={defaultAcidPalette} />
    );
    expect(lastFrame()).toContain('read_file');
  });

  it('renders approved state', () => {
    const { lastFrame } = render(<ApprovalState status="approved" action="write file" palette={defaultAcidPalette} />);
    const frame = lastFrame();
    expect(frame).toContain('write file');
  });

  it('renders rejected state', () => {
    const { lastFrame } = render(<ApprovalState status="rejected" action="delete file" palette={defaultAcidPalette} />);
    const frame = lastFrame();
    expect(frame).toContain('delete file');
  });
});
