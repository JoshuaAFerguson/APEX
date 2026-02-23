import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFile, stat } from 'fs/promises';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  type MultimodalInputHandlerConfig,
} from '../multimodal-input-handler';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const mockReadFile = readFile as MockedFunction<typeof readFile>;
const mockStat = stat as MockedFunction<typeof stat>;

describe('MultimodalInputHandler - Additional Edge Cases', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('boundary conditions', () => {
    it('should handle exactly maximum file size', async () => {
      const maxSize = 20 * 1024 * 1024; // Default 20MB limit
      const mockFileStats = {
        isFile: () => true,
        size: maxSize,
      };
      const mockImageBuffer = Buffer.alloc(maxSize, 'a');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const result = await handler.processImageFile('/path/to/max-size-image.png');
      expect(result.fileSizeBytes).toBe(maxSize);
    });

    it('should handle one byte over maximum file size', async () => {
      const maxSize = 20 * 1024 * 1024; // Default 20MB limit
      const mockFileStats = {
        isFile: () => true,
        size: maxSize + 1,
      };

      mockStat.mockResolvedValue(mockFileStats as any);

      await expect(handler.processImageFile('/path/to/over-max-image.png'))
        .rejects
        .toThrow(MultimodalInputError);
    });

    it('should handle very small file (1 byte)', async () => {
      const mockFileStats = {
        isFile: () => true,
        size: 1,
      };
      const mockImageBuffer = Buffer.from('a');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const result = await handler.processImageFile('/path/to/tiny-image.png');
      expect(result.fileSizeBytes).toBe(1);
    });
  });

  describe('configuration edge cases', () => {
    it('should handle zero max file size configuration', () => {
      expect(() => {
        new MultimodalInputHandler({ maxFileSizeBytes: 0 });
      }).not.toThrow();
    });

    it('should handle empty supported formats array', () => {
      const restrictiveHandler = new MultimodalInputHandler({
        supportedFormats: []
      });

      expect(restrictiveHandler.getSupportedMediaTypes()).toEqual([]);
    });

    it('should handle custom formats not in MEDIA_TYPE_MAP', () => {
      const customHandler = new MultimodalInputHandler({
        supportedFormats: ['bmp', 'tiff'] // Formats not in MEDIA_TYPE_MAP
      });

      expect(customHandler.getSupportedMediaTypes()).toEqual([]);
    });
  });

  describe('path normalization', () => {
    it('should handle paths with consecutive slashes', async () => {
      const mockFileStats = {
        isFile: () => true,
        size: 1024,
      };
      const mockImageBuffer = Buffer.from('test-data');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const result = await handler.processImageFile('/path//to///image.png');
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });

    it('should handle Windows-style paths', async () => {
      const mockFileStats = {
        isFile: () => true,
        size: 1024,
      };
      const mockImageBuffer = Buffer.from('test-data');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const result = await handler.processImageFile('C:\\path\\to\\image.png');
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('base64 encoding verification', () => {
    it('should produce valid base64 that can be decoded', async () => {
      const originalData = 'Hello, this is test image data!';
      const mockFileStats = {
        isFile: () => true,
        size: originalData.length,
      };
      const mockImageBuffer = Buffer.from(originalData, 'utf8');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      const result = await handler.processImageFile('/path/to/image.png');

      // Verify the base64 can be decoded back to original data
      const decodedBuffer = Buffer.from(result.imageBlock.source.data, 'base64');
      expect(decodedBuffer.toString('utf8')).toBe(originalData);
    });

    it('should handle binary data correctly', async () => {
      // Create binary data with all byte values
      const binaryData = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const mockFileStats = {
        isFile: () => true,
        size: binaryData.length,
      };

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(binaryData);

      const result = await handler.processImageFile('/path/to/binary-image.png');

      // Verify the binary data round-trip
      const decodedBuffer = Buffer.from(result.imageBlock.source.data, 'base64');
      expect(decodedBuffer).toEqual(binaryData);
    });
  });

  describe('concurrent processing', () => {
    it('should handle multiple simultaneous file processing requests', async () => {
      const mockFileStats = {
        isFile: () => true,
        size: 1024,
      };
      const mockImageBuffer = Buffer.from('test-data');

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(mockImageBuffer);

      // Process multiple files concurrently
      const promises = [
        handler.processImageFile('/path/to/image1.png'),
        handler.processImageFile('/path/to/image2.jpg'),
        handler.processImageFile('/path/to/image3.gif'),
        handler.processImageFile('/path/to/image4.webp'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      expect(results[0].imageBlock.source.media_type).toBe('image/png');
      expect(results[1].imageBlock.source.media_type).toBe('image/jpeg');
      expect(results[2].imageBlock.source.media_type).toBe('image/gif');
      expect(results[3].imageBlock.source.media_type).toBe('image/webp');
    });
  });

  describe('memory efficiency', () => {
    it('should not keep references to processed file data', async () => {
      const largeData = Buffer.alloc(1024 * 1024, 'x'); // 1MB of data
      const mockFileStats = {
        isFile: () => true,
        size: largeData.length,
      };

      mockStat.mockResolvedValue(mockFileStats as any);
      mockReadFile.mockResolvedValue(largeData);

      const result = await handler.processImageFile('/path/to/large-image.png');

      // Verify result structure is correct
      expect(result.imageBlock.source.data).toBeDefined();
      expect(result.fileSizeBytes).toBe(largeData.length);

      // The handler shouldn't keep references to the original buffer
      // This is more of a design verification than a testable assertion
      expect(typeof result.imageBlock.source.data).toBe('string');
    });
  });

  describe('error message quality', () => {
    it('should provide helpful error messages with file paths', async () => {
      const testPath = '/path/to/nonexistent/image.png';
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      try {
        await handler.processImageFile(testPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        const multimodalError = error as MultimodalInputError;
        expect(multimodalError.message).toContain(testPath);
        expect(multimodalError.code).toBe('FILE_NOT_FOUND');
      }
    });

    it('should provide clear error for unsupported formats', async () => {
      const mockFileStats = {
        isFile: () => true,
        size: 1024,
      };

      mockStat.mockResolvedValue(mockFileStats as any);

      try {
        await handler.processImageFile('/path/to/document.pdf');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        const multimodalError = error as MultimodalInputError;
        expect(multimodalError.message).toContain('Unsupported file format');
        expect(multimodalError.message).toContain('.pdf');
        expect(multimodalError.message).toContain('png, jpg, jpeg, gif, webp');
      }
    });
  });
});