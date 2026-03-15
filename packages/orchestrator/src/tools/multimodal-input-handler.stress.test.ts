import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  type MultimodalInputHandlerConfig
} from './multimodal-input-handler';

describe('MultimodalInputHandler Stress Tests', () => {
  const testDir = '/tmp/multimodal-stress-test';

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('boundary condition tests', () => {
    it('should handle file exactly at size limit', async () => {
      const exactLimitPath = join(testDir, 'exact-limit.png');
      const exactLimitSize = 20 * 1024 * 1024; // Exactly 20MB

      // Create minimal PNG header
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR start
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE // IHDR end
      ]);

      const iendChunk = Buffer.from([
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const dataSize = exactLimitSize - pngHeader.length - iendChunk.length;
      const paddingData = Buffer.alloc(dataSize, 0x00);

      const exactLimitData = Buffer.concat([pngHeader, paddingData, iendChunk]);
      await writeFile(exactLimitPath, exactLimitData);

      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(exactLimitPath);

      expect(result.fileSizeBytes).toBe(exactLimitSize);
      expect(result.imageBlock.type).toBe('image');
    });

    it('should reject file one byte over limit', async () => {
      const overLimitPath = join(testDir, 'over-limit.png');
      const overLimitSize = 20 * 1024 * 1024 + 1; // 20MB + 1 byte

      const overLimitData = Buffer.alloc(overLimitSize, 0x00);
      await writeFile(overLimitPath, overLimitData);

      const handler = new MultimodalInputHandler();

      await expect(handler.processImageFile(overLimitPath))
        .rejects
        .toThrow(MultimodalInputError);
    });

    it('should handle minimum viable file (1 byte)', async () => {
      const minimalPath = join(testDir, 'minimal.png');
      const minimalData = Buffer.from([0x89]); // Single byte
      await writeFile(minimalPath, minimalData);

      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(minimalPath);

      expect(result.fileSizeBytes).toBe(1);
      expect(result.imageBlock.source.data).toBe('iQ=='); // Base64 for single byte 0x89
    });

    it('should handle custom size limits correctly', async () => {
      const customLimitPath = join(testDir, 'custom-limit.png');
      const testData = Buffer.alloc(1000, 0xFF); // 1KB
      await writeFile(customLimitPath, testData);

      // Handler with very small limit
      const restrictiveHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 500 // 500 bytes
      });

      await expect(restrictiveHandler.processImageFile(customLimitPath))
        .rejects
        .toThrow(/exceeds maximum allowed size/);

      // Handler with larger limit
      const permissiveHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 2000 // 2KB
      });

      const result = await permissiveHandler.processImageFile(customLimitPath);
      expect(result.fileSizeBytes).toBe(1000);
    });
  });

  describe('extreme configuration tests', () => {
    it('should handle empty supported formats array', async () => {
      const config: MultimodalInputHandlerConfig = {
        supportedFormats: []
      };

      const handler = new MultimodalInputHandler(config);
      const testPath = join(testDir, 'no-formats.png');
      await writeFile(testPath, Buffer.from('test'));

      await expect(handler.processImageFile(testPath))
        .rejects
        .toThrow(MultimodalInputError);
    });

    it('should handle single format restriction', async () => {
      const pngOnlyHandler = new MultimodalInputHandler({
        supportedFormats: ['png']
      });

      const pngPath = join(testDir, 'png-only.png');
      await writeFile(pngPath, Buffer.from('png-data'));

      const result = await pngOnlyHandler.processImageFile(pngPath);
      expect(result.imageBlock.source.media_type).toBe('image/png');

      // Should reject other formats
      const jpgPath = join(testDir, 'rejected.jpg');
      await writeFile(jpgPath, Buffer.from('jpg-data'));

      await expect(pngOnlyHandler.processImageFile(jpgPath))
        .rejects
        .toThrow(/FORMAT_NOT_CONFIGURED/);
    });

    it('should handle extremely small size limits', async () => {
      const tinyHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 1 // 1 byte
      });

      const singleBytePath = join(testDir, 'single-byte.png');
      await writeFile(singleBytePath, Buffer.from([0x89]));

      const result = await tinyHandler.processImageFile(singleBytePath);
      expect(result.fileSizeBytes).toBe(1);

      // Should reject 2-byte files
      const twoBytePath = join(testDir, 'two-bytes.png');
      await writeFile(twoBytePath, Buffer.from([0x89, 0x50]));

      await expect(tinyHandler.processImageFile(twoBytePath))
        .rejects
        .toThrow(/exceeds maximum allowed size/);
    });

    it('should handle maximum theoretical size limit', async () => {
      const maxHandler = new MultimodalInputHandler({
        maxFileSizeBytes: Number.MAX_SAFE_INTEGER
      });

      const config = maxHandler.getConfig();
      expect(config.maxFileSizeBytes).toBe(Number.MAX_SAFE_INTEGER);

      // Test with a reasonable file size should still work
      const reasonablePath = join(testDir, 'reasonable.png');
      await writeFile(reasonablePath, Buffer.alloc(1024, 0xFF));

      const result = await maxHandler.processImageFile(reasonablePath);
      expect(result.fileSizeBytes).toBe(1024);
    });
  });

  describe('path handling stress tests', () => {
    it('should handle very long file paths', async () => {
      const longDirName = 'a'.repeat(100); // 100 char directory name
      const longPath = join(testDir, longDirName);
      await mkdir(longPath, { recursive: true });

      const veryLongFileName = 'b'.repeat(200) + '.png'; // 200+ char filename
      const veryLongFilePath = join(longPath, veryLongFileName);
      await writeFile(veryLongFilePath, Buffer.from('test-data'));

      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(veryLongFilePath);

      expect(result.imageBlock.type).toBe('image');
      expect(result.fileSizeBytes).toBe(9); // 'test-data' length
    });

    it('should handle paths with unicode characters', async () => {
      const unicodePath = join(testDir, '测试文件-файл-テスト-🎨.png');
      await writeFile(unicodePath, Buffer.from('unicode-test'));

      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(unicodePath);

      expect(result.imageBlock.type).toBe('image');
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });

    it('should handle paths with many dots and special characters', async () => {
      const complexPath = join(testDir, 'my.complex-file_name (1) [copy].v2.final.png');
      await writeFile(complexPath, Buffer.from('complex-path-test'));

      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(complexPath);

      expect(result.imageBlock.source.media_type).toBe('image/png');
      expect(result.fileSizeBytes).toBe(17); // 'complex-path-test' length
    });

    it('should handle case variations in extensions', async () => {
      const casePaths = [
        join(testDir, 'case.PNG'),
        join(testDir, 'case.Png'),
        join(testDir, 'case.pNg'),
        join(testDir, 'case.png')
      ];

      const handler = new MultimodalInputHandler();

      for (const path of casePaths) {
        await writeFile(path, Buffer.from('case-test'));
        const result = await handler.processImageFile(path);
        expect(result.imageBlock.source.media_type).toBe('image/png');
      }
    });
  });

  describe('concurrent handler instances', () => {
    it('should handle multiple handler instances concurrently', async () => {
      const numHandlers = 20;
      const testData = Buffer.from('concurrent-handler-test');

      const handlers = Array.from(
        { length: numHandlers },
        (_, i) => new MultimodalInputHandler({
          maxFileSizeBytes: (i + 1) * 1000, // Different configs
          supportedFormats: i % 2 === 0 ? ['png'] : ['png', 'jpg']
        })
      );

      // Create test files for each handler
      const testFiles = await Promise.all(
        handlers.map(async (_, i) => {
          const path = join(testDir, `handler-${i}.png`);
          await writeFile(path, testData);
          return path;
        })
      );

      // Process files concurrently with different handlers
      const results = await Promise.all(
        handlers.map((handler, i) => handler.processImageFile(testFiles[i]))
      );

      expect(results).toHaveLength(numHandlers);
      results.forEach((result, i) => {
        expect(result.imageBlock.type).toBe('image');
        expect(result.imageBlock.source.media_type).toBe('image/png');
        expect(result.fileSizeBytes).toBe(testData.length);
      });
    });

    it('should maintain isolation between handler configurations', async () => {
      const strictHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 100,
        supportedFormats: ['png']
      });

      const lenientHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 10000,
        supportedFormats: ['png', 'jpg', 'gif', 'webp']
      });

      // Verify configurations are independent
      expect(strictHandler.getConfig().maxFileSizeBytes).toBe(100);
      expect(lenientHandler.getConfig().maxFileSizeBytes).toBe(10000);

      expect(strictHandler.getConfig().supportedFormats).toEqual(['png']);
      expect(lenientHandler.getConfig().supportedFormats).toEqual(['png', 'jpg', 'gif', 'webp']);

      // Test with file that exceeds strict handler limit
      const testPath = join(testDir, 'isolation-test.png');
      const testData = Buffer.alloc(500, 0xFF); // 500 bytes
      await writeFile(testPath, testData);

      // Strict handler should reject
      await expect(strictHandler.processImageFile(testPath))
        .rejects
        .toThrow(/exceeds maximum allowed size/);

      // Lenient handler should accept
      const result = await lenientHandler.processImageFile(testPath);
      expect(result.fileSizeBytes).toBe(500);
    });
  });

  describe('error resilience tests', () => {
    it('should handle file system race conditions gracefully', async () => {
      const racePath = join(testDir, 'race-condition.png');
      await writeFile(racePath, Buffer.from('race-test'));

      const handler = new MultimodalInputHandler();

      // Start processing file
      const processPromise = handler.processImageFile(racePath);

      // Immediately try to process again (potential race condition)
      const processPromise2 = handler.processImageFile(racePath);

      // Both should succeed
      const [result1, result2] = await Promise.all([processPromise, processPromise2]);

      expect(result1.imageBlock.source.data).toBe(result2.imageBlock.source.data);
      expect(result1.fileSizeBytes).toBe(result2.fileSizeBytes);
    });

    it('should handle rapid configuration changes', async () => {
      let handler = new MultimodalInputHandler({ maxFileSizeBytes: 1000 });

      const testPath = join(testDir, 'config-change.png');
      await writeFile(testPath, Buffer.alloc(500, 0xFF));

      // Process with initial config
      const result1 = await handler.processImageFile(testPath);
      expect(result1.fileSizeBytes).toBe(500);

      // Create new handler with different config
      handler = new MultimodalInputHandler({ maxFileSizeBytes: 100 });

      // Should now reject the same file
      await expect(handler.processImageFile(testPath))
        .rejects
        .toThrow(/exceeds maximum allowed size/);

      // Create handler with original config again
      handler = new MultimodalInputHandler({ maxFileSizeBytes: 1000 });

      // Should accept again
      const result2 = await handler.processImageFile(testPath);
      expect(result2.fileSizeBytes).toBe(500);
    });
  });

  describe('resource cleanup verification', () => {
    it('should properly clean up after failed operations', async () => {
      const handler = new MultimodalInputHandler();
      const nonExistentPath = join(testDir, 'does-not-exist.png');

      // Multiple failed operations
      const failedOperations = Array.from({ length: 10 }, () =>
        handler.processImageFile(nonExistentPath).catch(() => 'failed')
      );

      const results = await Promise.all(failedOperations);

      // All should have failed
      results.forEach(result => {
        expect(result).toBe('failed');
      });

      // Handler should still work for valid operations
      const validPath = join(testDir, 'cleanup-test.png');
      await writeFile(validPath, Buffer.from('cleanup-test'));

      const validResult = await handler.processImageFile(validPath);
      expect(validResult.imageBlock.type).toBe('image');
    });

    it('should handle interruption gracefully', async () => {
      const handler = new MultimodalInputHandler();
      const testPath = join(testDir, 'interruption.png');
      await writeFile(testPath, Buffer.alloc(1000, 0xFF));

      // Start processing
      const processPromise = handler.processImageFile(testPath);

      // Let it start, then continue (simulating potential interruption points)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should complete successfully
      const result = await processPromise;
      expect(result.imageBlock.type).toBe('image');
      expect(result.fileSizeBytes).toBe(1000);
    });
  });
});