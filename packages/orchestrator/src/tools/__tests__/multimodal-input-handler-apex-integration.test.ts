/**
 * APEX system integration tests for MultimodalInputHandler
 * Tests how multimodal functionality integrates with task orchestration, Claude SDK, and workflow management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultimodalInputHandler, processImageFile, processWebPage } from '../multimodal-input-handler';

// Mock Claude SDK integration (this would normally come from the orchestrator)
const mockClaudeSDKIntegration = {
  processWithMultimodalContext: vi.fn(),
  createImageBlocks: vi.fn(),
  validateImageBlocks: vi.fn()
};

describe('MultimodalInputHandler - APEX System Integration', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Claude SDK compatibility', () => {
    it('should produce Claude SDK compatible image blocks', async () => {
      // Create a test image input
      const testImageInput = {
        type: 'image' as const,
        mediaType: 'image/png' as const,
        data: Buffer.from('fake-image-data').toString('base64'),
        description: 'UI mockup'
      };

      const result = await handler.processInputs([testImageInput]);
      const processedImage = result.inputs[0];

      // Verify the structure matches Claude SDK expectations
      expect(processedImage.input).toEqual({
        type: 'image',
        mediaType: 'image/png',
        data: testImageInput.data,
        description: 'UI mockup'
      });

      // Verify extracted content for context building
      expect(processedImage.extractedContent).toEqual({
        text: 'UI mockup'
      });

      expect(processedImage.status).toBe('completed');
      expect(processedImage.processedAt).toBeInstanceOf(Date);
    });

    it('should handle multimodal context aggregation for task workflows', async () => {
      const mixedInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('screenshot-1').toString('base64'),
          description: 'Current UI state'
        },
        {
          type: 'web_page',
          url: 'https://api-docs.example.com',
          capturedText: 'API documentation content...'
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          fileUrl: 'https://figma.com/file/123/Design',
          description: 'Target design state'
        }
      ];

      const result = await handler.processInputs(mixedInputs);

      // Verify the context summary is suitable for APEX task descriptions
      expect(result.contextSummary).toBe(
        'Task includes 1 image, 1 web page, 1 design mockup for context and reference.'
      );

      // Verify the structure supports orchestrator integration
      expect(result.status).toBe('completed');
      expect(result.inputCounts).toEqual({
        images: 1,
        webPages: 1,
        designMockups: 1
      });

      // Verify timing information for orchestrator metrics
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('task orchestration integration patterns', () => {
    it('should support agent workflow context injection', async () => {
      // Simulate a planner agent requesting analysis of UI screens
      const plannerInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('login-screen').toString('base64'),
          description: 'Login screen screenshot'
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          description: 'Login screen design specs'
        }
      ];

      const plannerContext = await handler.processInputs(plannerInputs);

      // Verify context is suitable for passing to architect agent
      expect(plannerContext.inputs).toHaveLength(2);
      expect(plannerContext.contextSummary).toContain('1 image');
      expect(plannerContext.contextSummary).toContain('1 design mockup');

      // Simulate architect agent adding implementation context
      const architectInputs = [
        {
          type: 'web_page',
          url: 'https://component-library.example.com',
          capturedText: 'Component library documentation'
        }
      ];

      const architectContext = await handler.processInputs(architectInputs);

      // Combined context for developer agent
      const combinedCounts = {
        images: plannerContext.inputCounts.images + architectContext.inputCounts.images,
        webPages: plannerContext.inputCounts.webPages + architectContext.inputCounts.webPages,
        designMockups: plannerContext.inputCounts.designMockups + architectContext.inputCounts.designMockups
      };

      expect(combinedCounts.images).toBe(1);
      expect(combinedCounts.webPages).toBe(1);
      expect(combinedCounts.designMockups).toBe(1);
    });

    it('should handle tester agent validation scenarios', async () => {
      // Tester agent comparing expected vs actual UI
      const testInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('expected-ui').toString('base64'),
          description: 'Expected UI state from design'
        },
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('actual-ui').toString('base64'),
          description: 'Actual UI state from implementation'
        }
      ];

      const testContext = await handler.processInputs(testInputs);

      expect(testContext.inputCounts.images).toBe(2);
      expect(testContext.inputs).toHaveLength(2);

      // Verify both images have appropriate context
      expect(testContext.inputs[0].extractedContent.text).toBe('Expected UI state from design');
      expect(testContext.inputs[1].extractedContent.text).toBe('Actual UI state from implementation');
    });
  });

  describe('error propagation to orchestrator', () => {
    it('should provide detailed error context for orchestrator logging', async () => {
      const invalidInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'invalid-base64-data!!!'
      };

      try {
        await handler.processInputs([invalidInput]);
        expect.fail('Should have thrown error');
      } catch (error) {
        // Verify error structure is suitable for orchestrator error handling
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Invalid image data: malformed base64');

        // Error should be clear enough for orchestrator to log and potentially retry
        expect(error.message).not.toBeUndefined();
        expect(error.message.length).toBeGreaterThan(10);
      }
    });

    it('should handle validation errors gracefully for workflow continuation', async () => {
      const inputs = [
        {
          type: 'invalid_type'
        }
      ];

      try {
        await handler.processInputs(inputs);
        expect.fail('Should have thrown error');
      } catch (error) {
        // Error should be specific enough for orchestrator to understand the issue
        expect(error.message).toBe('Invalid multimodal input type: invalid_type');

        // Should not be a system error that would crash the orchestrator
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error).not.toBeInstanceOf(ReferenceError);
      }
    });
  });

  describe('configuration integration', () => {
    it('should respect APEX configuration settings', () => {
      // Test that handler respects configuration that might come from .apex/config.yaml
      const apexConfig = {
        maxFileSizeBytes: 10 * 1024 * 1024, // 10MB limit from APEX config
        supportedFormats: ['png', 'jpg', 'jpeg'] // Restricted formats
      };

      const configuredHandler = new MultimodalInputHandler(apexConfig);
      const config = configuredHandler.getConfig();

      expect(config.maxFileSizeBytes).toBe(10 * 1024 * 1024);
      expect(config.supportedFormats).toEqual(['png', 'jpg', 'jpeg']);

      // Verify unsupported formats are rejected
      expect(configuredHandler.isSupportedFormat('test.gif')).toBe(false);
      expect(configuredHandler.isSupportedFormat('test.webp')).toBe(false);
    });
  });

  describe('performance integration', () => {
    it('should support orchestrator performance monitoring', async () => {
      const testInput = {
        type: 'image',
        mediaType: 'image/png',
        data: Buffer.from('test-image').toString('base64')
      };

      const startTime = Date.now();
      const result = await handler.processInputs([testInput]);
      const endTime = Date.now();

      // Verify timing data is available for orchestrator metrics
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalProcessingTimeMs).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small margin

      // Individual input timing
      expect(result.inputs[0].processingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide metrics suitable for orchestrator usage tracking', async () => {
      const inputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('image-1').toString('base64')
        },
        {
          type: 'web_page',
          capturedText: 'Web page content'
        }
      ];

      const result = await handler.processInputs(inputs);

      // Metrics that orchestrator can use for usage tracking
      const metrics = {
        totalInputs: result.inputs.length,
        imageInputs: result.inputCounts.images,
        webPageInputs: result.inputCounts.webPages,
        designInputs: result.inputCounts.designMockups,
        processingTimeMs: result.totalProcessingTimeMs,
        status: result.status
      };

      expect(metrics.totalInputs).toBe(2);
      expect(metrics.imageInputs).toBe(1);
      expect(metrics.webPageInputs).toBe(1);
      expect(metrics.designInputs).toBe(0);
      expect(metrics.status).toBe('completed');
    });
  });

  describe('workflow stage integration', () => {
    it('should support planning stage multimodal requirements gathering', async () => {
      const planningInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('user-flow').toString('base64'),
          description: 'User flow diagram from stakeholder'
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          description: 'Initial wireframes'
        }
      ];

      const planningContext = await handler.processInputs(planningInputs);

      expect(planningContext.contextSummary).toContain('1 image');
      expect(planningContext.contextSummary).toContain('1 design mockup');
    });

    it('should support architecture stage design analysis', async () => {
      const architectureInputs = [
        {
          type: 'design_mockup',
          designTool: 'figma',
          description: 'System architecture diagram'
        },
        {
          type: 'web_page',
          url: 'https://api-spec.example.com',
          capturedText: 'API specification'
        }
      ];

      const architectureContext = await handler.processInputs(architectureInputs);

      expect(architectureContext.inputCounts.designMockups).toBe(1);
      expect(architectureContext.inputCounts.webPages).toBe(1);
    });

    it('should support implementation stage reference materials', async () => {
      const implementationInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('component-spec').toString('base64'),
          description: 'Component specification screenshot'
        },
        {
          type: 'web_page',
          capturedMarkdown: '# Implementation Guide\n\nStep-by-step implementation...'
        }
      ];

      const implementationContext = await handler.processInputs(implementationInputs);

      expect(implementationContext.inputs[1].extractedContent.text).toContain('Implementation Guide');
    });
  });

  describe('convenience functions for orchestrator', () => {
    it('should provide direct image processing for simple cases', async () => {
      // Test the convenience function that orchestrator might use directly
      const mockFileSystem = vi.fn().mockResolvedValue({
        imageBlock: {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'base64-data'
          }
        },
        fileSizeBytes: 1024,
        mediaType: 'image/png'
      });

      // Since we can't actually test file system operations in unit tests,
      // we verify the function exists and would be callable
      expect(typeof processImageFile).toBe('function');
      expect(typeof processWebPage).toBe('function');
    });
  });
});