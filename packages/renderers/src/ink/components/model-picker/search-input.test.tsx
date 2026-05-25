import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { SearchInput } from './search-input.tsx';

describe('SearchInput', () => {
  it('renders placeholder when empty', () => {
    const { lastFrame } = render(<SearchInput query="" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('Search');
  });

  it('renders query text', () => {
    const { lastFrame } = render(<SearchInput query="claude" palette={defaultAcidPalette} />);
    expect(lastFrame()).toContain('claude');
  });
});
