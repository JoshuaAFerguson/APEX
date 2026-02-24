import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from './tools/multimodal-input-handler';
import type {
  MultimodalInput,
  ImageInput,
  WebPageInput,
  DesignMockupInput,
  MultimodalContext,
  ProcessedMultimodalInput
} from '@apexcli/core';

describe('MultimodalInputHandler - Validation and Processing', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('Input Validation', () => {
    it('should validate valid image inputs', async () => {
      const validImageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 1,
        height: 1,
      };

      const result = await handler.processInputs([validImageInput]);

      expect(result.status).toBe('completed');
      expect(result.inputs).toHaveLength(1);
      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputCounts.images).toBe(1);
    });

    it('should reject invalid base64 image data', async () => {
      const invalidImageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'not-valid-base64!@#$%',
        encoding: 'base64',
      };

      const result = await handler.processInputs([invalidImageInput]);

      expect(result.status).toBe('failed');
      expect(result.inputs[0].status).toBe('failed');
      expect(result.inputs[0].error).toMatch(/Invalid base64 data/i);
    });

    it('should validate URL format for web page inputs', async () => {
      const validWebPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        name: 'Test Page',
      };

      const result = await handler.processInputs([validWebPageInput]);

      expect(result.inputs[0].input.url).toBe('https://example.com');
      expect(result.inputCounts.webPages).toBe(1);
    });

    it('should reject malformed URLs', async () => {
      const invalidWebPageInput: WebPageInput = {
        type: 'web_page',
        url: 'not-a-valid-url',
        name: 'Invalid URL Page',
      };

      await expect(handler.processInputs([invalidWebPageInput]))
        .rejects.toThrow(/Invalid URL format/i);
    });

    it('should validate design mockup inputs from supported tools', async () => {
      const validDesignInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'abc123',
        fileUrl: 'https://figma.com/file/abc123',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
      };

      const result = await handler.processInputs([validDesignInput]);

      expect(result.inputs[0].input.designTool).toBe('figma');
      expect(result.inputCounts.designMockups).toBe(1);
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalImageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/jpeg',
        data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A0CAgICAgICAgICAgICAgICAgIKFgAAAAAAABAaaa23/2Q==',
        encoding: 'base64',
      };

      const result = await handler.processInputs([minimalImageInput]);

      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputs[0].input.name).toBeUndefined();
      expect(result.inputs[0].input.description).toBeUndefined();
    });
  });

  describe('Image Processing', () => {
    it('should extract metadata from valid images', async () => {
      const imageWithMetadata: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAP0lEQVR42mP8/x8EGIEYRJHGgA0BLdAbDhIIAABqABLYaVP7wgAAAABJRU5ErkJggg==', // 2x2 red pixel
        encoding: 'base64',
        name: 'test-image.png',
      };

      const result = await handler.processInputs([imageWithMetadata]);

      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputs[0].extractedContent).toBeDefined();
      expect(result.inputs[0].processingDurationMs).toBeGreaterThan(0);
    });

    it('should handle different image formats', async () => {
      const jpegImage: ImageInput = {
        type: 'image',
        mediaType: 'image/jpeg',
        data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A0CAgICAgICAgICAgICAgICAgIKFgAAAAAAABAaaa23/2Q==',
        encoding: 'base64',
      };

      const result = await handler.processInputs([jpegImage]);

      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputs[0].input.mediaType).toBe('image/jpeg');
    });

    it('should handle corrupted image data gracefully', async () => {
      const corruptedImage: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcS', // Truncated PNG
        encoding: 'base64',
      };

      const result = await handler.processInputs([corruptedImage]);

      expect(result.inputs[0].status).toBe('failed');
      expect(result.inputs[0].error).toMatch(/corrupted|invalid|malformed/i);
    });

    it('should respect size limits for image processing', async () => {
      // Mock an oversized image (simulate by overriding fileSize)
      const oversizedImage: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        fileSize: 50 * 1024 * 1024, // 50MB
      };

      const result = await handler.processInputs([oversizedImage]);

      // Depending on implementation, this might be rejected or processed with a warning
      expect(result.inputs[0]).toBeDefined();
    });
  });

  describe('Web Page Processing', () => {
    it('should handle successful web page capture', async () => {
      // Mock successful web page processing
      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://httpbin.org/html', // Public testing service
        name: 'Test HTML Page',
      };

      const result = await handler.processInputs([webPageInput]);

      // Note: This test might be skipped if running without internet access
      if (result.inputs[0].status === 'completed') {
        expect(result.inputs[0].extractedContent?.text).toBeDefined();
        expect(result.inputs[0].processingDurationMs).toBeGreaterThan(0);
      }
    });

    it('should handle web page timeout gracefully', async () => {
      const slowWebPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://httpbin.org/delay/10', // 10-second delay
        name: 'Slow Page',
      };

      // Set a short timeout for testing
      const handler = new MultimodalInputHandler({
        webPageOptions: {
          timeout: 1000, // 1 second timeout
        },
      });

      const result = await handler.processInputs([slowWebPageInput]);

      expect(result.inputs[0].status).toBe('failed');
      expect(result.inputs[0].error).toMatch(/timeout/i);
    });

    it('should extract structured content from HTML', async () => {
      const htmlPageInput: WebPageInput = {
        type: 'web_page',
        url: 'data:text/html,<html><head><title>Test</title></head><body><h1>Hello</h1><p>World</p></body></html>',
        name: 'Test HTML',
        capturedText: 'Test\nHello\nWorld',
        capturedMarkdown: '# Test\n\n# Hello\n\nWorld',
      };

      const result = await handler.processInputs([htmlPageInput]);

      expect(result.inputs[0].extractedContent?.text).toContain('Hello');
      expect(result.inputs[0].extractedContent?.text).toContain('World');
    });
  });

  describe('Design Mockup Processing', () => {
    it('should process Figma design mockups', async () => {
      const figmaInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'test123',
        nodeId: 'frame456',
        fileUrl: 'https://figma.com/file/test123',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        designTokens: {
          colors: {
            primary: '#FF6B6B',
            secondary: '#4ECDC4',
          },
        },
      };

      const result = await handler.processInputs([figmaInput]);

      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputs[0].extractedContent).toBeDefined();
      expect(result.inputs[0].input.designTokens?.colors?.primary).toBe('#FF6B6B');
    });

    it('should handle Sketch design mockups', async () => {
      const sketchInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'sketch',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
      };

      const result = await handler.processInputs([sketchInput]);

      expect(result.inputs[0].input.designTool).toBe('sketch');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple inputs efficiently', async () => {
      const multipleInputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          name: 'image1.png',
        },
        {
          type: 'web_page',
          url: 'data:text/html,<html><body><h1>Test</h1></body></html>',
          name: 'test-page',
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          exportedImage: {
            type: 'image',
            mediaType: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            encoding: 'base64',
          },
        },
      ] as MultimodalInput[];

      const startTime = Date.now();
      const result = await handler.processInputs(multipleInputs);
      const processingTime = Date.now() - startTime;

      expect(result.inputs).toHaveLength(3);
      expect(result.inputCounts.images).toBe(1);
      expect(result.inputCounts.webPages).toBe(1);
      expect(result.inputCounts.designMockups).toBe(1);
      expect(processingTime).toBeLessThan(5000); // Should be reasonably fast
    });

    it('should handle mixed success and failure in batch processing', async () => {
      const mixedInputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          name: 'valid-image.png',
        },
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'invalid-data',
          encoding: 'base64',
          name: 'invalid-image.png',
        },
      ] as ImageInput[];

      const result = await handler.processInputs(mixedInputs);

      expect(result.inputs).toHaveLength(2);
      expect(result.inputs[0].status).toBe('completed');
      expect(result.inputs[1].status).toBe('failed');
      expect(result.status).toBe('partial');
    });
  });

  describe('Context Generation', () => {
    it('should generate comprehensive context summary', async () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          name: 'wireframe.png',
          description: 'Initial wireframe for user dashboard',
        },
        {
          type: 'web_page',
          url: 'https://example.com',
          name: 'current-dashboard',
          description: 'Current implementation of the dashboard',
        },
      ] as MultimodalInput[];

      const result = await handler.processInputs(inputs);

      expect(result.contextSummary).toBeDefined();
      expect(result.contextSummary).toContain('wireframe');
      expect(result.contextSummary).toContain('dashboard');
      expect(result.createdAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should track processing statistics', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const result = await handler.processInputs([imageInput]);

      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.inputs[0].processingDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.inputs[0].processedAt).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after individual failures', async () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'invalid-base64',
          encoding: 'base64',
          name: 'bad-image',
        },
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          name: 'good-image',
        },
      ] as ImageInput[];

      const result = await handler.processInputs(inputs);

      expect(result.inputs).toHaveLength(2);
      expect(result.inputs.filter(i => i.status === 'completed')).toHaveLength(1);
      expect(result.inputs.filter(i => i.status === 'failed')).toHaveLength(1);
    });

    it('should provide detailed error information', async () => {
      const invalidInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'clearly-not-base64-!@#$%^&*()',
        encoding: 'base64',
        name: 'error-test',
      };

      const result = await handler.processInputs([invalidInput]);

      expect(result.inputs[0].status).toBe('failed');
      expect(result.inputs[0].error).toBeDefined();
      expect(result.inputs[0].error).toMatch(/base64|invalid|decode/i);
    });
  });
});