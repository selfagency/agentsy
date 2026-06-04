import { bench, describe } from 'vitest';

import { compressOutput } from './index.js';

const BENCHMARK_SAMPLES = {
  codeOutput: `# Code Documentation

This is a response that contains code blocks which should be preserved.

\`\`\`typescript
export function compressOutput(response: string, options: OutputCompressionOptions): OutputCompressionResult {
  const preserve = new Set(options.preserve ?? [...DEFAULT_PRESERVATION_SET]);
  const level = options.level;

  if (!preserve.has('code')) {
    const originalTokens = estimateTextTokens(response);
    const compressed = compressNonCodeSegment(response, level);
    const compressedTokens = estimateTextTokens(compressed);
    return {
      original: response,
      compressed,
      originalTokens,
      compressedTokens,
      savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens),
    };
  }
}
\`\`\`

And here is some text that is really quite verbose and basically says nothing important. The code above is quite important and should be preserved carefully.
`,
  largeOutput: `# System Architecture Documentation

This document provides comprehensive, detailed analysis of our system architecture. The architecture basically consists of several key components that work together really effectively.

## Component Overview

Component 1: This component is really important for system stability. It handles really critical operations in a very sophisticated manner. The implementation is quite complex but basically performs its core function effectively.

Component 2: This component is simply essential for data processing. It processes data through multiple transformation stages, which is really important. The component basically receives input and produces output in a very systematic way.

Component 3: This is a really critical component that handles security concerns. The security model is quite comprehensive and basically provides multiple layers of protection.

## Performance Analysis

Performance metrics show that the system is working really well overall. The latency is quite acceptable and basically meets our requirements. Throughput is also quite good, which is really important for production deployments.

## Integration Points

Integration with external systems is really straightforward and basically follows standard patterns. The API is very simple and basically provides all necessary functionality.

More detailed information that is just restating previous points in a verbose and redundant manner.
Additional paragraphs that add very little new information but just expand the document unnecessarily.`,
  mediumOutput: `# Analysis Report

This is a very comprehensive analysis that provides really extensive information about the system.
The system basically works by processing data through multiple stages, which is really important for performance.

## Key Findings

The analysis simply shows that the implementation is basically working correctly, and the performance metrics are really impressive.
More analysis here that is quite redundant and repetitive with previously stated information.

Some additional comments and observations that basically reiterate earlier points in a verbose manner.`,
  shortOutput: 'This is a simple response that should be compressed effectively and efficiently.'
};

describe('Phase 0: Output Compression Benchmarks', () => {
  describe('Lite compression level', () => {
    bench('short text (<100 chars)', () => {
      compressOutput(BENCHMARK_SAMPLES.shortOutput, {
        level: 'lite',
        preserve: ['code']
      });
    });

    bench('medium text (~500 chars)', () => {
      compressOutput(BENCHMARK_SAMPLES.mediumOutput, {
        level: 'lite',
        preserve: ['code']
      });
    });

    bench('large text (~2000 chars)', () => {
      compressOutput(BENCHMARK_SAMPLES.largeOutput, {
        level: 'lite',
        preserve: ['code']
      });
    });
  });

  describe('Full compression level', () => {
    bench('short text', () => {
      compressOutput(BENCHMARK_SAMPLES.shortOutput, {
        level: 'full',
        preserve: ['code']
      });
    });

    bench('medium text', () => {
      compressOutput(BENCHMARK_SAMPLES.mediumOutput, {
        level: 'full',
        preserve: ['code']
      });
    });

    bench('large text', () => {
      compressOutput(BENCHMARK_SAMPLES.largeOutput, {
        level: 'full',
        preserve: ['code']
      });
    });
  });

  describe('Ultra compression level', () => {
    bench('short text', () => {
      compressOutput(BENCHMARK_SAMPLES.shortOutput, {
        level: 'ultra',
        preserve: ['code']
      });
    });

    bench('medium text', () => {
      compressOutput(BENCHMARK_SAMPLES.mediumOutput, {
        level: 'ultra',
        preserve: ['code']
      });
    });

    bench('large text', () => {
      compressOutput(BENCHMARK_SAMPLES.largeOutput, {
        level: 'ultra',
        preserve: ['code']
      });
    });
  });

  describe('With code preservation', () => {
    bench('text with code blocks (full)', () => {
      compressOutput(BENCHMARK_SAMPLES.codeOutput, {
        level: 'full',
        preserve: ['code']
      });
    });

    bench('text with code blocks (ultra)', () => {
      compressOutput(BENCHMARK_SAMPLES.codeOutput, {
        level: 'ultra',
        preserve: ['code']
      });
    });
  });
});
