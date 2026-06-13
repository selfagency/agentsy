import { describe, expect, it, vi } from 'vitest';
import { createWikiSynthesisHook } from './memory-wiki-synthesis.js';
import type { RuntimeHookEvent } from './types.js';

function makePostResponse(response: unknown = 'ok', sessionId = 'test-session'): RuntimeHookEvent {
  return { type: 'PostResponse', response, sessionId };
}

describe('createWikiSynthesisHook', () => {
  it('skips non-PostResponse events', async () => {
    const wiki = { synthesize: vi.fn() };
    const hook = createWikiSynthesisHook({ wiki });
    const event = { type: 'PreToolCall', sessionId: 'test-session', toolName: 'fs_read', args: {} } as RuntimeHookEvent;

    const result = await hook.handler(event);

    expect(result).toEqual({ continue: true });
    expect(wiki.synthesize).not.toHaveBeenCalled();
  });

  it('does not synthesize before the turn threshold', async () => {
    const wiki = { synthesize: vi.fn() };
    const hook = createWikiSynthesisHook({ wiki, everyNTurns: 5 });

    for (let i = 0; i < 4; i++) {
      await hook.handler(makePostResponse('ok'));
    }

    expect(wiki.synthesize).not.toHaveBeenCalled();
  });

  it('synthesizes when the turn threshold is reached', async () => {
    const wiki = { synthesize: vi.fn().mockResolvedValue(undefined) };
    const hook = createWikiSynthesisHook({ wiki, everyNTurns: 5 });

    for (let i = 0; i < 5; i++) {
      await hook.handler(makePostResponse('ok'));
    }

    expect(wiki.synthesize).toHaveBeenCalledTimes(1);
    expect(wiki.synthesize).toHaveBeenCalledWith('test-session');
  });

  it('synthesizes every N turns', async () => {
    const wiki = { synthesize: vi.fn().mockResolvedValue(undefined) };
    const hook = createWikiSynthesisHook({ wiki, everyNTurns: 3 });

    for (let i = 0; i < 9; i++) {
      await hook.handler(makePostResponse('ok'));
    }

    expect(wiki.synthesize).toHaveBeenCalledTimes(3); // turns 3, 6, 9
  });

  it('maintains separate counters per session', async () => {
    const wiki = { synthesize: vi.fn().mockResolvedValue(undefined) };
    const hook = createWikiSynthesisHook({ wiki, everyNTurns: 3 });

    await hook.handler(makePostResponse('ok', 'session-a'));
    await hook.handler(makePostResponse('ok', 'session-b'));
    await hook.handler(makePostResponse('ok', 'session-a')); // a hits 3? no, a=2
    await hook.handler(makePostResponse('ok', 'session-b')); // b=2
    await hook.handler(makePostResponse('ok', 'session-a')); // a=3 — synthesize
    await hook.handler(makePostResponse('ok', 'session-b')); // b=3 — synthesize

    expect(wiki.synthesize).toHaveBeenCalledTimes(2);
    expect(wiki.synthesize).toHaveBeenCalledWith('session-a');
    expect(wiki.synthesize).toHaveBeenCalledWith('session-b');
  });

  it('isolates wiki errors', async () => {
    const wiki = { synthesize: vi.fn().mockRejectedValue(new Error('wiki down')) };
    const hook = createWikiSynthesisHook({ wiki, everyNTurns: 1 });

    const result = await hook.handler(makePostResponse('ok'));

    expect(result).toEqual({ continue: true });
  });
});
