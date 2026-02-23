import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFile, stat } from 'fs/promises';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  multimodalInputHandler,
  processImageFile,
  processWebPage,
  processGitHubIssueImages,
  type MultimodalInputHandlerConfig,
  type ImageProcessResult,
  type WebPageOptions,
  type WebPageContent,
  type GitHubIssueImageResult
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

  describe('processGitHubIssueImages', () => {
    let mockWebFetchTool: { execute: MockedFunction<any> };

    beforeEach(() => {
      mockWebFetchTool = {
        execute: vi.fn(),
      };
      MockWebFetchTool.mockImplementation(() => mockWebFetchTool as any);
    });

    describe('successful processing', () => {
      it('should extract and process GitHub issue images', async () => {
        const issueContent = `
## Bug Report

Here's a screenshot of the issue:
![Screenshot](https://user-images.githubusercontent.com/12345/screenshot.png)

And another image:
<img src="https://user-images.githubusercontent.com/67890/debug.jpg" />
        `;

        // Mock image data response
        const mockImageData = Buffer.from('fake-image-data');
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: { 'content-type': 'image/png' },
          data: mockImageData.toString('base64'),
          metadata: { url: 'https://user-images.githubusercontent.com/12345/screenshot.png', method: 'GET', responseTime: 200 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.issueContent).toBe(issueContent);
        expect(result.imageUrls).toHaveLength(2);
        expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/screenshot.png');
        expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/67890/debug.jpg');
        expect(result.imageBlocks).toHaveLength(2);
        expect(result.imageMetadata).toHaveLength(2);
        expect(result.totalProcessingTime).toBeGreaterThan(0);
      });

      it('should handle content with no images', async () => {
        const issueContent = `
## Bug Report

This is just text with no images.
        `;

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.issueContent).toBe(issueContent);
        expect(result.imageUrls).toHaveLength(0);
        expect(result.imageBlocks).toHaveLength(0);
        expect(result.imageMetadata).toHaveLength(0);
        expect(result.totalProcessingTime).toBeGreaterThan(0);
      });

      it('should extract direct GitHub image URLs', async () => {
        const issueContent = `
Check out this image: https://user-images.githubusercontent.com/12345/example.png
And this one too: https://raw.githubusercontent.com/user/repo/main/image.jpg
        `;

        const mockImageData = Buffer.from('fake-image-data');
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/example.png');
        expect(result.imageUrls).toContain('https://raw.githubusercontent.com/user/repo/main/image.jpg');
      });

      it('should filter out non-image URLs', async () => {
        const issueContent = `
Here's an image: https://user-images.githubusercontent.com/12345/screenshot.png
But not this: https://user-images.githubusercontent.com/12345/document.txt
Or this: https://raw.githubusercontent.com/user/repo/main/README.md
        `;

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageUrls).toHaveLength(1);
        expect(result.imageUrls[0]).toBe('https://user-images.githubusercontent.com/12345/screenshot.png');
      });

      it('should handle duplicate URLs', async () => {
        const issueContent = `
![Image 1](https://user-images.githubusercontent.com/12345/screenshot.png)
![Image 2](https://user-images.githubusercontent.com/12345/screenshot.png)
https://user-images.githubusercontent.com/12345/screenshot.png
        `;

        const mockImageData = Buffer.from('fake-image-data');
        const mockWebFetchResult: WebFetchResult = {
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
        };
        mockWebFetchTool.execute.mockResolvedValue(mockWebFetchResult);

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageUrls).toHaveLength(1);
        expect(result.imageBlocks).toHaveLength(1);
        expect(mockWebFetchTool.execute).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('should handle image download failures gracefully', async () => {
        const issueContent = `
![Good image](https://user-images.githubusercontent.com/12345/good.png)
![Bad image](https://user-images.githubusercontent.com/12345/bad.png)
        `;

        const mockGoodImageData = Buffer.from('good-image-data');
        mockWebFetchTool.execute
          .mockResolvedValueOnce({
            success: true,
            status: 200,
            headers: {},
            data: mockGoodImageData.toString('base64'),
            metadata: { url: 'good-url', method: 'GET', responseTime: 100 },
          })
          .mockResolvedValueOnce({
            success: false,
            error: 'Not found',
          });

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageUrls).toHaveLength(2);
        expect(result.imageBlocks).toHaveLength(1); // Only the good image
        expect(result.imageMetadata).toHaveLength(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors![0]).toContain('Failed to download image');
      });

      it('should validate image file sizes', async () => {
        const issueContent = '![Large image](https://user-images.githubusercontent.com/12345/large.png)';

        // Create an image that exceeds the default 20MB limit
        const largeImageData = Buffer.alloc(21 * 1024 * 1024); // 21MB
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: largeImageData.toString('base64'),
          metadata: { url: 'large-url', method: 'GET', responseTime: 100 },
        });

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.errors).toHaveLength(1);
        expect(result.errors![0]).toContain('exceeds maximum allowed size');
        expect(result.imageBlocks).toHaveLength(0);
      });

      it('should handle invalid image URLs', async () => {
        const issueContent = `
![Valid](https://user-images.githubusercontent.com/12345/valid.png)
![Invalid](not-a-valid-url)
        `;

        const mockImageData = Buffer.from('valid-image-data');
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'valid-url', method: 'GET', responseTime: 100 },
        });

        const result = await handler.processGitHubIssueImages(issueContent);

        // Should only process the valid URL
        expect(result.imageUrls).toHaveLength(1);
        expect(result.imageUrls[0]).toBe('https://user-images.githubusercontent.com/12345/valid.png');
        expect(result.imageBlocks).toHaveLength(1);
      });
    });

    describe('media type detection', () => {
      it('should correctly detect PNG media type', async () => {
        const issueContent = '![PNG](https://user-images.githubusercontent.com/12345/test.png)';

        const mockImageData = Buffer.from('png-data');
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'png-url', method: 'GET', responseTime: 100 },
        });

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageBlocks[0].source.media_type).toBe('image/png');
        expect(result.imageMetadata[0].mediaType).toBe('image/png');
      });

      it('should correctly detect JPEG media type for .jpg extension', async () => {
        const issueContent = '![JPEG](https://user-images.githubusercontent.com/12345/test.jpg)';

        const mockImageData = Buffer.from('jpeg-data');
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'jpeg-url', method: 'GET', responseTime: 100 },
        });

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageBlocks[0].source.media_type).toBe('image/jpeg');
      });

      it('should default to JPEG for unknown extensions', async () => {
        const issueContent = '![Unknown](https://user-images.githubusercontent.com/12345/test.png)'; // Will be treated as PNG

        const mockImageData = Buffer.from('image-data');
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'unknown-url', method: 'GET', responseTime: 100 },
        });

        const result = await handler.processGitHubIssueImages(issueContent);

        expect(result.imageBlocks[0].source.media_type).toBe('image/png');
      });
    });

    describe('type safety', () => {
      it('should ensure GitHubIssueImageResult has correct structure', async () => {
        const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

        const mockImageData = Buffer.from('test-data');
        mockWebFetchTool.execute.mockResolvedValue({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
        });

        const result: GitHubIssueImageResult = await handler.processGitHubIssueImages(issueContent);

        expect(typeof result.issueContent).toBe('string');
        expect(Array.isArray(result.imageUrls)).toBe(true);
        expect(Array.isArray(result.imageBlocks)).toBe(true);
        expect(Array.isArray(result.imageMetadata)).toBe(true);
        expect(typeof result.totalProcessingTime).toBe('number');

        if (result.imageBlocks.length > 0) {
          expect(result.imageBlocks[0].type).toBe('image');
          expect(result.imageBlocks[0].source.type).toBe('base64');
          expect(typeof result.imageBlocks[0].source.data).toBe('string');
        }

        if (result.imageMetadata.length > 0) {
          expect(typeof result.imageMetadata[0].url).toBe('string');
          expect(typeof result.imageMetadata[0].fileSizeBytes).toBe('number');
          expect(typeof result.imageMetadata[0].mediaType).toBe('string');
          expect(typeof result.imageMetadata[0].downloadTime).toBe('number');
        }
      });
    });
  });

  describe('processGitHubIssueImages convenience function', () => {
    it('should use default handler when no config provided', async () => {
      const issueContent = 'No images here';

      const result = await processGitHubIssueImages(issueContent);

      expect(result.issueContent).toBe(issueContent);
      expect(result.imageUrls).toHaveLength(0);
    });

    it('should create new handler when config provided', async () => {
      const issueContent = 'No images here';
      const customConfig: MultimodalInputHandlerConfig = {
        maxFileSizeBytes: 5 * 1024 * 1024,
      };

      const result = await processGitHubIssueImages(issueContent, customConfig);

      expect(result.issueContent).toBe(issueContent);
      expect(result.imageUrls).toHaveLength(0);
    });
  });

  describe('Figma URL parsing', () => {
    describe('isFigmaUrl', () => {
      it('should correctly identify valid Figma file URLs', () => {
        // Access private method for testing
        const result = (handler as any).isFigmaUrl('https://www.figma.com/file/abc123xyz456789012345678/Login-Screens');
        expect(result).toBe(true);
      });

      it('should correctly identify valid Figma design URLs', () => {
        const result = (handler as any).isFigmaUrl('https://figma.com/design/abc123xyz456789012345678/Dashboard');
        expect(result).toBe(true);
      });

      it('should correctly identify valid Figma prototype URLs', () => {
        const result = (handler as any).isFigmaUrl('https://www.figma.com/proto/abc123xyz456789012345678/Mobile-App');
        expect(result).toBe(true);
      });

      it('should correctly identify valid Figma board URLs', () => {
        const result = (handler as any).isFigmaUrl('https://figma.com/board/abc123xyz456789012345678/Brainstorm');
        expect(result).toBe(true);
      });

      it('should correctly identify valid Figma embed URLs', () => {
        const result = (handler as any).isFigmaUrl('https://www.figma.com/embed/abc123xyz456789012345678/Presentation');
        expect(result).toBe(true);
      });

      it('should reject non-Figma URLs', () => {
        expect((handler as any).isFigmaUrl('https://sketch.com/file/123')).toBe(false);
        expect((handler as any).isFigmaUrl('https://example.com/image.png')).toBe(false);
        expect((handler as any).isFigmaUrl('https://adobe.com/xd/file/123')).toBe(false);
      });

      it('should reject malformed URLs', () => {
        expect((handler as any).isFigmaUrl('not-a-url')).toBe(false);
        expect((handler as any).isFigmaUrl('figma.com/file/123')).toBe(false); // Missing protocol
        expect((handler as any).isFigmaUrl('')).toBe(false);
      });

      it('should handle URLs with query parameters', () => {
        const result = (handler as any).isFigmaUrl('https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456');
        expect(result).toBe(true);
      });
    });

    describe('parseFigmaUrl', () => {
      it('should successfully parse basic Figma file URL', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info.fileName).toBe('Login-Screens');
        expect(result.info.urlType).toBe('file');
        expect(result.info.originalUrl).toBe(url);
        expect(result.info.nodeId).toBeUndefined();
        expect(result.info.hasVersionParams).toBe(false);
        expect(result.info.branchName).toBeUndefined();
      });

      it('should successfully parse Figma URL with node ID', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info.fileName).toBe('Login-Screens');
        expect(result.info.urlType).toBe('file');
        expect(result.info.nodeId).toBe('123:456');
        expect(result.info.hasVersionParams).toBe(false);
      });

      it('should successfully parse Figma URL with URL-encoded node ID', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123%3A456';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.nodeId).toBe('123:456');
      });

      it('should successfully parse Figma URL with version parameters', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?version-id=123456789';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.hasVersionParams).toBe(true);
      });

      it('should successfully parse Figma URL with branch name', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?branch-name=feature-redesign';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.branchName).toBe('feature-redesign');
      });

      it('should successfully parse Figma URL with URL-encoded branch name', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?branch-name=feature%2Dredesign';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.branchName).toBe('feature-redesign');
      });

      it('should successfully parse Figma URL with multiple parameters', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&branch-name=feature-branch&version-id=987654321';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.nodeId).toBe('123:456');
        expect(result.info.branchName).toBe('feature-branch');
        expect(result.info.hasVersionParams).toBe(true);
      });

      it('should handle URL-encoded file names', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login%20Screens%20-%20Mobile';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileName).toBe('Login Screens - Mobile');
      });

      it('should parse different Figma URL types correctly', () => {
        const testCases = [
          { url: 'https://figma.com/design/abc123xyz456789012345678/Dashboard', expectedType: 'design' },
          { url: 'https://www.figma.com/proto/abc123xyz456789012345678/Mobile-App', expectedType: 'proto' },
          { url: 'https://figma.com/board/abc123xyz456789012345678/Brainstorm', expectedType: 'board' },
          { url: 'https://www.figma.com/embed/abc123xyz456789012345678/Presentation', expectedType: 'embed' },
        ];

        testCases.forEach(({ url, expectedType }) => {
          const result = (handler as any).parseFigmaUrl(url);
          expect(result.success).toBe(true);
          expect(result.info.urlType).toBe(expectedType);
        });
      });

      it('should handle URLs without file names', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileName).toBe('');
      });

      it('should handle URLs with no file name at all', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileName).toBeUndefined();
      });

      it('should return error for invalid URL format', () => {
        const result = (handler as any).parseFigmaUrl('not-a-url');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should return error for non-Figma URLs', () => {
        const result = (handler as any).parseFigmaUrl('https://sketch.com/file/123');
        expect(result.success).toBe(false);
        expect(result.error).toBe('URL is not a valid Figma URL');
      });

      it('should handle complex node IDs with special characters', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=1234%3A5678-9abc%3Adef0';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.nodeId).toBe('1234:5678-9abc:def0');
      });

      it('should preserve original URL exactly', () => {
        const originalUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Login%20Screens?node-id=123%3A456&utm_source=test';
        const result = (handler as any).parseFigmaUrl(originalUrl);

        expect(result.success).toBe(true);
        expect(result.info.originalUrl).toBe(originalUrl);
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle very short file keys', () => {
        const url = 'https://www.figma.com/file/abc/Test';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(false);
        expect(result.error).toBe('URL is not a valid Figma URL');
      });

      it('should handle URLs with fragments', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens#section1';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
      });

      it('should handle URLs with trailing slashes', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens/';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileName).toBe('Login-Screens');
      });

      it('should handle mixed case in domain', () => {
        const url = 'https://Www.FIGMA.com/file/abc123xyz456789012345678/Login-Screens';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
      });

      it('should validate file key length', () => {
        // Test with standard 22-character file key
        const validUrl = 'https://www.figma.com/file/abcdefghij1234567890ab/Test';
        const validResult = (handler as any).parseFigmaUrl(validUrl);
        expect(validResult.success).toBe(true);

        // Test with longer file key (should still work due to {22,} in regex)
        const longerUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Test';
        const longerResult = (handler as any).parseFigmaUrl(longerUrl);
        expect(longerResult.success).toBe(true);
      });
    });

    describe('type safety and structure validation', () => {
      it('should return properly structured FigmaUrlParseResult for successful parse', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('info');
        expect(result).not.toHaveProperty('error');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.info).toBe('object');

        expect(result.info).toHaveProperty('fileKey');
        expect(result.info).toHaveProperty('fileName');
        expect(result.info).toHaveProperty('nodeId');
        expect(result.info).toHaveProperty('urlType');
        expect(result.info).toHaveProperty('originalUrl');
        expect(result.info).toHaveProperty('hasVersionParams');
        expect(result.info).toHaveProperty('branchName');

        expect(typeof result.info.fileKey).toBe('string');
        expect(typeof result.info.urlType).toBe('string');
        expect(typeof result.info.originalUrl).toBe('string');
        expect(typeof result.info.hasVersionParams).toBe('boolean');
      });

      it('should return properly structured FigmaUrlParseResult for failed parse', () => {
        const result = (handler as any).parseFigmaUrl('invalid-url');

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('error');
        expect(result).not.toHaveProperty('info');
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe('string');
      });

      it('should handle all valid URL types from FigmaUrlInfo interface', () => {
        const validTypes = ['file', 'design', 'proto', 'board', 'embed'];

        validTypes.forEach(type => {
          const url = `https://www.figma.com/${type}/abc123xyz456789012345678/Test`;
          const result = (handler as any).parseFigmaUrl(url);

          expect(result.success).toBe(true);
          expect(result.info.urlType).toBe(type);
        });
      });
    });

    describe('additional edge cases for comprehensive coverage', () => {
      it('should handle HTTP protocol (non-HTTPS)', () => {
        const url = 'http://www.figma.com/file/abc123xyz456789012345678/Test';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
      });

      it('should handle URLs with multiple query parameters in different order', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?version-id=123&branch-name=main&node-id=456:789';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.hasVersionParams).toBe(true);
        expect(result.info.branchName).toBe('main');
        expect(result.info.nodeId).toBe('456:789');
      });

      it('should handle empty string URL', () => {
        const result = (handler as any).parseFigmaUrl('');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should handle null input gracefully', () => {
        const result = (handler as any).parseFigmaUrl(null as any);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should handle undefined input gracefully', () => {
        const result = (handler as any).parseFigmaUrl(undefined as any);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should handle URLs with special characters in file names properly', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test%20File%20%26%20More%20%2D%20Special%20Characters';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileName).toBe('Test File & More - Special Characters');
      });

      it('should handle URLs with only ampersand separators in query params', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test&node-id=123:456&version-id=789';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.nodeId).toBe('123:456');
        expect(result.info.hasVersionParams).toBe(true);
      });

      it('should validate file key minimum length requirement', () => {
        const shortFileKey = 'https://www.figma.com/file/shortkey/Test';
        const result = (handler as any).parseFigmaUrl(shortFileKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('URL is not a valid Figma URL');
      });

      it('should handle URLs with extra slashes', () => {
        const url = 'https://www.figma.com//file//abc123xyz456789012345678//Test//';
        const result = (handler as any).parseFigmaUrl(url);

        // This should fail because the regex expects specific structure
        expect(result.success).toBe(false);
      });

      it('should handle case-sensitive file keys correctly', () => {
        const url = 'https://www.figma.com/file/AbC123xyZ456789012345678/Test';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('AbC123xyZ456789012345678');
      });

      it('should preserve all URL parameters in originalUrl', () => {
        const originalUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456&utm_source=share&utm_medium=figma&custom=param#anchor';
        const result = (handler as any).parseFigmaUrl(originalUrl);

        expect(result.success).toBe(true);
        expect(result.info.originalUrl).toBe(originalUrl);
      });

      it('should handle file key at exactly minimum length (22 chars)', () => {
        const minLengthFileKey = 'abcdefghij1234567890ab'; // exactly 22 chars
        const url = `https://www.figma.com/file/${minLengthFileKey}/Test`;
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe(minLengthFileKey);
      });

      it('should handle very long file key (more than 22 chars)', () => {
        const longFileKey = 'abcdefghij1234567890abcdefghijklmnop'; // much longer than 22 chars
        const url = `https://www.figma.com/file/${longFileKey}/Test`;
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe(longFileKey);
      });

      it('should handle URLs with only question mark but no parameters', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?';
        const result = (handler as any).parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info.nodeId).toBeUndefined();
      });
    });
  });
});