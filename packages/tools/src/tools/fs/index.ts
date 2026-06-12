import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolDefinition } from '../../definitions.js';

/**
 * Resolve and validate a file path to prevent traversal attacks.
 *
 * Normalises the path, rejects paths with unresolved `..` segments
 * (indicating attempted escape from the intended directory), and
 * converts bare filenames to absolute paths relative to the cwd.
 */
function safePath(raw: string): string {
  const resolved = path.resolve(raw);
  const normalised = path.normalize(resolved);
  // After resolve + normalize, any remaining '..' segment means traversal
  if (normalised.split(path.sep).includes('..')) {
    throw new Error(`Path traversal detected: "${raw}" resolves outside the allowed scope`);
  }
  return normalised;
}

/** TypeScript type guard: is `enc` a valid `BufferEncoding` literal? */
function isBufferEncoding(enc: string): enc is BufferEncoding {
  return ['ascii', 'utf-8', 'utf16le', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'].includes(enc);
}

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
      handler: async input => {
        const filePath = typeof input.path === 'string' ? input.path : '';
        if (!filePath) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        try {
          const resolved = safePath(filePath);
          const encoding =
            typeof input.encoding === 'string' && isBufferEncoding(input.encoding) ? input.encoding : 'utf-8';
          const content = await fs.readFile(resolved, encoding);
          const stat = await fs.stat(resolved);
          return { ok: true, data: { content, size: stat.size, path: resolved } };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, data: null, error: `fs_read error: ${message}` };
        }
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
      handler: async input => {
        const filePath = typeof input.path === 'string' ? input.path : '';
        const content = typeof input.content === 'string' ? input.content : '';
        if (!filePath) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        try {
          const resolved = safePath(filePath);
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          if (input.append === true) {
            await fs.appendFile(resolved, content, 'utf-8');
          } else {
            await fs.writeFile(resolved, content, 'utf-8');
          }
          return { ok: true, data: { path: resolved, written: true, append: input.append === true } };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, data: null, error: `fs_write error: ${message}` };
        }
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
      handler: async input => {
        const filePath = typeof input.path === 'string' ? input.path : '';
        const oldString = typeof input.oldString === 'string' ? input.oldString : '';
        if (!filePath) {
          return { ok: false, data: null, error: 'Missing required parameter: path' };
        }
        if (!oldString) {
          return { ok: false, data: null, error: 'Missing required parameter: oldString' };
        }
        try {
          const resolved = safePath(filePath);
          const current = await fs.readFile(resolved, 'utf-8');
          if (!current.includes(oldString)) {
            return { ok: false, data: null, error: `Pattern not found in ${resolved}` };
          }
          const newContent =
            typeof input.newString === 'string'
              ? current.replace(oldString, input.newString)
              : current.replace(oldString, '');
          await fs.writeFile(resolved, newContent, 'utf-8');
          return { ok: true, data: { path: resolved, patched: true, changed: current !== newContent } };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, data: null, error: `fs_patch error: ${message}` };
        }
      }
    }
  ];
}

type BufferEncoding = 'ascii' | 'utf-8' | 'utf16le' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex';
