import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFile, stat } from 'fs/promises';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  multimodalInputHandler,
  processImageFile,
  processWebPage,
  type MultimodalInputHandlerConfig,
  type ImageProcessResult,
  type WebPageOptions,
  type WebPageContent
} from './multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from './webfetch';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock WebFetchTool
vi.mock('./webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const mockReadFile = readFile as MockedFunction<typeof readFile>;
const mockStat = stat as MockedFunction<typeof stat>;
const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

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

  describe('processWebPage', () => {
    let mockWebFetchTool: { execute: MockedFunction<any> };

    beforeEach(() => {
      mockWebFetchTool = {
        execute: vi.fn(),
      };
      MockWebFetchTool.mockImplementation(() => mockWebFetchTool as any);
    });

    describe('successful processing', () => {
      it('should process URL and return WebPageContent', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          data: '# Example Page\n\nThis is a test page.',
          fromCache: false,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 150,
            contentLength: 1024,
            contentType: 'text/html',
          },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processWebPage('https://example.com');

        expect(result.url).toBe('https://example.com');
        expect(result.statusCode).toBe(200);
        expect(result.markdown).toBe('# Example Page\n\nThis is a test page.');
        expect(result.title).toBe('Example Page');
        expect(result.fromCache).toBe(false);
        expect(result.metadata.responseTime).toBe(150);
      });

      it('should extract title from HTML content', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: '<title>HTML Title Test</title><h1>Content</h1>',
          metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processWebPage('https://example.com', { convertToMarkdown: false });

        expect(result.title).toBe('HTML Title Test');
        expect(result.html).toBe('<title>HTML Title Test</title><h1>Content</h1>');
        expect(result.markdown).toBeUndefined();
      });

      it('should handle AI analysis when prompt is provided', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: '# Test Page\n\nContent for analysis.',
          metadata: { url: 'https://example.com', method: 'GET', responseTime: 200 },
          analysis: {
            content: 'This page contains test content.',
            model: 'claude-3-5-haiku-latest',
            usage: { inputTokens: 50, outputTokens: 25 },
            truncated: false,
            originalContentLength: 100,
            analyzedContentLength: 100,
          },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processWebPage('https://example.com', {
          prompt: 'Analyze this content'
        });

        expect(result.analysis).toBeDefined();
        expect(result.analysis!.content).toBe('This page contains test content.');
        expect(result.analysis!.model).toBe('claude-3-5-haiku-latest');
        expect(result.analysis!.usage.inputTokens).toBe(50);
        expect(result.analysis!.usage.outputTokens).toBe(25);
      });

      it('should handle cache results correctly', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: 'Cached content',
          fromCache: true,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 0,
            cacheKey: 'test-cache-key',
          },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processWebPage('https://example.com');

        expect(result.fromCache).toBe(true);
        expect(result.metadata.responseTime).toBe(0);
        expect(result.metadata.cacheKey).toBe('test-cache-key');
      });

      it('should pass through custom options to WebFetch', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: 'Content',
          metadata: { url: 'https://example.com', method: 'POST', responseTime: 100 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const options: WebPageOptions = {
          method: 'POST',
          headers: { 'Authorization': 'Bearer token' },
          body: '{"test": "data"}',
          timeout: 15000,
          bypassCache: true,
          prompt: 'Extract key info',
        };

        await handler.processWebPage('https://api.example.com', options);

        expect(mockWebFetchTool.execute).toHaveBeenCalledWith({
          url: 'https://api.example.com',
          method: 'POST',
          headers: { 'Authorization': 'Bearer token' },
          body: '{"test": "data"}',
          timeout: 15000,
          convertToMarkdown: true,
          bypassCache: true,
          cacheTtl: undefined,
          prompt: 'Extract key info',
          maxAnalysisContent: undefined,
        });
      });
    });

    describe('error handling', () => {
      it('should throw INVALID_URL error for malformed URLs', async () => {
        await expect(handler.processWebPage('not-a-url')).rejects.toThrow(MultimodalInputError);
        await expect(handler.processWebPage('not-a-url')).rejects.toMatchObject({
          code: 'INVALID_URL',
        });
      });

      it('should throw FETCH_ERROR when web fetch fails', async () => {
        mockWebFetchTool.execute.mockResolvedValue({
          success: false,
          error: 'Network timeout',
        });

        await expect(handler.processWebPage('https://example.com')).rejects.toThrow(MultimodalInputError);
        await expect(handler.processWebPage('https://example.com')).rejects.toMatchObject({
          code: 'FETCH_ERROR',
        });
      });

      it('should throw HTTP_ERROR for non-2xx status codes', async () => {
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 404,
          error: 'Not Found',
          metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
        });

        await expect(handler.processWebPage('https://example.com')).rejects.toThrow(MultimodalInputError);
        await expect(handler.processWebPage('https://example.com')).rejects.toMatchObject({
          code: 'HTTP_ERROR',
        });
      });

      it('should throw WEB_PAGE_PROCESSING_ERROR for unexpected errors', async () => {
        mockWebFetchTool.execute.mockRejectedValue(new Error('Unexpected error'));

        await expect(handler.processWebPage('https://example.com')).rejects.toThrow(MultimodalInputError);
        await expect(handler.processWebPage('https://example.com')).rejects.toMatchObject({
          code: 'WEB_PAGE_PROCESSING_ERROR',
        });
      });

      it('should handle analysis errors gracefully', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: 'Content',
          metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
          analysisError: 'AI analysis failed due to rate limiting',
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processWebPage('https://example.com', {
          prompt: 'Analyze this'
        });

        expect(result.analysisError).toBe('AI analysis failed due to rate limiting');
        expect(result.analysis).toBeUndefined();
      });
    });

    describe('type safety', () => {
      it('should ensure WebPageContent has correct structure', async () => {
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: '# Test Page',
          metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result: WebPageContent = await handler.processWebPage('https://example.com');

        // Verify the structure matches expected types
        expect(typeof result.url).toBe('string');
        expect(typeof result.statusCode).toBe('number');
        expect(typeof result.headers).toBe('object');
        expect(typeof result.fromCache).toBe('boolean');
        expect(typeof result.metadata).toBe('object');
        expect(typeof result.metadata.responseTime).toBe('number');
      });
    });
  });

  describe('processWebPage convenience function', () => {
    it('should use default handler when no config provided', async () => {
      const mockWebFetchResult: WebFetchResult = {
        success: true,
        status: 200,
        headers: {},
        data: 'Content',
        metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
      };

      // Mock the default handler's webFetchTool
      const mockExecute = vi.fn().mockResolvedValue(mockWebFetchResult);
      MockWebFetchTool.mockImplementation(() => ({ execute: mockExecute }) as any);

      const result = await processWebPage('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should create new handler when config provided', async () => {
      const mockWebFetchResult: WebFetchResult = {
        success: true,
        status: 200,
        headers: {},
        data: 'Content',
        metadata: { url: 'https://example.com', method: 'GET', responseTime: 100 },
      };

      const mockExecute = vi.fn().mockResolvedValue(mockWebFetchResult);
      MockWebFetchTool.mockImplementation(() => ({ execute: mockExecute }) as any);

      const customConfig: MultimodalInputHandlerConfig = {
        maxFileSizeBytes: 5 * 1024 * 1024,
      };

      const result = await processWebPage('https://example.com', undefined, customConfig);

      expect(result.url).toBe('https://example.com');
      expect(mockExecute).toHaveBeenCalled();
    });
  });
});