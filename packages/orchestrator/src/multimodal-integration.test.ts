/**
 * Focused integration tests for multimodal input functionality
 * Tests the integration between MultimodalInputHandler and ApexOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { MultimodalInputHandler, MultimodalInputError } from './tools/multimodal-input-handler';
import type {
  Task,
  MultimodalInput,
  ImageInput,
  WebPageInput,
  DesignMockupInput,
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Multimodal Input Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multimodal-integration-'));
    process.chdir(testProjectPath);

    // Initialize a minimal APEX project
    await initializeApex({
      projectPath: testProjectPath,
      skipGitInit: true,
    });

    orchestrator = new ApexOrchestrator(testProjectPath);
    await orchestrator.initialize();
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

  describe('Acceptance Criteria Validation', () => {
    it('should accept multimodal inputs when creating tasks', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'ui-mockup.png',
        description: 'Login screen mockup',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 320,
        height: 568,
        fileSize: 95,
      };

      // This should work without throwing errors - validates the API supports multimodal inputs
      const task = await orchestrator.createTask({
        description: 'Implement login screen based on provided mockup',
        acceptanceCriteria: 'Login screen should match the visual design provided',
        workflow: 'feature',
        multimodalInputs: [imageInput],
      });

      expect(task).toBeDefined();
      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputCounts.images).toBe(1);
    });

    it('should support images, web pages, and mockups as context', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        description: 'Screenshot of current UI',
      };

      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com/api-docs',
        title: 'API Documentation',
        capturedText: 'API endpoint documentation for user authentication...',
        description: 'Documentation for the authentication API',
      };

      const designMockupInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'abc123xyz',
        fileUrl: 'https://figma.com/file/abc123xyz/New-Design',
        description: 'Figma mockup for new user interface',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          width: 375,
          height: 812,
        },
      };

      const task = await orchestrator.createTask({
        description: 'Implement new UI based on multiple context sources',
        multimodalInputs: [imageInput, webPageInput, designMockupInput],
      });

      expect(task.multimodalContext?.inputs).toHaveLength(3);
      expect(task.multimodalContext?.inputCounts.images).toBe(1);
      expect(task.multimodalContext?.inputCounts.webPages).toBe(1);
      expect(task.multimodalContext?.inputCounts.designMockups).toBe(1);
    });

    it('should properly format multimodal content for Claude API calls', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        description: 'UI mockup for new feature',
      };

      const task = await orchestrator.createTask({
        description: 'Implement feature from mockup',
        multimodalInputs: [imageInput],
      });

      // Verify the multimodal context is properly structured for Claude SDK
      const multimodalContext = task.multimodalContext;
      expect(multimodalContext?.status).toBe('completed');
      expect(multimodalContext?.contextSummary).toContain('1 image');
      expect(multimodalContext?.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);

      // Verify the processed input structure
      const processedInput = multimodalContext?.inputs[0];
      expect(processedInput?.input.type).toBe('image');
      expect(processedInput?.status).toBe('completed');
      expect(processedInput?.extractedContent?.text).toBe('UI mockup for new feature');
      expect(processedInput?.processedAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle multimodal input validation errors', async () => {
      const invalidInput = {
        type: 'invalid_type',
        data: 'some data',
      } as any;

      await expect(orchestrator.createTask({
        description: 'Test with invalid multimodal input',
        multimodalInputs: [invalidInput],
      })).rejects.toThrow(/Invalid multimodal input type/);
    });

    it('should handle missing required fields in multimodal inputs', async () => {
      const incompleteInput = {
        type: 'image',
        // Missing required mediaType and data fields
      } as any;

      await expect(orchestrator.createTask({
        description: 'Test with incomplete input',
        multimodalInputs: [incompleteInput],
      })).rejects.toThrow(/Missing required field/);
    });

    it('should handle malformed image data', async () => {
      const malformedInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'not-valid-base64!!!',
        encoding: 'base64',
      };

      await expect(orchestrator.createTask({
        description: 'Test with malformed image',
        multimodalInputs: [malformedInput],
      })).rejects.toThrow(/Invalid image data/);
    });
  });

  describe('MultimodalInputHandler Unit Tests', () => {
    let handler: MultimodalInputHandler;

    beforeEach(() => {
      handler = new MultimodalInputHandler();
    });

    it('should process valid inputs correctly', async () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-image-data').toString('base64'),
          description: 'Test image',
        },
        {
          type: 'web_page',
          url: 'https://example.com',
          capturedText: 'Example webpage content',
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          description: 'Design mockup',
        },
      ];

      const result = await handler.processInputs(inputs);

      expect(result.status).toBe('completed');
      expect(result.inputs).toHaveLength(3);
      expect(result.inputCounts.images).toBe(1);
      expect(result.inputCounts.webPages).toBe(1);
      expect(result.inputCounts.designMockups).toBe(1);
      expect(result.contextSummary).toContain('1 image, 1 web page, 1 design mockup');
    });

    it('should validate input types correctly', async () => {
      const invalidInputs = [
        {
          type: 'unknown_type',
          data: 'some data',
        } as any,
      ];

      await expect(handler.processInputs(invalidInputs))
        .rejects
        .toThrow('Invalid multimodal input type: unknown_type');
    });

    it('should validate required fields for each input type', async () => {
      // Test image validation
      const imageWithoutMediaType = {
        type: 'image',
        data: 'some-data',
      } as any;

      await expect(handler.processInputs([imageWithoutMediaType]))
        .rejects
        .toThrow('Missing required field: mediaType');

      // Test web page validation
      const webPageWithoutUrl = {
        type: 'web_page',
      } as any;

      await expect(handler.processInputs([webPageWithoutUrl]))
        .rejects
        .toThrow('Missing required field: url or capturedText or capturedMarkdown');

      // Test design mockup validation
      const designMockupWithoutTool = {
        type: 'design_mockup',
      } as any;

      await expect(handler.processInputs([designMockupWithoutTool]))
        .rejects
        .toThrow('Missing required field: designTool');
    });

    it('should handle empty input arrays', async () => {
      const result = await handler.processInputs([]);

      expect(result.status).toBe('completed');
      expect(result.inputs).toHaveLength(0);
      expect(result.inputCounts.images).toBe(0);
      expect(result.inputCounts.webPages).toBe(0);
      expect(result.inputCounts.designMockups).toBe(0);
      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should create meaningful context summaries', async () => {
      const singleImageInput = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-data').toString('base64'),
        },
      ];

      const singleResult = await handler.processInputs(singleImageInput);
      expect(singleResult.contextSummary).toBe('Task includes 1 image for context and reference.');

      const multipleInputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('fake-data').toString('base64'),
        },
        {
          type: 'image',
          mediaType: 'image/jpeg',
          data: Buffer.from('fake-data').toString('base64'),
        },
        {
          type: 'web_page',
          url: 'https://example.com',
          capturedText: 'content',
        },
      ];

      const multipleResult = await handler.processInputs(multipleInputs);
      expect(multipleResult.contextSummary).toBe('Task includes 2 images, 1 web page for context and reference.');
    });
  });
});