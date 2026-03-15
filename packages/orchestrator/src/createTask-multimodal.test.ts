import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import type {
  Task,
  MultimodalInput,
  ImageInput,
  WebPageInput,
  DesignMockupInput,
  MultimodalContext
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('ApexOrchestrator.createTask - Multimodal Input Integration', () => {
  let orchestrator: ApexOrchestrator;
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multimodal-test-'));
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

  describe('Multimodal Input Processing', () => {
    it('should accept and process image inputs in createTask', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'mockup.png',
        description: 'UI mockup for login screen',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // 1x1 red pixel
        encoding: 'base64',
        width: 1,
        height: 1,
        fileSize: 95,
      };

      // This test expects the createTask method to accept multimodalInputs parameter
      const task = await orchestrator.createTask({
        description: 'Implement login screen based on provided mockup',
        acceptanceCriteria: 'Login screen should match the visual design provided',
        workflow: 'feature',
        multimodalInputs: [imageInput],
      } as any); // Using 'as any' until interface is updated

      expect(task).toBeDefined();
      expect(task.description).toBe('Implement login screen based on provided mockup');

      // Verify multimodal context was created and stored
      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputs[0].input.type).toBe('image');
      expect(task.multimodalContext?.inputCounts.images).toBe(1);
    });

    it('should process web page inputs correctly', async () => {
      const webPageInput: WebPageInput = {
        type: 'web_page',
        name: 'Current Implementation',
        description: 'Current login page implementation',
        url: 'https://example.com/login',
        title: 'Login - Example App',
        capturedText: 'Username\nPassword\nLogin Button',
        capturedMarkdown: '# Login\n\n- Username field\n- Password field\n- Login button',
      };

      const task = await orchestrator.createTask({
        description: 'Update login screen design',
        multimodalInputs: [webPageInput],
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputs[0].input.type).toBe('web_page');
      expect(task.multimodalContext?.inputCounts.webPages).toBe(1);

      const processedWebPage = task.multimodalContext?.inputs[0];
      expect(processedWebPage?.extractedContent?.text).toContain('Username');
      expect(processedWebPage?.status).toBe('completed');
    });

    it('should handle design mockup inputs from Figma', async () => {
      const designMockupInput: DesignMockupInput = {
        type: 'design_mockup',
        name: 'Login Screen Mockup',
        description: 'Figma design for new login screen',
        designTool: 'figma',
        fileId: 'abc123',
        nodeId: 'node456',
        fileUrl: 'https://figma.com/file/abc123/login-screen',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
          width: 375,
          height: 812,
        },
        designTokens: {
          colors: {
            primary: '#007AFF',
            secondary: '#5856D6',
            background: '#FFFFFF',
          },
          typography: {
            heading: 'SF Pro Display',
            body: 'SF Pro Text',
          },
        },
      };

      const task = await orchestrator.createTask({
        description: 'Implement new login screen from Figma design',
        multimodalInputs: [designMockupInput],
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputs[0].input.type).toBe('design_mockup');
      expect(task.multimodalContext?.inputCounts.designMockups).toBe(1);

      const processedMockup = task.multimodalContext?.inputs[0];
      expect(processedMockup?.input).toMatchObject({
        designTool: 'figma',
        fileId: 'abc123',
        nodeId: 'node456',
      });
    });

    it('should handle multiple multimodal inputs of different types', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'reference.jpg',
        mediaType: 'image/jpeg',
        data: '/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gNzUK/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==', // Minimal JPEG
        encoding: 'base64',
      };

      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com/current-implementation',
        capturedText: 'Current implementation text',
      };

      const task = await orchestrator.createTask({
        description: 'Redesign page based on reference image and current implementation',
        multimodalInputs: [imageInput, webPageInput],
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(2);
      expect(task.multimodalContext?.inputCounts.images).toBe(1);
      expect(task.multimodalContext?.inputCounts.webPages).toBe(1);
      expect(task.multimodalContext?.inputCounts.designMockups).toBe(0);
    });

    it('should generate contextSummary for multimodal inputs', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'design-reference.png',
        description: 'Reference design for the new dashboard',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Implement dashboard based on design reference',
        multimodalInputs: [imageInput],
      } as any);

      expect(task.multimodalContext?.contextSummary).toBeDefined();
      expect(task.multimodalContext?.contextSummary).toContain('image');
      expect(task.multimodalContext?.status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidImageInput: ImageInput = {
        type: 'image',
        name: 'invalid.png',
        mediaType: 'image/png',
        data: 'invalid-base64-data',
        encoding: 'base64',
      };

      await expect(orchestrator.createTask({
        description: 'Test with invalid image',
        multimodalInputs: [invalidImageInput],
      } as any)).rejects.toThrow(/Invalid image data/);
    });

    it('should handle unreachable web URLs gracefully', async () => {
      const unreachableWebPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://this-domain-does-not-exist-12345.com',
        name: 'Unreachable Page',
      };

      const task = await orchestrator.createTask({
        description: 'Test with unreachable URL',
        multimodalInputs: [unreachableWebPageInput],
      } as any);

      // Should still create task but with failed processing status
      expect(task).toBeDefined();
      expect(task.multimodalContext?.inputs[0].status).toBe('failed');
      expect(task.multimodalContext?.inputs[0].error).toBeDefined();
    });

    it('should validate multimodal input schemas', async () => {
      const invalidInput = {
        type: 'unknown_type',
        name: 'invalid input',
      } as any;

      await expect(orchestrator.createTask({
        description: 'Test with invalid input type',
        multimodalInputs: [invalidInput],
      } as any)).rejects.toThrow(/Invalid multimodal input type/);
    });

    it('should handle missing required fields in multimodal inputs', async () => {
      const incompleteImageInput = {
        type: 'image',
        // Missing required mediaType field
        data: 'some-data',
      } as any;

      await expect(orchestrator.createTask({
        description: 'Test with incomplete image input',
        multimodalInputs: [incompleteImageInput],
      } as any)).rejects.toThrow(/Missing required field/);
    });

    it('should handle processing timeouts gracefully', async () => {
      // Mock the multimodal input handler to simulate timeout
      vi.spyOn(orchestrator['multimodalInputHandler'], 'processInputs').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          inputs: [{
            input: { type: 'image', mediaType: 'image/png', data: 'test' } as ImageInput,
            status: 'failed' as const,
            error: 'Processing timeout',
          }],
          status: 'failed' as const,
          inputCounts: { images: 1, webPages: 0, designMockups: 0 },
          createdAt: new Date(),
        }), 100))
      );

      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'test-data',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Test timeout handling',
        multimodalInputs: [imageInput],
      } as any);

      expect(task.multimodalContext?.inputs[0].status).toBe('failed');
      expect(task.multimodalContext?.inputs[0].error).toContain('timeout');
    });
  });

  describe('Integration with Task Storage', () => {
    it('should persist multimodal context to task storage', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'test-image.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Test multimodal persistence',
        multimodalInputs: [imageInput],
      } as any);

      // Retrieve task from storage
      const retrievedTask = await orchestrator.getTask(task.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.multimodalContext).toBeDefined();
      expect(retrievedTask?.multimodalContext?.inputs).toHaveLength(1);
      expect(retrievedTask?.multimodalContext?.inputs[0].input.name).toBe('test-image.png');
    });

    it('should handle large multimodal contexts efficiently', async () => {
      // Create multiple multimodal inputs
      const inputs: MultimodalInput[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'image',
        name: `image-${i}.png`,
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      })) as ImageInput[];

      const startTime = Date.now();

      const task = await orchestrator.createTask({
        description: 'Test with multiple inputs',
        multimodalInputs: inputs,
      } as any);

      const processingTime = Date.now() - startTime;

      expect(task.multimodalContext?.inputs).toHaveLength(10);
      expect(task.multimodalContext?.inputCounts.images).toBe(10);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(task.multimodalContext?.totalProcessingTimeMs).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty multimodal inputs array', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with empty multimodal inputs',
        multimodalInputs: [],
      } as any);

      expect(task).toBeDefined();
      expect(task.context?.multimodal).toBeUndefined();
    });

    it('should handle undefined multimodal inputs', async () => {
      const task = await orchestrator.createTask({
        description: 'Task without multimodal inputs',
        multimodalInputs: undefined,
      } as any);

      expect(task).toBeDefined();
      expect(task.context?.multimodal).toBeUndefined();
    });

    it('should maintain processing order for sequential inputs', async () => {
      const inputs: ImageInput[] = [
        {
          type: 'image',
          name: 'first.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'image',
          name: 'second.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Test input processing order',
        multimodalInputs: inputs,
      } as any);

      expect(task.context?.multimodal?.inputs[0].input.name).toBe('first.png');
      expect(task.context?.multimodal?.inputs[1].input.name).toBe('second.png');
    });
  });
});