/**
 * LLM message scrubbing — bagdock-inspired wrapper for AI model input sanitization.
 *
 * ## Usage
 *
 * ```typescript
 * const messages = [
 *   { role: 'system', content: 'You are a bot.' },
 *   { role: 'user', content: 'My email is user@test.com' },
 * ];
 *
 * const scrubbed = await scrubMessagesForModel(messages, [piiScanner]);
 * // System message unchanged, user email redacted
 * ```
 *
 * ## Design
 *
 * Only `role: 'user'` messages are scrubbed. System and assistant messages
 * pass through unchanged, following bagdock's `scrubMessagesForModel` pattern.
 * This ensures the LLM still receives its full instruction context.
 */

import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface ChatMessage {
  readonly content: string;
  readonly role: 'user' | 'assistant' | 'system';
}

export interface ScrubbedMessage extends ChatMessage {
  /** Detections that triggered scrubbing (if any). */
  readonly detections?: GuardrailResult['detections'];
  /** True if any scanner transformed the content. */
  readonly scrubbed: boolean;
}

export interface MessageScrubResult {
  /** Combined detections from all scanners that triggered. */
  readonly detections: GuardrailResult['detections'];
  /** Error message if a scanner threw (message preserved as-is). */
  readonly error?: string;
  /** The scrubbed (or untouched) message. */
  readonly message: ScrubbedMessage;
}

// =============================================================================
// Single message scrubbing
// =============================================================================

/**
 * Scrub a single message through a pipeline of scanners.
 *
 * Non-user messages pass through unchanged. User messages are evaluated
 * against every scanner; the first scanner that returns `block` takes
 * precedence, otherwise `transform` outcomes chain.
 *
 * @param message — The chat message to scrub.
 * @param scanners — Ordered array of guardrail scanners.
 * @returns The scrubbing result with the sanitized message.
 */
export async function scrubMessage(message: ChatMessage, scanners: GuardrailScanner[]): Promise<MessageScrubResult> {
  // Only scrub user messages
  if (message.role !== 'user') {
    return {
      message: { ...message, scrubbed: false },
      detections: []
    };
  }

  let content = message.content;
  const allDetections: Detection[] = [];

  for (const scanner of scanners) {
    try {
      const result = await scanner.evaluate(content);

      const detections = result.detections ?? [];
      allDetections.push(...detections);

      if (result.status === 'block') {
        // Block takes precedence — return as-is but mark as blocked
        return {
          message: {
            ...message,
            content,
            scrubbed: true
          },
          detections: allDetections
        };
      }

      if (result.status === 'transform' && result.sanitized) {
        content = result.sanitized;
      }
    } catch (error) {
      // Scanner error — preserve original content, record the error
      return {
        message: {
          ...message,
          content: message.content,
          scrubbed: false
        },
        detections: allDetections,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const wasScrubbed = content !== message.content;

  return {
    message: {
      ...message,
      content,
      scrubbed: wasScrubbed,
      detections: allDetections.length > 0 ? allDetections : undefined
    },
    detections: allDetections
  };
}

// =============================================================================
// Batch scrubbing — simple API
// =============================================================================

/**
 * Scrub an array of messages for LLM consumption.
 *
 * Non-user messages pass through unchanged. User messages are evaluated
 * against all scanners. The returned array has the same length and order
 * as the input.
 *
 * @param messages — Array of chat messages to scrub.
 * @param scanners — Ordered array of guardrail scanners.
 * @returns Scrubbed messages (same length and order as input).
 */
export async function scrubMessagesForModel(
  messages: ChatMessage[],
  scanners: GuardrailScanner[]
): Promise<ScrubbedMessage[]> {
  if (messages.length === 0) {
    return [];
  }

  const results = await Promise.all(messages.map(message => scrubMessage(message, scanners)));

  return results.map(r => r.message);
}

// =============================================================================
// Batch scrubbing — detailed API with per-message results
// =============================================================================

/**
 * Scrub messages and return detailed per-message results.
 *
 * Unlike `scrubMessagesForModel`, this returns the full `MessageScrubResult`
 * including combined detections and per-message error information.
 *
 * @param messages — Array of chat messages to scrub.
 * @param scanners — Ordered array of guardrail scanners.
 * @returns Detailed per-message results with error isolation.
 */
export function scrubMessagesDetailed(
  messages: ChatMessage[],
  scanners: GuardrailScanner[]
): Promise<MessageScrubResult[]> {
  return Promise.all(messages.map(message => scrubMessage(message, scanners)));
}
