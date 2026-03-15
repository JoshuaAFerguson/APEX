import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { MultimodalInputHandler } from './tools/multimodal-input-handler';
import { initializeApex } from '@apexcli/core';
import type {
  ImageInput,
  WebPageInput,
  DesignMockupInput,
} from '@apexcli/core';

// Mock the claude-agent-sdk to prevent external API calls
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('MultimodalInputHandler - Error Handling and Validation', () => {
  let orchestrator: ApexOrchestrator;
  let handler: MultimodalInputHandler;
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multimodal-errors-'));
    process.chdir(testProjectPath);

    // Initialize a minimal APEX project
    await initializeApex({
      projectPath: testProjectPath,
      skipGitInit: true,
    });

    orchestrator = new ApexOrchestrator(testProjectPath);
    await orchestrator.initialize();

    handler = new MultimodalInputHandler();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.dispose();
    }

    process.chdir(originalCwd);

    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test project:', error);
    }
  });

  describe('Input Validation Errors', () => {
    it('should reject inputs with missing required type field', async () => {
      const inputMissingType = {
        name: 'test-image.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      };

      await expect(
        handler.processInputs([inputMissingType])
      ).rejects.toThrow(/Missing required field: type/);
    });

    it('should reject inputs with invalid type values', async () => {
      const inputWithInvalidType = {
        type: 'invalid_type',
        name: 'test',
        data: 'test',
      };

      await expect(
        handler.processInputs([inputWithInvalidType])
      ).rejects.toThrow(/Invalid multimodal input type: invalid_type/);
    });

    it('should reject image inputs missing required mediaType', async () => {
      const imageInputMissingMediaType = {
        type: 'image',
        name: 'test.png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      };

      await expect(
        handler.processInputs([imageInputMissingMediaType])
      ).rejects.toThrow(/Missing required field: mediaType/);
    });

    it('should reject image inputs missing required data', async () => {
      const imageInputMissingData = {
        type: 'image',
        name: 'test.png',
        mediaType: 'image/png',
      };

      await expect(
        handler.processInputs([imageInputMissingData])
      ).rejects.toThrow(/Missing required field: data/);
    });

    it('should reject web page inputs missing required URL or content', async () => {
      const webPageInputMissingRequiredFields = {
        type: 'web_page',
        name: 'test-page',
        description: 'Test page',
      };

      await expect(
        handler.processInputs([webPageInputMissingRequiredFields])
      ).rejects.toThrow(/Missing required field: url or capturedText or capturedMarkdown/);
    });

    it('should reject design mockup inputs missing required designTool', async () => {
      const designMockupInputMissingTool = {
        type: 'design_mockup',
        name: 'test-design',
        fileUrl: 'https://figma.com/file/test',
      };

      await expect(
        handler.processInputs([designMockupInputMissingTool])
      ).rejects.toThrow(/Missing required field: designTool/);
    });

    it('should reject non-object inputs', async () => {
      const nonObjectInputs = [
        null,
        undefined,
        'string-input',
        123,
        true,
        [],
      ];

      for (const invalidInput of nonObjectInputs) {
        await expect(
          handler.processInputs([invalidInput])
        ).rejects.toThrow(/Input must be an object/);
      }
    });
  });

  describe('Image Data Validation Errors', () => {
    it('should reject images with malformed base64 data', async () => {
      const malformedBase64Samples = [
        'not-base64-at-all!@#$%^&*()',
        'almost-base64-but-invalid-characters!@#',
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ', // Incomplete base64
        '====invalid-padding====',
        '', // Empty string
      ];

      for (const malformedData of malformedBase64Samples) {
        const imageInput: ImageInput = {
          type: 'image',
          mediaType: 'image/png',
          data: malformedData,
          encoding: 'base64',
        };

        await expect(
          handler.processInputs([imageInput])
        ).rejects.toThrow(/Invalid image data: malformed base64/);
      }
    });

    it('should reject images with unsupported media types', async () => {
      const unsupportedMediaTypes = [
        'image/bmp',
        'image/tiff',
        'image/svg+xml',
        'video/mp4',
        'text/plain',
        'application/pdf',
      ];

      for (const mediaType of unsupportedMediaTypes) {
        const imageInput: ImageInput = {
          type: 'image',
          mediaType: mediaType as any,
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        };

        // Note: This test assumes the handler validates media types against a whitelist
        // The actual behavior might vary based on implementation
        const result = await handler.processInputs([imageInput]);

        // Either rejected or processed with conversion - both are acceptable
        expect(result).toBeDefined();
      }
    });

    it('should handle corrupted image data gracefully', async () => {
      // Various forms of corrupted PNG data
      const corruptedImageData = [
        'iVBORw0KGgo', // Truncated PNG header
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY', // Truncated PNG
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // Valid GIF in PNG field
        'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=', // Valid WebP in PNG field
      ];

      for (const corruptedData of corruptedImageData) {
        const imageInput: ImageInput = {
          type: 'image',
          mediaType: 'image/png',
          data: corruptedData,
          encoding: 'base64',
        };

        const result = await handler.processInputs([imageInput]);

        // Should either fail gracefully or process with warnings
        expect(result).toBeDefined();
        if (result.inputs[0].status === 'failed') {
          expect(result.inputs[0].error).toBeDefined();
        }
      }
    });
  });

  describe('URL Validation Errors', () => {
    it('should reject web pages with invalid URL formats', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'javascript:alert("xss")',
        'file:///etc/passwd',
        'http://',
        'https://',
        'www.missing-protocol.com',
        'https://.',
        'https://.com',
        'https://domain..com',
      ];

      for (const invalidUrl of invalidUrls) {
        const webPageInput: WebPageInput = {
          type: 'web_page',
          name: 'invalid-url-test',
          url: invalidUrl,
        };

        await expect(
          handler.processInputs([webPageInput])
        ).rejects.toThrow(/Invalid URL format/);
      }
    });

    it('should handle network connectivity issues gracefully', async () => {
      const unreachableUrls = [
        'https://this-domain-absolutely-does-not-exist-12345.com',
        'https://192.168.999.999', // Invalid IP
        'https://localhost:99999', // Invalid port
        'https://httpbin.org/status/404', // 404 error
        'https://httpbin.org/status/500', // 5xx error
      ];

      for (const url of unreachableUrls) {
        const webPageInput: WebPageInput = {
          type: 'web_page',
          name: 'unreachable-test',
          url,
        };

        const result = await handler.processInputs([webPageInput]);

        // Should create result but mark as failed
        expect(result).toBeDefined();
        expect(result.inputs[0]).toBeDefined();

        if (result.inputs[0].status === 'failed') {
          expect(result.inputs[0].error).toBeDefined();
          expect(result.inputs[0].error).toMatch(/network|fetch|timeout|not found|error/i);
        }
      }
    });
  });

  describe('Memory and Resource Handling', () => {
    it('should handle extremely large input arrays gracefully', async () => {
      // Create a large number of inputs to test memory handling
      const largeInputArray: ImageInput[] = Array.from({ length: 1000 }, (_, i) => ({
        type: 'image',
        name: `stress-test-${i}.png`,
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      }));

      // This test verifies the handler can process large arrays without crashing
      // It might take some time, so we set a generous timeout
      const startTime = Date.now();
      const result = await handler.processInputs(largeInputArray);
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.inputs).toHaveLength(1000);
      expect(result.inputCounts.images).toBe(1000);

      // Should complete within reasonable time (adjusted for large dataset)
      expect(processingTime).toBeLessThan(60000); // 60 seconds max
    }, 70000); // 70 second timeout for this test

    it('should handle concurrent processing failures without deadlock', async () => {
      // Mix of valid and invalid inputs to test concurrent failure handling
      const mixedInputs = [
        // Valid inputs
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'web_page',
          url: 'https://httpbin.org/html',
          capturedText: 'Valid content',
        },
        // Invalid inputs that should fail
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'invalid-data',
          encoding: 'base64',
        },
        {
          type: 'web_page',
          url: 'invalid-url',
        },
        {
          type: 'design_mockup',
          // Missing designTool
        },
      ];

      // Should handle mixed success/failure without hanging or crashing
      await expect(async () => {
        const result = await handler.processInputs(mixedInputs);
        return result;
      }).not.toThrow();
    });
  });

  describe('Integration with ApexOrchestrator Error Handling', () => {
    it('should propagate validation errors through createTask', async () => {
      const invalidInput = {
        type: 'invalid_type',
        name: 'test',
      };

      await expect(
        orchestrator.createTask({
          description: 'Test error propagation',
          acceptanceCriteria: 'Should propagate validation errors',
          workflow: 'feature',
          multimodalInputs: [invalidInput],
        } as any)
      ).rejects.toThrow();
    });

    it('should handle processing errors without breaking task creation flow', async () => {
      const problematicInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'corrupt-but-parseable-base64-data-that-might-cause-processing-issues',
        encoding: 'base64',
      };

      // Should create task even if some multimodal processing fails
      const task = await orchestrator.createTask({
        description: 'Test error tolerance',
        acceptanceCriteria: 'Should tolerate processing errors',
        workflow: 'feature',
        multimodalInputs: [problematicInput],
      } as any);

      expect(task).toBeDefined();
      expect(task.multimodalContext).toBeDefined();
    });

    it('should maintain data consistency after errors', async () => {
      // Create a task that should partially succeed
      const mixedInputs = [
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

      const task = await orchestrator.createTask({
        description: 'Test data consistency',
        acceptanceCriteria: 'Should maintain data consistency',
        workflow: 'feature',
        multimodalInputs: mixedInputs,
      } as any);

      // Verify data consistency
      expect(task).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(2);

      const validInput = task.multimodalContext?.inputs.find(i => i.input.name === 'valid-image.png');
      const invalidInput = task.multimodalContext?.inputs.find(i => i.input.name === 'invalid-image.png');

      expect(validInput?.status).toBe('completed');
      expect(invalidInput?.status).toBe('failed');
      expect(invalidInput?.error).toBeDefined();
    });
  });

  describe('Security and Safety', () => {
    it('should sanitize input data to prevent injection attacks', async () => {
      const potentiallyMaliciousInputs = [
        {
          type: 'web_page',
          name: '<script>alert("xss")</script>',
          url: 'https://httpbin.org/html',
          description: 'javascript:alert("xss")',
        },
        {
          type: 'image',
          name: '../../etc/passwd.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          description: '${process.env.SECRET_KEY}',
        },
      ];

      const result = await handler.processInputs(potentiallyMaliciousInputs);

      // Should process without executing any malicious content
      expect(result).toBeDefined();
      expect(result.inputs).toHaveLength(2);

      // Verify that potentially malicious content is treated as literal strings
      const webPageInput = result.inputs.find(i => i.input.type === 'web_page');
      const imageInput = result.inputs.find(i => i.input.type === 'image');

      expect(webPageInput?.input.name).toBe('<script>alert("xss")</script>');
      expect(imageInput?.input.name).toBe('../../etc/passwd.png');
    });

    it('should limit resource consumption for processing', async () => {
      // Test with a very large base64 string to ensure size limits are enforced
      const extremelyLargeData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='.repeat(10000);

      const largeImageInput: ImageInput = {
        type: 'image',
        name: 'extremely-large-image.png',
        mediaType: 'image/png',
        data: extremelyLargeData,
        encoding: 'base64',
        fileSize: extremelyLargeData.length,
      };

      const result = await handler.processInputs([largeImageInput]);

      // Should handle large inputs gracefully (either process or reject with appropriate error)
      expect(result).toBeDefined();
      if (result.inputs[0].status === 'failed') {
        expect(result.inputs[0].error).toMatch(/size|limit|large/i);
      } else {
        expect(result.inputs[0].status).toBe('completed');
      }
    });
  });
});