import type { JsonObject } from '@agentsy/types';

/**
 * Shared provider-facing tools payload contract that is interoperable with NativeTool[].
 * This contract ensures consistency across different provider implementations.
 */
export interface ProviderTool {
  /**
   * The name of the tool/function to call.
   */
  name: string;

  /**
   * The parameters/arguments for the tool call as a structured object.
   */
  parameters: JsonObject;

  /**
   * Optional provider-assigned call ID for tracking and correlation.
   */
  id?: string;

  /**
   * The format in which this tool call was encoded in the stream.
   */
  format?: 'bare-xml' | 'json-wrapped' | 'native-json';

  /**
   * Additional metadata or provider-specific information.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type guard to check if an object conforms to the ProviderTool interface.
 */
export function isProviderTool(obj: unknown): obj is ProviderTool {
  if (!obj || typeof obj !== 'object') return false;

  const tool = obj as ProviderTool;
  return (
    typeof tool.name === 'string' &&
    tool.name.trim() !== '' &&
    (tool.parameters === undefined ||
      (typeof tool.parameters === 'object' && !Array.isArray(tool.parameters) && tool.parameters !== null)) &&
    (tool.id === undefined || typeof tool.id === 'string') &&
    (tool.format === undefined ||
      tool.format === 'bare-xml' ||
      tool.format === 'json-wrapped' ||
      tool.format === 'native-json') &&
    (tool.metadata === undefined ||
      (typeof tool.metadata === 'object' && !Array.isArray(tool.metadata) && tool.metadata !== null))
  );
}

/**
 * Converts a ProviderTool to a format compatible with NativeTool[].
 */
export function providerToolToNative(tool: ProviderTool): { name: string; arguments: JsonObject; id?: string } {
  return {
    name: tool.name,
    arguments: tool.parameters ?? {},
    ...(tool.id !== undefined && { id: tool.id }),
  };
}

/**
 * Converts a NativeTool[] compatible object to a ProviderTool.
 */
export function nativeToProviderTool(nativeTool: { name: string; arguments: JsonObject; id?: string }): ProviderTool {
  return {
    name: nativeTool.name,
    parameters: nativeTool.arguments ?? {},
    ...(nativeTool.id !== undefined && { id: nativeTool.id }),
    format: 'native-json',
  };
}
