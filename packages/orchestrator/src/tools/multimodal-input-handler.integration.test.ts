import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MultimodalInputHandler, processImageFile } from './multimodal-input-handler';

describe('MultimodalInputHandler Integration Tests', () => {
  const testDir = '/tmp/multimodal-test';
  const testImagePath = join(testDir, 'test-image.png');

  // Simple 1x1 PNG image in base64 (transparent pixel)
  const simplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==';
  const simplePngBuffer = Buffer.from(simplePngBase64, 'base64');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(testImagePath, simplePngBuffer);
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('real file processing', () => {
    it('should process a real PNG file correctly', async () => {
      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(testImagePath);

      expect(result).toMatchObject({
        imageBlock: {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: expect.any(String),
          },
        },
        fileSizeBytes: expect.any(Number),
        mediaType: 'image/png',
      });

      // Verify the base64 data is correct
      expect(result.imageBlock.source.data).toBe(simplePngBase64);
      expect(result.fileSizeBytes).toBe(simplePngBuffer.length);
    });

    it('should work with convenience function', async () => {
      const result = await processImageFile(testImagePath);

      expect(result.imageBlock.type).toBe('image');
      expect(result.imageBlock.source.media_type).toBe('image/png');
      expect(result.imageBlock.source.data).toBe(simplePngBase64);
    });

    it('should work with custom configuration', async () => {
      const result = await processImageFile(testImagePath, {
        maxFileSizeBytes: 1024,
        supportedFormats: ['png'],
      });

      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('file size limits with real files', () => {
    it('should reject file that exceeds custom size limit', async () => {
      const smallHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 50, // Very small limit
      });

      await expect(smallHandler.processImageFile(testImagePath))
        .rejects
        .toThrow('exceeds maximum allowed size');
    });
  });

  describe('format validation with real files', () => {
    let jpegPath: string;

    beforeEach(async () => {
      jpegPath = join(testDir, 'test-image.jpg');
      // Create a minimal JPEG file (this is a valid 1x1 JPEG)
      const jpegBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A8A', 'base64');
      await writeFile(jpegPath, jpegBuffer);
    });

    it('should process JPEG files correctly', async () => {
      const handler = new MultimodalInputHandler();
      const result = await handler.processImageFile(jpegPath);

      expect(result.imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should respect custom format restrictions', async () => {
      const restrictiveHandler = new MultimodalInputHandler({
        supportedFormats: ['png'], // Only PNG allowed
      });

      await expect(restrictiveHandler.processImageFile(jpegPath))
        .rejects
        .toThrow('FORMAT_NOT_CONFIGURED');
    });
  });

  describe('helper methods with real context', () => {
    let handler: MultimodalInputHandler;

    beforeEach(() => {
      handler = new MultimodalInputHandler();
    });

    it('should correctly identify supported formats', () => {
      expect(handler.isSupportedFormat(testImagePath)).toBe(true);
      expect(handler.isSupportedFormat('/path/to/file.txt')).toBe(false);
    });

    it('should return correct supported media types', () => {
      const mediaTypes = handler.getSupportedMediaTypes();
      expect(mediaTypes).toContain('image/png');
      expect(mediaTypes).toContain('image/jpeg');
      expect(mediaTypes).toContain('image/gif');
      expect(mediaTypes).toContain('image/webp');
    });
  });

  describe('claude sdk compatibility', () => {
    it('should produce output compatible with Claude SDK', async () => {
      const result = await processImageFile(testImagePath);

      // Verify structure matches what Claude SDK expects
      const imageBlock = result.imageBlock;

      // Type check - these should not throw TypeScript errors
      expect(imageBlock.type).toBe('image');
      expect(imageBlock.source.type).toBe('base64');
      expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
        .toContain(imageBlock.source.media_type);
      expect(typeof imageBlock.source.data).toBe('string');

      // Verify the base64 data is valid
      expect(() => Buffer.from(imageBlock.source.data, 'base64')).not.toThrow();

      // Verify the structure can be JSON serialized (important for API calls)
      expect(() => JSON.stringify(imageBlock)).not.toThrow();

      const serialized = JSON.stringify(imageBlock);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(imageBlock);
    });
  });
});

/**
 * Integration test to verify the handler integrates properly with the orchestrator package exports
 */
describe('Package Integration', () => {
  it('should be available through package exports', async () => {
    // This import tests that our exports are working correctly
    const {
      MultimodalInputHandler,
      multimodalInputHandler,
      processImageFile,
      MultimodalInputError
    } = await import('./index');

    expect(MultimodalInputHandler).toBeDefined();
    expect(multimodalInputHandler).toBeInstanceOf(MultimodalInputHandler);
    expect(typeof processImageFile).toBe('function');
    expect(MultimodalInputError).toBeDefined();
  });
});