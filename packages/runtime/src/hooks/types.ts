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
  type: 'UserPromptSubmit';
  input: string;
  sessionId: string;
}

/** Fired before a tool call executes. Deterministic — never prompt-based. */
export interface PreToolCallEvent {
  type: 'PreToolCall';
  toolName: string;
  args: unknown;
  sessionId: string;
}

/** Fired after a tool call completes with its result. */
export interface PostToolCallEvent {
  type: 'PostToolCall';
  toolName: string;
  args: unknown;
  result: unknown;
  sessionId: string;
}

/** Fired before context compaction, allowing critical items to be pinned. */
export interface PreCompactEvent {
  type: 'PreCompact';
  contextSize: number;
  sessionId: string;
}

/** Fired when a spawned subagent terminates. */
export interface SubagentStopEvent {
  type: 'SubagentStop';
  subagentId: string;
  result: unknown;
  sessionId: string;
}

/** Fired when the session ends. */
export interface StopEvent {
  type: 'Stop';
  reason: string;
  sessionId: string;
}

/** Fired before a model response is returned to the user. */
export interface PreResponseEvent {
  type: 'PreResponse';
  response: unknown;
  sessionId: string;
}

/** Fired after a response has been delivered to the user. */
export interface PostResponseEvent {
  type: 'PostResponse';
  response: unknown;
  sessionId: string;
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
