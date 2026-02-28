/**
 * Comprehensive tests for the processInputs method of MultimodalInputHandler
 * Tests unified multimodal context processing, validation, and aggregation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';

describe('MultimodalInputHandler - processInputs', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    vi.clearAllMocks();
  });

  describe('empty and null inputs', () => {
    it('should handle empty array input', async () => {
      const result = await handler.processInputs([]);

      expect(result).toEqual({
        inputs: [],
        status: 'completed',
        inputCounts: {
          images: 0,
          webPages: 0,
          designMockups: 0,
        },
        createdAt: expect.any(Date),
        totalProcessingTimeMs: expect.any(Number),
      });
    });

    it('should handle null/undefined inputs', async () => {
      const result = await handler.processInputs(null as any);

      expect(result.inputs).toEqual([]);
      expect(result.status).toBe('completed');
      expect(result.inputCounts.images).toBe(0);
    });
  });

  describe('image input validation', () => {
    it('should process valid image input', async () => {
      const validImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: Buffer.from('fake-image-data').toString('base64'),
        description: 'Test image'
      };

      const result = await handler.processInputs([validImageInput]);

      expect(result.status).toBe('completed');
      expect(result.inputCounts.images).toBe(1);
      expect(result.inputCounts.webPages).toBe(0);
      expect(result.inputCounts.designMockups).toBe(0);
      expect(result.inputs).toHaveLength(1);

      const processedInput = result.inputs[0];
      expect(processedInput.input).toEqual(validImageInput);
      expect(processedInput.status).toBe('completed');
      expect(processedInput.extractedContent.text).toBe('Test image');
    });

    it('should reject image input without mediaType', async () => {
      const invalidImageInput = {
        type: 'image',
        data: 'base64-data'
        // Missing mediaType
      };

      await expect(handler.processInputs([invalidImageInput]))
        .rejects
        .toThrow('Missing required field: mediaType');
    });

    it('should reject image input without data', async () => {
      const invalidImageInput = {
        type: 'image',
        mediaType: 'image/png'
        // Missing data
      };

      await expect(handler.processInputs([invalidImageInput]))
        .rejects
        .toThrow('Missing required field: data');
    });

    it('should reject image input with invalid base64 data', async () => {
      const invalidImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'invalid-base64!!!'
      };

      await expect(handler.processInputs([invalidImageInput]))
        .rejects
        .toThrow('Invalid image data: malformed base64');
    });
  });

  describe('web page input validation', () => {
    it('should process valid web page input with URL', async () => {
      const validWebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
      };

      const result = await handler.processInputs([validWebPageInput]);

      expect(result.status).toBe('completed');
      expect(result.inputCounts.webPages).toBe(1);
      expect(result.inputs).toHaveLength(1);

      const processedInput = result.inputs[0];
      expect(processedInput.extractedContent.text).toBe('https://example.com');
    });

    it('should process valid web page input with captured text', async () => {
      const validWebPageInput = {
        type: 'web_page',
        capturedText: 'This is the captured text content',
      };

      const result = await handler.processInputs([validWebPageInput]);

      expect(result.inputCounts.webPages).toBe(1);
      expect(result.inputs[0].extractedContent.text).toBe('This is the captured text content');
    });

    it('should process valid web page input with captured markdown', async () => {
      const validWebPageInput = {
        type: 'web_page',
        capturedMarkdown: '# Heading\nThis is markdown content',
      };

      const result = await handler.processInputs([validWebPageInput]);

      expect(result.inputCounts.webPages).toBe(1);
      expect(result.inputs[0].extractedContent.text).toBe('# Heading\nThis is markdown content');
    });

    it('should reject web page input without any required fields', async () => {
      const invalidWebPageInput = {
        type: 'web_page'
        // Missing url, capturedText, and capturedMarkdown
      };

      await expect(handler.processInputs([invalidWebPageInput]))
        .rejects
        .toThrow('Missing required field: url or capturedText or capturedMarkdown');
    });
  });

  describe('design mockup input validation', () => {
    it('should process valid design mockup input', async () => {
      const validDesignInput = {
        type: 'design_mockup',
        designTool: 'figma',
        description: 'Login screen mockup'
      };

      const result = await handler.processInputs([validDesignInput]);

      expect(result.status).toBe('completed');
      expect(result.inputCounts.designMockups).toBe(1);
      expect(result.inputs).toHaveLength(1);

      const processedInput = result.inputs[0];
      expect(processedInput.extractedContent.text).toBe('Login screen mockup');
      expect(processedInput.extractedContent.structuredData.designTool).toBe('figma');
    });

    it('should include design tokens when present', async () => {
      const validDesignInput = {
        type: 'design_mockup',
        designTool: 'sketch',
        designTokens: {
          colors: { primary: '#007AFF' },
          typography: { headerFont: 'SF Pro Display' }
        }
      };

      const result = await handler.processInputs([validDesignInput]);

      expect(result.inputs[0].extractedContent.structuredData.designTokens).toEqual({
        colors: { primary: '#007AFF' },
        typography: { headerFont: 'SF Pro Display' }
      });
    });

    it('should reject design mockup input without designTool', async () => {
      const invalidDesignInput = {
        type: 'design_mockup'
        // Missing designTool
      };

      await expect(handler.processInputs([invalidDesignInput]))
        .rejects
        .toThrow('Missing required field: designTool');
    });
  });

  describe('mixed input types', () => {
    it('should process multiple input types correctly', async () => {
      const mixedInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-image-1').toString('base64'),
          name: 'Screenshot 1'
        },
        {
          type: 'web_page',
          url: 'https://api-docs.example.com'
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          description: 'Dashboard mockup'
        },
        {
          type: 'image',
          mediaType: 'image/jpeg',
          data: Buffer.from('fake-image-2').toString('base64'),
          description: 'User flow diagram'
        }
      ];

      const result = await handler.processInputs(mixedInputs);

      expect(result.status).toBe('completed');
      expect(result.inputCounts).toEqual({
        images: 2,
        webPages: 1,
        designMockups: 1,
      });
      expect(result.inputs).toHaveLength(4);
      expect(result.totalProcessingTimeMs).toBeGreaterThan(0);

      // Verify context summary
      expect(result.contextSummary).toBe(
        'Task includes 2 images, 1 web page, 1 design mockup for context and reference.'
      );
    });

    it('should handle singular forms in context summary', async () => {
      const singleInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-image').toString('base64')
        }
      ];

      const result = await handler.processInputs(singleInputs);
      expect(result.contextSummary).toBe(
        'Task includes 1 image for context and reference.'
      );
    });
  });

  describe('error handling', () => {
    it('should reject invalid input type', async () => {
      const invalidInput = {
        type: 'invalid_type'
      };

      await expect(handler.processInputs([invalidInput]))
        .rejects
        .toThrow('Invalid multimodal input type: invalid_type');
    });

    it('should reject non-object input', async () => {
      await expect(handler.processInputs(['string-input'] as any))
        .rejects
        .toThrow('Input must be an object');
    });

    it('should reject input without type field', async () => {
      const inputWithoutType = {
        data: 'some-data'
      };

      await expect(handler.processInputs([inputWithoutType]))
        .rejects
        .toThrow('Missing required field: type');
    });
  });

  describe('processing metadata', () => {
    it('should include processing timestamps and duration', async () => {
      const validInput = {
        type: 'image',
        mediaType: 'image/png',
        data: Buffer.from('fake-image').toString('base64')
      };

      const startTime = Date.now();
      const result = await handler.processInputs([validInput]);
      const endTime = Date.now();

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalProcessingTimeMs).toBeLessThan(endTime - startTime + 100); // Allow some margin

      const processedInput = result.inputs[0];
      expect(processedInput.processedAt).toBeInstanceOf(Date);
      expect(processedInput.processingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should mark all inputs as completed on successful processing', async () => {
      const inputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-image').toString('base64')
        },
        {
          type: 'web_page',
          url: 'https://example.com'
        }
      ];

      const result = await handler.processInputs(inputs);

      result.inputs.forEach(processedInput => {
        expect(processedInput.status).toBe('completed');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle large number of inputs efficiently', async () => {
      const manyInputs = Array.from({ length: 50 }, (_, i) => ({
        type: 'image',
        mediaType: 'image/png',
        data: Buffer.from(`fake-image-${i}`).toString('base64'),
        name: `Image ${i}`
      }));

      const startTime = Date.now();
      const result = await handler.processInputs(manyInputs);
      const processingTime = Date.now() - startTime;

      expect(result.inputs).toHaveLength(50);
      expect(result.inputCounts.images).toBe(50);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle inputs with special characters in descriptions', async () => {
      const inputWithSpecialChars = {
        type: 'design_mockup',
        designTool: 'figma',
        description: 'Login form with émojis 🔐 and spëcial chars: <>&"'
      };

      const result = await handler.processInputs([inputWithSpecialChars]);

      expect(result.inputs[0].extractedContent.text).toBe(
        'Login form with émojis 🔐 and spëcial chars: <>&"'
      );
    });

    it('should handle inputs with very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      const inputWithLongDesc = {
        type: 'web_page',
        capturedText: longDescription
      };

      const result = await handler.processInputs([inputWithLongDesc]);

      expect(result.inputs[0].extractedContent.text).toBe(longDescription);
    });
  });
});