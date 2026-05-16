/**
 * Common part type for outbound messages across adapters.
 * Modelled after VS Code's LanguageModelChatResponsePart but generic.
 */
export type OutboundPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: Uint8Array | string }
  | {
      type: "tool-call";
      callId: string;
      name: string;
      input?: Record<string, unknown>;
    }
  | { type: "tool-result"; callId: string; content: string };

/**
 * Common message type for outbound messages across adapters.
 */
export interface OutboundMessage {
  role: "system" | "user" | "assistant";
  parts: OutboundPart[];
}

/**
 * Common options for outbound adapters.
 */
export interface OutboundAdapterOptions {
  /** Optional custom tool-call id normalizer. */
  normalizeToolCallId?: (originalId: string) => string;
  /** Optional warning hook for dropped/adjusted parts. */
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
}
