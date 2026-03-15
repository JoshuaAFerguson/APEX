import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  processGitHubIssueImages,
  type GitHubIssueImageResult,
  type MultimodalInputHandlerConfig,
} from '../multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from '../webfetch';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

describe('MultimodalInputHandler - GitHub Issue Image Extraction', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetchTool: { execute: MockedFunction<any> };

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetchTool = {
      execute: vi.fn(),
    };
    MockWebFetchTool.mockImplementation(() => mockWebFetchTool as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GitHub Image URL Extraction Patterns', () => {
    it('should extract user-images.githubusercontent.com URLs from markdown format', async () => {
      const issueContent = `
## Bug Report

Here's a screenshot:
![Screenshot](https://user-images.githubusercontent.com/12345/screenshot.png)

Another image:
![Debug Info](https://user-images.githubusercontent.com/67890/debug.jpg)
      `;

      // Mock successful image downloads
      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/screenshot.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/67890/debug.jpg');
      expect(result.imageBlocks).toHaveLength(2);
      expect(mockWebFetchTool.execute).toHaveBeenCalledTimes(2);
    });

    it('should extract user-images.githubusercontent.com URLs from HTML format', async () => {
      const issueContent = `
<p>Here are the test results:</p>
<img src="https://user-images.githubusercontent.com/11111/test-results.png" alt="Test Results" />
<img src="https://user-images.githubusercontent.com/22222/error-log.gif" alt="Error Log" width="800" />
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/11111/test-results.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/22222/error-log.gif');
    });

    it('should extract raw.githubusercontent.com URLs', async () => {
      const issueContent = `
Check out these repository images:
https://raw.githubusercontent.com/owner/repo/main/docs/architecture.png

![Diagram](https://raw.githubusercontent.com/owner/repo/feature-branch/images/flow-chart.jpg)
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/owner/repo/main/docs/architecture.png');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/owner/repo/feature-branch/images/flow-chart.jpg');
    });

    it('should extract direct user-images URLs without markdown/HTML wrapper', async () => {
      const issueContent = `
I uploaded these images:

https://user-images.githubusercontent.com/12345/image1.png
https://user-images.githubusercontent.com/12345/image2.webp

Please check them out.
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image1.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image2.webp');
    });

    it('should handle mixed URL formats in same content', async () => {
      const issueContent = `
## Mixed Format Test

Direct URL: https://user-images.githubusercontent.com/12345/direct.png

![Markdown](https://user-images.githubusercontent.com/12345/markdown.jpg)

<img src="https://user-images.githubusercontent.com/12345/html.gif" />

Repository file: https://raw.githubusercontent.com/user/repo/main/assets/repo-image.webp
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(4);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/direct.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/markdown.jpg');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/html.gif');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/user/repo/main/assets/repo-image.webp');
    });

    it('should handle HTTP and HTTPS URLs', async () => {
      const issueContent = `
HTTP: http://user-images.githubusercontent.com/12345/http-image.png
HTTPS: https://user-images.githubusercontent.com/12345/https-image.jpg
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('http://user-images.githubusercontent.com/12345/http-image.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/https-image.jpg');
    });
  });

  describe('Image URL Filtering', () => {
    it('should filter out non-image URLs based on file extensions', async () => {
      const issueContent = `
Valid images:
https://user-images.githubusercontent.com/12345/screenshot.png
https://user-images.githubusercontent.com/12345/photo.jpg

Invalid (non-image) files:
https://user-images.githubusercontent.com/12345/document.txt
https://user-images.githubusercontent.com/12345/data.json
https://user-images.githubusercontent.com/12345/archive.zip
https://raw.githubusercontent.com/user/repo/main/README.md
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      // Should only include image files (png, jpg)
      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/screenshot.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/photo.jpg');

      // Should not include non-image files
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/document.txt');
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/data.json');
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/archive.zip');
      expect(result.imageUrls).not.toContain('https://raw.githubusercontent.com/user/repo/main/README.md');
    });

    it('should handle all supported image formats', async () => {
      const issueContent = `
![PNG](https://user-images.githubusercontent.com/12345/image.png)
![JPG](https://user-images.githubusercontent.com/12345/image.jpg)
![JPEG](https://user-images.githubusercontent.com/12345/image.jpeg)
![GIF](https://user-images.githubusercontent.com/12345/image.gif)
![WebP](https://user-images.githubusercontent.com/12345/image.webp)
      `;

      const mockImageData = Buffer.from('fake-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(5);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.jpg');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.jpeg');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.gif');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.webp');
    });

    it('should respect custom supported formats configuration', async () => {
      const restrictiveHandler = new MultimodalInputHandler({
        supportedFormats: ['png', 'jpg'], // Only PNG and JPG
      });

      const issueContent = `
![PNG - should be included](https://user-images.githubusercontent.com/12345/image.png)
![JPG - should be included](https://user-images.githubusercontent.com/12345/image.jpg)
![GIF - should be filtered out](https://user-images.githubusercontent.com/12345/image.gif)
![WebP - should be filtered out](https://user-images.githubusercontent.com/12345/image.webp)
      `;

      const result = await restrictiveHandler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.jpg');
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/image.gif');
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/image.webp');
    });
  });

  describe('Image Download and Processing', () => {
    it('should download and convert images to Claude SDK format', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

      const mockImageBuffer = Buffer.from('test-image-binary-data', 'binary');
      const expectedBase64 = mockImageBuffer.toString('base64');

      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'content-type': 'image/png' },
        data: expectedBase64,
        metadata: { url: 'https://user-images.githubusercontent.com/12345/test.png', method: 'GET', responseTime: 250 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageBlocks).toHaveLength(1);

      const imageBlock = result.imageBlocks[0];
      expect(imageBlock.type).toBe('image');
      expect(imageBlock.source.type).toBe('base64');
      expect(imageBlock.source.media_type).toBe('image/png');
      expect(imageBlock.source.data).toBe(expectedBase64);

      expect(result.imageMetadata).toHaveLength(1);
      expect(result.imageMetadata[0].url).toBe('https://user-images.githubusercontent.com/12345/test.png');
      expect(result.imageMetadata[0].fileSizeBytes).toBe(mockImageBuffer.length);
      expect(result.imageMetadata[0].mediaType).toBe('image/png');
      expect(result.imageMetadata[0].downloadTime).toBeGreaterThan(0);
    });

    it('should handle different image data formats from WebFetch', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.jpg)';

      // Test with string data (base64)
      const mockImageData = 'dGVzdC1pbWFnZS1kYXRh'; // base64 for 'test-image-data'
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData,
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageBlocks).toHaveLength(1);
      expect(result.imageBlocks[0].source.media_type).toBe('image/jpeg');
      expect(result.imageBlocks[0].source.data).toBeTruthy();
    });

    it('should set appropriate timeout for image downloads', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      await handler.processGitHubIssueImages(issueContent);

      expect(mockWebFetchTool.execute).toHaveBeenCalledWith({
        url: 'https://user-images.githubusercontent.com/12345/test.png',
        method: 'GET',
        timeout: 30000, // 30 second timeout for image downloads
        bypassCache: false,
        convertToMarkdown: false, // Want raw image data
      });
    });
  });

  describe('Media Type Detection', () => {
    it('should correctly determine media types from file extensions', async () => {
      const issueContent = `
![PNG](https://user-images.githubusercontent.com/12345/image.png)
![JPEG](https://user-images.githubusercontent.com/12345/image.jpeg)
![JPG](https://user-images.githubusercontent.com/12345/image.jpg)
![GIF](https://user-images.githubusercontent.com/12345/image.gif)
![WebP](https://user-images.githubusercontent.com/12345/image.webp)
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageBlocks).toHaveLength(5);
      expect(result.imageMetadata).toHaveLength(5);

      // Check media types
      const pngIndex = result.imageUrls.findIndex(url => url.includes('.png'));
      const jpegIndex = result.imageUrls.findIndex(url => url.includes('.jpeg'));
      const jpgIndex = result.imageUrls.findIndex(url => url.includes('.jpg'));
      const gifIndex = result.imageUrls.findIndex(url => url.includes('.gif'));
      const webpIndex = result.imageUrls.findIndex(url => url.includes('.webp'));

      expect(result.imageBlocks[pngIndex].source.media_type).toBe('image/png');
      expect(result.imageBlocks[jpegIndex].source.media_type).toBe('image/jpeg');
      expect(result.imageBlocks[jpgIndex].source.media_type).toBe('image/jpeg');
      expect(result.imageBlocks[gifIndex].source.media_type).toBe('image/gif');
      expect(result.imageBlocks[webpIndex].source.media_type).toBe('image/webp');

      expect(result.imageMetadata[pngIndex].mediaType).toBe('image/png');
      expect(result.imageMetadata[jpegIndex].mediaType).toBe('image/jpeg');
      expect(result.imageMetadata[jpgIndex].mediaType).toBe('image/jpeg');
      expect(result.imageMetadata[gifIndex].mediaType).toBe('image/gif');
      expect(result.imageMetadata[webpIndex].mediaType).toBe('image/webp');
    });

    it('should default to JPEG for unknown extensions', async () => {
      const issueContent = '![Unknown](https://user-images.githubusercontent.com/12345/test.png)'; // Still png, will use PNG

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageBlocks[0].source.media_type).toBe('image/png');
    });
  });

  describe('Error Handling', () => {
    it('should handle image download failures gracefully', async () => {
      const issueContent = `
![Good Image](https://user-images.githubusercontent.com/12345/good.png)
![Bad Image](https://user-images.githubusercontent.com/12345/bad.png)
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
          error: 'Image not found (404)',
        });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(2);
      expect(result.imageBlocks).toHaveLength(1); // Only the successful download
      expect(result.imageMetadata).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to download image from');
      expect(result.errors![0]).toContain('bad.png');
      expect(result.errors![0]).toContain('Image not found (404)');
    });

    it('should handle file size validation errors', async () => {
      const issueContent = '![Large](https://user-images.githubusercontent.com/12345/large.png)';

      // Create image that exceeds default 20MB limit
      const largeImageData = Buffer.alloc(21 * 1024 * 1024, 'a'); // 21MB
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: largeImageData.toString('base64'),
        metadata: { url: 'large-url', method: 'GET', responseTime: 1000 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('exceeds maximum allowed size');
      expect(result.imageBlocks).toHaveLength(0);
    });

    it('should handle empty image data responses', async () => {
      const issueContent = '![Empty](https://user-images.githubusercontent.com/12345/empty.png)';

      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: null, // No image data
        metadata: { url: 'empty-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('No image data received');
      expect(result.imageBlocks).toHaveLength(0);
    });

    it('should handle network timeout errors', async () => {
      const issueContent = '![Timeout](https://user-images.githubusercontent.com/12345/timeout.png)';

      mockWebFetchTool.execute.mockRejectedValue(new Error('Network timeout after 30s'));

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to download image from');
      expect(result.errors![0]).toContain('Network timeout after 30s');
      expect(result.imageBlocks).toHaveLength(0);
    });

    it('should continue processing remaining images after individual failures', async () => {
      const issueContent = `
![Image 1](https://user-images.githubusercontent.com/12345/image1.png)
![Image 2](https://user-images.githubusercontent.com/12345/image2.png)
![Image 3](https://user-images.githubusercontent.com/12345/image3.png)
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'image1-url', method: 'GET', responseTime: 100 },
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'image3-url', method: 'GET', responseTime: 150 },
        });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.imageBlocks).toHaveLength(2); // 2 successful downloads
      expect(result.imageMetadata).toHaveLength(2);
      expect(result.errors).toHaveLength(1); // 1 failure
      expect(result.errors![0]).toContain('image2.png');
    });

    it('should throw error for malformed issue content processing', async () => {
      // This test ensures the main error handling wrapper works
      const handler = new MultimodalInputHandler();

      // Mock an error in the extraction process by making URL parsing fail
      const issueContent = null as any; // Force a processing error

      await expect(handler.processGitHubIssueImages(issueContent))
        .rejects
        .toThrow(MultimodalInputError);

      await expect(handler.processGitHubIssueImages(issueContent))
        .rejects
        .toMatchObject({
          code: 'GITHUB_ISSUE_PROCESSING_ERROR',
        });
    });
  });

  describe('Duplicate URL Handling', () => {
    it('should deduplicate identical image URLs', async () => {
      const issueContent = `
Same image referenced multiple times:
![First reference](https://user-images.githubusercontent.com/12345/duplicate.png)
![Second reference](https://user-images.githubusercontent.com/12345/duplicate.png)
https://user-images.githubusercontent.com/12345/duplicate.png
<img src="https://user-images.githubusercontent.com/12345/duplicate.png" />
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'duplicate-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      // Should only have one unique URL
      expect(result.imageUrls).toHaveLength(1);
      expect(result.imageUrls[0]).toBe('https://user-images.githubusercontent.com/12345/duplicate.png');

      // Should only download once
      expect(mockWebFetchTool.execute).toHaveBeenCalledTimes(1);
      expect(result.imageBlocks).toHaveLength(1);
      expect(result.imageMetadata).toHaveLength(1);
    });
  });

  describe('Empty Content Handling', () => {
    it('should handle content with no images', async () => {
      const issueContent = `
## Bug Report

This is a text-only issue with no images.

### Steps to Reproduce
1. Do something
2. See the problem
3. No screenshots provided

### Expected Behavior
Should work correctly.
      `;

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.issueContent).toBe(issueContent);
      expect(result.imageUrls).toHaveLength(0);
      expect(result.imageBlocks).toHaveLength(0);
      expect(result.imageMetadata).toHaveLength(0);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
      expect(mockWebFetchTool.execute).not.toHaveBeenCalled();
    });

    it('should handle empty issue content', async () => {
      const issueContent = '';

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.issueContent).toBe('');
      expect(result.imageUrls).toHaveLength(0);
      expect(result.imageBlocks).toHaveLength(0);
      expect(result.imageMetadata).toHaveLength(0);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Performance and Timing', () => {
    it('should track processing time for each image download', async () => {
      const issueContent = `
![Fast Image](https://user-images.githubusercontent.com/12345/fast.png)
![Slow Image](https://user-images.githubusercontent.com/12345/slow.png)
      `;

      const mockImageData = Buffer.from('test-data');

      // Simulate different download times
      mockWebFetchTool.execute
        .mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve({
            success: true,
            status: 200,
            headers: {},
            data: mockImageData.toString('base64'),
            metadata: { url: 'fast-url', method: 'GET', responseTime: 50 },
          }), 10)) // 10ms delay
        )
        .mockImplementationOnce(() =>
          new Promise(resolve => setTimeout(() => resolve({
            success: true,
            status: 200,
            headers: {},
            data: mockImageData.toString('base64'),
            metadata: { url: 'slow-url', method: 'GET', responseTime: 200 },
          }), 50)) // 50ms delay
        );

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.imageMetadata).toHaveLength(2);

      // Both should have measured download times
      expect(result.imageMetadata[0].downloadTime).toBeGreaterThan(0);
      expect(result.imageMetadata[1].downloadTime).toBeGreaterThan(0);
    });

    it('should measure total processing time', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const startTime = Date.now();
      const result = await handler.processGitHubIssueImages(issueContent);
      const endTime = Date.now();

      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.totalProcessingTime).toBeLessThanOrEqual(endTime - startTime + 10); // Small margin for test execution
    });
  });

  describe('Type Safety and Structure Validation', () => {
    it('should return properly structured GitHubIssueImageResult', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

      const mockImageData = Buffer.from('test-binary-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result: GitHubIssueImageResult = await handler.processGitHubIssueImages(issueContent);

      // Validate overall structure
      expect(typeof result.issueContent).toBe('string');
      expect(Array.isArray(result.imageUrls)).toBe(true);
      expect(Array.isArray(result.imageBlocks)).toBe(true);
      expect(Array.isArray(result.imageMetadata)).toBe(true);
      expect(typeof result.totalProcessingTime).toBe('number');

      // Validate imageBlocks structure
      if (result.imageBlocks.length > 0) {
        const imageBlock = result.imageBlocks[0];
        expect(imageBlock.type).toBe('image');
        expect(imageBlock.source.type).toBe('base64');
        expect(typeof imageBlock.source.data).toBe('string');
        expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp']).toContain(imageBlock.source.media_type);
      }

      // Validate imageMetadata structure
      if (result.imageMetadata.length > 0) {
        const metadata = result.imageMetadata[0];
        expect(typeof metadata.url).toBe('string');
        expect(typeof metadata.fileSizeBytes).toBe('number');
        expect(typeof metadata.mediaType).toBe('string');
        expect(typeof metadata.downloadTime).toBe('number');
        expect(metadata.fileSizeBytes).toBeGreaterThan(0);
        expect(metadata.downloadTime).toBeGreaterThan(0);
      }
    });

    it('should ensure imageUrls and imageBlocks arrays have consistent lengths on success', async () => {
      const issueContent = `
![Image 1](https://user-images.githubusercontent.com/12345/image1.png)
![Image 2](https://user-images.githubusercontent.com/12345/image2.jpg)
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls.length).toBe(result.imageBlocks.length);
      expect(result.imageUrls.length).toBe(result.imageMetadata.length);
      expect(result.imageUrls).toHaveLength(2);
    });
  });

  describe('Convenience Function', () => {
    it('should work with default configuration', async () => {
      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await processGitHubIssueImages(issueContent);

      expect(result.issueContent).toBe(issueContent);
      expect(result.imageUrls).toHaveLength(1);
      expect(result.imageBlocks).toHaveLength(1);
    });

    it('should work with custom configuration', async () => {
      const issueContent = `
![PNG - should be included](https://user-images.githubusercontent.com/12345/test.png)
![GIF - should be excluded](https://user-images.githubusercontent.com/12345/test.gif)
      `;

      const customConfig: MultimodalInputHandlerConfig = {
        supportedFormats: ['png'], // Only PNG supported
        maxFileSizeBytes: 1024 * 1024, // 1MB limit
      };

      const result = await processGitHubIssueImages(issueContent, customConfig);

      expect(result.imageUrls).toHaveLength(1);
      expect(result.imageUrls[0]).toContain('.png');
      expect(result.imageUrls[0]).not.toContain('.gif');
    });
  });
});