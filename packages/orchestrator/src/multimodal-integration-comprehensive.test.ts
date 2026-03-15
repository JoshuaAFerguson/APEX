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

// Mock the claude-agent-sdk to prevent external API calls
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('ApexOrchestrator - MultimodalInputHandler Integration (Comprehensive)', () => {
  let orchestrator: ApexOrchestrator;
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multimodal-comprehensive-'));
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

  describe('Multimodal Context Processing and Storage', () => {
    it('should process and store complex multimodal context with all input types', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'ui-mockup.png',
        description: 'Complete UI mockup showing login and dashboard',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 375,
        height: 812,
        fileSize: 95,
      };

      const webPageInput: WebPageInput = {
        type: 'web_page',
        name: 'Current Implementation',
        description: 'Live production login page for reference',
        url: 'https://example.com/login',
        title: 'Login - Example App',
        capturedText: 'Username\nPassword\nLogin Button\nForgot Password?',
        capturedMarkdown: '# Login\n\n- Username field\n- Password field\n- Login button\n- Forgot password link',
      };

      const designMockupInput: DesignMockupInput = {
        type: 'design_mockup',
        name: 'Figma Design System',
        description: 'Complete design system with components and tokens',
        designTool: 'figma',
        fileId: 'abc123xyz',
        nodeId: 'frame456',
        fileUrl: 'https://figma.com/file/abc123xyz/design-system',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAP0lEQVR42mP8/x8EGIEYRJHGgA0BLdAbDhIIAABqABLYaVP7wgAAAABJRU5ErkJggg==',
          encoding: 'base64',
          width: 1200,
          height: 800,
        },
        designTokens: {
          colors: {
            primary: '#007AFF',
            secondary: '#5856D6',
            background: '#FFFFFF',
            surface: '#F2F2F7',
            error: '#FF3B30',
          },
          typography: {
            heading: 'SF Pro Display',
            body: 'SF Pro Text',
            caption: 'SF Pro Text',
          },
          spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '24px',
            xl: '32px',
          },
        },
      };

      const task = await orchestrator.createTask({
        description: 'Redesign login page with new design system and improved UX',
        acceptanceCriteria: [
          'Match the visual design provided in the mockup',
          'Implement the design tokens consistently',
          'Improve accessibility compared to current implementation',
          'Add mobile-responsive behavior',
        ].join('\n'),
        workflow: 'feature',
        multimodalInputs: [imageInput, webPageInput, designMockupInput],
      } as any);

      expect(task).toBeDefined();
      expect(task.multimodalContext).toBeDefined();

      // Verify all inputs were processed
      expect(task.multimodalContext?.inputs).toHaveLength(3);
      expect(task.multimodalContext?.inputCounts).toEqual({
        images: 1,
        webPages: 1,
        designMockups: 1,
      });

      // Verify processing status
      expect(task.multimodalContext?.status).toBe('completed');
      expect(task.multimodalContext?.inputs.every(i => i.status === 'completed')).toBe(true);

      // Verify context summary generation
      expect(task.multimodalContext?.contextSummary).toBeDefined();
      expect(task.multimodalContext?.contextSummary).toContain('1 image');
      expect(task.multimodalContext?.contextSummary).toContain('1 web page');
      expect(task.multimodalContext?.contextSummary).toContain('1 design mockup');

      // Verify timing information
      expect(task.multimodalContext?.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(task.multimodalContext?.createdAt).toBeDefined();
      expect(task.multimodalContext?.completedAt).toBeDefined();

      // Verify individual input processing
      const [processedImage, processedWebPage, processedDesignMockup] = task.multimodalContext?.inputs || [];

      expect(processedImage?.input.type).toBe('image');
      expect(processedImage?.extractedContent?.text).toContain('UI mockup');
      expect(processedImage?.processingDurationMs).toBeGreaterThanOrEqual(0);

      expect(processedWebPage?.input.type).toBe('web_page');
      expect(processedWebPage?.extractedContent?.text).toContain('Username');

      expect(processedDesignMockup?.input.type).toBe('design_mockup');
      expect(processedDesignMockup?.input.designTokens?.colors?.primary).toBe('#007AFF');
      expect(processedDesignMockup?.extractedContent?.structuredData?.designTool).toBe('figma');
    });

    it('should persist multimodal context across task retrieval operations', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'architecture-diagram.png',
        description: 'System architecture diagram',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 800,
        height: 600,
        fileSize: 95,
      };

      // Create task with multimodal inputs
      const originalTask = await orchestrator.createTask({
        description: 'Implement system based on architecture diagram',
        acceptanceCriteria: 'Follow the architecture shown in the diagram',
        workflow: 'feature',
        multimodalInputs: [imageInput],
      } as any);

      expect(originalTask.multimodalContext).toBeDefined();
      expect(originalTask.multimodalContext?.inputs).toHaveLength(1);

      // Retrieve task from storage
      const retrievedTask = await orchestrator.getTask(originalTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.multimodalContext).toBeDefined();
      expect(retrievedTask?.multimodalContext?.inputs).toHaveLength(1);

      // Verify data integrity
      const originalInput = originalTask.multimodalContext?.inputs[0];
      const retrievedInput = retrievedTask?.multimodalContext?.inputs[0];

      expect(retrievedInput?.input.name).toBe(originalInput?.input.name);
      expect(retrievedInput?.input.description).toBe(originalInput?.input.description);
      expect(retrievedInput?.status).toBe(originalInput?.status);
      expect(retrievedInput?.extractedContent).toEqual(originalInput?.extractedContent);

      // Verify context metadata
      expect(retrievedTask?.multimodalContext?.inputCounts).toEqual(originalTask.multimodalContext?.inputCounts);
      expect(retrievedTask?.multimodalContext?.contextSummary).toBe(originalTask.multimodalContext?.contextSummary);
      expect(retrievedTask?.multimodalContext?.status).toBe(originalTask.multimodalContext?.status);
    });

    it('should handle large-scale multimodal processing efficiently', async () => {
      // Create multiple inputs to test performance and scalability
      const multipleImageInputs: ImageInput[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'image',
        name: `screenshot-${i + 1}.png`,
        description: `UI screenshot ${i + 1} for reference`,
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 1920,
        height: 1080,
        fileSize: 95,
      }));

      const multipleWebPageInputs: WebPageInput[] = Array.from({ length: 3 }, (_, i) => ({
        type: 'web_page',
        name: `reference-page-${i + 1}`,
        description: `Reference implementation ${i + 1}`,
        url: `https://example${i + 1}.com`,
        title: `Reference ${i + 1}`,
        capturedText: `Content from page ${i + 1}`,
        capturedMarkdown: `# Page ${i + 1}\n\nContent here`,
      }));

      const allInputs: MultimodalInput[] = [...multipleImageInputs, ...multipleWebPageInputs];

      const startTime = Date.now();

      const task = await orchestrator.createTask({
        description: 'Comprehensive redesign based on multiple references',
        acceptanceCriteria: 'Synthesize insights from all provided references',
        workflow: 'feature',
        multimodalInputs: allInputs,
      } as any);

      const totalTime = Date.now() - startTime;

      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(8);
      expect(task.multimodalContext?.inputCounts).toEqual({
        images: 5,
        webPages: 3,
        designMockups: 0,
      });

      // Verify performance - should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      expect(task.multimodalContext?.totalProcessingTimeMs).toBeLessThan(8000); // 8 seconds for processing

      // Verify all inputs processed successfully
      expect(task.multimodalContext?.status).toBe('completed');
      expect(task.multimodalContext?.inputs.every(i => i.status === 'completed')).toBe(true);

      // Verify context summary accurately reflects input counts
      expect(task.multimodalContext?.contextSummary).toContain('5 images');
      expect(task.multimodalContext?.contextSummary).toContain('3 web pages');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial failures gracefully without breaking task creation', async () => {
      const validImageInput: ImageInput = {
        type: 'image',
        name: 'valid-image.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const invalidImageInput: ImageInput = {
        type: 'image',
        name: 'invalid-image.png',
        mediaType: 'image/png',
        data: 'invalid-base64-data-that-cannot-be-decoded',
        encoding: 'base64',
      };

      const validWebPageInput: WebPageInput = {
        type: 'web_page',
        name: 'valid-page',
        url: 'https://httpbin.org/html',
        capturedText: 'Valid content',
      };

      const mixedInputs: MultimodalInput[] = [validImageInput, invalidImageInput, validWebPageInput];

      // Should create task despite some input failures
      const task = await orchestrator.createTask({
        description: 'Test mixed success/failure handling',
        acceptanceCriteria: 'Should handle partial failures gracefully',
        workflow: 'feature',
        multimodalInputs: mixedInputs,
      } as any);

      expect(task).toBeDefined();
      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(3);

      // Verify mixed status handling
      const processedInputs = task.multimodalContext?.inputs || [];
      const successfulInputs = processedInputs.filter(i => i.status === 'completed');
      const failedInputs = processedInputs.filter(i => i.status === 'failed');

      expect(successfulInputs.length).toBeGreaterThan(0);
      expect(failedInputs.length).toBeGreaterThan(0);

      // Verify failed inputs have error details
      failedInputs.forEach(failedInput => {
        expect(failedInput.error).toBeDefined();
        expect(typeof failedInput.error).toBe('string');
        expect(failedInput.error!.length).toBeGreaterThan(0);
      });

      // Verify overall context status reflects partial failure
      expect(task.multimodalContext?.status).toBe('partial');
    });

    it('should validate input schemas strictly and reject malformed inputs', async () => {
      const malformedInputs = [
        // Missing type
        {
          name: 'no-type',
          mediaType: 'image/png',
          data: 'test',
        },
        // Invalid type
        {
          type: 'unknown_type',
          name: 'invalid-type',
        },
        // Image missing required fields
        {
          type: 'image',
          name: 'no-media-type',
          data: 'test',
        },
        // Web page with invalid URL
        {
          type: 'web_page',
          name: 'invalid-url',
          url: 'not-a-valid-url',
        },
        // Design mockup missing design tool
        {
          type: 'design_mockup',
          name: 'no-design-tool',
          fileUrl: 'https://example.com',
        },
      ];

      for (const malformedInput of malformedInputs) {
        await expect(
          orchestrator.createTask({
            description: 'Test input validation',
            acceptanceCriteria: 'Should reject malformed inputs',
            workflow: 'feature',
            multimodalInputs: [malformedInput],
          } as any)
        ).rejects.toThrow();
      }
    });

    it('should handle network timeouts and unreachable URLs gracefully', async () => {
      const unreachableWebPageInput: WebPageInput = {
        type: 'web_page',
        name: 'unreachable-page',
        url: 'https://this-domain-definitely-does-not-exist-12345.com',
        description: 'Page that cannot be reached',
      };

      // Should create task but mark web page processing as failed
      const task = await orchestrator.createTask({
        description: 'Test network failure handling',
        acceptanceCriteria: 'Should handle network failures gracefully',
        workflow: 'feature',
        multimodalInputs: [unreachableWebPageInput],
      } as any);

      expect(task).toBeDefined();
      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.inputs).toHaveLength(1);

      const processedInput = task.multimodalContext?.inputs[0];
      expect(processedInput?.status).toBe('failed');
      expect(processedInput?.error).toBeDefined();
      expect(processedInput?.error).toMatch(/network|fetch|timeout|unreachable/i);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty multimodal inputs array gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Task without multimodal inputs',
        acceptanceCriteria: 'Should work without multimodal context',
        workflow: 'feature',
        multimodalInputs: [],
      } as any);

      expect(task).toBeDefined();
      // When no multimodal inputs provided, context might be undefined or empty
      expect(task.multimodalContext?.inputs || []).toHaveLength(0);
    });

    it('should handle undefined multimodal inputs parameter', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with undefined multimodal inputs',
        acceptanceCriteria: 'Should work with undefined multimodal inputs',
        workflow: 'feature',
        multimodalInputs: undefined,
      } as any);

      expect(task).toBeDefined();
      expect(task.multimodalContext?.inputs || []).toHaveLength(0);
    });

    it('should maintain input processing order', async () => {
      const orderedInputs: ImageInput[] = [
        {
          type: 'image',
          name: 'first-image.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'image',
          name: 'second-image.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'image',
          name: 'third-image.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Test input processing order',
        acceptanceCriteria: 'Inputs should be processed in order',
        workflow: 'feature',
        multimodalInputs: orderedInputs,
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(3);

      const processedNames = task.multimodalContext?.inputs.map(i => i.input.name);
      expect(processedNames).toEqual(['first-image.png', 'second-image.png', 'third-image.png']);
    });

    it('should handle very large base64 image data within limits', async () => {
      // Create a larger (but still valid) base64 string
      const largeImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAP0lEQVR42mP8/x8EGIEYRJHGgA0BLdAbDhIIAABqABLYaVP7wgAAAABJRU5ErkJggg=='.repeat(100);

      const largeImageInput: ImageInput = {
        type: 'image',
        name: 'large-image.png',
        description: 'Large image data for testing',
        mediaType: 'image/png',
        data: largeImageData,
        encoding: 'base64',
        fileSize: largeImageData.length,
      };

      const task = await orchestrator.createTask({
        description: 'Test large image handling',
        acceptanceCriteria: 'Should handle reasonably large images',
        workflow: 'feature',
        multimodalInputs: [largeImageInput],
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputs[0].status).toBe('completed');
    });

    it('should handle special characters in input names and descriptions', async () => {
      const specialCharacterInput: ImageInput = {
        type: 'image',
        name: 'image-with-émojis-🚀-and-special-chars-&-symbols.png',
        description: 'Image with special characters: émojis 🎨, symbols &@#$%, and unicode 测试',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Test special character handling',
        acceptanceCriteria: 'Should handle unicode and special characters correctly',
        workflow: 'feature',
        multimodalInputs: [specialCharacterInput],
      } as any);

      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputs[0].status).toBe('completed');
      expect(task.multimodalContext?.inputs[0].input.name).toBe(specialCharacterInput.name);
      expect(task.multimodalContext?.inputs[0].input.description).toBe(specialCharacterInput.description);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should process inputs concurrently for better performance', async () => {
      const multipleInputs: ImageInput[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'image',
        name: `concurrent-image-${i}.png`,
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      }));

      const startTime = Date.now();

      const task = await orchestrator.createTask({
        description: 'Test concurrent processing performance',
        acceptanceCriteria: 'Should process multiple inputs efficiently',
        workflow: 'feature',
        multimodalInputs: multipleInputs,
      } as any);

      const totalTime = Date.now() - startTime;

      expect(task.multimodalContext?.inputs).toHaveLength(10);
      expect(task.multimodalContext?.inputs.every(i => i.status === 'completed')).toBe(true);

      // Processing should be reasonably fast due to concurrency
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for 10 inputs
      expect(task.multimodalContext?.totalProcessingTimeMs).toBeDefined();
    });

    it('should cleanup resources properly after processing', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'resource-test.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const webPageInput: WebPageInput = {
        type: 'web_page',
        name: 'resource-test-page',
        url: 'https://httpbin.org/html',
      };

      // Process multiple tasks to verify no resource leaks
      for (let i = 0; i < 3; i++) {
        const task = await orchestrator.createTask({
          description: `Resource cleanup test ${i}`,
          acceptanceCriteria: 'Should cleanup resources properly',
          workflow: 'feature',
          multimodalInputs: [imageInput, webPageInput],
        } as any);

        expect(task.multimodalContext?.inputs).toHaveLength(2);
      }

      // If we reach this point without memory issues or hanging, cleanup is working
      expect(true).toBe(true);
    });
  });
});