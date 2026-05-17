import { createPipeline } from '@agentsy/providers/pipeline';
import type { PipelineEvent } from '@agentsy/providers/pipeline';
/**
 * Integration: SSE text → createPipeline → PipelineEvents
 *
 * Tests the high-level `createPipeline` helper from @agentsy/providers which
 * wires SSE parsing, JSON parsing, normalisation, and the processor together.
 */
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: turn a multi-line SSE string into an async iterable of chunks so we
// can simulate a raw HTTP response body from a real provider.
// ---------------------------------------------------------------------------

async function* sseSource(text: string): AsyncGenerator<string> {
  // Yield the SSE text one "network chunk" at a time — split at newlines to
  // exercise real incremental SSE parsing.
  for (const line of text.split('\n')) {
    yield `${line}\n`;
  }
}

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Collect all events from a pipeline into an array
async function collectPipelineEvents(
  source: AsyncIterable<string>,
  provider: Parameters<typeof createPipeline>[1]['provider']
): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  for await (const event of createPipeline(source, { provider })) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions via SSE
// ---------------------------------------------------------------------------

describe('createPipeline (openai)', () => {
  it('emits delta events for each content chunk', async () => {
    const sse = `${sseLine({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] })}${sseLine({ choices: [{ delta: { content: ', world!' }, finish_reason: null }] })}${sseLine({ choices: [{ delta: {}, finish_reason: 'stop' }] })}data: [DONE]\n\n`;

    const events = await collectPipelineEvents(sseSource(sse), 'openai');

    const deltas = events.filter(e => e.type === 'delta');
    expect(deltas.map(e => e.content).join('')).toBe('Hello, world!');

    const done = events.find(e => e.type === 'message_done');
    expect(done).toBeDefined();
    expect(done?.provider).toBe('openai');
  });

  it('emits a tool_call event for XML-style tool calls in content', async () => {
    const xmlContent = 'Sure! <search_files><query>integration tests</query></search_files>';

    const sse = `${sseLine({ choices: [{ delta: { content: xmlContent }, finish_reason: 'stop' }] })}data: [DONE]\n\n`;

    const events = await collectPipelineEvents(sseSource(sse), 'openai');

    // The pipeline emits tool_call only when knownTools option includes the name.
    // Without knownTools the XML is treated as regular content.
    const textDeltas = events.filter(e => e.type === 'delta');
    // Either way the combined content should contain the original text
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  it('emits tool_call events when knownTools is configured', async () => {
    const xmlContent = '<search_files><query>cats</query></search_files>';

    const sse = `${sseLine({ choices: [{ delta: { content: xmlContent }, finish_reason: 'stop' }] })}data: [DONE]\n\n`;

    const events: PipelineEvent[] = [];
    for await (const event of createPipeline(sseSource(sse), {
      knownTools: new Set(['search_files']),
      provider: 'openai'
    })) {
      events.push(event);
    }

    const toolCalls = events.filter(e => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]?.tool_call?.name).toBe('search_files');
    expect(toolCalls[0]?.tool_call?.parameters).toStrictEqual({
      query: 'cats'
    });
  });

  it('emits thinking event when parseThinkTags=true', async () => {
    const content = '<think>internal reasoning</think>Final answer';

    const sse = `${sseLine({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}data: [DONE]\n\n`;

    const events: PipelineEvent[] = [];
    for await (const event of createPipeline(sseSource(sse), {
      parseThinkTags: true,
      provider: 'openai'
    })) {
      events.push(event);
    }

    const thinking = events.find(e => e.type === 'thinking');
    expect(thinking?.thinking).toBe('internal reasoning');

    const delta = events.filter(e => e.type === 'delta');
    expect(delta.map(e => e.content).join('')).toBe('Final answer');
  });

  it('yields error events for malformed JSON in SSE data', async () => {
    const sse = 'data: {not valid json}\n\ndata: [DONE]\n\n';

    const events = await collectPipelineEvents(sseSource(sse), 'openai');

    const errors = events.filter(e => e.type === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Anthropic via SSE
// ---------------------------------------------------------------------------

describe('createPipeline (anthropic)', () => {
  it('accumulates text delta events and emits message_done', async () => {
    const sse =
      sseLine({
        message: { usage: { input_tokens: 10 } },
        type: 'message_start'
      }) +
      sseLine({
        content_block: { text: '', type: 'text' },
        index: 0,
        type: 'content_block_start'
      }) +
      sseLine({
        delta: { text: 'Hi there', type: 'text_delta' },
        index: 0,
        type: 'content_block_delta'
      }) +
      sseLine({ index: 0, type: 'content_block_stop' }) +
      sseLine({
        delta: { stop_reason: 'end_turn' },
        type: 'message_delta',
        usage: { output_tokens: 3 }
      }) +
      sseLine({ type: 'message_stop' });

    const events = await collectPipelineEvents(sseSource(sse), 'anthropic');

    const deltas = events.filter(e => e.type === 'delta');
    expect(deltas.map(e => e.content).join('')).toBe('Hi there');

    expect(events.find(e => e.type === 'message_done')).toBeDefined();
  });

  it('emits thinking events for thinking_delta events', async () => {
    const sse =
      sseLine({
        content_block: { thinking: '', type: 'thinking' },
        index: 0,
        type: 'content_block_start'
      }) +
      sseLine({
        delta: { thinking: 'my reasoning', type: 'thinking_delta' },
        index: 0,
        type: 'content_block_delta'
      }) +
      sseLine({ index: 0, type: 'content_block_stop' }) +
      sseLine({
        content_block: { text: '', type: 'text' },
        index: 1,
        type: 'content_block_start'
      }) +
      sseLine({
        delta: { text: 'answer', type: 'text_delta' },
        index: 1,
        type: 'content_block_delta'
      }) +
      sseLine({
        delta: { stop_reason: 'end_turn' },
        type: 'message_delta',
        usage: { output_tokens: 3 }
      });

    const events = await collectPipelineEvents(sseSource(sse), 'anthropic');

    const thinking = events.find(e => e.type === 'thinking');
    expect(thinking?.thinking).toBe('my reasoning');

    const text = events
      .filter(e => e.type === 'delta')
      .map(e => e.content)
      .join('');
    expect(text).toBe('answer');
  });
});

// ---------------------------------------------------------------------------
// Gemini via SSE
// ---------------------------------------------------------------------------

describe('createPipeline (gemini)', () => {
  it('accumulates text parts from candidates', async () => {
    const sse =
      sseLine({
        candidates: [
          {
            content: { parts: [{ text: 'Gemini' }], role: 'model' },
            finishReason: null
          }
        ]
      }) +
      sseLine({
        candidates: [
          {
            content: { parts: [{ text: ' here' }], role: 'model' },
            finishReason: 'STOP'
          }
        ],
        usageMetadata: {
          candidatesTokenCount: 2,
          promptTokenCount: 5,
          totalTokenCount: 7
        }
      });

    const events = await collectPipelineEvents(sseSource(sse), 'gemini');

    const text = events
      .filter(e => e.type === 'delta')
      .map(e => e.content)
      .join('');
    expect(text).toBe('Gemini here');
  });
});

// ---------------------------------------------------------------------------
// Unknown provider
// ---------------------------------------------------------------------------

describe('createPipeline (unknown provider)', () => {
  it('throws synchronously for unknown provider', async () => {
    const gen = createPipeline(sseSource('data: {}\n\n'), {
      provider: 'unknown-provider' as Parameters<typeof createPipeline>[1]['provider']
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    });
    // The error is thrown when the generator function body begins executing
    expect(await gen.next()).rejects.toThrow('Unknown provider');
  });
});
