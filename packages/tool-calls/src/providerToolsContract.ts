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
 * Type predicate for validating string properties.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Type predicate for validating JsonObject properties.
 */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type predicate for validating optional string properties.
 */
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

/**
 * Type predicate for validating optional JsonObject properties.
 */
function isOptionalJsonObject(value: unknown): value is JsonObject | undefined {
  return value === undefined || isJsonObject(value);
}

/**
 *Valid format values for ProviderTool.
 */
const VALID_FORMATS = ['bare-xml', 'json-wrapped', 'native-json'] as const;

/**
 * Type predicate for validating format property.
 */
function isValidFormat(value: unknown): value is typeof VALID_FORMATS[number] | undefined {
  return value === undefined || (typeof value === 'string' && VALID_FORMATS.includes(value as never));
}

/**
 * Type guard to check if an object conforms to the ProviderTool interface.
 * All required fields must be present and valid.
 */
export function isProviderTool(obj: unknown): obj is ProviderTool {
  if (!obj || typeof obj !== 'object') return false;

  const tool = obj as Record<string, unknown>;
  
  return (
    isNonEmptyString(tool.name) &&
    isJsonObject(tool.parameters) &&
    isOptionalString(tool.id) &&
    isValidFormat(tool.format) &&
    isOptionalJsonObject(tool.metadata)
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
