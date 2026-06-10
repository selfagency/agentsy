import type { ToolDefinition } from '../../definitions.js';

export function createFsTools(): ToolDefinition[] {
  return [
    {
      name: 'fs_read',
      description: 'Read a file from the filesystem.',
      annotations: { readOnlyHint: true },
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'Absolute path to the file' },
        { name: 'encoding', type: 'string', required: false, description: 'File encoding (default: utf-8)' }
      ],
      handler: input => {
        const path = String(input.path ?? '');
        if (!path) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        return { ok: true, data: { content: `[fs_read placeholder] ${path}` } };
      }
    },
    {
      name: 'fs_write',
      description: 'Write content to a file. Overwrites existing content.',
      annotations: { destructiveHint: true, openWorldHint: true },
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'Absolute path to the file' },
        { name: 'content', type: 'string', required: true, description: 'Content to write' },
        { name: 'append', type: 'boolean', required: false, description: 'Append instead of overwrite' }
      ],
      handler: input => {
        const path = String(input.path ?? '');
        if (!path) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        return { ok: true, data: { path, written: true } };
      }
    },
    {
      name: 'fs_patch',
      description: 'Apply a textual patch to a file (insert, replace, delete lines).',
      annotations: { destructiveHint: true },
      parameters: [
        { name: 'path', type: 'string', required: true, description: 'Absolute path to the file' },
        { name: 'oldString', type: 'string', required: true, description: 'Text to find' },
        { name: 'newString', type: 'string', required: false, description: 'Replacement text (omit to delete)' }
      ],
      handler: input => {
        const path = String(input.path ?? '');
        if (!path) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        return { ok: true, data: { path, patched: true } };
      }
    }
  ];
}
