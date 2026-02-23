import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MultimodalInputHandler, processImageFile } from './multimodal-input-handler';

describe('MultimodalInputHandler Performance Tests', () => {
  const testDir = '/tmp/multimodal-perf-test';

  // Generate test images of different sizes
  const createTestImage = (sizeKB: number): Buffer => {
    // Create a simple PNG header + data to reach approximate size
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width = 1
      0x00, 0x00, 0x00, 0x01, // height = 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
      0x90, 0x77, 0x53, 0xDE, // IHDR CRC
    ]);

    const targetSize = sizeKB * 1024;
    const dataSize = Math.max(0, targetSize - pngHeader.length - 12); // Account for IEND chunk
    const imageData = Buffer.alloc(dataSize, 0xFF); // Fill with data

    const iendChunk = Buffer.from([
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // IEND CRC
    ]);

    return Buffer.concat([pngHeader, imageData, iendChunk]);
  };

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('file size performance', () => {
    it('should process small images quickly (< 10KB)', async () => {
      const smallImagePath = join(testDir, 'small.png');
      const smallImageData = createTestImage(5); // 5KB
      await writeFile(smallImagePath, smallImageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(smallImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.imageBlock.type).toBe('image');
      expect(processingTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle medium files efficiently (100KB - 1MB)', async () => {
      const mediumImagePath = join(testDir, 'medium.png');
      const mediumImageData = createTestImage(500); // 500KB
      await writeFile(mediumImagePath, mediumImageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(mediumImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.imageBlock.type).toBe('image');
      expect(result.fileSizeBytes).toBeGreaterThan(500 * 1024 * 0.9); // Allow 10% variance
      expect(processingTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should process large files within reasonable time (1MB - 10MB)', async () => {
      const largeImagePath = join(testDir, 'large.png');
      const largeImageData = createTestImage(5000); // 5MB
      await writeFile(largeImagePath, largeImageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(largeImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.imageBlock.type).toBe('image');
      expect(result.fileSizeBytes).toBeGreaterThan(5000 * 1024 * 0.9); // Allow 10% variance
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle maximum size files (approaching 20MB limit)', async () => {
      const maxSizeImagePath = join(testDir, 'max-size.png');
      const maxSizeImageData = createTestImage(19000); // 19MB (under 20MB limit)
      await writeFile(maxSizeImagePath, maxSizeImageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(maxSizeImagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.imageBlock.type).toBe('image');
      expect(result.fileSizeBytes).toBeGreaterThan(19000 * 1024 * 0.9); // Allow 10% variance
      expect(processingTime).toBeLessThan(10000); // Should complete in under 10 seconds
    });
  });

  describe('concurrent processing performance', () => {
    it('should handle multiple small files concurrently', async () => {
      const numFiles = 10;
      const smallImageData = createTestImage(10); // 10KB each

      // Create multiple test files
      const filePaths = await Promise.all(
        Array.from({ length: numFiles }, async (_, i) => {
          const path = join(testDir, `concurrent-small-${i}.png`);
          await writeFile(path, smallImageData);
          return path;
        })
      );

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      // Process all files concurrently
      const results = await Promise.all(
        filePaths.map(path => handler.processImageFile(path))
      );

      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;
      const avgTimePerFile = totalProcessingTime / numFiles;

      expect(results).toHaveLength(numFiles);
      results.forEach(result => {
        expect(result.imageBlock.type).toBe('image');
        expect(result.imageBlock.source.media_type).toBe('image/png');
      });

      // Concurrent processing should be more efficient than sequential
      expect(avgTimePerFile).toBeLessThan(200); // Average under 200ms per file
      expect(totalProcessingTime).toBeLessThan(2000); // Total under 2 seconds
    });

    it('should handle mixed file sizes concurrently', async () => {
      const testFiles = [
        { name: 'small.png', size: 5 },
        { name: 'medium.png', size: 100 },
        { name: 'large.png', size: 1000 }
      ];

      // Create test files of different sizes
      const filePaths = await Promise.all(
        testFiles.map(async ({ name, size }) => {
          const path = join(testDir, `concurrent-${name}`);
          const imageData = createTestImage(size);
          await writeFile(path, imageData);
          return { path, expectedSize: size };
        })
      );

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      // Process all files concurrently
      const results = await Promise.all(
        filePaths.map(({ path }) => handler.processImageFile(path))
      );

      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;

      expect(results).toHaveLength(testFiles.length);
      results.forEach((result, index) => {
        expect(result.imageBlock.type).toBe('image');
        expect(result.fileSizeBytes).toBeGreaterThan(
          filePaths[index].expectedSize * 1024 * 0.8
        ); // Allow 20% variance
      });

      expect(totalProcessingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('memory usage patterns', () => {
    it('should not leak memory with repeated processing', async () => {
      const testImagePath = join(testDir, 'memory-test.png');
      const testImageData = createTestImage(100); // 100KB
      await writeFile(testImagePath, testImageData);

      const handler = new MultimodalInputHandler();
      const iterations = 50;

      // Force garbage collection if available
      const forceGC = () => {
        if (global.gc) {
          global.gc();
        }
      };

      // Get baseline memory usage
      forceGC();
      const initialMemory = process.memoryUsage();

      // Process the same file multiple times
      for (let i = 0; i < iterations; i++) {
        const result = await handler.processImageFile(testImagePath);
        expect(result.imageBlock.type).toBe('image');

        // Periodically force garbage collection
        if (i % 10 === 0) {
          forceGC();
        }
      }

      // Final garbage collection and memory check
      forceGC();
      const finalMemory = process.memoryUsage();

      // Memory usage shouldn't increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Allow reasonable memory increase (should be much less than file size * iterations)
      expect(memoryIncreaseKB).toBeLessThan(iterations * 50); // 50KB threshold per iteration
    });

    it('should handle large base64 strings efficiently', async () => {
      const largeImagePath = join(testDir, 'base64-test.png');
      const largeImageData = createTestImage(2000); // 2MB
      await writeFile(largeImagePath, largeImageData);

      const handler = new MultimodalInputHandler();

      const startTime = performance.now();
      const result = await handler.processImageFile(largeImagePath);
      const endTime = performance.now();

      const base64String = result.imageBlock.source.data;
      const processingTime = endTime - startTime;

      // Verify base64 string is valid and reasonably sized
      expect(base64String).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(base64String.length).toBeGreaterThan(result.fileSizeBytes * 1.3); // Base64 expansion
      expect(base64String.length).toBeLessThan(result.fileSizeBytes * 1.5); // But not too much

      // Processing should be reasonable even for large base64 conversion
      expect(processingTime).toBeLessThan(3000); // Under 3 seconds for 2MB
    });
  });

  describe('error handling performance', () => {
    it('should fail fast for obviously invalid files', async () => {
      const handler = new MultimodalInputHandler();

      const startTime = performance.now();

      try {
        await handler.processImageFile('/nonexistent/path/file.png');
      } catch (error) {
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        expect(processingTime).toBeLessThan(100); // Should fail very quickly
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should validate file size quickly without reading entire file', async () => {
      const oversizedImagePath = join(testDir, 'oversized.png');
      const oversizedImageData = createTestImage(25000); // 25MB (exceeds 20MB limit)
      await writeFile(oversizedImagePath, oversizedImageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      try {
        await handler.processImageFile(oversizedImagePath);
      } catch (error) {
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        // Should fail quickly based on file stats, not after reading entire file
        expect(processingTime).toBeLessThan(500); // Should fail in under 500ms
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('exceeds maximum allowed size');
      }
    });
  });

  describe('format-specific performance', () => {
    it.each([
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['jpeg', 'image/jpeg'],
      ['gif', 'image/gif'],
      ['webp', 'image/webp']
    ])('should process %s files consistently', async (extension, expectedMediaType) => {
      const imagePath = join(testDir, `format-test.${extension}`);
      const imageData = createTestImage(100); // 100KB
      await writeFile(imagePath, imageData);

      const handler = new MultimodalInputHandler();
      const startTime = performance.now();

      const result = await handler.processImageFile(imagePath);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.imageBlock.source.media_type).toBe(expectedMediaType);
      expect(processingTime).toBeLessThan(1000); // Consistent performance across formats
    });
  });
});