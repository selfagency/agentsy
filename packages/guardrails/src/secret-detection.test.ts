import { describe, expect, it } from 'vitest';
import { SecretDetectionScanner } from './secret-detection.js';
import { assertBlock, assertDetections, assertPass } from './test-helpers.js';

describe('SecretDetectionScanner', () => {
  const scanner = new SecretDetectionScanner();

  it('passes on clean text', async () => {
    await assertPass(scanner, 'The server is running on port 8080.');
    await assertPass(scanner, 'Use the API reference at docs.example.com.');
    await assertPass(scanner, 'npm install @agentsy/core');
  });

  it('blocks GitHub token', async () => {
    const r = await assertBlock(scanner, 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Secret detected');
    assertDetections(r, ['github-token']);
  });

  it('blocks AWS access key', async () => {
    const r = await assertBlock(scanner, 'AKIAIOSFODNN7EXAMPLE', 'Secret detected');
    assertDetections(r, ['aws-access-key']);
  });

  it('blocks Slack webhook', async () => {
    const r = await assertBlock(scanner, 'https://hooks.slack.com/services/T00/B00/xxxxx', 'Secret detected');
    assertDetections(r, ['slack-webhook']);
  });

  it('blocks Stripe live key', async () => {
    const r = await assertBlock(scanner, 'sk_live_xxxxxxxxxxxxxxxxxxxx', 'Secret detected');
    assertDetections(r, ['stripe-live-key']);
  });

  it('blocks generic API key pattern', async () => {
    const r = await assertBlock(scanner, 'api_key=sk-xxxxxxxxxxxxxxxxxxxx', 'Secret detected');
    assertDetections(r, ['generic-api-key']);
  });

  it('has correct metadata', () => {
    const meta = scanner.metadata;
    expect(meta.id).toBe('hub://guardrails/secret-detection');
    expect(meta.owaspCategories).toContain('asi-08');
  });
});
