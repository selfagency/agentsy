/**
 * Hook event types for the runtime lifecycle.
 *
 * These discriminated-union events are fired by the `HookRegistry` at
 * specific points in the task execution lifecycle. Each handler receives
 * the full event context and can return a `HookResult` to influence
 * whether execution continues, blocks, or transforms the payload.
 */

/** Result returned by a single hook handler. */
export type HookResult = { continue: true } | { continue: false; reason: string } | { transform: unknown };

/** Fired when raw user input arrives, before any model call. */
export interface UserPromptSubmitEvent {
  input: string;
  sessionId: string;
  type: 'UserPromptSubmit';
}

/** Fired before a tool call executes. Deterministic — never prompt-based. */
export interface PreToolCallEvent {
  args: unknown;
  sessionId: string;
  toolName: string;
  type: 'PreToolCall';
}

/** Fired after a tool call completes with its result. */
export interface PostToolCallEvent {
  args: unknown;
  result: unknown;
  sessionId: string;
  toolName: string;
  type: 'PostToolCall';
}

/** Fired before context compaction, allowing critical items to be pinned. */
export interface PreCompactEvent {
  contextSize: number;
  sessionId: string;
  type: 'PreCompact';
}

/** Fired when a spawned subagent terminates. */
export interface SubagentStopEvent {
  result: unknown;
  sessionId: string;
  subagentId: string;
  type: 'SubagentStop';
}

/** Fired when the session ends. */
export interface StopEvent {
  reason: string;
  sessionId: string;
  type: 'Stop';
}

/** Fired before a model response is returned to the user. */
export interface PreResponseEvent {
  response: unknown;
  sessionId: string;
  type: 'PreResponse';
}

/** Fired after a response has been delivered to the user. */
export interface PostResponseEvent {
  response: unknown;
  sessionId: string;
  type: 'PostResponse';
}

/** Union of all runtime hook events. */
export type RuntimeHookEvent =
  | UserPromptSubmitEvent
  | PreToolCallEvent
  | PostToolCallEvent
  | PreCompactEvent
  | SubagentStopEvent
  | StopEvent
  | PreResponseEvent
  | PostResponseEvent;
