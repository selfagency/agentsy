/**
 * MSW request handlers for provider API endpoints.
 *
 * Simulates OpenAI, Anthropic, Gemini, and other provider SSE streaming
 * responses used by @agentsy/providers UniversalClient and related code.
 *
 * @module @agentsy/testing/msw/handlers/providers
 */

import { type HttpHandler, HttpResponse, http } from 'msw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Build a partial OpenAI streaming response body.
 */
function openaiStreamBody(
  chunks: string[],
  finalUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }
): string {
  const id = 'chatcmpl-mock';
  const created = Math.floor(Date.now() / 1000);
  const lines: string[] = [];

  for (const chunk of chunks) {
    lines.push(
      sseLine({
        choices: [{ delta: { content: chunk }, finish_reason: null }],
        created,
        id,
        model: 'gpt-4o-mock',
        object: 'chat.completion.chunk'
      })
    );
  }

  // Final stop chunk
  lines.push(
    sseLine({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      created,
      id,
      model: 'gpt-4o-mock',
      object: 'chat.completion.chunk',
      ...(finalUsage
        ? {
            usage: {
              input_tokens: finalUsage.inputTokens,
              output_tokens: finalUsage.outputTokens,
              total_tokens: finalUsage.totalTokens
            }
          }
        : {})
    })
  );

  lines.push('data: [DONE]\n\n');

  return lines.join('');
}

/**
 * Build a partial Anthropic streaming response body.
 */
function anthropicStreamBody(chunks: string[]): string {
  const lines: string[] = [];

  lines.push(
    sseLine({
      message: { id: 'msg_mock', type: 'message', usage: { input_tokens: 12 } },
      type: 'message_start'
    })
  );

  lines.push(
    sseLine({
      content_block: { text: '', type: 'text' },
      index: 0,
      type: 'content_block_start'
    })
  );

  for (const chunk of chunks) {
    lines.push(
      sseLine({
        delta: { text: chunk, type: 'text_delta' },
        index: 0,
        type: 'content_block_delta'
      })
    );
  }

  lines.push(sseLine({ index: 0, type: 'content_block_stop' }));
  lines.push(
    sseLine({
      delta: { stop_reason: 'end_turn' },
      type: 'message_delta',
      usage: { output_tokens: chunks.join('').length }
    })
  );
  lines.push(sseLine({ type: 'message_stop' }));

  return lines.join('');
}

/**
 * Build a partial Gemini streaming response body.
 */
function geminiStreamBody(chunks: string[]): string {
  const lines: string[] = [];

  for (const chunk of chunks) {
    lines.push(
      sseLine({
        candidates: [
          {
            content: { parts: [{ text: chunk }], role: 'model' },
            finishReason: null
          }
        ]
      })
    );
  }

  lines.push(
    sseLine({
      candidates: [
        {
          content: { parts: [{ text: '' }], role: 'model' },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        candidatesTokenCount: chunks.join('').length,
        promptTokenCount: 10,
        totalTokenCount: 10 + chunks.join('').length
      }
    })
  );

  return lines.join('');
}

/** Build a non-streaming OpenAI completion response body. */
function openaiCompleteBody(content: string): string {
  return JSON.stringify({
    choices: [{ finish_reason: 'stop', index: 0, message: { content, role: 'assistant' } }],
    created: Math.floor(Date.now() / 1000),
    id: 'chatcmpl-mock',
    model: 'gpt-4o-mock',
    object: 'chat.completion',
    usage: {
      completion_tokens: content.length,
      prompt_tokens: 20,
      total_tokens: 20 + content.length
    }
  });
}

// ---------------------------------------------------------------------------
// Provider-specific handler factories
// ---------------------------------------------------------------------------

export interface ProviderStreamingOptions {
  /** Content chunks to stream (default: ['Hello', ', world!']) */
  chunks?: string[];
  /** Response delay in ms (default: 0) */
  delay?: number;
  /** Simulate an error response instead of streaming */
  simulateError?: { status: number; statusText: string; body?: string };
}

/**
 * Create an OpenAI chat completions streaming handler.
 *
 * POST to `https://api.openai.com/v1/chat/completions` with `stream: true`
 * receives an SSE stream of delta chunks.
 */
export function createOpenAIHandler(options?: ProviderStreamingOptions): HttpHandler {
  const { chunks = ['Hello', ', world!'], simulateError } = options ?? {};
  const body = simulateError ? (simulateError.body ?? '') : openaiStreamBody(chunks);

  return http.post('https://api.openai.com/v1/chat/completions', async () => {
    if (simulateError) {
      return new HttpResponse(body, {
        status: simulateError.status,
        statusText: simulateError.statusText
      });
    }

    return new HttpResponse(body, {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200
    });
  });
}

/**
 * Create an OpenAI chat completions **non-streaming** handler.
 *
 * POST to `https://api.openai.com/v1/chat/completions` (no `stream` flag)
 * returns a JSON completion body.
 */
export function createOpenAICompleteHandler(content?: string): HttpHandler {
  return http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json(JSON.parse(openaiCompleteBody(content ?? 'Mock response')))
  );
}

/**
 * Create an Anthropic messages streaming handler.
 *
 * POST to `https://api.anthropic.com/v1/messages` receives an SSE stream
 * of Anthropic-format events.
 */
export function createAnthropicHandler(options?: ProviderStreamingOptions): HttpHandler {
  const { chunks = ['Hello', ' from Anthropic'], simulateError } = options ?? {};
  const body = simulateError ? (simulateError.body ?? '') : anthropicStreamBody(chunks);

  return http.post('https://api.anthropic.com/v1/messages', async () => {
    if (simulateError) {
      return new HttpResponse(body, {
        status: simulateError.status,
        statusText: simulateError.statusText
      });
    }

    return new HttpResponse(body, {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200
    });
  });
}

/**
 * Create a Gemini streaming handler.
 *
 * POST to `https://generativelanguage.googleapis.com/v1beta/models` receives
 * an SSE stream of Gemini-format candidates.
 */
export function createGeminiHandler(options?: ProviderStreamingOptions): HttpHandler {
  const { chunks = ['Gemini', ' streaming'], simulateError } = options ?? {};
  const body = simulateError ? (simulateError.body ?? '') : geminiStreamBody(chunks);

  return http.post('https://generativelanguage.googleapis.com/v1beta/models*', async () => {
    if (simulateError) {
      return new HttpResponse(body, {
        status: simulateError.status,
        statusText: simulateError.statusText
      });
    }

    return new HttpResponse(body, {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200
    });
  });
}

/**
 * Create all provider handlers in a single array for convenience.
 */
export function createAllProviderHandlers(streamOptions?: ProviderStreamingOptions): HttpHandler[] {
  return [
    createOpenAIHandler(streamOptions),
    createAnthropicHandler(streamOptions),
    createGeminiHandler(streamOptions)
  ];
}
