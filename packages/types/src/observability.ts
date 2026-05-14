/**
 * Observability and distributed tracing types including AG-UI protocol events.
 */

export enum EventType {
  RUN_STARTED = 'run:started',
  RUN_FINISHED = 'run:finished',
  RUN_ERROR = 'run:error',
  RUN_INTERRUPTED = 'run:interrupted',
  STEP_STARTED = 'step:started',
  STEP_FINISHED = 'step:finished',
  TEXT_MESSAGE_START = 'text_message:start',
  TEXT_MESSAGE_CONTENT = 'text_message:content',
  TEXT_MESSAGE_END = 'text_message:end',
  REASONING_START = 'reasoning:start',
  REASONING_MESSAGE_START = 'reasoning_message:start',
  REASONING_MESSAGE_CONTENT = 'reasoning_message:content',
  REASONING_MESSAGE_END = 'reasoning_message:end',
  REASONING_END = 'reasoning:end',
  TOOL_CALL_START = 'tool_call:start',
  TOOL_CALL_ARGS = 'tool_call:args',
  TOOL_CALL_END = 'tool_call:end',
  TOOL_CALL_RESULT = 'tool_call:result',
  MESSAGES_SNAPSHOT = 'messages:snapshot',
  STATE_SNAPSHOT = 'state:snapshot',
  STATE_DELTA = 'state:delta',
}