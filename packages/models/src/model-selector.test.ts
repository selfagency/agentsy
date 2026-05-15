import { describe, expect, it } from 'vitest';
import { ModelSelector, ModelsDevClient } from './index.js';

describe('models.dev integration', () => {
  describe('ModelsDevClient', () => {
    it('should fetch models.dev data', async () => {
      const modelsDevClient = new ModelsDevClient();
      const data = await modelsDevClient.fetchModelsDevData();

      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(50);
    });

    it('should get model by ID', async () => {
      const modelsDevClient = new ModelsDevClient();
      await modelsDevClient.fetchModelsDevData();

      const model = modelsDevClient.getModel('anthropic:claude-sonnet-4-6');
      expect(model).toBeDefined();
      expect(model?.family).toBe('claude-sonnet');
      expect(model?.reasoning).toBe(true);
      expect(model?.tool_call).toBe(true);
    });

    it('should list models', async () => {
      const modelsDevClient = new ModelsDevClient();
      await modelsDevClient.fetchModelsDevData();

      const allModels = modelsDevClient.listModels();
      expect(allModels.length).toBeGreaterThan(50);
    });
  });

  describe('ModelSelector', () => {
    it('should select model for text task', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'text',
        capabilities: {
          tool_calling: true,
        },
      });

      expect(result.model).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should select model for multimodal task', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'multimodal',
        capabilities: {
          image_input: true,
          tool_calling: true,
        },
      });

      expect(result.model).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should select model for reasoning task', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'text',
        capabilities: {
          tool_calling: true,
        },
        specialization: 'reasoning',
      });

      expect(result.model).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should respect cost constraints', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'text',
        constraints: {
          max_cost: 0.02, // Very low budget
        },
      });

      expect(result.estimatedCost).toBeLessThanOrEqual(0.02);
    });

    it('should respect context window constraints', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'text',
        constraints: {
          max_context: 256000, // Large context window
        },
      });

      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should only select from whitelisted model-originating providers', async () => {
      const selector = new ModelSelector();

      const result = await selector.selectModel({
        modality: 'multimodal',
      });

      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      const excludedProviders = ['302ai', 'openrouter', 'llmgateway', 'fireworks-ai', 'replicate'];

      expect(excludedProviders).not.toContain(result.provider);
    });

    it('should estimate task cost', async () => {
      const selector = new ModelSelector();

      const result = await selector.estimateTask('Write a blog post about AI', 'anthropic:claude-sonnet-4-6');

      expect(result).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });

    it('should estimate with custom token counts', async () => {
      const selector = new ModelSelector();

      const result = await selector.estimateTask('Analyze code', 'anthropic:claude-sonnet-4-6', {
        estimatedInputTokens: 25000,
        estimatedOutputTokens: 5000,
      });

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();
    });
  });
});
