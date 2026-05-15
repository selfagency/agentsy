import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { runCli } from './index.js';

/**
 * Phase 0 CLI Command Validation
 * Ensures compress and compress-memory commands work correctly
 */

const SAMPLE_TEXT = `
This is a very comprehensive response that provides really extensive information.
The response is basically quite verbose and could definitely benefit from compression.
There is really quite a lot of redundant content here that should be compressed.
`;

describe('Phase 0: CLI Commands Validation', () => {
  let testFile: string;
  let capturedOutput: string[];

  beforeEach(() => {
    testFile = join('/tmp', `test-cli-${Date.now()}.txt`);
    capturedOutput = [];
  });

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
    const memoryTestFile = testFile.replace('.txt', '.md');
    if (existsSync(memoryTestFile)) {
      unlinkSync(memoryTestFile);
    }
    const backupFile = `${memoryTestFile}.original.md`;
    if (existsSync(backupFile)) {
      unlinkSync(backupFile);
    }
  });

  it('compress command works with --text flag', async () => {
    const exitCode = await runCli(['compress', '--level', 'full', '--text', SAMPLE_TEXT], {
      stdout: (value: string) => capturedOutput.push(value)
    });

    expect(exitCode).toBe(0);
    expect(capturedOutput.length).toBeGreaterThan(0);
    expect(capturedOutput[0]).toBeDefined(); // Compressed output
  });

  it('compress command supports different levels', async () => {
    for (const level of ['lite', 'full', 'ultra']) {
      capturedOutput = [];
      const exitCode = await runCli(['compress', '--level', level, '--text', SAMPLE_TEXT], {
        stdout: (value: string) => capturedOutput.push(value)
      });

      expect(exitCode).toBe(0);
      expect(capturedOutput.length).toBeGreaterThan(0);
    }
  });

  it('compress-memory command creates backup', async () => {
    const memoryFile = testFile.replace('.txt', '.md');
    writeFileSync(memoryFile, SAMPLE_TEXT, 'utf-8');

    const exitCode = await runCli(['compress-memory', '--file', memoryFile], {
      stdout: (value: string) => capturedOutput.push(value)
    });

    expect(exitCode).toBe(0);
    const backupFile = `${memoryFile}.original.md`;
    expect(existsSync(backupFile)).toBe(true);

    // Verify backup contains original content
    const backupContent = readFileSync(backupFile, 'utf-8');
    expect(backupContent).toContain('comprehensive');
  });

  it('compress-memory command preserves code blocks', async () => {
    const memoryFile = testFile.replace('.txt', '.md');
    const contentWithCode = `
${SAMPLE_TEXT}

\`\`\`typescript
export function important(): void {}
\`\`\`

More text after code.
    `;
    writeFileSync(memoryFile, contentWithCode, 'utf-8');

    const exitCode = await runCli(['compress-memory', '--file', memoryFile], {
      stdout: (value: string) => capturedOutput.push(value)
    });

    expect(exitCode).toBe(0);

    // Verify compressed file preserves code
    const compressedContent = readFileSync(memoryFile, 'utf-8');
    expect(compressedContent).toContain('export function important');
  });

  it('compress command reports savings ratio', async () => {
    const exitCode = await runCli(['compress', '--level', 'ultra', '--text', SAMPLE_TEXT], {
      stdout: (value: string) => capturedOutput.push(value)
    });

    expect(exitCode).toBe(0);

    // Should have compressed content and savings ratio
    const savingsLine = capturedOutput.find(line => line.includes('Savings:'));
    expect(savingsLine).toBeDefined();
    expect(savingsLine).toMatch(/Savings: \d+\.\d+%/);
  });

  it('compress command completes quickly', async () => {
    const startTime = performance.now();
    await runCli(['compress', '--level', 'full', '--text', SAMPLE_TEXT], {
      stdout: (value: string) => capturedOutput.push(value)
    });
    const elapsed = performance.now() - startTime;

    console.log(`CLI command time: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(100);
  });

  it('handles missing --file argument gracefully', async () => {
    const errors: string[] = [];
    const exitCode = await runCli(['compress-memory'], {
      stderr: (value: string) => errors.push(value)
    });

    expect(exitCode).toBe(1);
    expect(errors.some(e => e.includes('Missing --file'))).toBe(true);
  });

  it('handles missing input for compress command', async () => {
    const errors: string[] = [];
    const exitCode = await runCli(['compress'], {
      stderr: (value: string) => errors.push(value)
    });

    expect(exitCode).toBe(1);
    expect(errors.some(e => e.includes('Missing input'))).toBe(true);
  });

  it('compress-memory command reports savings', async () => {
    const memoryFile = testFile.replace('.txt', '.md');
    writeFileSync(memoryFile, SAMPLE_TEXT, 'utf-8');

    const exitCode = await runCli(['compress-memory', '--file', memoryFile], {
      stdout: (value: string) => capturedOutput.push(value)
    });

    expect(exitCode).toBe(0);
    const savingsLine = capturedOutput.find(line => line.includes('Savings:'));
    expect(savingsLine).toBeDefined();
  });
});
