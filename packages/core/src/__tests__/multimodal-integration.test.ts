import { describe, it, expect } from 'vitest';
import {
  MultimodalInput,
  MultimodalContext,
  ProcessedMultimodalInput,
  CreateTaskRequest,
  Task,
  ImageInput,
  WebPageInput,
  DesignMockupInput,
  MultimodalInputSchema,
  MultimodalContextSchema,
} from '../types';

describe('Multimodal Integration Tests', () => {
  describe('CreateTaskRequest with multimodal inputs', () => {
    it('should accept CreateTaskRequest with multimodal inputs', () => {
      const imageInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        encoding: 'base64',
        name: 'test-screenshot.png',
        description: 'Screenshot of current UI',
      };

      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com/current-page',
        title: 'Current Implementation',
        capturedText: 'This is the current implementation that needs to be updated',
      };

      const designInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'abc123def456',
        nodeId: 'frame789',
        fileUrl: 'https://figma.com/file/abc123def456',
        name: 'New Login Design',
        description: 'Updated login screen design from Figma',
      };

      const createRequest: CreateTaskRequest = {
        description: 'Update login screen to match new design',
        acceptanceCriteria: 'Login screen should match the Figma design exactly',
        workflow: 'feature-development',
        autonomy: 'medium',
        priority: 'high',
        multimodalInputs: [imageInput, webPageInput, designInput],
      };

      // Should compile without errors
      expect(createRequest.multimodalInputs).toHaveLength(3);
      expect(createRequest.multimodalInputs?.[0].type).toBe('image');
      expect(createRequest.multimodalInputs?.[1].type).toBe('web_page');
      expect(createRequest.multimodalInputs?.[2].type).toBe('design_mockup');
    });
  });

  describe('Task with multimodal context', () => {
    it('should accept Task with processed multimodal context', () => {
      const processedInputs: ProcessedMultimodalInput[] = [
        {
          input: {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64data',
            name: 'screenshot.png',
          },
          status: 'completed',
          processedAt: new Date(),
          processingDurationMs: 1500,
          extractedContent: {
            text: 'Login form with username field, password field, and login button',
            entities: [
              { type: 'input', value: 'username', confidence: 0.98 },
              { type: 'input', value: 'password', confidence: 0.97 },
              { type: 'button', value: 'Login', confidence: 0.99 },
            ],
          },
        },
      ];

      const multimodalContext: MultimodalContext = {
        inputs: processedInputs,
        status: 'completed',
        contextSummary: 'Task includes a screenshot of the current login form for reference',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:00:05Z'),
        totalProcessingTimeMs: 1500,
        inputCounts: {
          images: 1,
          webPages: 0,
          designMockups: 0,
        },
      };

      const task: Task = {
        id: 'task-123',
        description: 'Update login screen',
        workflow: 'feature-development',
        autonomy: 'medium',
        status: 'in_progress',
        priority: 'high',
        effort: 'medium',
        projectPath: '/project',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          totalCostCents: 0,
          executionTimeMs: 0,
        },
        logs: [],
        artifacts: [],
        multimodalContext,
      };

      // Should compile without errors
      expect(task.multimodalContext).toBeDefined();
      expect(task.multimodalContext?.status).toBe('completed');
      expect(task.multimodalContext?.inputs).toHaveLength(1);
      expect(task.multimodalContext?.inputCounts.images).toBe(1);
    });
  });

  describe('Schema validation integration', () => {
    it('should validate multimodal inputs through schemas', () => {
      const mixedInputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/jpeg',
          url: 'https://example.com/mockup.jpg',
          altText: 'Design mockup',
        },
        {
          type: 'web_page',
          url: 'https://current.example.com',
          title: 'Current Page',
        },
        {
          type: 'design_mockup',
          designTool: 'sketch',
          fileUrl: 'https://sketch.cloud/file/123',
        },
      ];

      // All inputs should validate
      mixedInputs.forEach(input => {
        expect(() => MultimodalInputSchema.parse(input)).not.toThrow();
      });
    });

    it('should validate complete multimodal context through schema', () => {
      const context: MultimodalContext = {
        inputs: [
          {
            input: {
              type: 'image',
              mediaType: 'image/png',
              data: 'base64data',
            },
            status: 'completed',
            processedAt: new Date(),
          },
        ],
        status: 'completed',
        createdAt: new Date(),
        inputCounts: {
          images: 1,
          webPages: 0,
          designMockups: 0,
        },
      };

      expect(() => MultimodalContextSchema.parse(context)).not.toThrow();
    });
  });

  describe('Multimodal Input Collection', () => {
    it('should validate multimodal input collection', () => {
      const collection = {
        inputs: [
          {
            type: 'image' as const,
            mediaType: 'image/png',
            data: 'base64data',
            name: 'mockup.png',
          },
          {
            type: 'web_page' as const,
            url: 'https://current.example.com',
            title: 'Current Page',
          },
        ],
        context: 'Compare current implementation with new design mockup',
        primaryInputIndex: 0,
        processingOrder: 'sequential' as const,
        createdAt: new Date(),
        metadata: {
          requestId: 'req-123',
          priority: 'high',
        },
      };

      expect(() => MultimodalInputCollectionSchema.parse(collection)).not.toThrow();
      expect(collection.inputs).toHaveLength(2);
      expect(collection.primaryInputIndex).toBe(0);
    });

    it('should require at least one input in collection', () => {
      const emptyCollection = {
        inputs: [],
      };

      expect(() => MultimodalInputCollectionSchema.parse(emptyCollection)).toThrow();
    });

    it('should default processing order to sequential', () => {
      const collection = {
        inputs: [
          {
            type: 'image' as const,
            mediaType: 'image/png',
            data: 'base64data',
          },
        ],
      };

      const parsed = MultimodalInputCollectionSchema.parse(collection);
      expect(parsed.processingOrder).toBe('sequential');
    });

    it('should validate processing order options', () => {
      const orders: Array<'sequential' | 'parallel' | 'priority'> = ['sequential', 'parallel', 'priority'];

      orders.forEach(order => {
        const collection = {
          inputs: [
            {
              type: 'image' as const,
              mediaType: 'image/png',
              data: 'base64data',
            },
          ],
          processingOrder: order,
        };

        expect(() => MultimodalInputCollectionSchema.parse(collection)).not.toThrow();
      });
    });

    it('should validate primary input index bounds', () => {
      const collection = {
        inputs: [
          {
            type: 'image' as const,
            mediaType: 'image/png',
            data: 'base64data',
          },
        ],
        primaryInputIndex: -1, // Invalid negative index
      };

      expect(() => MultimodalInputCollectionSchema.parse(collection)).toThrow();
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle CreateTaskRequest without multimodal inputs', () => {
      const requestWithoutMultimodal: CreateTaskRequest = {
        description: 'Simple task without multimedia',
        workflow: 'simple-workflow',
        autonomy: 'low',
      };

      expect(requestWithoutMultimodal.multimodalInputs).toBeUndefined();
    });

    it('should handle empty multimodal inputs array', () => {
      const requestWithEmptyArray: CreateTaskRequest = {
        description: 'Task with empty multimodal array',
        workflow: 'test-workflow',
        autonomy: 'medium',
        multimodalInputs: [],
      };

      expect(requestWithEmptyArray.multimodalInputs).toEqual([]);
    });

    it('should handle task without multimodal context', () => {
      const taskWithoutMultimodal: Partial<Task> = {
        id: 'task-no-multimodal',
        description: 'Simple task',
        workflow: 'simple-workflow',
        autonomy: 'low',
        status: 'pending',
        // No multimodalContext field
      };

      expect(taskWithoutMultimodal.multimodalContext).toBeUndefined();
    });

    it('should handle malformed image data gracefully', () => {
      const malformedInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'not-valid-base64!@#$',
        encoding: 'base64',
      };

      // Schema validation should pass (validation of actual base64 would be at processing time)
      expect(() => ImageInputSchema.parse(malformedInput)).not.toThrow();
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(2000) + '.html';
      const webPageInput: WebPageInput = {
        type: 'web_page',
        url: longUrl,
      };

      expect(() => WebPageInputSchema.parse(webPageInput)).not.toThrow();
    });

    it('should handle special characters in descriptions and names', () => {
      const specialCharsInput: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        name: 'Design with émojis 🎨 and spéçial characters!',
        description: 'Description with\nnewlines\tand\ttabs',
      };

      expect(() => DesignMockupInputSchema.parse(specialCharsInput)).not.toThrow();
    });

    it('should handle processing timeout scenarios', () => {
      const timedOutProcessing: ProcessedMultimodalInput = {
        input: {
          type: 'web_page',
          url: 'https://slow-response.example.com',
        },
        status: 'failed',
        processedAt: new Date(),
        processingDurationMs: 30000, // 30 second timeout
        error: 'Processing timeout after 30 seconds',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(timedOutProcessing)).not.toThrow();
      expect(timedOutProcessing.error).toContain('timeout');
    });

    it('should handle context with partial processing', () => {
      const partialContext: MultimodalContext = {
        inputs: [
          {
            input: { type: 'image', mediaType: 'image/png', data: 'data1' },
            status: 'completed',
            processedAt: new Date(),
            extractedContent: {
              text: 'Successfully extracted content',
              entities: [{ type: 'button', value: 'Click me' }],
            },
          },
          {
            input: { type: 'web_page', url: 'https://example.com' },
            status: 'failed',
            processedAt: new Date(),
            error: 'Failed to load page',
          },
          {
            input: { type: 'design_mockup', designTool: 'figma' },
            status: 'skipped',
            error: 'Unsupported file format',
          },
        ],
        status: 'completed', // Completed despite some failures
        contextSummary: 'Partially processed context with 1 success, 1 failure, 1 skipped',
        createdAt: new Date(),
        completedAt: new Date(),
        inputCounts: { images: 1, webPages: 1, designMockups: 1 },
      };

      expect(() => MultimodalContextSchema.parse(partialContext)).not.toThrow();
      expect(partialContext.contextSummary).toContain('Partially processed');
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle large number of inputs', () => {
      const manyInputs = Array.from({ length: 50 }, (_, i) => ({
        type: 'image' as const,
        mediaType: 'image/png',
        data: `image-data-${i}`,
        name: `image-${i}.png`,
      }));

      const largeCollection = {
        inputs: manyInputs,
        context: 'Batch processing of 50 images',
        processingOrder: 'parallel' as const,
      };

      expect(() => MultimodalInputCollectionSchema.parse(largeCollection)).not.toThrow();
      expect(largeCollection.inputs).toHaveLength(50);
    });

    it('should handle context with many processed inputs', () => {
      const manyProcessedInputs = Array.from({ length: 20 }, (_, i) => ({
        input: {
          type: 'image' as const,
          mediaType: 'image/png',
          data: `batch-image-${i}`,
        },
        status: 'completed' as const,
        processedAt: new Date(),
        processingDurationMs: 1000 + i * 100, // Variable processing times
      }));

      const largeContext: MultimodalContext = {
        inputs: manyProcessedInputs,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: manyProcessedInputs.reduce((sum, input) => sum + (input.processingDurationMs || 0), 0),
        inputCounts: { images: 20, webPages: 0, designMockups: 0 },
      };

      expect(() => MultimodalContextSchema.parse(largeContext)).not.toThrow();
      expect(largeContext.inputs).toHaveLength(20);
      expect(largeContext.totalProcessingTimeMs).toBeGreaterThan(0);
    });

    it('should handle very large extracted content', () => {
      const largeExtractedContent = {
        text: 'A'.repeat(100000), // 100KB of text
        structuredData: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`field${i}`, `value${i}`])
        ),
        entities: Array.from({ length: 500 }, (_, i) => ({
          type: 'element',
          value: `element-${i}`,
          confidence: Math.random(),
        })),
      };

      const largeProcessedInput: ProcessedMultimodalInput = {
        input: {
          type: 'web_page',
          url: 'https://complex-page.example.com',
        },
        status: 'completed',
        processedAt: new Date(),
        extractedContent: largeExtractedContent,
      };

      expect(() => ProcessedMultimodalInputSchema.parse(largeProcessedInput)).not.toThrow();
      expect(largeProcessedInput.extractedContent?.entities).toHaveLength(500);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle UI redesign workflow', () => {
      const uiRedesignRequest: CreateTaskRequest = {
        description: 'Redesign the login page based on new Figma mockups',
        acceptanceCriteria: 'New design should match Figma exactly and be responsive',
        workflow: 'ui-redesign',
        autonomy: 'high',
        priority: 'medium',
        multimodalInputs: [
          {
            type: 'design_mockup',
            designTool: 'figma',
            fileId: 'figma123',
            nodeId: 'login-screen',
            fileUrl: 'https://figma.com/file/figma123',
            name: 'New Login Design',
            description: 'Updated login screen with dark mode support',
          },
          {
            type: 'image',
            mediaType: 'image/png',
            url: 'https://assets.example.com/current-login.png',
            name: 'current-login.png',
            description: 'Screenshot of current login implementation',
          },
          {
            type: 'web_page',
            url: 'https://app.example.com/login',
            title: 'Current Login Page',
            capturedText: 'Username field, Password field, Login button, Forgot password link',
          },
        ],
      };

      expect(uiRedesignRequest.multimodalInputs).toHaveLength(3);
      expect(uiRedesignRequest.multimodalInputs![0].type).toBe('design_mockup');
      expect(uiRedesignRequest.multimodalInputs![1].type).toBe('image');
      expect(uiRedesignRequest.multimodalInputs![2].type).toBe('web_page');
    });

    it('should handle bug reproduction workflow', () => {
      const bugReproductionRequest: CreateTaskRequest = {
        description: 'Investigate and fix checkout cart calculation error',
        acceptanceCriteria: 'Cart totals should calculate correctly with discounts and tax',
        workflow: 'bug-investigation',
        autonomy: 'medium',
        multimodalInputs: [
          {
            type: 'image',
            mediaType: 'image/jpeg',
            data: 'base64-screenshot-of-error',
            encoding: 'base64',
            name: 'cart-error-screenshot.jpg',
            description: 'Screenshot showing incorrect cart total calculation',
          },
          {
            type: 'web_page',
            url: 'https://app.example.com/cart',
            title: 'Shopping Cart',
            capturedText: 'Items: Widget ($10), Gadget ($25), Subtotal: $35, Discount: -$5, Tax: $2.40, Total: $33.40 (should be $32.40)',
          },
        ],
      };

      expect(bugReproductionRequest.multimodalInputs).toHaveLength(2);
      expect(bugReproductionRequest.description).toContain('calculation error');
    });

    it('should handle API documentation update workflow', () => {
      const apiDocsRequest: CreateTaskRequest = {
        description: 'Update API documentation based on Postman collection and OpenAPI spec',
        workflow: 'documentation-update',
        autonomy: 'low',
        multimodalInputs: [
          {
            type: 'web_page',
            url: 'https://docs.example.com/api/current',
            title: 'Current API Documentation',
            capturedText: 'Outdated API endpoints and response formats',
          },
          {
            type: 'design_mockup',
            designTool: 'other',
            name: 'API Response Examples',
            description: 'Screenshots of Postman requests and responses',
          },
        ],
      };

      expect(apiDocsRequest.multimodalInputs).toHaveLength(2);
      expect(apiDocsRequest.autonomy).toBe('low'); // Requires more human oversight
    });
  });
});