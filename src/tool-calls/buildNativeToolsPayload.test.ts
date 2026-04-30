import { describe, it, expect } from 'vitest';
import { buildNativeToolsArray } from './buildNativeToolsPayload.js';

const SEARCH_TOOL = {
  name: 'search_files',
  description: 'Search files',
  inputSchema: {
    properties: {
      'content-type': { type: 'string', description: 'Content type header' },
      path: { type: 'string' },
    },
    required: ['content-type', 'path'],
  },
};

const RICH_SCHEMA_TOOL = {
  name: 'create_event',
  description: 'Create a calendar event',
  inputSchema: {
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      duration: { type: 'integer', minimum: 1, maximum: 1440, description: 'Duration in minutes' },
      status: { type: 'string', enum: ['tentative', 'confirmed', 'cancelled'], default: 'tentative' },
      tags: { type: 'array', items: { type: 'string', pattern: '^[a-z]+$' } },
      location: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          country: { type: 'string', format: 'iso3166-alpha2' },
        },
        required: ['city'],
      },
    },
    required: ['title', 'duration'],
  },
};

describe('buildNativeToolsArray', () => {
  it('preserves property names with hyphens and retains required entries', () => {
    const tools = buildNativeToolsArray([SEARCH_TOOL]);
    expect(tools).toHaveLength(1);
    const fn = tools[0]!.function;
    expect(fn.parameters.properties['content-type']).toBeDefined();
    expect(fn.parameters.properties.path).toBeDefined();
    expect(fn.parameters.required).toContain('content-type');
    expect(fn.parameters.required).toContain('path');
  });

  it('passes through rich JSON Schema keywords without stripping them', () => {
    const tools = buildNativeToolsArray([RICH_SCHEMA_TOOL]);
    const props = tools[0]!.function.parameters.properties;

    // String constraints
    expect(props.title).toMatchObject({ type: 'string', minLength: 1, maxLength: 200 });
    // Integer constraints
    expect(props.duration).toMatchObject({ type: 'integer', minimum: 1, maximum: 1440 });
    // Enum and default
    expect(props.status).toMatchObject({ enum: ['tentative', 'confirmed', 'cancelled'], default: 'tentative' });
    // Array with item schema
    expect(props.tags).toMatchObject({ type: 'array', items: { type: 'string', pattern: '^[a-z]+$' } });
    // Nested object
    const loc = props.location as Record<string, unknown>;
    expect(loc.type).toBe('object');
    expect(loc.required).toContain('city');
  });

  it('strict mode sets strict:true and enforces additionalProperties:false on nested objects', () => {
    const tools = buildNativeToolsArray([RICH_SCHEMA_TOOL], { strict: true });
    const fn = tools[0]!.function;

    expect(fn.strict).toBe(true);
    // Top-level parameters already have additionalProperties: false
    expect(fn.parameters.additionalProperties).toBe(false);
    // Nested location object should also have additionalProperties: false
    const loc = fn.parameters.properties.location as Record<string, unknown>;
    expect(loc.additionalProperties).toBe(false);
  });

  it('strict mode does not mutate non-object properties', () => {
    const tools = buildNativeToolsArray([RICH_SCHEMA_TOOL], { strict: true });
    const props = tools[0]!.function.parameters.properties;
    // Non-object schemas are returned as-is
    expect(props.title).toMatchObject({ type: 'string', minLength: 1, maxLength: 200 });
    expect(props.tags).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  it('without strict option, strict flag is absent', () => {
    const tools = buildNativeToolsArray([SEARCH_TOOL]);
    expect(tools[0]!.function.strict).toBeUndefined();
  });

  it('throws on invalid tool names', () => {
    expect(() => buildNativeToolsArray([{ name: '1invalid' }])).toThrow('Invalid tool name');
    expect(() => buildNativeToolsArray([{ name: 'has space' }])).toThrow('Invalid tool name');
  });
});

