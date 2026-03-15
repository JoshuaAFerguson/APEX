import { describe, it, expect } from 'vitest';
import {
  MultimodalInput,
  MultimodalContext,
  ProcessedMultimodalInput,
  MultimodalProcessingStatus,
  ExtractedContent,
  ExtractedEntity,
  MultimodalInputCollection,
  MultimodalInputSchema,
  MultimodalContextSchema,
  ProcessedMultimodalInputSchema,
  MultimodalInputCollectionSchema,
  ExtractedContentSchema,
  ExtractedEntitySchema,
  MultimodalProcessingStatusSchema,
  MultimodalInputCountsSchema,
} from '../types';

describe('Multimodal Processing Workflows', () => {
  describe('Processing Status Transitions', () => {
    it('should model processing lifecycle correctly', () => {
      const statuses: MultimodalProcessingStatus[] = [
        'pending',
        'processing',
        'completed'
      ];

      // Should progress through statuses
      statuses.forEach(status => {
        expect(() => MultimodalProcessingStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should handle processing failure paths', () => {
      const failureStatuses: MultimodalProcessingStatus[] = [
        'failed',
        'skipped'
      ];

      failureStatuses.forEach(status => {
        expect(() => MultimodalProcessingStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should track processing state changes', () => {
      const input: MultimodalInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data',
      };

      // Initial pending state
      const pendingProcessed: ProcessedMultimodalInput = {
        input,
        status: 'pending',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(pendingProcessed)).not.toThrow();

      // Progress to processing
      const processingState: ProcessedMultimodalInput = {
        ...pendingProcessed,
        status: 'processing',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(processingState)).not.toThrow();

      // Complete with results
      const completedState: ProcessedMultimodalInput = {
        ...processingState,
        status: 'completed',
        processedAt: new Date(),
        processingDurationMs: 2500,
        extractedContent: {
          text: 'Image processed successfully',
        },
      };

      expect(() => ProcessedMultimodalInputSchema.parse(completedState)).not.toThrow();
    });
  });

  describe('Content Extraction Validation', () => {
    it('should validate extracted text content', () => {
      const textContent: ExtractedContent = {
        text: 'This is extracted text from the multimodal input',
      };

      expect(() => ExtractedContentSchema.parse(textContent)).not.toThrow();
    });

    it('should validate structured data extraction', () => {
      const structuredContent: ExtractedContent = {
        structuredData: {
          formElements: ['username', 'password', 'submit'],
          hasValidation: true,
          isAccessible: true,
          colorScheme: 'light',
        },
      };

      expect(() => ExtractedContentSchema.parse(structuredContent)).not.toThrow();
    });

    it('should validate entity extraction with confidence scores', () => {
      const entities: ExtractedEntity[] = [
        { type: 'button', value: 'Submit', confidence: 0.95 },
        { type: 'input', value: 'username', confidence: 0.92 },
        { type: 'input', value: 'password', confidence: 0.89 },
        { type: 'link', value: 'Forgot password?', confidence: 0.87 },
      ];

      entities.forEach(entity => {
        expect(() => ExtractedEntitySchema.parse(entity)).not.toThrow();
      });

      const contentWithEntities: ExtractedContent = {
        entities,
      };

      expect(() => ExtractedContentSchema.parse(contentWithEntities)).not.toThrow();
    });

    it('should validate combined extraction results', () => {
      const complexExtractedContent: ExtractedContent = {
        text: 'Login form with username field, password field, and submit button. Also includes forgot password link.',
        structuredData: {
          formType: 'login',
          fieldCount: 2,
          hasRememberMe: false,
          securityFeatures: ['password-visibility-toggle'],
        },
        entities: [
          {
            type: 'input',
            value: 'username',
            confidence: 0.98,
            bounds: { x: 20, y: 100, width: 200, height: 40 }
          },
          {
            type: 'input',
            value: 'password',
            confidence: 0.97,
            bounds: { x: 20, y: 150, width: 200, height: 40 }
          },
          {
            type: 'button',
            value: 'Login',
            confidence: 0.99,
            bounds: { x: 20, y: 200, width: 80, height: 40 }
          }
        ],
      };

      expect(() => ExtractedContentSchema.parse(complexExtractedContent)).not.toThrow();
    });
  });

  describe('Batch Processing Scenarios', () => {
    it('should handle sequential batch processing', () => {
      const batchInputs: MultimodalInput[] = [
        { type: 'image', mediaType: 'image/png', data: 'image1' },
        { type: 'image', mediaType: 'image/png', data: 'image2' },
        { type: 'image', mediaType: 'image/png', data: 'image3' },
      ];

      const collection: MultimodalInputCollection = {
        inputs: batchInputs,
        processingOrder: 'sequential',
        context: 'Process images in sequence for UI flow analysis',
      };

      expect(() => MultimodalInputCollectionSchema.parse(collection)).not.toThrow();

      // Simulate sequential processing results
      const processedInputs: ProcessedMultimodalInput[] = batchInputs.map((input, index) => ({
        input,
        status: 'completed' as const,
        processedAt: new Date(Date.now() + index * 1000), // Sequential timing
        processingDurationMs: 1500,
        extractedContent: {
          text: `Image ${index + 1} processed`,
        },
      }));

      const batchContext: MultimodalContext = {
        inputs: processedInputs,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 4500, // 3 * 1500ms
        inputCounts: { images: 3, webPages: 0, designMockups: 0 },
      };

      expect(() => MultimodalContextSchema.parse(batchContext)).not.toThrow();
    });

    it('should handle parallel batch processing', () => {
      const parallelInputs: MultimodalInput[] = [
        { type: 'web_page', url: 'https://example.com/page1' },
        { type: 'web_page', url: 'https://example.com/page2' },
        { type: 'web_page', url: 'https://example.com/page3' },
      ];

      const parallelCollection: MultimodalInputCollection = {
        inputs: parallelInputs,
        processingOrder: 'parallel',
        context: 'Analyze multiple pages simultaneously',
      };

      expect(() => MultimodalInputCollectionSchema.parse(parallelCollection)).not.toThrow();

      // Simulate parallel processing with same completion time
      const sameProcessingTime = new Date();
      const parallelProcessedInputs: ProcessedMultimodalInput[] = parallelInputs.map((input, index) => ({
        input,
        status: 'completed' as const,
        processedAt: sameProcessingTime, // Parallel - same time
        processingDurationMs: 2000 + index * 100, // Different durations but same end time
        extractedContent: {
          text: `Web page ${index + 1} content extracted`,
        },
      }));

      const parallelContext: MultimodalContext = {
        inputs: parallelProcessedInputs,
        status: 'completed',
        createdAt: new Date(),
        completedAt: sameProcessingTime,
        totalProcessingTimeMs: Math.max(...parallelProcessedInputs.map(p => p.processingDurationMs || 0)), // Max time for parallel
        inputCounts: { images: 0, webPages: 3, designMockups: 0 },
      };

      expect(() => MultimodalContextSchema.parse(parallelContext)).not.toThrow();
    });

    it('should handle priority-based processing', () => {
      const priorityInputs: MultimodalInput[] = [
        {
          type: 'design_mockup',
          designTool: 'figma',
          name: 'High Priority Design',
          metadata: { priority: 'high' }
        },
        {
          type: 'image',
          mediaType: 'image/png',
          data: 'low-priority-image',
          metadata: { priority: 'low' }
        },
        {
          type: 'web_page',
          url: 'https://example.com',
          metadata: { priority: 'medium' }
        },
      ];

      const priorityCollection: MultimodalInputCollection = {
        inputs: priorityInputs,
        processingOrder: 'priority',
        context: 'Process inputs based on priority levels',
        metadata: {
          priorityStrategy: 'high-first',
        },
      };

      expect(() => MultimodalInputCollectionSchema.parse(priorityCollection)).not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle individual processing failures gracefully', () => {
      const mixedResults: ProcessedMultimodalInput[] = [
        {
          input: { type: 'image', mediaType: 'image/png', data: 'valid-data' },
          status: 'completed',
          processedAt: new Date(),
          extractedContent: { text: 'Successfully processed image' },
        },
        {
          input: { type: 'web_page', url: 'https://invalid-domain.fake' },
          status: 'failed',
          processedAt: new Date(),
          error: 'DNS resolution failed: domain not found',
        },
        {
          input: { type: 'design_mockup', designTool: 'figma', fileId: 'missing-file' },
          status: 'failed',
          processedAt: new Date(),
          error: 'File not accessible: permission denied',
        },
      ];

      const contextWithFailures: MultimodalContext = {
        inputs: mixedResults,
        status: 'completed', // Overall can be completed even with some failures
        contextSummary: '1 of 3 inputs processed successfully. 2 failed due to access issues.',
        createdAt: new Date(),
        completedAt: new Date(),
        inputCounts: { images: 1, webPages: 1, designMockups: 1 },
      };

      expect(() => MultimodalContextSchema.parse(contextWithFailures)).not.toThrow();

      // Verify error messages are captured
      const failures = mixedResults.filter(r => r.status === 'failed');
      expect(failures).toHaveLength(2);
      failures.forEach(failure => {
        expect(failure.error).toBeDefined();
        expect(failure.error).toContain('failed' || failure.error).toContain('denied');
      });
    });

    it('should handle timeout scenarios', () => {
      const timeoutInput: ProcessedMultimodalInput = {
        input: {
          type: 'web_page',
          url: 'https://very-slow-site.example.com',
        },
        status: 'failed',
        processedAt: new Date(),
        processingDurationMs: 30000, // 30 second timeout
        error: 'Processing timeout: exceeded 30 second limit',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(timeoutInput)).not.toThrow();
      expect(timeoutInput.processingDurationMs).toBe(30000);
      expect(timeoutInput.error).toContain('timeout');
    });

    it('should handle resource exhaustion scenarios', () => {
      const resourceError: ProcessedMultimodalInput = {
        input: {
          type: 'image',
          mediaType: 'image/png',
          data: 'huge-image-data', // Simulating very large image
        },
        status: 'failed',
        processedAt: new Date(),
        processingDurationMs: 5000,
        error: 'Processing failed: insufficient memory for image processing',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(resourceError)).not.toThrow();
      expect(resourceError.error).toContain('insufficient memory');
    });

    it('should handle invalid format scenarios', () => {
      const formatError: ProcessedMultimodalInput = {
        input: {
          type: 'design_mockup',
          designTool: 'sketch',
          fileUrl: 'https://example.com/not-a-sketch-file.pdf',
        },
        status: 'skipped',
        error: 'Unsupported file format: expected .sketch file, got .pdf',
      };

      expect(() => ProcessedMultimodalInputSchema.parse(formatError)).not.toThrow();
      expect(formatError.status).toBe('skipped');
      expect(formatError.error).toContain('Unsupported file format');
    });
  });

  describe('Input Count Validation', () => {
    it('should validate input counts schema', () => {
      const counts = {
        images: 5,
        webPages: 3,
        designMockups: 2,
      };

      expect(() => MultimodalInputCountsSchema.parse(counts)).not.toThrow();
    });

    it('should default zero counts', () => {
      const emptyCounts = {};
      const parsed = MultimodalInputCountsSchema.parse(emptyCounts);

      expect(parsed.images).toBe(0);
      expect(parsed.webPages).toBe(0);
      expect(parsed.designMockups).toBe(0);
    });

    it('should reject negative counts', () => {
      const negativeCounts = {
        images: -1,
        webPages: 0,
        designMockups: 0,
      };

      expect(() => MultimodalInputCountsSchema.parse(negativeCounts)).toThrow();
    });

    it('should enforce integer counts', () => {
      const floatCounts = {
        images: 3.5, // Should fail - must be integer
        webPages: 2,
        designMockups: 1,
      };

      expect(() => MultimodalInputCountsSchema.parse(floatCounts)).toThrow();
    });
  });

  describe('Context Summary Generation', () => {
    it('should handle contexts with comprehensive summaries', () => {
      const detailedContext: MultimodalContext = {
        inputs: [
          {
            input: { type: 'image', mediaType: 'image/png', data: 'screenshot' },
            status: 'completed',
            processedAt: new Date(),
            extractedContent: {
              text: 'Login form screenshot',
              entities: [{ type: 'button', value: 'Login' }],
            },
          },
        ],
        status: 'completed',
        contextSummary: `
          Processed 1 image containing a login form.
          Extracted elements: 1 button (Login).
          Processing completed successfully in 1.5 seconds.
          Context suitable for UI implementation tasks.
        `.trim(),
        createdAt: new Date(),
        completedAt: new Date(),
        totalProcessingTimeMs: 1500,
        inputCounts: { images: 1, webPages: 0, designMockups: 0 },
        metadata: {
          summaryGenerated: true,
          confidence: 'high',
          recommendedActions: ['ui-implementation', 'visual-testing'],
        },
      };

      expect(() => MultimodalContextSchema.parse(detailedContext)).not.toThrow();
      expect(detailedContext.contextSummary).toContain('login form');
      expect(detailedContext.metadata).toBeDefined();
    });

    it('should handle empty or minimal summaries', () => {
      const minimalContext: MultimodalContext = {
        inputs: [],
        status: 'pending',
        createdAt: new Date(),
        inputCounts: { images: 0, webPages: 0, designMockups: 0 },
        // No contextSummary - should be optional
      };

      expect(() => MultimodalContextSchema.parse(minimalContext)).not.toThrow();
      expect(minimalContext.contextSummary).toBeUndefined();
    });
  });
});