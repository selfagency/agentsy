import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { AgentPicker, type AgentEntry } from './index.tsx';

describe('AgentPicker', () => {
  const agents: AgentEntry[] = [
    {
      id: 'superagents/research',
      name: 'Research',
      description: 'Deep research mode',
      provenance: 'bundled',
      active: true
    },
    {
      id: 'user/custom',
      name: 'Custom',
      description: 'My custom agent',
      provenance: 'user',
      active: false,
      model: 'claude-opus-4',
      toolCount: 3
    }
  ];

  it('renders agent list', () => {
    const { lastFrame } = render(
      <AgentPicker agents={agents} query="" highlightIndex={0} palette={defaultAcidPalette} />
    );
    const frame = lastFrame();
    expect(frame).toContain('Research');
    expect(frame).toContain('Custom');
  });

  it('shows provenance badges', () => {
    const { lastFrame } = render(
      <AgentPicker agents={agents} query="" highlightIndex={0} palette={defaultAcidPalette} />
    );
    expect(lastFrame()).toContain('built-in');
  });

  it('filters agents by query', () => {
    const { lastFrame } = render(
      <AgentPicker agents={agents} query="Custom" highlightIndex={0} palette={defaultAcidPalette} />
    );
    const frame = lastFrame();
    expect(frame).toContain('Custom');
    expect(frame).not.toContain('Research');
  });

  it('shows empty state when filter matches nothing', () => {
    const { lastFrame } = render(
      <AgentPicker agents={agents} query="no-match-xyz" highlightIndex={0} palette={defaultAcidPalette} />
    );
    expect(lastFrame()).toContain('no-match-xyz');
  });
});
