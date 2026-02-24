import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { TaskStore } from './store';
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

describe('Task Multimodal Context Storage and Retrieval', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let testProjectPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-multimodal-context-test-'));
    process.chdir(testProjectPath);

    // Initialize a minimal APEX project
    await initializeApex({
      projectPath: testProjectPath,
      skipGitInit: true,
    });

    orchestrator = new ApexOrchestrator(testProjectPath);
    await orchestrator.initialize();

    store = (orchestrator as any).store;
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

  describe('Multimodal Context Storage', () => {
    it('should store multimodal context in task properly', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        name: 'design-mockup.png',
        description: 'Design mockup for new feature',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 1,
        height: 1,
        fileSize: 95,
        altText: 'Red pixel mockup',
      };

      const task = await orchestrator.createTask({
        description: 'Implement feature based on design mockup',
        acceptanceCriteria: 'Feature should match the provided design',
        multimodalInputs: [imageInput],
      } as any);

      // Verify task was created with multimodal context
      expect(task.context?.multimodal).toBeDefined();
      expect(task.context?.multimodal?.inputs).toHaveLength(1);
      expect(task.context?.multimodal?.inputs[0].input.name).toBe('design-mockup.png');
      expect(task.context?.multimodal?.inputs[0].input.description).toBe('Design mockup for new feature');
      expect(task.context?.multimodal?.status).toBe('completed');

      // Verify context was stored in database
      const storedTask = await store.getTask(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.context?.multimodal).toBeDefined();
      expect(storedTask?.context?.multimodal?.inputs).toHaveLength(1);
      expect(storedTask?.context?.multimodal?.inputs[0].input.type).toBe('image');
    });

    it('should store multiple multimodal inputs with correct counts', async () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          name: 'wireframe.png',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'web_page',
          url: 'https://example.com/current',
          name: 'current-implementation',
          capturedText: 'Current page content',
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          fileId: 'abc123',
          exportedImage: {
            type: 'image',
            mediaType: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            encoding: 'base64',
          },
        },
      ] as MultimodalInput[];

      const task = await orchestrator.createTask({
        description: 'Redesign based on wireframe, current state, and Figma mockup',
        multimodalInputs: inputs,
      } as any);

      expect(task.context?.multimodal?.inputCounts).toEqual({
        images: 1,
        webPages: 1,
        designMockups: 1,
      });

      // Verify persistence
      const storedTask = await store.getTask(task.id);
      expect(storedTask?.context?.multimodal?.inputCounts).toEqual({
        images: 1,
        webPages: 1,
        designMockups: 1,
      });
    });

    it('should preserve processing metadata in storage', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        name: 'test-image.png',
      };

      const task = await orchestrator.createTask({
        description: 'Test processing metadata storage',
        multimodalInputs: [imageInput],
      } as any);

      const storedTask = await store.getTask(task.id);
      const processedInput = storedTask?.context?.multimodal?.inputs[0];

      expect(processedInput?.processedAt).toBeDefined();
      expect(processedInput?.processingDurationMs).toBeGreaterThanOrEqual(0);
      expect(processedInput?.status).toBe('completed');

      const multimodalContext = storedTask?.context?.multimodal;
      expect(multimodalContext?.createdAt).toBeDefined();
      expect(multimodalContext?.completedAt).toBeDefined();
      expect(multimodalContext?.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should store extracted content from multimodal inputs', async () => {
      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Main Title</h1><p>Content paragraph</p></body></html>',
        name: 'test-html-page',
        capturedText: 'Test Page\nMain Title\nContent paragraph',
        capturedMarkdown: '# Test Page\n\n# Main Title\n\nContent paragraph',
      };

      const task = await orchestrator.createTask({
        description: 'Process HTML content',
        multimodalInputs: [webPageInput],
      } as any);

      const storedTask = await store.getTask(task.id);
      const processedInput = storedTask?.context?.multimodal?.inputs[0];

      expect(processedInput?.extractedContent).toBeDefined();
      expect(processedInput?.extractedContent?.text).toContain('Main Title');
      expect(processedInput?.extractedContent?.text).toContain('Content paragraph');
    });

    it('should handle large multimodal contexts efficiently', async () => {
      // Create a moderate number of inputs to test storage efficiency
      const inputs: ImageInput[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'image',
        name: `test-image-${i}.png`,
        description: `Test image number ${i}`,
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      }));

      const startTime = Date.now();

      const task = await orchestrator.createTask({
        description: 'Process multiple images',
        multimodalInputs: inputs,
      } as any);

      const storageTime = Date.now() - startTime;

      // Verify all inputs were stored
      const storedTask = await store.getTask(task.id);
      expect(storedTask?.context?.multimodal?.inputs).toHaveLength(5);
      expect(storedTask?.context?.multimodal?.inputCounts.images).toBe(5);

      // Storage should be reasonably fast
      expect(storageTime).toBeLessThan(5000); // 5 seconds max

      // Verify each input was preserved correctly
      inputs.forEach((originalInput, index) => {
        const storedInput = storedTask?.context?.multimodal?.inputs[index];
        expect(storedInput?.input.name).toBe(originalInput.name);
        expect(storedInput?.input.description).toBe(originalInput.description);
        expect(storedInput?.input.type).toBe('image');
      });
    });
  });

  describe('Multimodal Context Retrieval', () => {
    it('should retrieve task with complete multimodal context', async () => {
      const designInput: DesignMockupInput = {
        type: 'design_mockup',
        name: 'Login Screen Design',
        description: 'New login screen from Figma',
        designTool: 'figma',
        fileId: 'design123',
        nodeId: 'frame456',
        fileUrl: 'https://figma.com/file/design123',
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

      // Create task with multimodal input
      const createdTask = await orchestrator.createTask({
        description: 'Implement login screen from Figma design',
        multimodalInputs: [designInput],
      } as any);

      // Retrieve task using orchestrator method
      const retrievedTask = await orchestrator.getTask(createdTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.context?.multimodal).toBeDefined();
      expect(retrievedTask?.context?.multimodal?.inputs[0].input.type).toBe('design_mockup');
      expect(retrievedTask?.context?.multimodal?.inputs[0].input.designTool).toBe('figma');
      expect(retrievedTask?.context?.multimodal?.inputs[0].input.designTokens?.colors?.primary).toBe('#007AFF');

      // Verify design tokens were preserved
      const retrievedInput = retrievedTask?.context?.multimodal?.inputs[0].input as DesignMockupInput;
      expect(retrievedInput.designTokens?.typography?.heading).toBe('SF Pro Display');
      expect(retrievedInput.designTokens?.colors?.background).toBe('#FFFFFF');
    });

    it('should handle retrieval of failed multimodal processing', async () => {
      // Mock a failed processing scenario
      const invalidImageInput: ImageInput = {
        type: 'image',
        name: 'corrupted-image.png',
        mediaType: 'image/png',
        data: 'invalid-base64-data-that-will-fail',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Test failed multimodal processing',
        multimodalInputs: [invalidImageInput],
      } as any);

      const retrievedTask = await orchestrator.getTask(task.id);

      expect(retrievedTask?.context?.multimodal).toBeDefined();
      expect(retrievedTask?.context?.multimodal?.inputs[0].status).toBe('failed');
      expect(retrievedTask?.context?.multimodal?.inputs[0].error).toBeDefined();
      expect(retrievedTask?.context?.multimodal?.status).toBe('failed');
    });

    it('should retrieve context summary correctly', async () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          name: 'wireframe.png',
          description: 'Initial wireframe sketch',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        {
          type: 'web_page',
          name: 'competitor-analysis',
          description: 'Competitor website for reference',
          url: 'https://example.com',
          capturedText: 'Competitor website content',
        },
      ] as MultimodalInput[];

      const task = await orchestrator.createTask({
        description: 'Build feature based on wireframe and competitor analysis',
        multimodalInputs: inputs,
      } as any);

      const retrievedTask = await orchestrator.getTask(task.id);

      expect(retrievedTask?.context?.multimodal?.contextSummary).toBeDefined();
      expect(retrievedTask?.context?.multimodal?.contextSummary).toContain('wireframe');
      expect(retrievedTask?.context?.multimodal?.contextSummary).toContain('competitor');
    });
  });

  describe('Context Serialization and Deserialization', () => {
    it('should correctly serialize and deserialize multimodal context', async () => {
      const complexInput: DesignMockupInput = {
        type: 'design_mockup',
        name: 'Complex Design',
        description: 'Multi-component dashboard design',
        designTool: 'figma',
        fileId: 'complex123',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          encoding: 'base64',
        },
        designTokens: {
          colors: {
            primary: '#007AFF',
            secondary: '#5856D6',
            tertiary: '#FF9500',
          },
          typography: {
            heading: 'SF Pro Display',
            subheading: 'SF Pro Text',
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
        metadata: {
          createdBy: 'Designer Name',
          lastModified: new Date().toISOString(),
          version: '1.2.0',
        },
      };

      const task = await orchestrator.createTask({
        description: 'Implement complex dashboard design',
        multimodalInputs: [complexInput],
      } as any);

      // Simulate database round-trip by getting the task again
      const retrievedTask = await orchestrator.getTask(task.id);

      // Verify all complex nested data was preserved
      const retrievedInput = retrievedTask?.context?.multimodal?.inputs[0].input as DesignMockupInput;

      expect(retrievedInput.designTokens?.colors?.tertiary).toBe('#FF9500');
      expect(retrievedInput.designTokens?.typography?.subheading).toBe('SF Pro Text');
      expect(retrievedInput.designTokens?.spacing?.xl).toBe('32px');
      expect(retrievedInput.metadata?.version).toBe('1.2.0');
      expect(retrievedInput.metadata?.createdBy).toBe('Designer Name');
    });

    it('should handle Date objects in multimodal context correctly', async () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };

      const task = await orchestrator.createTask({
        description: 'Test date serialization',
        multimodalInputs: [imageInput],
      } as any);

      const retrievedTask = await orchestrator.getTask(task.id);

      // Verify dates were preserved correctly
      expect(retrievedTask?.context?.multimodal?.createdAt).toBeInstanceOf(Date);
      expect(retrievedTask?.context?.multimodal?.completedAt).toBeInstanceOf(Date);

      const processedInput = retrievedTask?.context?.multimodal?.inputs[0];
      expect(processedInput?.processedAt).toBeInstanceOf(Date);
      expect(processedInput?.input.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Context Updates and Modifications', () => {
    it('should allow updating task with additional multimodal context', async () => {
      // Create initial task with one input
      const initialInput: ImageInput = {
        type: 'image',
        name: 'initial-design.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      const task = await orchestrator.createTask({
        description: 'Initial implementation',
        multimodalInputs: [initialInput],
      } as any);

      expect(task.context?.multimodal?.inputs).toHaveLength(1);

      // Test that we can retrieve the task with its context
      const retrievedTask = await orchestrator.getTask(task.id);
      expect(retrievedTask?.context?.multimodal?.inputs).toHaveLength(1);
      expect(retrievedTask?.context?.multimodal?.inputs[0].input.name).toBe('initial-design.png');
    });

    it('should preserve context across task updates', async () => {
      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com/reference',
        name: 'reference-page',
        capturedText: 'Reference page content',
      };

      const task = await orchestrator.createTask({
        description: 'Initial task with reference',
        multimodalInputs: [webPageInput],
      } as any);

      // Update task status (simulating task progression)
      await store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation',
        updatedAt: new Date(),
      });

      // Verify multimodal context is still intact
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.status).toBe('in-progress');
      expect(updatedTask?.context?.multimodal).toBeDefined();
      expect(updatedTask?.context?.multimodal?.inputs[0].input.name).toBe('reference-page');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle task creation when multimodal handler fails', async () => {
      // Mock the multimodal handler to throw an error
      const mockHandler = vi.spyOn((orchestrator as any).multimodalInputHandler, 'processInputs');
      mockHandler.mockRejectedValue(new Error('Multimodal processing service unavailable'));

      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        encoding: 'base64',
      };

      // Task creation should still succeed but without multimodal context
      await expect(orchestrator.createTask({
        description: 'Task with failing multimodal processing',
        multimodalInputs: [imageInput],
      } as any)).rejects.toThrow('Multimodal processing service unavailable');

      mockHandler.mockRestore();
    });

    it('should handle empty multimodal inputs gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with empty multimodal inputs',
        multimodalInputs: [],
      } as any);

      expect(task).toBeDefined();
      expect(task.context?.multimodal).toBeUndefined();

      const retrievedTask = await orchestrator.getTask(task.id);
      expect(retrievedTask?.context?.multimodal).toBeUndefined();
    });

    it('should handle null and undefined multimodal inputs', async () => {
      const taskWithNull = await orchestrator.createTask({
        description: 'Task with null multimodal inputs',
        multimodalInputs: null,
      } as any);

      const taskWithUndefined = await orchestrator.createTask({
        description: 'Task with undefined multimodal inputs',
        multimodalInputs: undefined,
      } as any);

      expect(taskWithNull.context?.multimodal).toBeUndefined();
      expect(taskWithUndefined.context?.multimodal).toBeUndefined();
    });
  });
});