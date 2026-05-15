import type { CapturedMemoryRecord } from './memory-capture.js';

export interface MemoryLintIssue {
  recordId: string;
  code: 'secret-like-pattern' | 'oversized-record';
  severity: 'warning' | 'error';
  message: string;
}

export interface MemoryLintResult {
  issues: MemoryLintIssue[];
}

export interface MemoryLintTool {
  execute(input?: MemoryLintInput): Promise<MemoryLintResult>;
}

export interface MemoryLintInput {
  maxContentLength?: number;
}

export interface MemoryLintToolDeps {
  list(): CapturedMemoryRecord[] | Promise<CapturedMemoryRecord[]>;
}

const SECRET_LIKE_PATTERN = /(api[_-]?key\s*=\s*\S+|sk_[a-z0-9_\-]{8,}|bearer\s+[a-z0-9._\-]{10,})/iu;

export function createMemoryLintTool(deps: MemoryLintToolDeps): MemoryLintTool {
  return {
    async execute(input: MemoryLintInput = {}) {
      const maxContentLength = input.maxContentLength ?? 4096;
      const records = await deps.list();
      const issues: MemoryLintIssue[] = [];

      for (const record of records) {
        if (SECRET_LIKE_PATTERN.test(record.content)) {
          issues.push({
            recordId: record.id,
            code: 'secret-like-pattern',
            severity: 'error',
            message: 'Record content appears to contain secret-like material.'
          });
        }

        if (record.content.length > maxContentLength) {
          issues.push({
            recordId: record.id,
            code: 'oversized-record',
            severity: 'warning',
            message: `Record content length (${record.content.length}) exceeds maxContentLength (${maxContentLength}).`
          });
        }
      }

      return { issues };
    }
  };
}
