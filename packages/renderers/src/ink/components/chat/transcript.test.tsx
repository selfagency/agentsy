import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { defaultAcidPalette } from '../../theme/palette.ts';
import { Transcript, type TranscriptTurn } from './transcript.tsx';

describe('Transcript', () => {
  const sampleTurns: TranscriptTurn[] = [
    { id: '1', role: 'user', text: 'hello' },
    { id: '2', role: 'assistant', text: 'hi there' }
  ];

  it('renders conversation turns', () => {
    const { lastFrame } = render(
      <Transcript turns={sampleTurns} palette={defaultAcidPalette} isStreaming={false} status="idle" />
    );
    const frame = lastFrame();
    expect(frame).toContain('hello');
    expect(frame).toContain('hi there');
  });

  it('shows status idle', () => {
    const { lastFrame } = render(
      <Transcript turns={sampleTurns} palette={defaultAcidPalette} isStreaming={false} status="idle" />
    );
    expect(lastFrame()).toContain('idle');
  });

  it('shows streaming cursor when streaming', () => {
    const { lastFrame } = render(
      <Transcript turns={sampleTurns} palette={defaultAcidPalette} isStreaming={true} status="streaming" />
    );
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('shows token meter when tokens provided', () => {
    const { lastFrame } = render(
      <Transcript
        turns={sampleTurns}
        palette={defaultAcidPalette}
        isStreaming={false}
        status="idle"
        inputTokens={42}
        outputTokens={7}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain('42');
    expect(frame).toContain('7');
  });
});
