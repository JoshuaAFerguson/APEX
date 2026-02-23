import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFile, stat } from 'fs/promises';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  multimodalInputHandler,
  processImageFile,
  type MultimodalInputHandlerConfig,
  type ImageProcessResult
} from './multimodal-input-handler';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const mockReadFile = readFile as MockedFunction<typeof readFile>;
const mockStat = stat as MockedFunction<typeof stat>;

describe('MultimodalInputHandler', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration when no config provided', () => {
      const config = handler.getConfig();
      expect(config.maxFileSizeBytes).toBe(20 * 1024 * 1024);
      expect(config.supportedFormats).toEqual(['png', 'jpg', 'jpeg', 'gif', 'webp']);
    });

    it('should merge custom config with defaults', () => {
      const customHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 10 * 1024 * 1024,
        supportedFormats: ['png', 'jpg'],
      });
      const config = customHandler.getConfig();
      expect(config.maxFileSizeBytes).toBe(10 * 1024 * 1024);
      expect(config.supportedFormats).toEqual(['png', 'jpg']);
    });
  });

  describe('processImageFile', () => {
    const mockFileStats = {
      isFile: () => true,
      size: 1024,
    };

    const mockImageBuffer = Buffer.from('fake-image-data');
    const expectedBase64 = mockImageBuffer.toString('base64');

    beforeEach(() => {
      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);
    });

    it('should process PNG file successfully', async () => {
      const result = await handler.processImageFile('/path/to/image.png');

      expect(result).toEqual({
        imageBlock: {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: expectedBase64,
          },
        },
        fileSizeBytes: 1024,
        mediaType: 'image/png',
      });
    });

    it('should process JPEG file successfully', async () => {
      const result = await handler.processImageFile('/path/to/image.jpg');

      expect(result.imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should process JPEG file with .jpeg extension', async () => {
      const result = await handler.processImageFile('/path/to/image.jpeg');

      expect(result.imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should process GIF file successfully', async () => {
      const result = await handler.processImageFile('/path/to/image.gif');

      expect(result.imageBlock.source.media_type).toBe('image/gif');
    });

    it('should process WebP file successfully', async () => {
      const result = await handler.processImageFile('/path/to/image.webp');

      expect(result.imageBlock.source.media_type).toBe('image/webp');
    });

    it('should handle uppercase extensions', async () => {
      const result = await handler.processImageFile('/path/to/image.PNG');

      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('file validation errors', () => {
    it('should throw error when file does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(handler.processImageFile('/nonexistent/file.png'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/nonexistent/file.png');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        expect((error as MultimodalInputError).code).toBe('FILE_NOT_FOUND');
      }
    });

    it('should throw error when path is not a file', async () => {
      mockStat.mockResolvedValue({
        isFile: () => false,
        size: 0,
      } as any);

      await expect(handler.processImageFile('/path/to/directory'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/path/to/directory');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('NOT_A_FILE');
      }
    });

    it('should throw error for unsupported file format', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      await expect(handler.processImageFile('/path/to/file.txt'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/path/to/file.txt');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('UNSUPPORTED_FORMAT');
      }
    });

    it('should throw error for empty file', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 0,
      } as any);

      await expect(handler.processImageFile('/path/to/empty.png'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/path/to/empty.png');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('EMPTY_FILE');
      }
    });

    it('should throw error for file too large', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 21 * 1024 * 1024, // 21MB, exceeds default 20MB limit
      } as any);

      await expect(handler.processImageFile('/path/to/large.png'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/path/to/large.png');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('FILE_TOO_LARGE');
      }
    });

    it('should throw error when readFile fails', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      await expect(handler.processImageFile('/path/to/image.png'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await handler.processImageFile('/path/to/image.png');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('BASE64_CONVERSION_ERROR');
      }
    });
  });

  describe('custom configuration', () => {
    it('should respect custom file size limit', async () => {
      const smallHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 500
      });

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024, // Exceeds custom 500 byte limit
      } as any);

      await expect(smallHandler.processImageFile('/path/to/image.png'))
        .rejects
        .toThrow(MultimodalInputError);
    });

    it('should respect custom supported formats', async () => {
      const restrictiveHandler = new MultimodalInputHandler({
        supportedFormats: ['png'] // Only PNG allowed
      });

      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      await expect(restrictiveHandler.processImageFile('/path/to/image.jpg'))
        .rejects
        .toThrow(MultimodalInputError);

      try {
        await restrictiveHandler.processImageFile('/path/to/image.jpg');
      } catch (error) {
        expect((error as MultimodalInputError).code).toBe('FORMAT_NOT_CONFIGURED');
      }
    });
  });

  describe('helper methods', () => {
    describe('isSupportedFormat', () => {
      it('should return true for supported formats', () => {
        expect(handler.isSupportedFormat('/path/to/image.png')).toBe(true);
        expect(handler.isSupportedFormat('/path/to/image.jpg')).toBe(true);
        expect(handler.isSupportedFormat('/path/to/image.jpeg')).toBe(true);
        expect(handler.isSupportedFormat('/path/to/image.gif')).toBe(true);
        expect(handler.isSupportedFormat('/path/to/image.webp')).toBe(true);
      });

      it('should return false for unsupported formats', () => {
        expect(handler.isSupportedFormat('/path/to/file.txt')).toBe(false);
        expect(handler.isSupportedFormat('/path/to/file.pdf')).toBe(false);
        expect(handler.isSupportedFormat('/path/to/file.doc')).toBe(false);
      });

      it('should handle uppercase extensions', () => {
        expect(handler.isSupportedFormat('/path/to/image.PNG')).toBe(true);
        expect(handler.isSupportedFormat('/path/to/image.JPG')).toBe(true);
      });
    });

    describe('getSupportedMediaTypes', () => {
      it('should return all supported media types', () => {
        const mediaTypes = handler.getSupportedMediaTypes();
        expect(mediaTypes).toEqual([
          'image/png',
          'image/jpeg',
          'image/jpeg',
          'image/gif',
          'image/webp'
        ]);
      });

      it('should return media types for custom configuration', () => {
        const restrictiveHandler = new MultimodalInputHandler({
          supportedFormats: ['png', 'jpg']
        });
        const mediaTypes = restrictiveHandler.getSupportedMediaTypes();
        expect(mediaTypes).toEqual([
          'image/png',
          'image/jpeg'
        ]);
      });
    });

    describe('getConfig', () => {
      it('should return current configuration', () => {
        const config = handler.getConfig();
        expect(config.maxFileSizeBytes).toBe(20 * 1024 * 1024);
        expect(config.supportedFormats).toEqual(['png', 'jpg', 'jpeg', 'gif', 'webp']);
      });

      it('should return copy of config to prevent mutation', () => {
        const config = handler.getConfig();
        config.maxFileSizeBytes = 999;

        const freshConfig = handler.getConfig();
        expect(freshConfig.maxFileSizeBytes).toBe(20 * 1024 * 1024);
      });
    });
  });

  describe('error handling', () => {
    it('should wrap unknown errors as processing errors', async () => {
      mockStat.mockImplementation(() => {
        throw 'Unknown error type';
      });

      try {
        await handler.processImageFile('/path/to/image.png');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        expect((error as MultimodalInputError).code).toBe('PROCESSING_ERROR');
        expect((error as MultimodalInputError).message).toContain('Failed to process image file');
      }
    });
  });

  describe('default instance and convenience function', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockReadFile.mockResolvedValue(Buffer.from('test-data'));
    });

    it('should provide default instance', () => {
      expect(multimodalInputHandler).toBeInstanceOf(MultimodalInputHandler);
    });

    it('should provide convenience function using default config', async () => {
      const result = await processImageFile('/path/to/image.png');

      expect(result).toBeDefined();
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });

    it('should provide convenience function with custom config', async () => {
      const customConfig: MultimodalInputHandlerConfig = {
        maxFileSizeBytes: 1000,
        supportedFormats: ['png']
      };

      const result = await processImageFile('/path/to/image.png', customConfig);

      expect(result).toBeDefined();
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('edge cases', () => {
    it('should handle files with no extension', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      await expect(handler.processImageFile('/path/to/imagefile'))
        .rejects
        .toThrow(MultimodalInputError);
    });

    it('should handle files with multiple dots in name', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const result = await handler.processImageFile('/path/to/my.image.file.png');

      expect(result.imageBlock.source.media_type).toBe('image/png');
    });

    it('should handle paths with special characters', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const result = await handler.processImageFile('/path/to/my-image (1).png');

      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('type safety', () => {
    it('should ensure ImageProcessResult has correct structure', async () => {
      mockStat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockReadFile.mockResolvedValue(Buffer.from('test'));

      const result: ImageProcessResult = await handler.processImageFile('/path/to/image.png');

      // Verify the structure matches expected types
      expect(result.imageBlock.type).toBe('image');
      expect(result.imageBlock.source.type).toBe('base64');
      expect(typeof result.imageBlock.source.data).toBe('string');
      expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
        .toContain(result.imageBlock.source.media_type);
      expect(typeof result.fileSizeBytes).toBe('number');
      expect(typeof result.mediaType).toBe('string');
    });
  });
});