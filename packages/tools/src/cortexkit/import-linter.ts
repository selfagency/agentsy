/**
 * Import linter — runs AFT's `aft_import organize` on changed files.
 *
 * Can be called as a precommit check or ad hoc to organize imports
 * across 20+ languages using tree-sitter-based analysis.
 *
 * @module @agentsy/tools/cortexkit
 */

import { getAftSessionBridge } from '@agentsy/shared';

export interface ImportLintResult {
  file: string;
  organized: boolean;
  reason?: string;
}

export interface ImportLintOptions {
  files: string[];
  projectRoot: string;
}

/**
 * Create an import linter that uses AFT's tree-sitter-backed import organizer.
 *
 * @param options - Project root and file list
 */
export async function lintImports(options: ImportLintOptions): Promise<ImportLintResult[]> {
  const { projectRoot, files } = options;
  const bridge = await getAftSessionBridge({ projectRoot });
  const results: ImportLintResult[] = [];

  for (const file of files) {
    try {
      const result = await bridge.send('import', { op: 'organize', filePath: file });

      const data = (result as { format_skipped_reason?: string }) ?? {};
      const skippedReason = data.format_skipped_reason;
      if (skippedReason === undefined) {
        results.push({ file, organized: true });
      } else {
        results.push({ file, organized: false, reason: skippedReason });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({
        file,
        organized: false,
        reason: msg
      });
    }
  }

  return results;
}
