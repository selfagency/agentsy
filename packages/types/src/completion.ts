/**
 * LLM request types.
 */

/**
 * Standardized input for any LLM request.
 * This is a generic interface that can be adapted to any provider (OpenAI, Anthropic, Gemini, etc.).
 */
export interface CompletionRequest {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus', 'gemini-pro'). */
  model: string;

  /** Messages to send to the model. Each message has a role and content parts. */
  messages: CompletionMessage[];

  /** Optional tools/function calling configuration. */
  tools?: ToolDefinition[];

  /** Temperature for response sampling (0.0-2.0). */
  temperature?: number;

  /** Maximum tokens to generate. */
  maxTokens?: number;

  /** Stop sequences to halt generation. */
  stop?: string[];

  /** Top-k sampling parameter. */
  topK?: number;

  /** Top-p (nucleus) sampling parameter. */
  topP?: number;

  /** Frequency penalty for token sampling. */
  frequencyPenalty?: number;

  /** Presence penalty for token sampling. */
  presencePenalty?: number;

  /** Seed for deterministic outputs. */
  seed?: number;

  /** Number of completions to generate. */
  n?: number;

  /** Whether to stream the response. */
  stream?: boolean;
}

/**
 * Message in a completion request.
 */
export interface CompletionMessage {
  /** Message role. */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /** Message content or parts. */
  content: string | ContentPart[];

  /** Optional tool call result (for role: 'tool'). */
  toolCallId?: string;
  /**
   * Name of the tool (for role: 'tool').
   * @deprecated Use toolCallId instead.
   */
  toolName?: string;
}

/**
 * Content part in a message.
 * Supports text, images, and tool calls.
 */
export type ContentPart = TextPart | ImagePart | ToolCallPart | ToolResultPart;

/** Plain text content. */
export interface TextPart {
  type: 'text';
  text: string;
}

/** Image content (for multimodal models). */
export interface ImagePart {
  type: 'image';
  /** Image data as URL or base64-encoded string. */
  imageUrl: string;
  /** Optional alternative text for accessibility. */
  detail?: 'auto' | 'low' | 'high';
}

/** Tool/function call content. */
export interface ToolCallPart {
  type: 'tool_call';
  /** Tool call ID for associating with responses. */
  id: string;
  /** Name of the tool to call. */
  name: string;
  /** Structured arguments to pass to the tool. */
  input: Record<string, unknown>;
}

/** Tool/function result content. */
export interface ToolResultPart {
  type: 'tool_result';
  /** Tool call ID this result corresponds to. */
  toolCallId: string;
  /** The result content from the tool. */
  content: string;
}

/**
 * Tool/function definition.
 */
export interface ToolDefinition {
  /** Tool name. */
  name: string;

  /** Tool description. */
  description: string;

  /** JSON Schema defining the function's parameters. */
  inputSchema: Record<string, unknown>;

  /** Optional: Union of input types (string, number, object, array, etc.). */
  inputType?: string;
}
