import { describe, it, expect } from 'vitest';
import { ModelSelector, modelsDevClient } from './index.js';

describe('models.dev integration', () => {
  describe('ModelsDevClient', () => {
    it('should fetch models.dev data', async () => {
      const data = await modelsDevClient.fetchModelsDevData();

      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(50); // 100+ providers
      expect(data.anthropic).toBeDefined();
      expect(data.openai).toBeDefined();
    });

    it('should get provider by ID', async () => {
      await modelsDevClient.fetchModelsDevData();

      const anthropic = modelsDevClient.getProvider('anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic.id).toBe('anthropic');
      expect(anthropic.name).toBe('Anthropic');
      expect(anthropic.api).toContain('api.anthropic.com');
    });

    it('should get model by ID', async () => {
      await modelsDevClient.fetchModelsDevData();

      const model = modelsDevClient.getModel('claude-3.7-sonnet');
      expect(model).toBeDefined();
      expect(model?.family).toBe('claude-sonnet');
      expect(model?.reasoning).toBe(false);
      expect(model?.tool_call).toBe(true);
    });

    it('should list models from a provider', async () => {
      await modelsDevClient.fetchModelsDevData();

      const anthropicModels = modelsDevClient.listModels('anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);

      const sonnet = anthropicModels.find(m => m.family === 'claude-sonnet');
      expect(sonnet).toBeDefined();
    });

    it('should list all models', async () => {
      await modelsDevClient.fetchModelsDevData();

      const allModels = modelsDevClient.listModels();
      expect(allModels.length).toBeGreaterThan(100);
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

      expect(result.model).toContain('anthropic:');
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

      expect(result.model).toContain('anthropic:') || result.model.contains('openai:');
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

    it('should reject model if no match', async () => {
      const selector = new ModelSelector();

      // Try with conflicting requirements
      await expect(
        selector.selectModel({
          modality: 'multimodal',
          constraints: {
            max_cost: 0.0001, // Very low budget
            max_context: 1000000, // Very large context
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('cost estimation', () => {
    it('should estimate task cost', async () => {
      const result = await ModelSelector.estimateTask('Write a blog post about AI', 'anthropic:claude-3.7-sonnet');

      expect(result).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.breakdown).toContain('$');
      expect(result.modelInfo).toBeDefined();
    });

    it('should estimate with custom token counts', async () => {
      const result = await ModelSelector.estimateTask('Analyze code', 'anthropic:claude-3.7-sonnet', {
        estimatedInputTokens: 25000,
        estimatedOutputTokens: 5000,
      });

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.breakdown).toContain('$0.');
    });
  });
});
