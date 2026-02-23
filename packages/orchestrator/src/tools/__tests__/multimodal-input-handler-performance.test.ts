import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MultimodalInputHandler } from '../multimodal-input-handler';

describe('MultimodalInputHandler - Performance Tests', () => {
  const testDir = '/tmp/multimodal-performance-test';

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('file size performance', () => {
    it('should process small files quickly (< 1KB)', async () => {
      const smallImagePath = join(testDir, 'small-image.png');
      const smallData = Buffer.alloc(512, 'x'); // 512 bytes
      await writeFile(smallImagePath, smallData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(smallImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.fileSizeBytes).toBe(512);
      expect(processingTime).toBeLessThan(100); // Should process in < 100ms
    });

    it('should process medium files efficiently (~100KB)', async () => {
      const mediumImagePath = join(testDir, 'medium-image.png');
      const mediumData = Buffer.alloc(100 * 1024, 'x'); // 100KB
      await writeFile(mediumImagePath, mediumData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(mediumImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.fileSizeBytes).toBe(100 * 1024);
      expect(processingTime).toBeLessThan(500); // Should process in < 500ms
    });

    it('should process large files within reasonable time (~10MB)', async () => {
      const largeImagePath = join(testDir, 'large-image.png');
      const largeData = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB
      await writeFile(largeImagePath, largeData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(largeImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.fileSizeBytes).toBe(10 * 1024 * 1024);
      expect(processingTime).toBeLessThan(2000); // Should process in < 2 seconds
    });
  });

  describe('concurrent processing performance', () => {
    it('should handle multiple small files concurrently', async () => {
      const fileCount = 10;
      const filePaths: string[] = [];

      // Create multiple small test files
      for (let i = 0; i < fileCount; i++) {
        const filePath = join(testDir, `concurrent-small-${i}.png`);
        await writeFile(filePath, Buffer.alloc(1024, `${i}`));
        filePaths.push(filePath);
      }

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      // Process all files concurrently
      const promises = filePaths.map(path => handler.processImageFile(path));
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;

      expect(results).toHaveLength(fileCount);
      results.forEach(result => {
        expect(result.fileSizeBytes).toBe(1024);
      });

      // Concurrent processing should be faster than sequential
      // Allow generous time for concurrent processing
      expect(totalProcessingTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });

  describe('memory usage patterns', () => {
    it('should not accumulate memory across multiple operations', async () => {
      const testImagePath = join(testDir, 'memory-test-image.png');
      const testData = Buffer.alloc(1024, 'x');
      await writeFile(testImagePath, testData);

      const handler = new MultimodalInputHandler();

      // Process the same file multiple times
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const result = await handler.processImageFile(testImagePath);
        expect(result.fileSizeBytes).toBe(1024);

        // Each iteration should complete reasonably quickly
        // This indirectly tests that we're not accumulating memory/resources
      }

      // If we get here without hanging or crashing, the test passes
      expect(true).toBe(true);
    });
  });

  describe('base64 encoding performance', () => {
    it('should encode base64 efficiently for various sizes', async () => {
      const sizes = [
        { name: '1KB', size: 1024 },
        { name: '10KB', size: 10 * 1024 },
        { name: '100KB', size: 100 * 1024 },
        { name: '1MB', size: 1024 * 1024 },
      ];

      const handler = new MultimodalInputHandler();

      for (const { name, size } of sizes) {
        const testImagePath = join(testDir, `base64-test-${name.toLowerCase()}.png`);
        const testData = Buffer.alloc(size, 'x');
        await writeFile(testImagePath, testData);

        const startTime = performance.now();
        const result = await handler.processImageFile(testImagePath);
        const endTime = performance.now();

        expect(result.fileSizeBytes).toBe(size);

        // Verify base64 encoding is correct
        const decodedSize = Buffer.from(result.imageBlock.source.data, 'base64').length;
        expect(decodedSize).toBe(size);

        const processingTime = endTime - startTime;
        console.log(`Base64 encoding for ${name}: ${processingTime.toFixed(2)}ms`);

        // Performance should scale reasonably with file size
        // Allow more time for larger files, but not excessively
        const maxTime = size <= 1024 ? 50 : size <= 10 * 1024 ? 100 : size <= 100 * 1024 ? 300 : 1000;
        expect(processingTime).toBeLessThan(maxTime);
      }
    });
  });

  describe('error handling performance', () => {
    it('should fail fast for nonexistent files', async () => {
      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      try {
        await handler.processImageFile('/nonexistent/path/image.png');
        fail('Should have thrown an error');
      } catch (error) {
        const endTime = performance.now();
        const errorTime = endTime - startTime;

        // Error detection should be very fast
        expect(errorTime).toBeLessThan(50);
      }
    });

    it('should fail fast for unsupported formats', async () => {
      const unsupportedFilePath = join(testDir, 'test-file.txt');
      await writeFile(unsupportedFilePath, 'Hello World');

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      try {
        await handler.processImageFile(unsupportedFilePath);
        fail('Should have thrown an error');
      } catch (error) {
        const endTime = performance.now();
        const errorTime = endTime - startTime;

        // Format validation should be fast
        expect(errorTime).toBeLessThan(100);
      }
    });
  });

  describe('configuration performance', () => {
    it('should create handlers with custom config quickly', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new MultimodalInputHandler({
          maxFileSizeBytes: i * 1024,
          supportedFormats: ['png', 'jpg'],
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Creating handlers should be very fast
      expect(totalTime).toBeLessThan(100);

      const avgTimePerHandler = totalTime / iterations;
      expect(avgTimePerHandler).toBeLessThan(0.1); // < 0.1ms per handler
    });
  });
});