/**
 * Performance and stress tests for MultimodalInputHandler
 * Tests system behavior under load, memory usage, and concurrent processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MultimodalInputHandler, type MultimodalInputHandlerConfig } from '../multimodal-input-handler';

describe('MultimodalInputHandler - Performance & Stress Tests', () => {
  const testDir = '/tmp/multimodal-stress-test';
  let handler: MultimodalInputHandler;

  // Test data
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==';
  const testImageBuffer = Buffer.from(testImageBase64, 'base64');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    handler = new MultimodalInputHandler();
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Force garbage collection if available (for memory tests)
    if (global.gc) {
      global.gc();
    }
  });

  describe('concurrent processing stress tests', () => {
    it('should handle high concurrency without errors', async () => {
      const concurrencyLevel = 50;
      const testFiles: string[] = [];

      // Create test files
      for (let i = 0; i < concurrencyLevel; i++) {
        const filePath = join(testDir, `concurrent-${i}.png`);
        await writeFile(filePath, testImageBuffer);
        testFiles.push(filePath);
      }

      const startTime = process.hrtime.bigint();
      const memoryBefore = process.memoryUsage();

      // Process all files concurrently
      const promises = testFiles.map(file => handler.processImageFile(file));
      const results = await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage();

      // Verify all processed successfully
      expect(results).toHaveLength(concurrencyLevel);
      results.forEach((result, index) => {
        expect(result.imageBlock.type).toBe('image');
        expect(result.mediaType).toBe('image/png');
        expect(result.fileSizeBytes).toBe(testImageBuffer.length);
      });

      // Performance metrics
      const processingTimeMs = Number(endTime - startTime) / 1_000_000;
      const avgProcessingTime = processingTimeMs / concurrencyLevel;
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`Concurrent processing stats:
        - Files: ${concurrencyLevel}
        - Total time: ${processingTimeMs.toFixed(2)}ms
        - Average per file: ${avgProcessingTime.toFixed(2)}ms
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Performance assertions
      expect(avgProcessingTime).toBeLessThan(100); // Less than 100ms per file on average
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB memory increase
    }, 30000); // 30 second timeout

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        // Image processing
        ...Array.from({ length: 10 }, async (_, i) => {
          const filePath = join(testDir, `mixed-image-${i}.png`);
          await writeFile(filePath, testImageBuffer);
          return handler.processImageFile(filePath);
        }),
        // processInputs calls
        ...Array.from({ length: 10 }, () =>
          handler.processInputs([{
            type: 'image',
            mediaType: 'image/png',
            data: testImageBase64,
            description: 'Test image'
          }])
        ),
        // Utility calls
        ...Array.from({ length: 10 }, () => Promise.resolve({
          isSupportedFormat: handler.isSupportedFormat('test.png'),
          supportedTypes: handler.getSupportedMediaTypes(),
          config: handler.getConfig()
        }))
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(30);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 15000);
  });

  describe('large file handling', () => {
    it('should efficiently process large files within memory limits', async () => {
      // Create a large but valid file (just under the 20MB default limit)
      const largeFileSize = 19 * 1024 * 1024; // 19MB
      const largeFilePath = join(testDir, 'large-file.png');
      const largeBuffer = Buffer.alloc(largeFileSize);

      // Fill with pattern to make it realistic
      for (let i = 0; i < largeBuffer.length; i++) {
        largeBuffer[i] = i % 256;
      }

      await writeFile(largeFilePath, largeBuffer);

      const memoryBefore = process.memoryUsage();
      const startTime = process.hrtime.bigint();

      const result = await handler.processImageFile(largeFilePath);

      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage();

      expect(result.fileSizeBytes).toBe(largeFileSize);
      expect(result.imageBlock.source.data).toBeDefined();

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`Large file processing stats:
        - File size: ${(largeFileSize / 1024 / 1024).toFixed(2)}MB
        - Processing time: ${processingTimeMs.toFixed(2)}ms
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should process within reasonable time and memory bounds
      expect(processingTimeMs).toBeLessThan(5000); // Less than 5 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    }, 10000);

    it('should handle multiple large files sequentially without memory leaks', async () => {
      const fileSize = 5 * 1024 * 1024; // 5MB each
      const numFiles = 5;
      const filePaths: string[] = [];

      // Create multiple large files
      for (let i = 0; i < numFiles; i++) {
        const filePath = join(testDir, `seq-large-${i}.png`);
        const buffer = Buffer.alloc(fileSize, i); // Fill with different patterns
        await writeFile(filePath, buffer);
        filePaths.push(filePath);
      }

      const memoryBefore = process.memoryUsage();
      const startTime = Date.now();

      // Process sequentially to test memory cleanup
      const results = [];
      for (const filePath of filePaths) {
        const result = await handler.processImageFile(filePath);
        results.push(result);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const processingTime = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();

      expect(results).toHaveLength(numFiles);
      results.forEach((result, index) => {
        expect(result.fileSizeBytes).toBe(fileSize);
      });

      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`Sequential large file processing stats:
        - Files: ${numFiles} x ${(fileSize / 1024 / 1024).toFixed(2)}MB
        - Total time: ${processingTime}ms
        - Avg per file: ${(processingTime / numFiles).toFixed(2)}ms
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory usage shouldn't grow linearly with file count (indicates cleanup)
      expect(memoryIncrease).toBeLessThan(2 * fileSize); // Less than 2x single file size
    }, 15000);
  });

  describe('batch processing performance', () => {
    it('should efficiently process large batches of inputs', async () => {
      const batchSize = 100;
      const inputs = Array.from({ length: batchSize }, (_, i) => ({
        type: 'image' as const,
        mediaType: 'image/png' as const,
        data: testImageBase64,
        description: `Batch image ${i}`
      }));

      const memoryBefore = process.memoryUsage();
      const startTime = process.hrtime.bigint();

      const result = await handler.processInputs(inputs);

      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage();

      expect(result.inputs).toHaveLength(batchSize);
      expect(result.inputCounts.images).toBe(batchSize);

      const processingTimeMs = Number(endTime - startTime) / 1_000_000;
      const avgTimePerInput = processingTimeMs / batchSize;
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`Batch processing stats:
        - Batch size: ${batchSize}
        - Total time: ${processingTimeMs.toFixed(2)}ms
        - Avg per input: ${avgTimePerInput.toFixed(3)}ms
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      expect(avgTimePerInput).toBeLessThan(10); // Less than 10ms per input on average
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
    });

    it('should handle mixed input types in large batches', async () => {
      const batchSize = 60; // 20 of each type
      const inputs = [
        // Images
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'image' as const,
          mediaType: 'image/png' as const,
          data: testImageBase64,
          description: `Batch image ${i}`
        })),
        // Web pages
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'web_page' as const,
          url: `https://example${i}.com`,
          capturedText: `Page content ${i}`
        })),
        // Design mockups
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'design_mockup' as const,
          designTool: 'figma' as const,
          description: `Design mockup ${i}`
        }))
      ];

      const startTime = Date.now();
      const result = await handler.processInputs(inputs);
      const processingTime = Date.now() - startTime;

      expect(result.inputs).toHaveLength(batchSize);
      expect(result.inputCounts.images).toBe(20);
      expect(result.inputCounts.webPages).toBe(20);
      expect(result.inputCounts.designMockups).toBe(20);

      const avgTimePerInput = processingTime / batchSize;

      console.log(`Mixed batch processing stats:
        - Batch size: ${batchSize}
        - Types: 20 images, 20 web pages, 20 design mockups
        - Total time: ${processingTime}ms
        - Avg per input: ${avgTimePerInput.toFixed(2)}ms`);

      expect(avgTimePerInput).toBeLessThan(50); // Less than 50ms per input on average
    });
  });

  describe('memory usage patterns', () => {
    it('should maintain stable memory usage during repeated operations', async () => {
      const iterations = 20;
      const memoryReadings: number[] = [];

      const testFilePath = join(testDir, 'memory-test.png');
      await writeFile(testFilePath, testImageBuffer);

      // Baseline memory
      if (global.gc) global.gc();
      const baselineMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        // Perform operation
        await handler.processImageFile(testFilePath);

        // Force cleanup and measure
        if (global.gc) global.gc();
        const currentMemory = process.memoryUsage().heapUsed;
        memoryReadings.push(currentMemory - baselineMemory);

        // Small delay to allow for any async cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Memory should not grow significantly over iterations
      const firstReadings = memoryReadings.slice(0, 5);
      const lastReadings = memoryReadings.slice(-5);

      const avgFirst = firstReadings.reduce((a, b) => a + b, 0) / firstReadings.length;
      const avgLast = lastReadings.reduce((a, b) => a + b, 0) / lastReadings.length;
      const memoryGrowth = avgLast - avgFirst;

      console.log(`Memory stability test:
        - Iterations: ${iterations}
        - Avg memory first 5: ${(avgFirst / 1024 / 1024).toFixed(2)}MB
        - Avg memory last 5: ${(avgLast / 1024 / 1024).toFixed(2)}MB
        - Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Memory growth should be minimal (less than 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('configuration impact on performance', () => {
    it('should show performance difference between different file size limits', async () => {
      const testSizes = [1024, 10 * 1024, 100 * 1024]; // 1KB, 10KB, 100KB
      const configs: MultimodalInputHandlerConfig[] = [
        { maxFileSizeBytes: 1024 }, // Very restrictive
        { maxFileSizeBytes: 1024 * 1024 }, // Moderate
        { maxFileSizeBytes: 20 * 1024 * 1024 } // Default
      ];

      const results: Array<{ config: MultimodalInputHandlerConfig; avgTime: number; errors: number }> = [];

      for (const config of configs) {
        const handler = new MultimodalInputHandler(config);
        const times: number[] = [];
        let errors = 0;

        for (let size of testSizes) {
          const filePath = join(testDir, `perf-config-${size}.png`);
          const buffer = Buffer.alloc(size);
          await writeFile(filePath, buffer);

          try {
            const startTime = Date.now();
            await handler.processImageFile(filePath);
            times.push(Date.now() - startTime);
          } catch (error) {
            errors++;
          }
        }

        const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        results.push({ config, avgTime, errors });
      }

      console.log('Configuration performance comparison:');
      results.forEach((result, i) => {
        console.log(`  Config ${i}: max=${result.config.maxFileSizeBytes} bytes, avg=${result.avgTime.toFixed(2)}ms, errors=${result.errors}`);
      });

      // Verify more restrictive configs reject larger files
      expect(results[0].errors).toBeGreaterThan(results[2].errors);
    });
  });

  describe('error handling under stress', () => {
    it('should gracefully handle mixed valid and invalid inputs in large batches', async () => {
      const batchSize = 50;
      const inputs = [];

      // Mix of valid and invalid inputs
      for (let i = 0; i < batchSize; i++) {
        if (i % 5 === 0) {
          // Invalid input (missing required field)
          inputs.push({
            type: 'image',
            // Missing mediaType and data
          });
        } else {
          // Valid input
          inputs.push({
            type: 'image',
            mediaType: 'image/png',
            data: testImageBase64,
            description: `Valid input ${i}`
          });
        }
      }

      // Should fail fast on first invalid input
      const startTime = Date.now();

      try {
        await handler.processInputs(inputs);
        expect.fail('Should have thrown error for invalid inputs');
      } catch (error) {
        const processingTime = Date.now() - startTime;

        // Should fail quickly (not process all inputs)
        expect(processingTime).toBeLessThan(1000); // Less than 1 second
        expect(error.message).toContain('Missing required field');
      }
    });
  });
});